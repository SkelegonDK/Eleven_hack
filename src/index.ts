import { serve } from "bun";
import index from "./index.html";
import plugin from "bun-plugin-tailwind";
import { createClerkClient } from "@clerk/backend";
import { Webhook } from "svix";
import { getAgentForMode, getConversationToken } from "./api/agents";
import { checkUsage, recordUsage } from "./api/usage";
import { syncClerkPlan } from "./api/billing";
import {
  uploadDocument,
  getDocument,
  deleteDocument,
  listDocuments,
  parseDocumentContent
} from "./api/knowledgebase";

const port = Number(process.env.PORT ?? 3000);
const hostname = process.env.HOST ?? "127.0.0.1";

// Get the Clerk publishable key
const clerkPublishableKey = process.env.VITE_PUBLIC_CLERK_PUBLISHABLE_KEY || "";
const convexUrl = process.env.CONVEX_URL || "";

if (!clerkPublishableKey) {
  console.warn("Warning: Clerk publishable key not found. Set VITE_PUBLIC_CLERK_PUBLISHABLE_KEY in your .env.local or .env file.");
}

if (!convexUrl) {
  console.warn("Warning: Convex URL not found. Set CONVEX_URL in your .env file.");
}

// Clerk server-side client for auth verification
const clerkSecretKey = process.env.CLERK_SECRET_KEY || "";
const clerkClient = clerkSecretKey
  ? createClerkClient({ secretKey: clerkSecretKey, publishableKey: clerkPublishableKey })
  : null;

if (!clerkSecretKey) {
  console.warn("Warning: CLERK_SECRET_KEY not found. API routes will not be authenticated.");
}

/** Authenticate a request using Clerk. Returns userId or null. */
async function authenticateRequest(req: Request): Promise<string | null> {
  if (!clerkClient) return null;

  try {
    const { isSignedIn, toAuth } = await clerkClient.authenticateRequest(req, {
      publishableKey: clerkPublishableKey,
      secretKey: clerkSecretKey,
    });

    if (!isSignedIn) return null;

    const auth = toAuth();
    return auth?.userId ?? null;
  } catch (error) {
    console.error("Auth error:", error);
    return null;
  }
}

/** Middleware: require auth and return 401 if not authenticated */
async function requireAuth(req: Request): Promise<{ userId: string } | Response> {
  const userId = await authenticateRequest(req);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return { userId };
}

// Cache the HTML template at startup
const htmlFile = Bun.file("./src/index.html");
const htmlTemplate = await htmlFile.text();

const server = serve({
  port,
  hostname,
  routes: {
    // API routes must be defined BEFORE the catch-all route
    // Get agent ID for the selected mode (requires auth)
    "/api/agents": {
      async POST(req) {
        const auth = await requireAuth(req);
        if (auth instanceof Response) return auth;

        try {
          const body = await req.json();
          const result = await getAgentForMode(body);
          return Response.json(result);
        } catch (error) {
          console.error("Error getting agent:", error);
          return Response.json(
            { error: error instanceof Error ? error.message : "Failed to get agent" },
            { status: 500 }
          );
        }
      },
    },

    // Get conversation token for WebRTC (requires auth + usage check)
    "/api/agents/:agentId/conversation-token": {
      async GET(req) {
        const auth = await requireAuth(req);
        if (auth instanceof Response) return auth;

        try {
          // Check usage limits before issuing a token
          const usage = await checkUsage(auth.userId);
          if (!usage.allowed) {
            return Response.json(
              { error: usage.message, usage },
              { status: 403 }
            );
          }

          const agentId = req.params.agentId;
          const token = await getConversationToken(agentId);
          return Response.json({ token, usage });
        } catch (error) {
          console.error("Error getting conversation token:", error);
          return Response.json(
            { error: error instanceof Error ? error.message : "Failed to get conversation token" },
            { status: 500 }
          );
        }
      },
    },

    // Get current usage for the authenticated user
    "/api/usage": {
      async GET(req) {
        const auth = await requireAuth(req);
        if (auth instanceof Response) return auth;

        try {
          const usage = await checkUsage(auth.userId);
          return Response.json(usage);
        } catch (error) {
          console.error("Error checking usage:", error);
          return Response.json(
            { error: "Failed to check usage" },
            { status: 500 }
          );
        }
      },
    },

    // Record conversation duration (called by client on disconnect)
    "/api/usage/record": {
      async POST(req) {
        const auth = await requireAuth(req);
        if (auth instanceof Response) return auth;

        try {
          const body = await req.json();
          const { durationSeconds, mode, agentId } = body;

          if (typeof durationSeconds !== "number" || durationSeconds <= 0) {
            return Response.json(
              { error: "Invalid duration" },
              { status: 400 }
            );
          }

          await recordUsage(auth.userId, durationSeconds, mode, agentId);
          return Response.json({ success: true });
        } catch (error) {
          console.error("Error recording usage:", error);
          return Response.json(
            { error: "Failed to record usage" },
            { status: 500 }
          );
        }
      },
    },

    // Clerk billing webhook (public, validated by Svix signature)
    "/api/webhooks/clerk": {
      async POST(req) {
        try {
          const clerkWebhookSecret = process.env.CLERK_WEBHOOK_SECRET;
          if (!clerkWebhookSecret) {
            console.error("CLERK_WEBHOOK_SECRET not configured");
            return Response.json({ error: "Webhook not configured" }, { status: 500 });
          }

          // Verify webhook signature using Svix
          const svixId = req.headers.get("svix-id");
          const svixTimestamp = req.headers.get("svix-timestamp");
          const svixSignature = req.headers.get("svix-signature");

          if (!svixId || !svixTimestamp || !svixSignature) {
            return Response.json({ error: "Missing Svix headers" }, { status: 400 });
          }

          const rawBody = await req.text();

          const wh = new Webhook(clerkWebhookSecret);
          let evt: any;
          try {
            evt = wh.verify(rawBody, {
              "svix-id": svixId,
              "svix-timestamp": svixTimestamp,
              "svix-signature": svixSignature,
            });
          } catch (err) {
            console.error("Clerk webhook signature verification failed:", err);
            return Response.json({ error: "Invalid signature" }, { status: 401 });
          }

          const eventType = evt.type as string;
          console.log(`Clerk webhook: ${eventType}`);

          // Handle billing subscription events
          if (eventType.startsWith("subscriptionItem.")) {
            const data = evt.data;
            // Extract user ID — Clerk webhooks include payer info on subscription items
            const clerkUserId = data?.subscription?.payer?.user_id;
            const planSlug = data?.plan?.slug || data?.plan?.name;
            const isActive = eventType === "subscriptionItem.active";
            const isCanceled = ["subscriptionItem.canceled", "subscriptionItem.ended"].includes(eventType);

            if (clerkUserId) {
              if (isCanceled) {
                await syncClerkPlan(clerkUserId, null, false);
              } else if (isActive && planSlug) {
                await syncClerkPlan(clerkUserId, planSlug, true);
              }
            }
          }

          return Response.json({ received: true });
        } catch (error) {
          console.error("Clerk webhook error:", error);
          return Response.json({ error: "Webhook processing failed" }, { status: 500 });
        }
      },
    },

    // ElevenLabs post-call webhook (public, validated by secret)
    "/api/webhooks/elevenlabs": {
      async POST(req) {
        try {
          const webhookSecret = process.env.ELEVENLABS_WEBHOOK_SECRET;
          if (!webhookSecret) {
            console.error("ELEVENLABS_WEBHOOK_SECRET not configured");
            return Response.json({ error: "Webhook not configured" }, { status: 500 });
          }

          // TODO: Validate HMAC signature from ElevenLabs-Signature header
          // For now, accept all requests (add signature validation when ElevenLabs
          // provides documentation on their webhook signature format)

          const body = await req.json();
          console.log("ElevenLabs webhook received:", JSON.stringify(body).slice(0, 200));

          // Extract conversation data from webhook payload
          // The exact shape depends on ElevenLabs webhook format
          const { conversation_id, agent_id, duration_seconds, metadata } = body;

          if (metadata?.clerk_id && duration_seconds) {
            await recordUsage(metadata.clerk_id, duration_seconds, metadata.mode || "unknown", agent_id || "unknown");
          }

          return Response.json({ received: true });
        } catch (error) {
          console.error("Webhook error:", error);
          return Response.json({ error: "Webhook processing failed" }, { status: 500 });
        }
      },
    },

    // Health check (public)
    "/api/health": {
      GET() {
        return Response.json({ status: "ok" });
      },
    },

    // Knowledgebase endpoints (requires auth)
    "/api/documents": {
      async GET(req) {
        const auth = await requireAuth(req);
        if (auth instanceof Response) return auth;

        try {
          const docs = await listDocuments();
          return Response.json({ documents: docs });
        } catch (error) {
          console.error("Error listing documents:", error);
          return Response.json(
            { error: "Failed to list documents" },
            { status: 500 }
          );
        }
      },
      async POST(req) {
        const auth = await requireAuth(req);
        if (auth instanceof Response) return auth;

        try {
          const formData = await req.formData();
          const file = formData.get("file") as File | null;

          if (!file) {
            return Response.json(
              { error: "No file provided" },
              { status: 400 }
            );
          }

          const content = await parseDocumentContent(file);
          const result = await uploadDocument({
            name: file.name,
            content,
          });

          return Response.json(result);
        } catch (error) {
          console.error("Error uploading document:", error);
          return Response.json(
            { error: "Failed to upload document" },
            { status: 500 }
          );
        }
      },
    },

    "/api/documents/:id": {
      async GET(req) {
        const auth = await requireAuth(req);
        if (auth instanceof Response) return auth;

        try {
          const doc = await getDocument(req.params.id);
          if (!doc) {
            return Response.json(
              { error: "Document not found" },
              { status: 404 }
            );
          }
          return Response.json(doc);
        } catch (error) {
          console.error("Error getting document:", error);
          return Response.json(
            { error: "Failed to get document" },
            { status: 500 }
          );
        }
      },
      async DELETE(req) {
        const auth = await requireAuth(req);
        if (auth instanceof Response) return auth;

        try {
          const deleted = await deleteDocument(req.params.id);
          if (!deleted) {
            return Response.json(
              { error: "Document not found" },
              { status: 404 }
            );
          }
          return Response.json({ success: true });
        } catch (error) {
          console.error("Error deleting document:", error);
          return Response.json(
            { error: "Failed to delete document" },
            { status: 500 }
          );
        }
      },
    },

    // Handle TypeScript/TSX files - Bun needs to transpile these
    "/frontend.tsx": async () => {
      try {
        // Use Bun's transpiler to convert TSX to JavaScript
        const file = Bun.file("./src/frontend.tsx");
        if (!(await file.exists())) {
          return new Response("File not found", { status: 404 });
        }

        // Transpile the file with environment variable injection
        const result = await Bun.build({
          entrypoints: ["./src/frontend.tsx"],
          plugins: [plugin],
          target: "browser",
          format: "esm",
          minify: false,
          sourcemap: "inline",
          define: {
            "import.meta.env.VITE_PUBLIC_CLERK_PUBLISHABLE_KEY": JSON.stringify(clerkPublishableKey),
            "import.meta.env.VITE_CONVEX_URL": JSON.stringify(convexUrl),
          },
        });

        if (!result.success) {
          console.error("Transpilation errors:", result.logs);
          return new Response("Transpilation failed", { status: 500 });
        }

        // Find JS and CSS outputs
        const jsOutput = result.outputs.find(output => output.kind === "entry-point" || output.path.endsWith(".js"));
        const cssOutput = result.outputs.find(output => output.kind === "asset" && output.path.endsWith(".css"));

        if (!jsOutput) {
          return new Response("No JavaScript output from transpilation", { status: 500 });
        }

        let transpiledCode = await jsOutput.text();

        // If there's a CSS output, inject it into the JS bundle
        if (cssOutput) {
          const cssContent = await cssOutput.text();
          // Inject CSS by creating a style tag injection at the start of the module
          transpiledCode = `const style = document.createElement('style'); style.textContent = ${JSON.stringify(cssContent)}; document.head.appendChild(style);\n${transpiledCode}`;
        }

        return new Response(transpiledCode, {
          headers: {
            "Content-Type": "application/javascript",
            "Cache-Control": "no-cache",
          },
        });
      } catch (error) {
        console.error("Error serving frontend.tsx:", error);
        return new Response("Internal server error", { status: 500 });
      }
    },

    // Serve index.html for all unmatched routes
    // This catch-all route must be LAST so API routes are matched first
    "/*": async (req) => {
      const url = new URL(req.url);
      const pathname = url.pathname;

      // Handle static assets (images, fonts, etc.)
      const staticExtensions = ['.svg', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.css'];
      const isStaticAsset = staticExtensions.some(ext => pathname.endsWith(ext));

      if (isStaticAsset) {
        // Try to find the file in common locations
        const filePaths = [
          `src${pathname}`,
          `.${pathname}`,
          pathname.slice(1),
        ];

        for (const filePath of filePaths) {
          const file = Bun.file(filePath);
          if (await file.exists()) {
            return new Response(file);
          }
        }

        return new Response("File not found", { status: 404 });
      }

      // Serve the HTML template (Clerk key is injected via Bun.build define option)
      return new Response(htmlTemplate, {
        headers: { "Content-Type": "text/html" },
      });
    },
  },

  development: process.env.NODE_ENV !== "production" && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true,
  },
});

console.log(`PODU server running at ${server.url}`);
