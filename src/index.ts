import { serve } from "bun";
import plugin from "bun-plugin-tailwind";
import { getAgentForMode, getConversationToken } from "./api/agents";
import {
  uploadDocument,
  getDocument,
  deleteDocument,
  listDocuments,
  parseDocumentContent,
} from "./api/knowledgebase";
import {
  getConfigStatus,
  handleSetApiKey,
  handleClearApiKey,
  resolveApiKey,
} from "./api/config";
import { readSession } from "./lib/session";
import { route } from "./lib/httpRoute";

const port = Number(process.env.PORT ?? 3000);
const hostname = process.env.HOST ?? "127.0.0.1";

if (!process.env.ELEVENLABS_API_KEY) {
  console.warn(
    "Note: ELEVENLABS_API_KEY not set in env. Users can enter their key in the app Settings panel instead.",
  );
}

const htmlFile = Bun.file("./src/index.html");
const htmlTemplate = await htmlFile.text();

const server = serve({
  port,
  hostname,
  routes: {
    "/api/config": {
      GET: route("load config", (req) => getConfigStatus(req)),
      POST: route("set API key", (req) => handleSetApiKey(req)),
      DELETE: route("clear API key", () => handleClearApiKey()),
    },

    "/api/agents": {
      POST: route("get agent", async (req) => {
        const body = await req.json();
        return getAgentForMode(body);
      }),
    },

    "/api/agents/:agentId/conversation-token": {
      GET: route<"/api/agents/:agentId/conversation-token">(
        "get conversation token",
        async (req) => {
          const session = await readSession(req);
          const apiKey = resolveApiKey(session);
          const token = await getConversationToken(req.params.agentId, apiKey);
          return { token };
        },
      ),
    },

    "/api/health": {
      GET: route("check health", () => ({ status: "ok" })),
    },

    "/api/documents": {
      GET: route("list documents", async () => {
        const docs = await listDocuments();
        return { documents: docs };
      }),
      POST: route("upload document", async (req) => {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
          return Response.json({ error: "No file provided" }, { status: 400 });
        }

        const content = await parseDocumentContent(file);
        return uploadDocument({ name: file.name, content });
      }),
    },

    "/api/documents/:id": {
      GET: route<"/api/documents/:id">("get document", async (req) => {
        const doc = await getDocument(req.params.id);
        if (!doc) return Response.json({ error: "Document not found" }, { status: 404 });
        return doc;
      }),
      DELETE: route<"/api/documents/:id">("delete document", async (req) => {
        const deleted = await deleteDocument(req.params.id);
        if (!deleted) return Response.json({ error: "Document not found" }, { status: 404 });
        return { success: true };
      }),
    },

    "/frontend.tsx": async () => {
      try {
        const file = Bun.file("./src/frontend.tsx");
        if (!(await file.exists())) {
          return new Response("File not found", { status: 404 });
        }

        const result = await Bun.build({
          entrypoints: ["./src/frontend.tsx"],
          plugins: [plugin],
          target: "browser",
          format: "esm",
          minify: false,
          sourcemap: "inline",
        });

        if (!result.success) {
          console.error("Transpilation errors:", result.logs);
          return new Response("Transpilation failed", { status: 500 });
        }

        const jsOutput = result.outputs.find(
          (output) => output.kind === "entry-point" || output.path.endsWith(".js"),
        );
        const cssOutput = result.outputs.find(
          (output) => output.kind === "asset" && output.path.endsWith(".css"),
        );

        if (!jsOutput) {
          return new Response("No JavaScript output from transpilation", { status: 500 });
        }

        let transpiledCode = await jsOutput.text();

        if (cssOutput) {
          const cssContent = await cssOutput.text();
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

    "/*": async (req) => {
      const url = new URL(req.url);
      const pathname = url.pathname;

      const staticExtensions = [
        ".svg", ".png", ".jpg", ".jpeg", ".gif", ".ico",
        ".woff", ".woff2", ".ttf", ".eot", ".css",
      ];
      const isStaticAsset = staticExtensions.some((ext) => pathname.endsWith(ext));

      if (isStaticAsset) {
        const filePaths = [`src${pathname}`, `.${pathname}`, pathname.slice(1)];
        for (const filePath of filePaths) {
          const file = Bun.file(filePath);
          if (await file.exists()) return new Response(file);
        }
        return new Response("File not found", { status: 404 });
      }

      return new Response(htmlTemplate, {
        headers: { "Content-Type": "text/html" },
      });
    },
  },

  development: process.env.NODE_ENV !== "production" && {
    hmr: true,
    console: true,
  },
});

console.log(`PODU server running at ${server.url}`);
