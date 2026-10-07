// Single API entry point. Every /api/* request is routed through handleApi().
// Written against the standard Request/Response types so it can be unit-tested without a server.
import { parseAuthHeader, signToken, verifyToken } from "../lib/auth.ts";
import { orderTotals, unitPrice } from "../lib/pricing.ts";
import { getDb, saveDb, uid } from "./db.ts";
import type { Flag, Notice, Order, Product, Review, Role, User } from "./db.ts";
import { screenListing, screenOrder, screenRegistrationBurst } from "./fraud.ts";
import {
  initPayment,
  paymentsAvailable,
  verifyPayfastItn,
  verifySnapscan,
  publicUrl,
} from "./payments.ts";
import {
  clearHits,
  countHits,
  hashPassword,
  isProd,
  newTotpSecret,
  passwordProblem,
  peekRateLimit,
  randomToken,
  rateLimited,
  recordHit,
  sendEmail,
  sha256,
  verifyPassword,
  verifyTotp,
} from "./security.ts";

type Body = Record<string, unknown>;
type Ctx = {
  req: Request;
  url: URL;
  params: Record<string, string>;
  body: Body;
  rawBody: string;
  user: User | null;
  ip: string;
};
type Handler = (c: Ctx) => Promise<Response> | Response;

const CATEGORIES = ["Textbooks", "Electronics", "Dorm Essentials", "Local Food & Services", "Apparel"];
const CONDITIONS = ["New", "Like New", "Used - Good", "Used - Fair"];
const ZONES = ["", "Bellville", "District Six"];
const NOTICE_TYPES = ["Announcement", "Lost & Found", "Club Event", "Service Request"];
const MAX_BODY = 1_500_000;
const DUMMY_HASH =
  "pbkdf2$210000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

// ---------- response helpers ----------
const json = (data: unknown, status = 200): Response =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
const fail = (error: string, status = 400, extra: Body = {}): Response =>
  json({ error, ...extra }, status);

const str = (v: unknown, max: number): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

function relTime(ms: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const BADGE: Record<Role, string> = {
  student: "Verified Student",
  vendor: "Verified Vendor",
  faculty: "Verified Faculty",
  resident: "Community Member",
};

function cleanImage(input: unknown, fallbackCategory: string, maxLen = 600_000): string {
  if (typeof input === "string" && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(input)) {
    if (input.length <= maxLen) return input;
  }
  return `asset:${fallbackCategory}`;
}

// ---------- ratings ----------
function productRating(p: Product, reviews: Review[]): { rating: number; count: number } {
  const mine = reviews.filter((r) => r.productId === p.id);
  if (!mine.length) return { rating: p.baseRating, count: 0 };
  const avg = mine.reduce((s, r) => s + r.rating, 0) / mine.length;
  return { rating: Math.round(avg * 10) / 10, count: mine.length };
}

function sellerRating(userId: string, reviews: Review[]): { avg: number; count: number } {
  const mine = reviews.filter((r) => r.sellerId === userId);
  if (!mine.length) return { avg: 0, count: 0 };
  return { avg: Math.round((mine.reduce((s, r) => s + r.rating, 0) / mine.length) * 10) / 10, count: mine.length };
}

// ---------- public shapes ----------
function publicUser(u: User) {
  const r = sellerRating(u.id, getDb().reviews);
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    badge: BADGE[u.role],
    emailVerified: u.emailVerified,
    vendorStatus: u.vendorStatus,
    bio: u.bio,
    avatar: u.avatar,
    campusZone: u.campusZone,
    twoFactorEnabled: u.twoFactorEnabled,
    loyaltyPoints: u.loyaltyPoints,
    credibilityBadges: u.badges,
    completedTrades: u.completedTrades,
    averageRating: r.avg,
    reviewCount: r.count,
  };
}

function publicProduct(p: Product) {
  const db = getDb();
  const seller = db.users.find((u) => u.id === p.sellerId);
  const { rating, count } = productRating(p, db.reviews);
  const boosted = p.boostedUntil > Date.now();
  return {
    id: p.id,
    title: p.title,
    price: p.price,
    category: p.category,
    condition: p.condition,
    seller: p.seller,
    sellerId: p.sellerId,
    sellerBadge: seller ? BADGE[seller.role] : "Community Member",
    rating,
    reviewCount: count,
    image: p.image,
    description: p.description,
    quantity: p.quantity,
    ...(p.campusZone ? { campusZone: p.campusZone } : {}),
    ...(p.studentDiscount ? { studentDiscount: p.studentDiscount } : {}),
    boosted,
    boostType: boosted ? p.boostType : "",
  };
}

function publicNotice(n: Notice, me: User | null) {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    author: n.author,
    authorId: n.authorId,
    time: relTime(n.createdAt),
    likes: n.baseLikes + n.likedBy.length,
    liked: !!me && n.likedBy.includes(me.id),
    ...(n.contact ? { contact: n.contact } : {}),
    ...(n.expiresAt ? { expiresAt: n.expiresAt } : {}),
    comments: n.comments.map((c) => ({ id: c.id, author: c.author, body: c.body, time: relTime(c.createdAt) })),
  };
}

function publicOrder(o: Order, me: User) {
  return {
    id: o.id,
    items: o.items,
    subtotal: o.subtotal,
    fee: o.fee,
    total: o.total,
    via: o.via,
    mode: o.mode,
    status: o.status,
    createdAt: o.createdAt,
    paidAt: o.paidAt,
    perspective: o.buyerId === me.id ? "buyer" : "seller",
    buyer: o.buyer,
  };
}

function notify(userId: string, type: "order" | "message" | "account" | "system", message: string): void {
  getDb().notifications.unshift({ id: uid(), userId, type, message, read: false, createdAt: Date.now() });
}

function addPoints(u: User | undefined, pts: number): void {
  if (u) u.loyaltyPoints += pts;
}

// ---------- auth handlers ----------
async function register(c: Ctx): Promise<Response> {
  if (rateLimited(`register:${c.ip}`, 5, 3_600_000)) return fail("Too many sign-ups from this network. Try again later.", 429);
  const db = getDb();
  const name = str(c.body["name"], 60);
  const email = str(c.body["email"], 120).toLowerCase();
  const password = c.body["password"];
  const role = c.body["role"] as Role;
  const businessReg = str(c.body["businessReg"], 30);

  if (name.length < 2) return fail("Please enter your name");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Please enter a valid email address");
  const pw = passwordProblem(password);
  if (pw) return fail(pw);
  if (!["student", "vendor", "resident"].includes(role))
    return fail("Choose Student, Vendor or Resident. Faculty accounts are created by campus IT.");
  if (role === "student" && !/@(my)?cput\.ac\.za$/.test(email))
    return fail("Students must register with their university email (@mycput.ac.za)");
  if (role === "vendor" && !/^[A-Za-z0-9/-]{5,30}$/.test(businessReg))
    return fail("Vendors must supply a business registration number");
  if (db.users.some((u) => u.email === email)) return fail("An account with this email already exists", 409);

  const user: User = {
    id: uid(),
    name,
    email,
    role,
    passwordHash: await hashPassword(password as string),
    emailVerified: false,
    vendorStatus: role === "vendor" ? "pending" : "none",
    businessReg: role === "vendor" ? businessReg : "",
    bio: "",
    avatar: "",
    campusZone: "",
    twoFactorSecret: "",
    twoFactorEnabled: false,
    loyaltyPoints: 100,
    badges: ["Early Adopter"],
    completedTrades: 0,
    createdAt: Date.now(),
  };
  db.users.push(user);
  recordHit(`regburst:${c.ip}`);
  screenRegistrationBurst(c.ip, countHits(`regburst:${c.ip}`, 3_600_000), user.id);
  const devToken = issueToken(user.id, "verify", 24 * 3_600_000);
  sendEmail(email, "Verify your Community Store account", `Open this link to verify: ${publicUrl()}/?verify=${devToken}`);
  saveDb();
  return json(
    {
      message: "Account created. Check your email for a verification link.",
      ...(isProd() ? {} : { devVerifyToken: devToken }),
    },
    201,
  );
}

function issueToken(userId: string, kind: "verify" | "reset", ttl: number): string {
  const raw = randomToken();
  getDb().tokens.push({ id: sha256(raw), userId, kind, expiresAt: Date.now() + ttl, used: false });
  return raw;
}

function consumeToken(raw: unknown, kind: "verify" | "reset") {
  if (typeof raw !== "string" || raw.length < 20) return null;
  const t = getDb().tokens.find((x) => x.id === sha256(raw) && x.kind === kind);
  if (!t || t.used || t.expiresAt < Date.now()) return null;
  return t;
}

function verifyEmail(c: Ctx): Response {
  const t = consumeToken(c.body["token"], "verify");
  if (!t) return fail("This verification link is invalid or has expired", 400);
  const u = getDb().users.find((x) => x.id === t.userId);
  if (!u) return fail("Account not found", 404);
  t.used = true;
  u.emailVerified = true;
  notify(u.id, "account", "Your email address is verified. Welcome to Community Store!");
  saveDb();
  return json({ message: "Email verified. You can now log in." });
}

function resendVerification(c: Ctx): Response {
  if (rateLimited(`resend:${c.ip}`, 5, 3_600_000)) return fail("Too many requests", 429);
  const email = str(c.body["email"], 120).toLowerCase();
  const u = getDb().users.find((x) => x.email === email);
  let dev: string | undefined;
  if (u && !u.emailVerified) {
    dev = issueToken(u.id, "verify", 24 * 3_600_000);
    sendEmail(email, "Verify your Community Store account", `Open this link to verify: ${publicUrl()}/?verify=${dev}`);
    saveDb();
  }
  return json({ message: "If that account exists and is unverified, a new link has been sent.", ...(isProd() || !dev ? {} : { devVerifyToken: dev }) });
}

async function login(c: Ctx): Promise<Response> {
  const email = str(c.body["email"], 120).toLowerCase();
  const password = typeof c.body["password"] === "string" ? (c.body["password"] as string) : "";
  if (!email || !password) return fail("Email and password required", 400);
  const key = `login:${email}`;
  if (peekRateLimit(key, 5, 15 * 60_000))
    return fail("Too many failed attempts. Please wait 15 minutes or reset your password.", 429);
  const u = getDb().users.find((x) => x.email === email);
  const ok = await verifyPassword(password, u ? u.passwordHash : DUMMY_HASH);
  if (!u || !ok) {
    recordHit(key);
    return fail("Incorrect email or password", 401);
  }
  if (!u.emailVerified)
    return fail("Please verify your email address before logging in", 403, { needsVerification: true });
  clearHits(key);
  const token = await signToken({ userId: u.id, email: u.email, role: u.role });
  return json({ token, user: publicUser(u) });
}

function forgotPassword(c: Ctx): Response {
  if (rateLimited(`forgot:${c.ip}`, 5, 3_600_000)) return fail("Too many requests", 429);
  const email = str(c.body["email"], 120).toLowerCase();
  const u = getDb().users.find((x) => x.email === email);
  let dev: string | undefined;
  if (u) {
    dev = issueToken(u.id, "reset", 3_600_000);
    sendEmail(email, "Reset your Community Store password", `Open this link within 1 hour: ${publicUrl()}/?reset=${dev}`);
    saveDb();
  }
  return json({ message: "If that email is registered, a reset link has been sent.", ...(isProd() || !dev ? {} : { devResetToken: dev }) });
}

async function resetPassword(c: Ctx): Promise<Response> {
  const pw = passwordProblem(c.body["password"]);
  if (pw) return fail(pw);
  const t = consumeToken(c.body["token"], "reset");
  if (!t) return fail("This reset link is invalid or has expired", 400);
  const u = getDb().users.find((x) => x.id === t.userId);
  if (!u) return fail("Account not found", 404);
  u.passwordHash = await hashPassword(c.body["password"] as string);
  t.used = true;
  for (const other of getDb().tokens) if (other.userId === u.id && other.kind === "reset") other.used = true;
  clearHits(`login:${u.email}`);
  notify(u.id, "account", "Your password was changed. If this wasn't you, contact support immediately.");
  saveDb();
  return json({ message: "Password updated. You can now log in." });
}

function twoFactorSetup(c: Ctx): Response {
  const u = c.user!;
  if (u.twoFactorEnabled) return fail("Two-factor authentication is already enabled", 409);
  u.twoFactorSecret = newTotpSecret();
  saveDb();
  return json({
    secret: u.twoFactorSecret,
    otpauthUrl: `otpauth://totp/CommunityStore:${encodeURIComponent(u.email)}?secret=${u.twoFactorSecret}&issuer=CommunityStore`,
  });
}

function twoFactorEnable(c: Ctx): Response {
  const u = c.user!;
  if (!u.twoFactorSecret || !verifyTotp(u.twoFactorSecret, c.body["code"])) return fail("That code is not correct", 400);
  u.twoFactorEnabled = true;
  notify(u.id, "account", "Two-factor authentication was turned on.");
  saveDb();
  return json({ user: publicUser(u) });
}

async function twoFactorDisable(c: Ctx): Promise<Response> {
  const u = c.user!;
  const okPw = await verifyPassword(typeof c.body["password"] === "string" ? (c.body["password"] as string) : "", u.passwordHash);
  if (!okPw || !verifyTotp(u.twoFactorSecret, c.body["code"])) return fail("Password or code is not correct", 400);
  u.twoFactorEnabled = false;
  u.twoFactorSecret = "";
  notify(u.id, "account", "Two-factor authentication was turned off.");
  saveDb();
  return json({ user: publicUser(u) });
}

// ---------- profile ----------
function updateMe(c: Ctx): Response {
  const u = c.user!;
  const name = str(c.body["name"], 60);
  if ("name" in c.body) {
    if (name.length < 2) return fail("Please enter your name");
    u.name = name;
  }
  if ("bio" in c.body) u.bio = str(c.body["bio"], 200);
  if ("campusZone" in c.body) {
    const z = str(c.body["campusZone"], 30);
    if (!ZONES.includes(z)) return fail("Unknown campus zone");
    u.campusZone = z;
  }
  if ("avatar" in c.body) {
    if (c.body["avatar"] === "") u.avatar = "";
    else {
      const a = cleanImage(c.body["avatar"], "", 300_000);
      if (a.startsWith("asset:")) return fail("Profile photo must be a PNG, JPEG or WebP under 200 KB");
      u.avatar = a;
    }
  }
  saveDb();
  return json({ user: publicUser(u) });
}

function history(c: Ctx): Response {
  const u = c.user!;
  const db = getDb();
  return json({
    listings: db.products.filter((p) => p.sellerId === u.id && !p.removed).map(publicProduct),
    orders: db.orders
      .filter((o) => o.buyerId === u.id || o.items.some((i) => i.sellerId === u.id))
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((o) => publicOrder(o, u)),
    reviews: db.reviews.filter((r) => r.reviewerId === u.id),
  });
}

// ---------- products ----------
function productInput(body: Body): { error: string } | { value: Omit<Product, "id" | "sellerId" | "seller" | "baseRating" | "boostType" | "boostedUntil" | "removed" | "createdAt"> } {
  const title = str(body["title"], 80);
  const price = Number(body["price"]);
  const quantity = Number(body["quantity"]);
  const category = str(body["category"], 40);
  const condition = str(body["condition"], 20);
  const zone = str(body["campusZone"], 30);
  const discount = body["studentDiscount"] === undefined ? 0 : Number(body["studentDiscount"]);
  if (title.length < 3) return { error: "Title must be at least 3 characters" };
  if (!Number.isFinite(price) || price < 1 || price > 1_000_000) return { error: "Price must be between R1 and R1 000 000" };
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) return { error: "Quantity must be between 1 and 999" };
  if (!CATEGORIES.includes(category)) return { error: "Choose a valid category" };
  if (!CONDITIONS.includes(condition)) return { error: "Choose a valid condition" };
  if (!ZONES.includes(zone)) return { error: "Unknown campus zone" };
  if (!Number.isFinite(discount) || discount < 0 || discount > 50) return { error: "Student discount must be 0–50%" };
  return {
    value: {
      title,
      price: Math.round(price * 100) / 100,
      quantity,
      category,
      condition,
      campusZone: zone,
      studentDiscount: discount,
      description: str(body["description"], 400) || "No description provided.",
      image: cleanImage(body["image"], category),
    },
  };
}

function canSell(u: User): string | null {
  if (u.role === "resident" || u.role === "faculty") return "Your account type cannot list items for sale";
  if (u.role === "vendor" && u.vendorStatus !== "approved") return "Your vendor account is awaiting approval";
  return null;
}

function createProduct(c: Ctx): Response {
  const u = c.user!;
  const block = canSell(u);
  if (block) return fail(block, 403);
  if (rateLimited(`listing:${u.id}`, 20, 3_600_000)) return fail("You are creating listings too quickly", 429);
  const parsed = productInput(c.body);
  if ("error" in parsed) return fail(parsed.error);
  const p: Product = {
    id: uid(),
    sellerId: u.id,
    seller: u.name,
    baseRating: 0,
    boostType: "",
    boostedUntil: 0,
    removed: false,
    createdAt: Date.now(),
    ...parsed.value,
  };
  getDb().products.unshift(p);
  screenListing(p, u);
  saveDb();
  return json({ product: publicProduct(p) }, 201);
}

function ownProduct(c: Ctx): { p: Product } | { res: Response } {
  const p = getDb().products.find((x) => x.id === c.params["id"] && !x.removed);
  if (!p) return { res: fail("Listing not found", 404) };
  if (p.sellerId !== c.user!.id && c.user!.role !== "faculty") return { res: fail("You can only change your own listings", 403) };
  return { p };
}

function updateProduct(c: Ctx): Response {
  const r = ownProduct(c);
  if ("res" in r) return r.res;
  const parsed = productInput({ ...c.body, image: c.body["image"] ?? r.p.image });
  if ("error" in parsed) return fail(parsed.error);
  Object.assign(r.p, parsed.value);
  saveDb();
  return json({ product: publicProduct(r.p) });
}

function deleteProduct(c: Ctx): Response {
  const r = ownProduct(c);
  if ("res" in r) return r.res;
  r.p.removed = true; // soft delete keeps order history intact
  saveDb();
  return json({ deleted: true });
}

function boostProduct(c: Ctx): Response {
  const u = c.user!;
  const p = getDb().products.find((x) => x.id === c.params["id"] && !x.removed);
  if (!p || p.sellerId !== u.id) return fail("Listing not found", 404);
  const type = c.body["type"];
  const duration = Number(c.body["duration"]);
  if ((type !== "featured" && type !== "urgent") || ![1, 3, 7].includes(duration)) return fail("Invalid boost");
  const cost = (type === "featured" ? 50 : 30) * duration;
  if (u.loyaltyPoints < cost) return fail(`You need ${cost} points for this boost`, 402);
  u.loyaltyPoints -= cost;
  p.boostType = type;
  p.boostedUntil = Date.now() + duration * 86_400_000;
  saveDb();
  return json({ product: publicProduct(p), user: publicUser(u) });
}

function listProducts(): Response {
  const db = getDb();
  const list = db.products
    .filter((p) => !p.removed && p.quantity >= 0)
    .sort((a, b) => Number(b.boostedUntil > Date.now()) - Number(a.boostedUntil > Date.now()) || b.createdAt - a.createdAt)
    .map(publicProduct);
  return json({ products: list });
}

function listReviews(c: Ctx): Response {
  const rs = getDb().reviews
    .filter((r) => r.productId === c.params["id"])
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((r) => ({ id: r.id, reviewer: r.reviewer, rating: r.rating, comment: r.comment, time: relTime(r.createdAt) }));
  return json({ reviews: rs });
}

function postReview(c: Ctx): Response {
  const u = c.user!;
  const db = getDb();
  const p = db.products.find((x) => x.id === c.params["id"]);
  if (!p) return fail("Listing not found", 404);
  if (p.sellerId === u.id) return fail("You cannot review your own listing", 403);
  const rating = Number(c.body["rating"]);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return fail("Rating must be 1 to 5 stars");
  const bought = db.orders.some(
    (o) => o.buyerId === u.id && o.status === "completed" && o.items.some((i) => i.productId === p.id),
  );
  if (!bought) return fail("You can review an item after you have collected it and confirmed the order", 403);
  const comment = str(c.body["comment"], 300);
  const existing = db.reviews.find((r) => r.productId === p.id && r.reviewerId === u.id);
  if (existing) {
    existing.rating = rating;
    existing.comment = comment;
  } else {
    db.reviews.push({ id: uid(), productId: p.id, sellerId: p.sellerId, reviewerId: u.id, reviewer: u.name, rating, comment, createdAt: Date.now() });
    addPoints(u, 5);
    notify(p.sellerId, "system", `${u.name} left a ${rating}-star review on "${p.title}".`);
  }
  saveDb();
  return json({ product: publicProduct(p) }, existing ? 200 : 201);
}

// ---------- bulletin board ----------
function listNotices(c: Ctx): Response {
  const today = new Date().toISOString().slice(0, 10);
  const list = getDb().notices
    .filter((n) => !n.removed && (!n.expiresAt || n.expiresAt >= today))
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((n) => publicNotice(n, c.user));
  return json({ notices: list });
}

function createNotice(c: Ctx): Response {
  const u = c.user!;
  const type = str(c.body["type"], 30);
  const title = str(c.body["title"], 80);
  const body = str(c.body["body"], 500);
  const expiresAt = str(c.body["expiresAt"], 10);
  if (!NOTICE_TYPES.includes(type)) return fail("Choose a valid notice type");
  if (title.length < 3 || body.length < 3) return fail("Please add a title and some details");
  if (expiresAt && !/^\d{4}-\d{2}-\d{2}$/.test(expiresAt)) return fail("Expiry must be a date");
  if (rateLimited(`notice:${u.id}`, 10, 3_600_000)) return fail("You are posting too quickly", 429);
  const n: Notice = {
    id: uid(), type, title, body, authorId: u.id, author: u.name, likedBy: [], baseLikes: 0, comments: [],
    contact: str(c.body["contact"], 80), expiresAt, removed: false, createdAt: Date.now(),
  };
  getDb().notices.unshift(n);
  addPoints(u, 5);
  saveDb();
  return json({ notice: publicNotice(n, u) }, 201);
}

function likeNotice(c: Ctx): Response {
  const n = getDb().notices.find((x) => x.id === c.params["id"] && !x.removed);
  if (!n) return fail("Notice not found", 404);
  const i = n.likedBy.indexOf(c.user!.id);
  if (i >= 0) n.likedBy.splice(i, 1);
  else n.likedBy.push(c.user!.id);
  saveDb();
  return json({ notice: publicNotice(n, c.user) });
}

function commentNotice(c: Ctx): Response {
  const n = getDb().notices.find((x) => x.id === c.params["id"] && !x.removed);
  if (!n) return fail("Notice not found", 404);
  const body = str(c.body["body"], 300);
  if (!body) return fail("Write a reply first");
  if (rateLimited(`comment:${c.user!.id}`, 30, 3_600_000)) return fail("You are replying too quickly", 429);
  n.comments.push({ id: uid(), authorId: c.user!.id, author: c.user!.name, body, createdAt: Date.now() });
  if (n.authorId !== c.user!.id) notify(n.authorId, "message", `${c.user!.name} replied to your notice "${n.title}".`);
  saveDb();
  return json({ notice: publicNotice(n, c.user) }, 201);
}

function deleteNotice(c: Ctx): Response {
  const n = getDb().notices.find((x) => x.id === c.params["id"] && !x.removed);
  if (!n) return fail("Notice not found", 404);
  if (n.authorId !== c.user!.id && c.user!.role !== "faculty") return fail("You can only delete your own notices", 403);
  n.removed = true;
  saveDb();
  return json({ deleted: true });
}

// ---------- orders & payments ----------
function markOrderPaid(order: Order): void {
  if (order.status !== "pending_payment") return;
  const db = getDb();
  for (const it of order.items) {
    const p = db.products.find((x) => x.id === it.productId);
    if (p) p.quantity = Math.max(0, p.quantity - it.qty);
  }
  order.status = "paid";
  order.paidAt = Date.now();
  notify(order.buyerId, "order", `Payment received. Funds for order #${order.id.slice(0, 8)} are held in escrow.`);
  for (const sid of new Set(order.items.map((i) => i.sellerId))) {
    notify(sid, "order", `New paid order #${order.id.slice(0, 8)} from ${order.buyer}. Arrange collection.`);
  }
  const buyer = db.users.find((u) => u.id === order.buyerId);
  if (buyer) screenOrder(order, buyer);
}

function createOrder(c: Ctx): Promise<Response> | Response {
  const u = c.user!;
  const db = getDb();
  const via = c.body["via"];
  if (via !== "PayFast" && via !== "SnapScan") return fail("Choose PayFast or SnapScan");
  if (!paymentsAvailable(via)) return fail("This payment method is not available right now", 503);
  if (u.twoFactorEnabled && !verifyTotp(u.twoFactorSecret, c.body["code"]))
    return fail("Enter the 6-digit code from your authenticator app", 401, { needsTwoFactor: true });
  const rawItems = Array.isArray(c.body["items"]) ? (c.body["items"] as unknown[]) : [];
  if (!rawItems.length || rawItems.length > 20) return fail("Your cart is empty");
  if (rateLimited(`order:${u.id}`, 15, 3_600_000)) return fail("Too many orders. Please slow down.", 429);

  const items: Order["items"] = [];
  const merged = new Map<string, number>();
  for (const r of rawItems) {
    const o = r as Body;
    const id = str(o["productId"], 60);
    const qty = Number(o["qty"]);
    if (!id || !Number.isInteger(qty) || qty < 1 || qty > 999) return fail("Invalid cart item");
    merged.set(id, (merged.get(id) ?? 0) + qty);
  }
  for (const [id, qty] of merged) {
    const p = db.products.find((x) => x.id === id && !x.removed);
    if (!p) return fail("An item in your cart is no longer available");
    if (p.sellerId === u.id) return fail("You cannot buy your own listing");
    if (qty > p.quantity) return fail(`Only ${p.quantity} left of "${p.title}"`, 409);
    items.push({ productId: p.id, title: p.title, unitPrice: unitPrice(p.price, p.studentDiscount, u.role), qty, sellerId: p.sellerId, seller: p.seller });
  }
  const totals = orderTotals(items.map((i) => ({ unit: i.unitPrice, qty: i.qty })));
  if (totals.total < 1) return fail("Order total is too low");
  const order: Order = {
    id: uid(), buyerId: u.id, buyer: u.name, items, ...totals, via,
    mode: "simulated", status: "pending_payment", createdAt: Date.now(), paidAt: 0, readyAt: 0, completedAt: 0,
  };
  const payment = initPayment(order, u.email, u.name);
  order.mode = payment.mode;
  db.orders.unshift(order);
  if (payment.paid) markOrderPaid(order);
  saveDb();
  return json({ order: publicOrder(order, u), payment: payment.paid ? { mode: payment.mode } : payment }, 201);
}

function listOrders(c: Ctx): Response {
  const u = c.user!;
  const list = getDb().orders
    .filter((o) => o.buyerId === u.id || o.items.some((i) => i.sellerId === u.id))
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((o) => publicOrder(o, u));
  return json({ orders: list });
}

function getOrder(c: Ctx): Response {
  const o = getDb().orders.find((x) => x.id === c.params["id"]);
  if (!o || (o.buyerId !== c.user!.id && !o.items.some((i) => i.sellerId === c.user!.id))) return fail("Order not found", 404);
  return json({ order: publicOrder(o, c.user!) });
}

function markReady(c: Ctx): Response {
  const o = getDb().orders.find((x) => x.id === c.params["id"]);
  if (!o || !o.items.some((i) => i.sellerId === c.user!.id)) return fail("Order not found", 404);
  if (o.status !== "paid") return fail("Only paid orders can be marked ready", 409);
  o.status = "ready";
  o.readyAt = Date.now();
  notify(o.buyerId, "order", `Your order #${o.id.slice(0, 8)} is ready for collection. Confirm once you have it to release payment.`);
  saveDb();
  return json({ order: publicOrder(o, c.user!) });
}

function confirmOrder(c: Ctx): Response {
  const db = getDb();
  const o = db.orders.find((x) => x.id === c.params["id"] && x.buyerId === c.user!.id);
  if (!o) return fail("Order not found", 404);
  if (o.status !== "paid" && o.status !== "ready") return fail("This order cannot be confirmed yet", 409);
  o.status = "completed";
  o.completedAt = Date.now();
  const parties = new Set([o.buyerId, ...o.items.map((i) => i.sellerId)]);
  for (const id of parties) {
    const u = db.users.find((x) => x.id === id);
    if (!u) continue;
    u.completedTrades += 1;
    addPoints(u, 10);
    if (u.completedTrades >= 5 && !u.badges.includes("Trusted Trader")) u.badges.push("Trusted Trader");
  }
  for (const sid of new Set(o.items.map((i) => i.sellerId))) {
    notify(sid, "order", `Order #${o.id.slice(0, 8)} was confirmed. Escrow funds have been released to you.`);
  }
  saveDb();
  return json({ order: publicOrder(o, c.user!), user: publicUser(c.user!) });
}

function cancelOrder(c: Ctx): Response {
  const o = getDb().orders.find((x) => x.id === c.params["id"] && x.buyerId === c.user!.id);
  if (!o) return fail("Order not found", 404);
  if (o.status !== "pending_payment") return fail("Only unpaid orders can be cancelled", 409);
  o.status = "cancelled";
  saveDb();
  return json({ order: publicOrder(o, c.user!) });
}

async function payfastNotify(c: Ctx): Promise<Response> {
  const f = verifyPayfastItn(c.rawBody);
  if (!f) return new Response("invalid signature", { status: 400 });
  const o = getDb().orders.find((x) => x.id === f["m_payment_id"]);
  if (!o || o.via !== "PayFast") return new Response("unknown order", { status: 404 });
  if (Math.abs(Number(f["amount_gross"]) - o.total) > 0.01) return new Response("amount mismatch", { status: 400 });
  if (f["payment_status"] === "COMPLETE") markOrderPaid(o);
  else if (f["payment_status"] === "CANCELLED" && o.status === "pending_payment") o.status = "cancelled";
  saveDb();
  return new Response("OK");
}

async function snapscanNotify(c: Ctx): Promise<Response> {
  if (!verifySnapscan(c.rawBody, c.req.headers.get("authorization"))) return new Response("invalid signature", { status: 401 });
  const payload = new URLSearchParams(c.rawBody).get("payload");
  let data: Body = {};
  try {
    data = JSON.parse(payload ?? "{}") as Body;
  } catch {
    return new Response("bad payload", { status: 400 });
  }
  const o = getDb().orders.find((x) => x.id === data["merchantReference"] || x.id === data["id"]);
  if (!o || o.via !== "SnapScan") return new Response("unknown order", { status: 404 });
  if (Number(data["totalAmount"]) !== Math.round(o.total * 100)) return new Response("amount mismatch", { status: 400 });
  if (data["status"] === "completed") markOrderPaid(o);
  saveDb();
  return new Response("OK");
}

// ---------- notifications & messages ----------
function listNotifications(c: Ctx): Response {
  const list = getDb().notifications
    .filter((n) => n.userId === c.user!.id)
    .slice(0, 50)
    .map((n) => ({ id: n.id, type: n.type, message: n.message, read: n.read, time: relTime(n.createdAt) }));
  return json({ notifications: list });
}

function readAllNotifications(c: Ctx): Response {
  for (const n of getDb().notifications) if (n.userId === c.user!.id) n.read = true;
  saveDb();
  return json({ ok: true });
}

const PHONE_LIKE = /(?:\d[\s().-]*){9,}/;

function threadFor(c: Ctx, productId: string, withId: string): { buyerId: string; otherId: string } | null {
  const p = getDb().products.find((x) => x.id === productId);
  if (!p) return null;
  const me = c.user!.id;
  if (me === p.sellerId) return withId ? { buyerId: withId, otherId: withId } : null;
  return { buyerId: me, otherId: p.sellerId };
}

function listMessages(c: Ctx): Response {
  const productId = c.url.searchParams.get("productId") ?? "";
  const t = threadFor(c, productId, c.url.searchParams.get("with") ?? "");
  if (!t) return fail("Conversation not found", 404);
  const list = getDb().messages
    .filter((m) => m.productId === productId && m.buyerId === t.buyerId)
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((m) => ({ id: m.id, mine: m.fromId === c.user!.id, text: m.text, time: relTime(m.createdAt) }));
  return json({ messages: list });
}

function listThreads(c: Ctx): Response {
  const db = getDb();
  const me = c.user!.id;
  const seen = new Map<string, { productId: string; title: string; withId: string; withName: string; last: string; at: number }>();
  for (const m of [...db.messages].sort((a, b) => a.createdAt - b.createdAt)) {
    if (m.fromId !== me && m.toId !== me) continue;
    const p = db.products.find((x) => x.id === m.productId);
    const otherId = m.fromId === me ? m.toId : m.fromId;
    const other = db.users.find((u) => u.id === otherId);
    seen.set(`${m.productId}:${m.buyerId}`, { productId: m.productId, title: p?.title ?? "Removed listing", withId: otherId, withName: other?.name ?? "User", last: m.text, at: m.createdAt });
  }
  const threads = [...seen.values()].sort((a, b) => b.at - a.at).map((t) => ({ ...t, time: relTime(t.at) }));
  return json({ threads });
}

function sendMessage(c: Ctx): Response {
  const productId = str(c.body["productId"], 60);
  const text = str(c.body["text"], 500);
  if (!text) return fail("Write a message first");
  if (PHONE_LIKE.test(text)) return fail("For your safety, phone numbers can't be shared in chat. Arrange collection here instead.");
  const t = threadFor(c, productId, str(c.body["toUserId"], 60));
  if (!t) return fail("Conversation not found", 404);
  if (t.otherId === c.user!.id) return fail("You cannot message yourself", 400);
  if (rateLimited(`msg:${c.user!.id}`, 60, 3_600_000)) return fail("You are sending messages too quickly", 429);
  const p = getDb().products.find((x) => x.id === productId)!;
  getDb().messages.push({ id: uid(), productId, buyerId: t.buyerId, fromId: c.user!.id, toId: t.otherId, text, createdAt: Date.now() });
  notify(t.otherId, "message", `${c.user!.name} sent you a message about "${p.title}".`);
  saveDb();
  return json({ ok: true }, 201);
}

// ---------- moderation, vendors, fraud, leaderboard ----------
function postFlag(c: Ctx): Response {
  const db = getDb();
  const type = c.body["type"] === "notice" ? "notice" : "product";
  const itemId = str(c.body["itemId"], 60);
  const exists = type === "product" ? db.products.some((p) => p.id === itemId) : db.notices.some((n) => n.id === itemId);
  if (!exists) return fail("Item not found", 404);
  if (db.flags.some((f) => f.itemId === itemId && f.reporterId === c.user!.id && f.status === "pending"))
    return fail("You already reported this item", 409);
  db.flags.unshift({ id: uid(), type, itemId, reason: str(c.body["reason"], 120) || "Suspicious content", reporterId: c.user!.id, reporter: c.user!.name, status: "pending", resolution: "", createdAt: Date.now() });
  saveDb();
  return json({ ok: true }, 201);
}

function listFlags(): Response {
  const db = getDb();
  return json({
    flags: db.flags.map((f) => {
      const target = f.type === "product" ? db.products.find((p) => p.id === f.itemId) : db.notices.find((n) => n.id === f.itemId);
      return { id: f.id, type: f.type, itemId: f.itemId, title: target?.title ?? "Removed item", reason: f.reason, reporter: f.reporter, timestamp: relTime(f.createdAt), status: f.status, resolution: f.resolution };
    }),
  });
}

function resolveFlag(c: Ctx): Response {
  const db = getDb();
  const f: Flag | undefined = db.flags.find((x) => x.id === c.params["id"]);
  if (!f) return fail("Flag not found", 404);
  const action = c.body["action"];
  if (action !== "remove" && action !== "keep") return fail("Invalid action");
  f.status = "resolved";
  f.resolution = action === "remove" ? "removed" : "kept";
  if (action === "remove") {
    const target = f.type === "product" ? db.products.find((p) => p.id === f.itemId) : db.notices.find((n) => n.id === f.itemId);
    if (target) {
      target.removed = true;
      const ownerId = "sellerId" in target ? target.sellerId : target.authorId;
      notify(ownerId, "system", `Your post "${target.title}" was removed by a moderator.`);
    }
  }
  saveDb();
  return json({ ok: true });
}

function listFraud(): Response {
  return json({
    alerts: getDb().fraudAlerts.slice(0, 50).map((a) => ({ id: a.id, type: a.type, description: a.description, severity: a.severity, targetId: a.targetId, timestamp: relTime(a.createdAt) })),
  });
}

function listPendingVendors(): Response {
  return json({
    vendors: getDb().users.filter((u) => u.role === "vendor" && u.vendorStatus === "pending").map((u) => ({ id: u.id, name: u.name, email: u.email, businessReg: u.businessReg })),
  });
}

function decideVendor(c: Ctx): Response {
  const u = getDb().users.find((x) => x.id === c.params["id"] && x.role === "vendor");
  if (!u) return fail("Vendor not found", 404);
  const action = c.body["action"];
  if (action !== "approve" && action !== "reject") return fail("Invalid action");
  u.vendorStatus = action === "approve" ? "approved" : "rejected";
  notify(u.id, "account", action === "approve" ? "Your vendor account is approved. You can now list products." : "Your vendor application was not approved. Please check your registration details.");
  saveDb();
  return json({ ok: true });
}

function leaderboard(c: Ctx): Response {
  const top = getDb().users
    .filter((u) => u.role !== "faculty")
    .sort((a, b) => b.loyaltyPoints - a.loyaltyPoints)
    .slice(0, 5)
    .map((u) => ({ id: u.id, name: u.name, points: u.loyaltyPoints, badge: u.badges[0] ?? "", you: c.user?.id === u.id }));
  return json({ leaders: top });
}

// ---------- routing ----------
type Route = { method: string; pattern: string[]; handler: Handler; auth: "none" | "optional" | "user" | "faculty"; };
const R = (method: string, path: string, auth: Route["auth"], handler: Handler): Route => ({ method, pattern: path.split("/"), handler, auth });

const routes: Route[] = [
  R("POST", "auth/register", "none", register),
  R("POST", "auth/verify-email", "none", verifyEmail),
  R("POST", "auth/resend-verification", "none", resendVerification),
  R("POST", "auth/login", "none", login),
  R("POST", "login", "none", login), // legacy path
  R("POST", "auth/logout", "none", () => json({ success: true })),
  R("POST", "logout", "none", () => json({ success: true })), // legacy path
  R("POST", "auth/forgot", "none", forgotPassword),
  R("POST", "auth/reset", "none", resetPassword),
  R("POST", "auth/2fa/setup", "user", twoFactorSetup),
  R("POST", "auth/2fa/enable", "user", twoFactorEnable),
  R("POST", "auth/2fa/disable", "user", twoFactorDisable),
  R("GET", "verify", "user", (c) => json({ valid: true, user: publicUser(c.user!) })), // legacy path
  R("GET", "me", "user", (c) => json({ user: publicUser(c.user!) })),
  R("PATCH", "me", "user", updateMe),
  R("GET", "me/history", "user", history),
  R("GET", "products", "optional", listProducts),
  R("POST", "products", "user", createProduct),
  R("PUT", "products/:id", "user", updateProduct),
  R("DELETE", "products/:id", "user", deleteProduct),
  R("POST", "products/:id/boost", "user", boostProduct),
  R("GET", "products/:id/reviews", "optional", listReviews),
  R("POST", "products/:id/reviews", "user", postReview),
  R("GET", "notices", "optional", listNotices),
  R("POST", "notices", "user", createNotice),
  R("POST", "notices/:id/like", "user", likeNotice),
  R("POST", "notices/:id/comments", "user", commentNotice),
  R("DELETE", "notices/:id", "user", deleteNotice),
  R("GET", "orders", "user", listOrders),
  R("POST", "orders", "user", createOrder),
  R("GET", "orders/:id", "user", getOrder),
  R("POST", "orders/:id/ready", "user", markReady),
  R("POST", "orders/:id/confirm", "user", confirmOrder),
  R("POST", "orders/:id/cancel", "user", cancelOrder),
  R("POST", "payments/payfast/notify", "none", payfastNotify),
  R("POST", "payments/snapscan/notify", "none", snapscanNotify),
  R("GET", "notifications", "user", listNotifications),
  R("POST", "notifications/read-all", "user", readAllNotifications),
  R("GET", "messages/threads", "user", listThreads),
  R("GET", "messages", "user", listMessages),
  R("POST", "messages", "user", sendMessage),
  R("POST", "flags", "user", postFlag),
  R("GET", "leaderboard", "optional", leaderboard),
  R("GET", "admin/flags", "faculty", listFlags),
  R("POST", "admin/flags/:id", "faculty", resolveFlag),
  R("GET", "admin/fraud", "faculty", listFraud),
  R("GET", "admin/vendors", "faculty", listPendingVendors),
  R("POST", "admin/vendors/:id", "faculty", decideVendor),
];

function match(route: Route, method: string, seg: string[]): Record<string, string> | null {
  if (route.method !== method || route.pattern.length !== seg.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < seg.length; i++) {
    const pat = route.pattern[i]!;
    const part = seg[i]!;
    if (pat.startsWith(":")) params[pat.slice(1)] = decodeURIComponent(part);
    else if (pat !== part) return null;
  }
  return params;
}

async function authenticate(req: Request): Promise<User | null> {
  const token = parseAuthHeader(req.headers.get("Authorization"));
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;
  return getDb().users.find((u) => u.id === payload.userId && u.emailVerified) ?? null;
}

export async function handleApi(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const seg = url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
    const ip = (req.headers.get("x-forwarded-for") ?? "local").split(",")[0]!.trim();
    if (rateLimited(`api:${ip}`, 600, 60_000)) return fail("Too many requests", 429);

    let route: Route | undefined;
    let params: Record<string, string> = {};
    let pathExists = false;
    for (const r of routes) {
      const p = match(r, req.method, seg);
      if (p) { route = r; params = p; break; }
      if (r.pattern.length === seg.length && r.pattern.every((x, i) => x.startsWith(":") || x === seg[i])) pathExists = true;
    }
    if (!route) return pathExists ? fail("Method not allowed", 405) : fail("Not found", 404);

    let rawBody = "";
    let body: Body = {};
    if (req.method !== "GET" && req.method !== "DELETE") {
      rawBody = await req.text();
      if (rawBody.length > MAX_BODY) return fail("Request too large", 413);
      const ct = req.headers.get("content-type") ?? "";
      if (rawBody && ct.includes("application/json")) {
        try {
          const parsed: unknown = JSON.parse(rawBody);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) body = parsed as Body;
        } catch {
          return fail("Invalid JSON", 400);
        }
      }
    }

    const user = route.auth === "none" ? null : await authenticate(req);
    if ((route.auth === "user" || route.auth === "faculty") && !user) return fail("Please log in", 401);
    if (route.auth === "faculty" && user!.role !== "faculty") return fail("Moderator access only", 403);

    return await route.handler({ req, url, params, body, rawBody, user, ip });
  } catch (error) {
    console.error(error);
    return fail("Something went wrong on our side", 500);
  }
}
