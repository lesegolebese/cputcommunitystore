// Payment provider adapters.
//  - PayFast: signed redirect + ITN webhook (sandbox or live, chosen by env vars).
//  - SnapScan: QR/URL payment + signed webhook.
//  - Simulated: used ONLY when no provider credentials exist (local demo). Disabled in
//    production unless ALLOW_SIMULATED_PAYMENTS=true.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { Order } from "./db.ts";
import { isProd } from "./security.ts";

const env = (k: string): string => process.env[k] ?? "";

export const publicUrl = (): string => env("PUBLIC_URL") || "http://localhost:5173";

// PHP-style urlencode, which is what PayFast signs against.
export function phpUrlEncode(v: string): string {
  return encodeURIComponent(v)
    .replace(/%20/g, "+")
    .replace(/[!'()*~]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

export function payfastSignature(pairs: [string, string][], passphrase: string): string {
  let str = pairs
    .filter(([, v]) => v !== "")
    .map(([k, v]) => `${k}=${phpUrlEncode(v.trim())}`)
    .join("&");
  if (passphrase) str += `&passphrase=${phpUrlEncode(passphrase.trim())}`;
  return createHash("md5").update(str).digest("hex");
}

export type PaymentInit =
  | { mode: "simulated"; paid: true }
  | { mode: "sandbox" | "live"; paid: false; provider: "PayFast"; action: string; fields: Record<string, string> }
  | { mode: "sandbox" | "live"; paid: false; provider: "SnapScan"; redirectUrl: string };

export function payfastConfigured(): boolean {
  return !!env("PAYFAST_MERCHANT_ID") && !!env("PAYFAST_MERCHANT_KEY");
}
export function snapscanConfigured(): boolean {
  return !!env("SNAPSCAN_SNAPCODE") && !!env("SNAPSCAN_WEBHOOK_KEY");
}

export function paymentsAvailable(via: Order["via"]): boolean {
  const configured = via === "PayFast" ? payfastConfigured() : snapscanConfigured();
  return configured || !isProd() || env("ALLOW_SIMULATED_PAYMENTS") === "true";
}

export function initPayment(order: Order, buyerEmail: string, buyerName: string): PaymentInit {
  if (order.via === "PayFast" && payfastConfigured()) {
    const sandbox = env("PAYFAST_SANDBOX") !== "false";
    const [first = "Buyer"] = buyerName.split(" ");
    const pairs: [string, string][] = [
      ["merchant_id", env("PAYFAST_MERCHANT_ID")],
      ["merchant_key", env("PAYFAST_MERCHANT_KEY")],
      ["return_url", `${publicUrl()}/?order=${order.id}&status=return`],
      ["cancel_url", `${publicUrl()}/?order=${order.id}&status=cancel`],
      ["notify_url", `${publicUrl()}/api/payments/payfast/notify`],
      ["name_first", first],
      ["email_address", buyerEmail],
      ["m_payment_id", order.id],
      ["amount", order.total.toFixed(2)],
      ["item_name", `Community Store order ${order.id.slice(0, 8)}`],
    ];
    const signature = payfastSignature(pairs, env("PAYFAST_PASSPHRASE"));
    const fields: Record<string, string> = {};
    for (const [k, v] of pairs) if (v !== "") fields[k] = v;
    fields["signature"] = signature;
    return {
      mode: sandbox ? "sandbox" : "live",
      paid: false,
      provider: "PayFast",
      action: sandbox ? "https://sandbox.payfast.co.za/eng/process" : "https://www.payfast.co.za/eng/process",
      fields,
    };
  }
  if (order.via === "SnapScan" && snapscanConfigured()) {
    const cents = Math.round(order.total * 100);
    return {
      mode: env("SNAPSCAN_SANDBOX") === "false" ? "live" : "sandbox",
      paid: false,
      provider: "SnapScan",
      redirectUrl: `https://pos.snapscan.io/qr/${encodeURIComponent(env("SNAPSCAN_SNAPCODE"))}?id=${order.id}&amount=${cents}&strict=true`,
    };
  }
  return { mode: "simulated", paid: true };
}

/** Verify a PayFast ITN body. Returns the parsed fields when the signature is valid. */
export function verifyPayfastItn(rawBody: string): Record<string, string> | null {
  const params = new URLSearchParams(rawBody);
  const pairs: [string, string][] = [];
  const fields: Record<string, string> = {};
  for (const [k, v] of params) {
    fields[k] = v;
    if (k !== "signature") pairs.push([k, v]);
  }
  const given = fields["signature"] ?? "";
  const expected = payfastSignature(pairs, env("PAYFAST_PASSPHRASE"));
  if (given.length !== expected.length) return null;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected)) ? fields : null;
}

/** Verify a SnapScan webhook: HMAC-SHA256 of the raw body using the webhook auth key. */
export function verifySnapscan(rawBody: string, authHeader: string | null): boolean {
  const match = /signature=([a-f0-9]+)/i.exec(authHeader ?? "");
  if (!match || !match[1]) return false;
  const expected = createHmac("sha256", env("SNAPSCAN_WEBHOOK_KEY")).update(rawBody).digest("hex");
  const given = match[1].toLowerCase();
  return given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}
