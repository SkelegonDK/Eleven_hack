/**
 * Document knowledgebase: parse an uploaded file, store it, and render the
 * stored documents into the slice of system prompt the agent sees.
 *
 * The module owns three separable concerns behind one small surface:
 *
 *   - `parseDocument` decides whether a `File` is something we can read at all.
 *     It is the ONLY async function here (it awaits `file.text()`); everything
 *     else is synchronous because `bun:sqlite` is synchronous.
 *   - `saveDocument` / `getDocument` / `deleteDocument` / `listDocuments` are
 *     the storage round-trip, on top of the `documents` table in ../lib/db.
 *   - `loadDocumentsForPrompt` + `renderDocumentsContext` split "read the
 *     content" from "format the content", so prompt-building is a pure
 *     function of its arguments and testable without touching the database.
 *
 * `listDocuments` never selects the `content` column — listing the library is
 * a metadata operation and shouldn't drag every document body through memory.
 * `loadDocumentsForPrompt` is the single content-bearing read.
 *
 * SCOPING: documents are a single global library; if PODU is ever served on a
 * non-loopback interface, scope by session id first.
 */

import { db } from "../lib/db";

export interface DocumentMeta {
  id: string;
  name: string;
  /** ISO-8601 timestamp. */
  uploadedAt: string;
}

export interface StoredDocument extends DocumentMeta {
  content: string;
}

/** The only file types we can read. Anything else is rejected at parse time. */
export const SUPPORTED_EXTENSIONS = ["txt", "md"] as const;
export type SupportedExtension = (typeof SUPPORTED_EXTENSIONS)[number];

export type ParseResult =
  | { ok: true; name: string; content: string }
  | {
      ok: false;
      name: string;
      reason: "unsupported_type";
      extension: string;
      supported: readonly SupportedExtension[];
    }
  | { ok: false; name: string; reason: "empty_file" };

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot + 1).toLowerCase();
}

function isSupported(extension: string): extension is SupportedExtension {
  return (SUPPORTED_EXTENSIONS as readonly string[]).includes(extension);
}

/**
 * Read an uploaded file into text, or explain why we can't.
 *
 * There is exactly one content source — `file.text()` for `.txt` and `.md`.
 * Unsupported extensions are rejected rather than read as text anyway: a
 * binary `.pdf` decoded as UTF-8 is mojibake, and feeding mojibake to the
 * agent is worse than telling the user we don't support the format.
 */
export async function parseDocument(file: File): Promise<ParseResult> {
  // Bun's multipart parser drops the filename on a zero-byte part, so
  // `file.name` is undefined at runtime even though the type says string.
  // A part with no bytes has nothing to classify by extension, and it is by
  // definition the empty-file case — say so instead of crashing.
  if (!file.name) {
    return { ok: false, name: "The uploaded file", reason: "empty_file" };
  }

  const extension = extensionOf(file.name);

  if (!isSupported(extension)) {
    return {
      ok: false,
      name: file.name,
      reason: "unsupported_type",
      extension,
      supported: SUPPORTED_EXTENSIONS,
    };
  }

  const content = await file.text();
  if (content.trim().length === 0) {
    return { ok: false, name: file.name, reason: "empty_file" };
  }

  return { ok: true, name: file.name, content };
}

/**
 * The `documents` table stores `filename`; the API speaks `name`. The mapping
 * lives here and in `toStoredDocument` only — nowhere else needs to know.
 */
interface DocumentRow {
  id: string;
  filename: string;
  uploaded_at: string;
}

interface DocumentContentRow extends DocumentRow {
  content: string;
}

function toMeta(row: DocumentRow): DocumentMeta {
  return { id: row.id, name: row.filename, uploadedAt: row.uploaded_at };
}

function toStoredDocument(row: DocumentContentRow): StoredDocument {
  return { id: row.id, name: row.filename, uploadedAt: row.uploaded_at, content: row.content };
}

export function saveDocument(input: { name: string; content: string }): DocumentMeta {
  const id = `doc-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const uploadedAt = new Date().toISOString();

  db.query(
    "INSERT INTO documents (id, filename, content, uploaded_at) VALUES (?, ?, ?, ?)",
  ).run(id, input.name, input.content, uploadedAt);

  return { id, name: input.name, uploadedAt };
}

export function getDocument(id: string): StoredDocument | null {
  const row = db
    .query("SELECT id, filename, content, uploaded_at FROM documents WHERE id = ?")
    .get(id) as DocumentContentRow | null;

  return row ? toStoredDocument(row) : null;
}

export function deleteDocument(id: string): boolean {
  const result = db.query("DELETE FROM documents WHERE id = ?").run(id);
  return result.changes > 0;
}

/** Metadata only — the `content` column is deliberately not selected. */
export function listDocuments(): DocumentMeta[] {
  const rows = db
    .query("SELECT id, filename, uploaded_at FROM documents ORDER BY uploaded_at, rowid")
    .all() as DocumentRow[];

  return rows.map(toMeta);
}

/** The one read that carries document bodies, for prompt construction. */
export function loadDocumentsForPrompt(): StoredDocument[] {
  const rows = db
    .query(
      "SELECT id, filename, content, uploaded_at FROM documents ORDER BY uploaded_at, rowid",
    )
    .all() as DocumentContentRow[];

  return rows.map(toStoredDocument);
}

/**
 * Render documents into the prompt fragment the agent receives. Pure: no I/O,
 * so prompt shape can be asserted against literal arrays.
 *
 * Returns "" for an empty library, which keeps `buildFullPrompt` from
 * appending a header that introduces documents that don't exist.
 */
export function renderDocumentsContext(docs: readonly StoredDocument[]): string {
  if (docs.length === 0) return "";

  const docsContent = docs
    .map((doc) => `--- Document: ${doc.name} ---\n${doc.content}`)
    .join("\n\n");

  return `\n\nYou have access to the following reference documents that the user has uploaded. Use this information to provide more informed and contextual responses:\n\n${docsContent}`;
}
