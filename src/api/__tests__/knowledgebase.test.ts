import { describe, it, expect, beforeEach } from "bun:test";
import {
  uploadDocument,
  getDocument,
  deleteDocument,
  listDocuments,
  getDocumentsContext,
  parseDocumentContent,
} from "../knowledgebase";

// Clean up all documents before each test
beforeEach(async () => {
  const docs = await listDocuments();
  for (const doc of docs) {
    await deleteDocument(doc.id);
  }
});

describe("uploadDocument", () => {
  it("stores document and returns metadata", async () => {
    const result = await uploadDocument({ name: "test.txt", content: "Hello world" });

    expect(result.id).toBeTruthy();
    expect(result.id).toStartWith("doc-");
    expect(result.name).toBe("test.txt");
    expect(result.uploadedAt).toBeTruthy();
  });

  it("generates unique IDs for each document", async () => {
    const doc1 = await uploadDocument({ name: "a.txt", content: "A" });
    const doc2 = await uploadDocument({ name: "b.txt", content: "B" });

    expect(doc1.id).not.toBe(doc2.id);
  });
});

describe("getDocument", () => {
  it("retrieves a stored document by ID", async () => {
    const uploaded = await uploadDocument({ name: "test.txt", content: "Content here" });
    const doc = await getDocument(uploaded.id);

    expect(doc).not.toBeNull();
    expect(doc!.id).toBe(uploaded.id);
    expect(doc!.name).toBe("test.txt");
    expect(doc!.content).toBe("Content here");
  });

  it("returns null for non-existent ID", async () => {
    const doc = await getDocument("doc-nonexistent");
    expect(doc).toBeNull();
  });
});

describe("deleteDocument", () => {
  it("removes document and returns true", async () => {
    const uploaded = await uploadDocument({ name: "test.txt", content: "Content" });
    const deleted = await deleteDocument(uploaded.id);

    expect(deleted).toBe(true);

    const doc = await getDocument(uploaded.id);
    expect(doc).toBeNull();
  });

  it("returns false for non-existent ID", async () => {
    const deleted = await deleteDocument("doc-nonexistent");
    expect(deleted).toBe(false);
  });
});

describe("listDocuments", () => {
  it("returns all documents without content", async () => {
    await uploadDocument({ name: "a.txt", content: "Content A" });
    await uploadDocument({ name: "b.txt", content: "Content B" });

    const docs = await listDocuments();

    expect(docs).toHaveLength(2);
    expect(docs[0]!.name).toBeTruthy();
    expect(docs[1]!.name).toBeTruthy();
    // Should NOT include content field
    expect((docs[0] as any).content).toBeUndefined();
    expect((docs[1] as any).content).toBeUndefined();
  });

  it("returns empty array when no documents exist", async () => {
    const docs = await listDocuments();
    expect(docs).toHaveLength(0);
  });
});

describe("getDocumentsContext", () => {
  it("returns empty string when no documents exist", () => {
    const context = getDocumentsContext();
    expect(context).toBe("");
  });

  it("includes all document names and content", async () => {
    await uploadDocument({ name: "notes.txt", content: "Some notes" });
    await uploadDocument({ name: "research.md", content: "Research data" });

    const context = getDocumentsContext();

    expect(context).toContain("reference documents");
    expect(context).toContain("notes.txt");
    expect(context).toContain("Some notes");
    expect(context).toContain("research.md");
    expect(context).toContain("Research data");
  });

  it("formats documents with separators", async () => {
    await uploadDocument({ name: "doc1.txt", content: "First" });

    const context = getDocumentsContext();
    expect(context).toContain("--- Document: doc1.txt ---");
  });
});

describe("parseDocumentContent", () => {
  it("handles .txt files", async () => {
    const file = new File(["Hello, text file!"], "test.txt", { type: "text/plain" });
    const content = await parseDocumentContent(file);
    expect(content).toBe("Hello, text file!");
  });

  it("handles .md files", async () => {
    const file = new File(["# Markdown heading"], "readme.md", { type: "text/markdown" });
    const content = await parseDocumentContent(file);
    expect(content).toBe("# Markdown heading");
  });

  it("returns placeholder for .pdf files", async () => {
    const file = new File(["fake pdf"], "document.pdf", { type: "application/pdf" });
    const content = await parseDocumentContent(file);
    expect(content).toContain("PDF");
    expect(content).toContain("document.pdf");
    expect(content).toContain("not yet implemented");
  });

  it("returns placeholder for .docx files", async () => {
    const file = new File(["fake docx"], "report.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    const content = await parseDocumentContent(file);
    expect(content).toContain("Word");
    expect(content).toContain("report.docx");
    expect(content).toContain("not yet implemented");
  });

  it("handles unknown extensions as text", async () => {
    const file = new File(["arbitrary content"], "data.csv", { type: "text/csv" });
    const content = await parseDocumentContent(file);
    expect(content).toBe("arbitrary content");
  });
});
