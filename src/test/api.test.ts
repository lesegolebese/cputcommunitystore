// @vitest-environment node
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

// Point the JSON database and email outbox at a throw-away folder BEFORE the server modules load.
const dir = mkdtempSync(join(tmpdir(), "cs-test-"));
process.env["DB_FILE"] = join(dir, "db.json");
process.env["OUTBOX_FILE"] = join(dir, "outbox.log");
process.env["JWT_SECRET"] = "test-secret-test-secret-test-secret-123456";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

let handleApi: (req: Request) => Promise<Response>;
let totpAt: (secret: string, counter: number) => string;
let payfastSignature: (pairs: [string, string][], pass: string) => string;
let verifyPayfastItn: (raw: string) => Record<string, string> | null;
let orderTotals: (l: { unit: number; qty: number }[]) => { subtotal: number; fee: number; total: number };
let unitPrice: (p: number, d: number | undefined, role: string) => number;

let ipCounter = 0;
async function call(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
  extraHeaders: Record<string, string> = {},
): Promise<{ status: number; data: Json }> {
  const headers: Record<string, string> = { "x-forwarded-for": `10.0.${Math.floor(ipCounter / 250)}.${ipCounter++ % 250}`, ...extraHeaders };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (body !== undefined && !headers["content-type"]) headers["content-type"] = "application/json";
  const res = await handleApi(
    new Request(`http://localhost/api/${path}`, {
      method,
      headers,
      ...(body !== undefined ? { body: typeof body === "string" ? body : JSON.stringify(body) } : {}),
    }),
  );
  let data: Json = {};
  try {
    data = (await res.json()) as Json;
  } catch {
    /* non-JSON body */
  }
  return { status: res.status, data };
}

async function signUp(name: string, email: string, role = "student", extra: Json = {}) {
  const r = await call("POST", "auth/register", { name, email, password: "Passw0rd!", role, ...extra });
  return r;
}

async function verifiedUser(name: string, email: string, role = "student", extra: Json = {}) {
  const r = await signUp(name, email, role, extra);
  expect(r.status).toBe(201);
  const v = await call("POST", "auth/verify-email", { token: r.data["devVerifyToken"] });
  expect(v.status).toBe(200);
  const l = await call("POST", "auth/login", { email, password: "Passw0rd!" });
  expect(l.status).toBe(200);
  return { token: l.data["token"] as string, user: l.data["user"] as Json };
}

async function demoLogin(email: string) {
  const l = await call("POST", "auth/login", { email, password: "Demo@1234" });
  expect(l.status).toBe(200);
  return l.data["token"] as string;
}

beforeAll(async () => {
  ({ handleApi } = await import("../server/handlers.ts"));
  ({ totpAt } = await import("../server/security.ts"));
  ({ payfastSignature, verifyPayfastItn } = await import("../server/payments.ts"));
  ({ orderTotals, unitPrice } = await import("../lib/pricing.ts"));
});

describe("registration & email verification", () => {
  it("rejects weak passwords and bad emails", async () => {
    expect((await call("POST", "auth/register", { name: "Weak", email: "weak@mycput.ac.za", password: "abc", role: "student" })).status).toBe(400);
    expect((await call("POST", "auth/register", { name: "Bad", email: "not-an-email", password: "Passw0rd!", role: "student" })).status).toBe(400);
  });

  it("requires a university email for students", async () => {
    const r = await signUp("Gmail Student", "someone@gmail.com", "student");
    expect(r.status).toBe(400);
    expect(String(r.data["error"])).toContain("university email");
  });

  it("requires a business registration number for vendors", async () => {
    expect((await signUp("Shop", "shop1@biz.co.za", "vendor")).status).toBe(400);
    expect((await signUp("Shop", "shop2@biz.co.za", "vendor", { businessReg: "2024/111222/07" })).status).toBe(201);
  });

  it("does not allow self-registration as faculty", async () => {
    expect((await signUp("Fake Dr", "fake@cput.ac.za", "faculty")).status).toBe(400);
  });

  it("blocks login until the email is verified, then allows it", async () => {
    const reg = await signUp("Thandi Z", "thandi.z@mycput.ac.za");
    expect(reg.status).toBe(201);
    const early = await call("POST", "auth/login", { email: "thandi.z@mycput.ac.za", password: "Passw0rd!" });
    expect(early.status).toBe(403);
    expect(early.data["needsVerification"]).toBe(true);
    expect((await call("POST", "auth/verify-email", { token: "garbage-garbage-garbage-garbage" })).status).toBe(400);
    expect((await call("POST", "auth/verify-email", { token: reg.data["devVerifyToken"] })).status).toBe(200);
    // a verification link can only be used once
    expect((await call("POST", "auth/verify-email", { token: reg.data["devVerifyToken"] })).status).toBe(400);
    expect((await call("POST", "auth/login", { email: "thandi.z@mycput.ac.za", password: "Passw0rd!" })).status).toBe(200);
  });

  it("rejects duplicate emails", async () => {
    await verifiedUser("Dup One", "dup@mycput.ac.za");
    expect((await signUp("Dup Two", "dup@mycput.ac.za")).status).toBe(409);
  });
});

describe("login, sessions & password reset", () => {
  it("stores no plaintext password and rejects wrong credentials", async () => {
    const { readFileSync } = await import("node:fs");
    await verifiedUser("Hash Check", "hash@mycput.ac.za");
    const raw = readFileSync(process.env["DB_FILE"]!, "utf8");
    expect(raw.includes("Passw0rd!")).toBe(false);
    expect((await call("POST", "auth/login", { email: "hash@mycput.ac.za", password: "Wrong1234" })).status).toBe(401);
    expect((await call("POST", "auth/login", { email: "nobody@mycput.ac.za", password: "Wrong1234" })).status).toBe(401);
  });

  it("locks an account after repeated failures", async () => {
    await verifiedUser("Lock Me", "lock@mycput.ac.za");
    for (let i = 0; i < 5; i++) await call("POST", "auth/login", { email: "lock@mycput.ac.za", password: "Nope12345" });
    const r = await call("POST", "auth/login", { email: "lock@mycput.ac.za", password: "Passw0rd!" });
    expect(r.status).toBe(429);
  });

  it("protects authenticated routes and rejects forged tokens", async () => {
    expect((await call("GET", "me")).status).toBe(401);
    expect((await call("GET", "me", undefined, "a.b.c")).status).toBe(401);
    const { token } = await verifiedUser("Me Check", "me@mycput.ac.za");
    const me = await call("GET", "me", undefined, token);
    expect(me.status).toBe(200);
    expect(me.data["user"]["email"]).toBe("me@mycput.ac.za");
    expect(me.data["user"]["passwordHash"]).toBeUndefined();
    // tampered payload (signature no longer matches)
    const [h, , s] = token.split(".");
    const evil = Buffer.from(JSON.stringify({ userId: "u-zanele", email: "zanele@cput.ac.za", role: "faculty", iat: 1, exp: 9999999999 })).toString("base64url");
    expect((await call("GET", "me", undefined, `${h}.${evil}.${s}`)).status).toBe(401);
  });

  it("resets a password with a one-time link and invalidates the old password", async () => {
    await verifiedUser("Reset Me", "reset@mycput.ac.za");
    const f = await call("POST", "auth/forgot", { email: "reset@mycput.ac.za" });
    expect(f.status).toBe(200);
    const token = f.data["devResetToken"];
    expect((await call("POST", "auth/reset", { token, password: "short" })).status).toBe(400);
    expect((await call("POST", "auth/reset", { token, password: "BrandNew123" })).status).toBe(200);
    expect((await call("POST", "auth/reset", { token, password: "AnotherOne123" })).status).toBe(400);
    expect((await call("POST", "auth/login", { email: "reset@mycput.ac.za", password: "Passw0rd!" })).status).toBe(401);
    expect((await call("POST", "auth/login", { email: "reset@mycput.ac.za", password: "BrandNew123" })).status).toBe(200);
  });

  it("does not reveal whether an email is registered", async () => {
    const a = await call("POST", "auth/forgot", { email: "ghost@mycput.ac.za" });
    expect(a.status).toBe(200);
    expect(a.data["devResetToken"]).toBeUndefined();
  });
});

describe("profile", () => {
  it("lets a user edit their profile and upload a photo", async () => {
    const { token } = await verifiedUser("Profile P", "profile@mycput.ac.za");
    const tiny = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
    const r = await call("PATCH", "me", { name: "Profile Updated", bio: "Hello", avatar: tiny, campusZone: "Bellville" }, token);
    expect(r.status).toBe(200);
    expect(r.data["user"]["name"]).toBe("Profile Updated");
    expect(r.data["user"]["avatar"]).toBe(tiny);
    expect((await call("PATCH", "me", { avatar: "http://evil.example/x.png" }, token)).status).toBe(400);
  });
});

describe("listings", () => {
  it("is public to read, and only sellers can create", async () => {
    const list = await call("GET", "products");
    expect(list.status).toBe(200);
    expect(list.data["products"].length).toBeGreaterThanOrEqual(8);
    const resident = await demoLogin("pieter@gmail.com");
    expect((await call("POST", "products", { title: "Nope", price: 10, quantity: 1, category: "Textbooks", condition: "New" }, resident)).status).toBe(403);
    expect((await call("POST", "products", {})).status).toBe(401);
  });

  it("validates input, persists, and enforces ownership on edit/delete", async () => {
    const owner = await verifiedUser("Owner O", "owner@mycput.ac.za");
    const other = await verifiedUser("Other O", "other@mycput.ac.za");
    const bad = await call("POST", "products", { title: "x", price: -5, quantity: 1, category: "Textbooks", condition: "New" }, owner.token);
    expect(bad.status).toBe(400);
    const made = await call("POST", "products", { title: "Physics textbook", price: 300, quantity: 2, category: "Textbooks", condition: "Like New", description: "Clean copy" }, owner.token);
    expect(made.status).toBe(201);
    const id = made.data["product"]["id"] as string;
    expect((await call("GET", "products")).data["products"].some((p: Json) => p["id"] === id)).toBe(true);

    expect((await call("PUT", `products/${id}`, { title: "Hijack", price: 1, quantity: 1, category: "Textbooks", condition: "New" }, other.token)).status).toBe(403);
    expect((await call("DELETE", `products/${id}`, undefined, other.token)).status).toBe(403);

    const edit = await call("PUT", `products/${id}`, { title: "Physics textbook 2nd ed", price: 250, quantity: 2, category: "Textbooks", condition: "Like New" }, owner.token);
    expect(edit.status).toBe(200);
    expect(edit.data["product"]["price"]).toBe(250);

    expect((await call("DELETE", `products/${id}`, undefined, owner.token)).status).toBe(200);
    expect((await call("GET", "products")).data["products"].some((p: Json) => p["id"] === id)).toBe(false);
  });

  it("keeps vendors out until a moderator approves them", async () => {
    const v = await verifiedUser("New Vendor", "vendor.new@biz.co.za", "vendor", { businessReg: "2024/999888/07" });
    const body = { title: "Vendor goods", price: 99, quantity: 5, category: "Dorm Essentials", condition: "New" };
    expect((await call("POST", "products", body, v.token)).status).toBe(403);
    const mod = await demoLogin("zanele@cput.ac.za");
    const pending = await call("GET", "admin/vendors", undefined, mod);
    expect(pending.data["vendors"].some((x: Json) => x["id"] === v.user["id"])).toBe(true);
    expect((await call("POST", `admin/vendors/${v.user["id"]}`, { action: "approve" }, mod)).status).toBe(200);
    expect((await call("POST", "products", body, v.token)).status).toBe(201);
  });
});

describe("pricing", () => {
  it("applies the student discount and escrow fee identically on client and server", () => {
    expect(unitPrice(100, 10, "student")).toBe(90);
    expect(unitPrice(100, 10, "resident")).toBe(100);
    expect(orderTotals([{ unit: 90, qty: 2 }])).toEqual({ subtotal: 180, fee: 3.6, total: 183.6 });
  });
});

describe("orders, escrow, reviews & notifications", () => {
  it("runs the full buy → ready → confirm → review journey", async () => {
    const seller = await verifiedUser("Seller S", "seller@mycput.ac.za");
    const buyer = await verifiedUser("Buyer B", "buyer@mycput.ac.za");
    const made = await call("POST", "products", { title: "Scientific calculator", price: 200, quantity: 3, category: "Electronics", condition: "Like New", studentDiscount: 10 }, seller.token);
    const pid = made.data["product"]["id"] as string;

    // cannot review before buying
    expect((await call("POST", `products/${pid}/reviews`, { rating: 5, comment: "great" }, buyer.token)).status).toBe(403);
    // cannot buy own listing, or more than stock
    expect((await call("POST", "orders", { via: "PayFast", items: [{ productId: pid, qty: 1 }] }, seller.token)).status).toBe(400);
    expect((await call("POST", "orders", { via: "PayFast", items: [{ productId: pid, qty: 9 }] }, buyer.token)).status).toBe(409);

    const order = await call("POST", "orders", { via: "PayFast", items: [{ productId: pid, qty: 2, price: 1 }] }, buyer.token);
    expect(order.status).toBe(201);
    // server calculates the price: 2 x (200 - 10%) = 360, + 2% escrow = 367.20 (client-sent price ignored)
    expect(order.data["order"]["subtotal"]).toBe(360);
    expect(order.data["order"]["total"]).toBe(367.2);
    expect(order.data["order"]["status"]).toBe("paid");
    const oid = order.data["order"]["id"] as string;

    // stock reduced, seller notified
    const after = (await call("GET", "products")).data["products"].find((p: Json) => p["id"] === pid);
    expect(after["quantity"]).toBe(1);
    const sellerNotes = await call("GET", "notifications", undefined, seller.token);
    expect(sellerNotes.data["notifications"].some((n: Json) => n["message"].includes("New paid order"))).toBe(true);

    // only the seller can mark ready; only the buyer can confirm
    expect((await call("POST", `orders/${oid}/ready`, {}, buyer.token)).status).toBe(404);
    expect((await call("POST", `orders/${oid}/ready`, {}, seller.token)).status).toBe(200);
    expect((await call("POST", `orders/${oid}/confirm`, {}, seller.token)).status).toBe(404);
    const done = await call("POST", `orders/${oid}/confirm`, {}, buyer.token);
    expect(done.status).toBe(200);
    expect(done.data["order"]["status"]).toBe("completed");
    expect((await call("POST", `orders/${oid}/confirm`, {}, buyer.token)).status).toBe(409);

    // now the buyer may review; rating is recomputed and own-listing review is blocked
    expect((await call("POST", `products/${pid}/reviews`, { rating: 9 }, buyer.token)).status).toBe(400);
    expect((await call("POST", `products/${pid}/reviews`, { rating: 4, comment: "Works well" }, buyer.token)).status).toBe(201);
    expect((await call("POST", `products/${pid}/reviews`, { rating: 5 }, seller.token)).status).toBe(403);
    const reviews = await call("GET", `products/${pid}/reviews`);
    expect(reviews.data["reviews"]).toHaveLength(1);
    expect((await call("GET", "products")).data["products"].find((p: Json) => p["id"] === pid)["rating"]).toBe(4);

    // order history shows on both sides
    const hist = await call("GET", "me/history", undefined, buyer.token);
    expect(hist.data["orders"].some((o: Json) => o["id"] === oid)).toBe(true);
    const sellerHist = await call("GET", "orders", undefined, seller.token);
    expect(sellerHist.data["orders"][0]["perspective"]).toBe("seller");

    // buyer never sees another user's order
    const stranger = await verifiedUser("Stranger S", "stranger@mycput.ac.za");
    expect((await call("GET", `orders/${oid}`, undefined, stranger.token)).status).toBe(404);

    // notifications can be marked read
    expect((await call("POST", "notifications/read-all", {}, buyer.token)).status).toBe(200);
    const notes = await call("GET", "notifications", undefined, buyer.token);
    expect(notes.data["notifications"].every((n: Json) => n["read"])).toBe(true);
  });

  it("rejects an empty cart and unknown payment methods", async () => {
    const b = await verifiedUser("Cart C", "cart@mycput.ac.za");
    expect((await call("POST", "orders", { via: "PayFast", items: [] }, b.token)).status).toBe(400);
    expect((await call("POST", "orders", { via: "Bitcoin", items: [{ productId: "1", qty: 1 }] }, b.token)).status).toBe(400);
  });
});

describe("two-factor authentication", () => {
  it("requires a valid authenticator code at checkout once enabled", async () => {
    const seller = await verifiedUser("Seller T", "seller.t@mycput.ac.za");
    const u = await verifiedUser("Secure S", "secure@mycput.ac.za");
    const made = await call("POST", "products", { title: "Desk lamp", price: 150, quantity: 5, category: "Dorm Essentials", condition: "New" }, seller.token);
    const pid = made.data["product"]["id"] as string;

    const setup = await call("POST", "auth/2fa/setup", {}, u.token);
    expect(setup.status).toBe(200);
    const secret = setup.data["secret"] as string;
    expect((await call("POST", "auth/2fa/enable", { code: "000000" }, u.token)).status).toBe(400);
    const code = () => totpAt(secret, Math.floor(Date.now() / 30000));
    expect((await call("POST", "auth/2fa/enable", { code: code() }, u.token)).status).toBe(200);

    const items = [{ productId: pid, qty: 1 }];
    const noCode = await call("POST", "orders", { via: "PayFast", items }, u.token);
    expect(noCode.status).toBe(401);
    expect(noCode.data["needsTwoFactor"]).toBe(true);
    expect((await call("POST", "orders", { via: "PayFast", items, code: "123456" }, u.token)).status).toBe(401);
    expect((await call("POST", "orders", { via: "PayFast", items, code: code() }, u.token)).status).toBe(201);
  });
});

describe("bulletin board", () => {
  it("lets users post, like, reply and delete only their own notices", async () => {
    const a = await verifiedUser("Poster P", "poster@mycput.ac.za");
    const b = await verifiedUser("Reader R", "reader@mycput.ac.za");
    expect((await call("POST", "notices", { type: "Announcement", title: "x", body: "y" }, a.token)).status).toBe(400);
    const made = await call("POST", "notices", { type: "Club Event", title: "Chess club", body: "Fridays at 4pm in the library" }, a.token);
    expect(made.status).toBe(201);
    const id = made.data["notice"]["id"] as string;

    expect((await call("GET", "notices")).data["notices"].some((n: Json) => n["id"] === id)).toBe(true);
    const liked = await call("POST", `notices/${id}/like`, {}, b.token);
    expect(liked.data["notice"]["likes"]).toBe(1);
    expect(liked.data["notice"]["liked"]).toBe(true);
    expect((await call("POST", `notices/${id}/like`, {}, b.token)).data["notice"]["likes"]).toBe(0);

    const reply = await call("POST", `notices/${id}/comments`, { body: "I'll be there" }, b.token);
    expect(reply.status).toBe(201);
    expect(reply.data["notice"]["comments"]).toHaveLength(1);
    expect((await call("GET", "notifications", undefined, a.token)).data["notifications"].some((n: Json) => n["message"].includes("replied"))).toBe(true);

    expect((await call("DELETE", `notices/${id}`, undefined, b.token)).status).toBe(403);
    expect((await call("DELETE", `notices/${id}`, undefined, a.token)).status).toBe(200);
  });
});

describe("messaging", () => {
  it("delivers messages between buyer and seller and blocks phone numbers", async () => {
    const seller = await verifiedUser("Msg Seller", "msg.seller@mycput.ac.za");
    const buyer = await verifiedUser("Msg Buyer", "msg.buyer@mycput.ac.za");
    const pid = (await call("POST", "products", { title: "Bike", price: 900, quantity: 1, category: "Apparel", condition: "Used - Good" }, seller.token)).data["product"]["id"] as string;
    expect((await call("POST", "messages", { productId: pid, text: "Call me on 082 123 4567" }, buyer.token)).status).toBe(400);
    expect((await call("POST", "messages", { productId: pid, text: "Is it still available?" }, buyer.token)).status).toBe(201);
    expect((await call("POST", "messages", { productId: pid, text: "Yes!", toUserId: buyer.user["id"] }, seller.token)).status).toBe(201);
    const thread = await call("GET", `messages?productId=${pid}`, undefined, buyer.token);
    expect(thread.data["messages"]).toHaveLength(2);
    expect(thread.data["messages"][0]["mine"]).toBe(true);
    expect((await call("GET", "messages/threads", undefined, seller.token)).data["threads"]).toHaveLength(1);
  });
});

describe("moderation & fraud", () => {
  it("lets any user report a listing but only faculty act on it", async () => {
    const seller = await verifiedUser("Shady S", "shady@mycput.ac.za");
    const reporter = await verifiedUser("Report R", "report@mycput.ac.za");
    const pid = (await call("POST", "products", { title: "Totally real iPhone", price: 50, quantity: 1, category: "Electronics", condition: "New" }, seller.token)).data["product"]["id"] as string;

    expect((await call("POST", "flags", { type: "product", itemId: pid, reason: "Too cheap" }, reporter.token)).status).toBe(201);
    expect((await call("POST", "flags", { type: "product", itemId: pid }, reporter.token)).status).toBe(409);
    expect((await call("GET", "admin/flags", undefined, reporter.token)).status).toBe(403);

    const mod = await demoLogin("zanele@cput.ac.za");
    const flags = await call("GET", "admin/flags", undefined, mod);
    const flag = flags.data["flags"].find((f: Json) => f["itemId"] === pid);
    expect(flag).toBeTruthy();
    expect((await call("POST", `admin/flags/${flag["id"]}`, { action: "remove" }, mod)).status).toBe(200);
    expect((await call("GET", "products")).data["products"].some((p: Json) => p["id"] === pid)).toBe(false);
    expect((await call("GET", "admin/fraud", undefined, mod)).status).toBe(200);
  });
});

describe("payment gateway signatures", () => {
  it("builds and verifies PayFast signatures (and rejects tampering)", () => {
    process.env["PAYFAST_PASSPHRASE"] = "test pass";
    const pairs: [string, string][] = [["m_payment_id", "abc"], ["amount", "100.00"], ["item_name", "Test item"]];
    const sig = payfastSignature(pairs, "test pass");
    const body = new URLSearchParams([...pairs, ["signature", sig]]).toString();
    expect(verifyPayfastItn(body)).toBeTruthy();
    const tampered = body.replace("100.00", "1.00");
    expect(verifyPayfastItn(tampered)).toBeNull();
    delete process.env["PAYFAST_PASSPHRASE"];
  });

  it("refuses a PayFast notification with a bad signature", async () => {
    const r = await handleApi(new Request("http://localhost/api/payments/payfast/notify", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "m_payment_id=x&amount_gross=1&signature=bad" }));
    expect(r.status).toBe(400);
  });
});

describe("API hygiene", () => {
  it("returns 404/405 for unknown routes and 400 for malformed JSON", async () => {
    expect((await call("GET", "does-not-exist")).status).toBe(404);
    expect((await call("DELETE", "me")).status).toBe(405);
    expect((await call("POST", "auth/login", "{not json")).status).toBe(400);
  });
});
