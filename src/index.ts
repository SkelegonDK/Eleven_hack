import { serve } from "bun";
import index from "./index.html";
import plugin from "bun-plugin-tailwind";
import { getAgentForMode, getSignedUrl, getConversationToken } from "./api/agents";
import { 
  uploadDocument, 
  getDocument, 
  deleteDocument, 
  listDocuments,
  parseDocumentContent 
} from "./api/knowledgebase";

const port = Number(process.env.PORT ?? 3000);
const hostname = process.env.HOST ?? "127.0.0.1";

// Get the Clerk publishable key (official Clerk pattern uses VITE_ prefix)
const clerkPublishableKey = process.env.VITE_CLERK_PUBLISHABLE_KEY || "";

if (!clerkPublishableKey) {
  console.warn("Warning: Clerk publishable key not found. Set VITE_CLERK_PUBLISHABLE_KEY in your .env.local or .env file.");
}

// Cache the HTML template at startup
const htmlFile = Bun.file("./src/index.html");
const htmlTemplate = await htmlFile.text();

const server = serve({
  port,
  hostname,
  routes: {
    // API routes must be defined BEFORE the catch-all route
    // Get agent ID for the selected mode
    "/api/agents": {
      async POST(req) {
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

    // Get signed URL for conversation (WebSocket)
    "/api/agents/:agentId/signed-url": {
      async GET(req) {
        try {
          const agentId = req.params.agentId;
          const signedUrl = await getSignedUrl(agentId);
          return Response.json({ signedUrl });
        } catch (error) {
          console.error("Error getting signed URL:", error);
          return Response.json(
            { error: error instanceof Error ? error.message : "Failed to get signed URL" },
            { status: 500 }
          );
        }
      },
    },

    // Get conversation token for WebRTC
    "/api/agents/:agentId/conversation-token": {
      async GET(req) {
        try {
          const agentId = req.params.agentId;
          const token = await getConversationToken(agentId);
          return Response.json({ token });
        } catch (error) {
          console.error("Error getting conversation token:", error);
          return Response.json(
            { error: error instanceof Error ? error.message : "Failed to get conversation token" },
            { status: 500 }
          );
        }
      },
    },

    // Health check
    "/api/health": {
      GET() {
        return Response.json({ status: "ok" });
      },
    },

    // Knowledgebase endpoints
    "/api/documents": {
      async GET() {
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
            "import.meta.env.VITE_CLERK_PUBLISHABLE_KEY": JSON.stringify(clerkPublishableKey),
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

console.log(`🎙️ PODU server running at ${server.url}`);
