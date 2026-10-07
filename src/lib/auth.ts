function getSecret(): string {
  const configured = process.env["JWT_SECRET"];
  if (configured && configured.length >= 32) return configured;
  if (process.env["NODE_ENV"] === "production") {
    throw new Error("JWT_SECRET must be set (32+ characters) in production");
  }
  return configured || "dev-only-secret-do-not-use-in-production-0000";
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

function base64UrlEncode(str: string): string {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function base64UrlDecode(str: string): string {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return atob(str);
}

async function hmacSha256(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signToken(payload: Omit<JWTPayload, "iat" | "exp">): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const tokenPayload = {
    ...payload,
    iat: now,
    exp: now + 12 * 60 * 60, // 12 hours
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(tokenPayload));
  const signature = await hmacSha256(`${encodedHeader}.${encodedPayload}`, getSecret());

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const [encodedHeader, encodedPayload, signature] = token.split(".");
    if (!encodedHeader || !encodedPayload || !signature) return null;

    const expectedSignature = await hmacSha256(`${encodedHeader}.${encodedPayload}`, getSecret());
    if (!safeEqual(signature, expectedSignature)) return null;

    const payload: JWTPayload = JSON.parse(base64UrlDecode(encodedPayload));

    // Check expiration
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch (error) {
    console.error("Token verification failed:", error);
    return null;
  }
}

export function parseAuthHeader(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.substring(7);
}

// Session management for demo (in production, use Redis/database)
const sessions = new Map<
  string,
  { userId: string; email: string; role: string; createdAt: number }
>();

export function createSession(userId: string, email: string, role: string): string {
  const sessionId = crypto.randomUUID();
  sessions.set(sessionId, { userId, email, role, createdAt: Date.now() });
  return sessionId;
}

export function getSession(
  sessionId: string,
): { userId: string; email: string; role: string } | null {
  const session = sessions.get(sessionId);
  if (!session) return null;

  // Session expires after 24 hours
  if (Date.now() - session.createdAt > 24 * 60 * 60 * 1000) {
    sessions.delete(sessionId);
    return null;
  }

  return session;
}

export function deleteSession(sessionId: string): void {
  sessions.delete(sessionId);
}
