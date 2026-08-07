import { describe, it, expect, beforeEach } from "bun:test";
import {
  saveDocument,
  getDocument,
  deleteDocument,
  listDocuments,
  loadDocumentsForPrompt,
  renderDocumentsContext,
  parseDocument,
  SUPPORTED_EXTENSIONS,
  type StoredDocument,
} from "../knowledgebase";

// These tests run against the real bun:sqlite layer, pointed at :memory: by
// src/test-setup.ts. The database is per-process, so rows survive between
// tests unless cleared here.
beforeEach(() => {
  for (const doc of listDocuments()) {
    deleteDocument(doc.id);
  }
});

function doc(overrides: Partial<StoredDocument> = {}): StoredDocument {
  return {
    id: "d1",
    name: "test.txt",
    content: "Test document content",
    uploadedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("saveDocument", () => {
  it("stores the document and returns its metadata", () => {
    const result = saveDocument({ name: "test.txt", content: "Hello world" });

    expect(result.id).toStartWith("doc-");
    expect(result.name).toBe("test.txt");
    expect(result.uploadedAt).toBeTruthy();
  });

  it("records uploadedAt as a valid ISO-8601 timestamp", () => {
    const result = saveDocument({ name: "test.txt", content: "Hello" });

    expect(result.uploadedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(new Date(result.uploadedAt).toISOString()).toBe(result.uploadedAt);
  });

  it("generates unique IDs for each document", () => {
    const first = saveDocument({ name: "a.txt", content: "A" });
    const second = saveDocument({ name: "b.txt", content: "B" });

    expect(first.id).not.toBe(second.id);
  });
});

describe("getDocument", () => {
  it("round-trips a saved document through the database", () => {
    const saved = saveDocument({ name: "test.txt", content: "Content here" });
    const found = getDocument(saved.id);

    expect(found).not.toBeNull();
    expect(found!.id).toBe(saved.id);
    expect(found!.name).toBe("test.txt");
    expect(found!.content).toBe("Content here");
    expect(found!.uploadedAt).toBe(saved.uploadedAt);
  });

  it("returns null for a non-existent ID", () => {
    expect(getDocument("doc-nonexistent")).toBeNull();
  });
});

describe("deleteDocument", () => {
  it("removes the document and reports true", () => {
    const saved = saveDocument({ name: "test.txt", content: "Content" });

    expect(deleteDocument(saved.id)).toBe(true);
    expect(getDocument(saved.id)).toBeNull();
  });

  it("reports false for a non-existent ID", () => {
    expect(deleteDocument("doc-nonexistent")).toBe(false);
  });
});

describe("listDocuments", () => {
  it("returns metadata for every stored document", () => {
    saveDocument({ name: "a.txt", content: "Content A" });
    saveDocument({ name: "b.txt", content: "Content B" });

    const docs = listDocuments();

    expect(docs).toHaveLength(2);
    expect(docs.map((d) => d.name).sort()).toEqual(["a.txt", "b.txt"]);
  });

  it("never includes document content", () => {
    saveDocument({ name: "a.txt", content: "Secret body" });

    const docs = listDocuments();

    expect(docs[0]).not.toHaveProperty("content");
    expect(JSON.stringify(docs)).not.toContain("Secret body");
  });

  it("returns an empty array when no documents exist", () => {
    expect(listDocuments()).toHaveLength(0);
  });
});

describe("loadDocumentsForPrompt", () => {
  it("returns full documents including content", () => {
    saveDocument({ name: "notes.txt", content: "Some notes" });

    const docs = loadDocumentsForPrompt();

    expect(docs).toHaveLength(1);
    expect(docs[0]!.name).toBe("notes.txt");
    expect(docs[0]!.content).toBe("Some notes");
  });

  it("returns an empty array when no documents exist", () => {
    expect(loadDocumentsForPrompt()).toEqual([]);
  });
});

describe("renderDocumentsContext", () => {
  it("returns an empty string for an empty library", () => {
    expect(renderDocumentsContext([])).toBe("");
  });

  it("includes every document's name and content", () => {
    const context = renderDocumentsContext([
      doc({ id: "d1", name: "notes.txt", content: "Some notes" }),
      doc({ id: "d2", name: "research.md", content: "Research data" }),
    ]);

    expect(context).toContain("reference documents");
    expect(context).toContain("notes.txt");
    expect(context).toContain("Some notes");
    expect(context).toContain("research.md");
    expect(context).toContain("Research data");
  });

  it("formats documents with separators", () => {
    const context = renderDocumentsContext([doc({ name: "doc1.txt", content: "First" })]);
    expect(context).toContain("--- Document: doc1.txt ---");
  });

  it("is pure — it reads nothing from storage", () => {
    saveDocument({ name: "stored.txt", content: "Stored body" });

    expect(renderDocumentsContext([])).toBe("");
  });
});

describe("parseDocument", () => {
  it("reads .txt files", async () => {
    const file = new File(["Hello, text file!"], "test.txt", { type: "text/plain" });
    const result = await parseDocument(file);

    expect(result.ok).toBe(true);
    expect(result).toMatchObject({ ok: true, name: "test.txt", content: "Hello, text file!" });
  });

  it("reads .md files", async () => {
    const file = new File(["# Markdown heading"], "readme.md", { type: "text/markdown" });
    const result = await parseDocument(file);

    expect(result).toMatchObject({ ok: true, name: "readme.md", content: "# Markdown heading" });
  });

  it("is case-insensitive about the extension", async () => {
    const file = new File(["Shouty"], "NOTES.TXT", { type: "text/plain" });
    const result = await parseDocument(file);

    expect(result.ok).toBe(true);
  });

  it("rejects .pdf files as an unsupported type", async () => {
    const file = new File(["fake pdf"], "document.pdf", { type: "application/pdf" });
    const result = await parseDocument(file);

    expect(result).toEqual({
      ok: false,
      name: "document.pdf",
      reason: "unsupported_type",
      extension: "pdf",
      supported: SUPPORTED_EXTENSIONS,
    });
  });

  it("rejects .docx files as an unsupported type", async () => {
    const file = new File(["fake docx"], "report.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    const result = await parseDocument(file);

    expect(result).toMatchObject({ ok: false, reason: "unsupported_type", extension: "docx" });
  });

  it("rejects unknown extensions instead of reading them as text", async () => {
    const file = new File(["arbitrary content"], "data.csv", { type: "text/csv" });
    const result = await parseDocument(file);

    expect(result).toMatchObject({ ok: false, reason: "unsupported_type", extension: "csv" });
  });

  it("rejects a file with no extension", async () => {
    const file = new File(["plain"], "README", { type: "text/plain" });
    const result = await parseDocument(file);

    expect(result).toMatchObject({ ok: false, reason: "unsupported_type", extension: "" });
  });

  it("rejects an empty file", async () => {
    const file = new File([""], "empty.txt", { type: "text/plain" });
    const result = await parseDocument(file);

    expect(result).toEqual({ ok: false, name: "empty.txt", reason: "empty_file" });
  });

  it("rejects a nameless file as empty (Bun drops the filename on a zero-byte part)", async () => {
    const nameless = {
      name: undefined,
      text: async () => "",
    } as unknown as File;

    expect(await parseDocument(nameless)).toMatchObject({ ok: false, reason: "empty_file" });
  });

  it("rejects a whitespace-only file", async () => {
    const file = new File(["   \n\t  "], "blank.md", { type: "text/markdown" });
    const result = await parseDocument(file);

    expect(result).toMatchObject({ ok: false, reason: "empty_file" });
  });
});

describe("parse → save → prompt", () => {
  it("carries an uploaded file's content all the way into the prompt fragment", async () => {
    const file = new File(["Round trip body"], "round-trip.md", { type: "text/markdown" });
    const parsed = await parseDocument(file);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    saveDocument({ name: parsed.name, content: parsed.content });
    const context = renderDocumentsContext(loadDocumentsForPrompt());

    expect(context).toContain("--- Document: round-trip.md ---");
    expect(context).toContain("Round trip body");
  });
});
