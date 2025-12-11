// Knowledgebase management for ElevenLabs agents
// This handles document upload and management for the conversation context

export interface Document {
  id: string;
  name: string;
  content: string;
  uploadedAt: string;
}

// In-memory storage for documents (in production, use a database)
const documents = new Map<string, Document>();

export interface UploadDocumentRequest {
  name: string;
  content: string;
}

export interface UploadDocumentResponse {
  id: string;
  name: string;
  uploadedAt: string;
}

export async function uploadDocument(request: UploadDocumentRequest): Promise<UploadDocumentResponse> {
  const id = `doc-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  
  const document: Document = {
    id,
    name: request.name,
    content: request.content,
    uploadedAt: new Date().toISOString(),
  };
  
  documents.set(id, document);
  
  return {
    id: document.id,
    name: document.name,
    uploadedAt: document.uploadedAt,
  };
}

export async function getDocument(id: string): Promise<Document | null> {
  return documents.get(id) || null;
}

export async function deleteDocument(id: string): Promise<boolean> {
  return documents.delete(id);
}

export async function listDocuments(): Promise<Omit<Document, "content">[]> {
  return Array.from(documents.values()).map(({ id, name, uploadedAt }) => ({
    id,
    name,
    uploadedAt,
  }));
}

export function getDocumentsContext(): string {
  if (documents.size === 0) {
    return "";
  }
  
  const docsContent = Array.from(documents.values())
    .map(doc => `--- Document: ${doc.name} ---\n${doc.content}`)
    .join("\n\n");
  
  return `\n\nYou have access to the following reference documents that the user has uploaded. Use this information to provide more informed and contextual responses:\n\n${docsContent}`;
}

// Parse various document formats to extract text
export async function parseDocumentContent(
  file: File
): Promise<string> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  
  if (extension === "txt" || extension === "md") {
    return await file.text();
  }
  
  if (extension === "pdf") {
    // For PDF parsing, we'd need a library like pdf-parse
    // For now, return a placeholder
    return `[PDF content from ${file.name} - PDF parsing not yet implemented]`;
  }
  
  if (extension === "doc" || extension === "docx") {
    // For Word docs, we'd need a library like mammoth
    return `[Word document content from ${file.name} - Word parsing not yet implemented]`;
  }
  
  return await file.text();
}

