import {
  createHash,
  createHmac,
  pbkdf2,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const ITER = 210_000;

function pbkdf2Async(password: string, salt: Buffer, iter: number): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    pbkdf2(password, salt, iter, 32, "sha256", (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await pbkdf2Async(password, salt, ITER);
  return `pbkdf2$${ITER}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iterStr, saltB64, hashB64] = stored.split("$");
  if (scheme !== "pbkdf2" || !iterStr || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await pbkdf2Async(password, Buffer.from(saltB64, "base64"), Number(iterStr));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function passwordProblem(password: unknown): string | null {
  if (typeof password !== "string" || password.length < 8) return "Password must be at least 8 characters";
  if (password.length > 128) return "Password is too long";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password))
    return "Password must contain at least one letter and one number";
  return null;
}

export const randomToken = (): string => randomBytes(32).toString("hex");
export const sha256 = (s: string): string => createHash("sha256").update(s).digest("hex");

// ---------- TOTP (RFC 6238, SHA-1, 30 s, 6 digits) — works with Google Authenticator ----------
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function newTotpSecret(): string {
  const bytes = randomBytes(20);
  let bits = "";
  for (const b of bytes) bits += b.toString(2).padStart(8, "0");
  let out = "";
  for (let i = 0; i + 5 <= bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}

function b32decode(s: string): Buffer {
  let bits = "";
  for (const c of s.toUpperCase()) {
    const v = B32.indexOf(c);
    if (v >= 0) bits += v.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

export function totpAt(secret: string, counter: number): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const h = createHmac("sha1", b32decode(secret)).update(buf).digest();
  const offset = (h[h.length - 1] ?? 0) & 0xf;
  const code =
    (((h[offset] ?? 0) & 0x7f) << 24) |
    (((h[offset + 1] ?? 0) & 0xff) << 16) |
    (((h[offset + 2] ?? 0) & 0xff) << 8) |
    ((h[offset + 3] ?? 0) & 0xff);
  return String(code % 1_000_000).padStart(6, "0");
}

export function verifyTotp(secret: string, code: unknown, now = Date.now()): boolean {
  if (!secret || typeof code !== "string" || !/^\d{6}$/.test(code)) return false;
  const counter = Math.floor(now / 30_000);
  for (const drift of [-1, 0, 1]) {
    if (totpAt(secret, counter + drift) === code) return true;
  }
  return false;
}

// ---------- in-memory rate limiting ----------
const hits = new Map<string, number[]>();

/** Returns true when the caller is OVER the limit. */
export function rateLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  return false;
}

export function peekRateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  return (hits.get(key) ?? []).filter((t) => now - t < windowMs).length >= max;
}
export function recordHit(key: string): void {
  hits.set(key, [...(hits.get(key) ?? []), Date.now()]);
}
export function clearHits(key: string): void {
  hits.delete(key);
}

// ---------- outbound email ----------
// No SMTP provider is wired up. Messages are appended to data/outbox.log and printed to the
// server console so verification/reset links can be followed during development and demos.
export function sendEmail(to: string, subject: string, body: string): void {
  const line = `[${new Date().toISOString()}] To: ${to} | ${subject}\n${body}\n---\n`;
  try {
    const file = process.env["OUTBOX_FILE"] || "data/outbox.log";
    mkdirSync(dirname(file), { recursive: true });
    appendFileSync(file, line);
  } catch {
    /* logging only */
  }
  if (process.env["NODE_ENV"] !== "test") console.log(`[email] ${to}: ${subject}\n${body}`);
}

export const isProd = (): boolean => process.env["NODE_ENV"] === "production";

export function countHits(key: string, windowMs: number): number {
  const now = Date.now();
  return (hits.get(key) ?? []).filter((t) => now - t < windowMs).length;
}
