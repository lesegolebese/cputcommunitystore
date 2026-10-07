// Server-side persistence. A small JSON-file database so the project runs with zero extra
// services. Every collection is a plain array; swap this module for Postgres/Supabase later
// without touching the handlers (they only use getDb()/saveDb()).
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { buildSeed } from "./seed.ts";

export type Role = "student" | "vendor" | "faculty" | "resident";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  passwordHash: string;
  emailVerified: boolean;
  vendorStatus: "none" | "pending" | "approved" | "rejected";
  businessReg: string;
  bio: string;
  avatar: string;
  campusZone: string;
  twoFactorSecret: string;
  twoFactorEnabled: boolean;
  loyaltyPoints: number;
  badges: string[];
  completedTrades: number;
  createdAt: number;
}

export interface Product {
  id: string;
  title: string;
  price: number;
  category: string;
  condition: string;
  sellerId: string;
  seller: string;
  image: string;
  description: string;
  quantity: number;
  campusZone: string;
  studentDiscount: number;
  baseRating: number;
  boostType: "" | "featured" | "urgent";
  boostedUntil: number;
  removed: boolean;
  createdAt: number;
}

export interface NoticeComment {
  id: string;
  authorId: string;
  author: string;
  body: string;
  createdAt: number;
}

export interface Notice {
  id: string;
  type: string;
  title: string;
  body: string;
  authorId: string;
  author: string;
  likedBy: string[];
  baseLikes: number;
  comments: NoticeComment[];
  contact: string;
  expiresAt: string;
  removed: boolean;
  createdAt: number;
}

export interface Review {
  id: string;
  productId: string;
  sellerId: string;
  reviewerId: string;
  reviewer: string;
  rating: number;
  comment: string;
  createdAt: number;
}

export interface OrderItem {
  productId: string;
  title: string;
  unitPrice: number;
  qty: number;
  sellerId: string;
  seller: string;
}

export type OrderStatus = "pending_payment" | "paid" | "ready" | "completed" | "cancelled";

export interface Order {
  id: string;
  buyerId: string;
  buyer: string;
  items: OrderItem[];
  subtotal: number;
  fee: number;
  total: number;
  via: "PayFast" | "SnapScan";
  mode: "simulated" | "sandbox" | "live";
  status: OrderStatus;
  createdAt: number;
  paidAt: number;
  readyAt: number;
  completedAt: number;
}

export interface Notification {
  id: string;
  userId: string;
  type: "order" | "message" | "account" | "system";
  message: string;
  read: boolean;
  createdAt: number;
}

export interface Message {
  id: string;
  productId: string;
  buyerId: string;
  fromId: string;
  toId: string;
  text: string;
  createdAt: number;
}

export interface Flag {
  id: string;
  type: "product" | "notice";
  itemId: string;
  reason: string;
  reporterId: string;
  reporter: string;
  status: "pending" | "resolved";
  resolution: "" | "removed" | "kept";
  createdAt: number;
}

export interface FraudAlert {
  id: string;
  type: "suspicious_listing" | "abnormal_transaction" | "fake_account";
  description: string;
  severity: "low" | "medium" | "high";
  targetId: string;
  createdAt: number;
}

export interface AuthToken {
  id: string; // sha256 of the raw token, never the token itself
  userId: string;
  kind: "verify" | "reset";
  expiresAt: number;
  used: boolean;
}

export interface DB {
  users: User[];
  products: Product[];
  notices: Notice[];
  reviews: Review[];
  orders: Order[];
  notifications: Notification[];
  messages: Message[];
  flags: Flag[];
  fraudAlerts: FraudAlert[];
  tokens: AuthToken[];
}

let cache: DB | null = null;
let cachePath = "";

export function dbPath(): string {
  return process.env["DB_FILE"] || "data/db.json";
}

export function getDb(): DB {
  const path = dbPath();
  if (cache && cachePath === path) return cache;
  if (existsSync(path)) {
    cache = JSON.parse(readFileSync(path, "utf8")) as DB;
  } else {
    cache = buildSeed();
    cachePath = path;
    saveDb();
  }
  cachePath = path;
  return cache;
}

export function saveDb(): void {
  if (!cache) return;
  const path = cachePath || dbPath();
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(cache));
  renameSync(tmp, path); // atomic swap so a crash never leaves a half-written file
}

export function resetDbCache(): void {
  cache = null;
  cachePath = "";
}

export const uid = (): string => crypto.randomUUID();
