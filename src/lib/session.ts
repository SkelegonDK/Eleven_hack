import { sealData, unsealData } from "iron-session";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, chmodSync } from "node:fs";

const COOKIE_NAME = "podu_session";
const SECRET_FILE = ".podu-session-secret";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export interface PoduSession {
  apiKey?: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __poduSessionPassword: string | undefined;
}

function loadPassword(): string {
  if (globalThis.__poduSessionPassword) return globalThis.__poduSessionPassword;

  const fromEnv = process.env.SESSION_PASSWORD;
  if (fromEnv && fromEnv.length >= 32) {
    globalThis.__poduSessionPassword = fromEnv;
    return fromEnv;
  }

  if (existsSync(SECRET_FILE)) {
    const existing = readFileSync(SECRET_FILE, "utf8").trim();
    if (existing.length >= 32) {
      globalThis.__poduSessionPassword = existing;
      return existing;
    }
  }

  const generated = randomBytes(32).toString("hex");
  writeFileSync(SECRET_FILE, generated, { flag: "w" });
  try {
    chmodSync(SECRET_FILE, 0o600);
  } catch {
    // ignore on platforms where chmod is a no-op
  }
  globalThis.__poduSessionPassword = generated;
  return generated;
}

function parseCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export async function readSession(req: Request): Promise<PoduSession> {
  const cookie = parseCookie(req.headers.get("cookie"), COOKIE_NAME);
  if (!cookie) return {};
  try {
    const data = await unsealData<PoduSession>(cookie, {
      password: loadPassword(),
    });
    return data ?? {};
  } catch {
    return {};
  }
}

export async function writeSessionCookie(session: PoduSession): Promise<string> {
  const sealed = await sealData(session, {
    password: loadPassword(),
    ttl: COOKIE_MAX_AGE_SECONDS,
  });
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(sealed)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
  ];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

export function clearSessionCookie(): string {
  const parts = [
    `${COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

export function resolveApiKey(session: PoduSession): string | null {
  return session.apiKey ?? process.env.ELEVENLABS_API_KEY ?? null;
}
