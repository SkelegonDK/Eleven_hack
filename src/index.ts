import { serve } from "bun";
import index from "./index.html";
import { createAgent, getSignedUrl } from "./api/agents";
import { 
  uploadDocument, 
  getDocument, 
  deleteDocument, 
  listDocuments,
  parseDocumentContent 
} from "./api/knowledgebase";

const server = serve({
  routes: {
    // Serve index.html for all unmatched routes.
    "/*": index,

    // Create a new conversational agent
    "/api/agents": {
      async POST(req) {
        try {
          const body = await req.json();
          const result = await createAgent(body);
          return Response.json(result);
        } catch (error) {
          console.error("Error creating agent:", error);
          return Response.json(
            { error: error instanceof Error ? error.message : "Failed to create agent" },
            { status: 500 }
          );
        }
      },
    },

    // Get signed URL for conversation
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
  },

  development: process.env.NODE_ENV !== "production" && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true,
  },
});

console.log(`🎙️ PODU server running at ${server.url}`);
