import { pbkdf2Sync, randomBytes } from "node:crypto";
import type { DB, Notice, Product, Role, User } from "./db.ts";

export const DEMO_PASSWORD = "Demo@1234";

const ITER = 210_000;
export function hashSync(password: string): string {
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(password, salt, ITER, 32, "sha256");
  return `pbkdf2$${ITER}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

const NO_LOGIN = "!"; // seeded sellers without a demo login can never authenticate

function user(
  id: string,
  name: string,
  email: string,
  role: Role,
  passwordHash: string,
  extra: Partial<User> = {},
): User {
  return {
    id,
    name,
    email,
    role,
    passwordHash,
    emailVerified: true,
    vendorStatus: role === "vendor" ? "approved" : "none",
    businessReg: role === "vendor" ? "2019/123456/07" : "",
    bio: "",
    avatar: "",
    campusZone: "",
    twoFactorSecret: "",
    twoFactorEnabled: false,
    loyaltyPoints: 150,
    badges: ["Early Adopter"],
    completedTrades: 0,
    createdAt: Date.now() - 30 * 86_400_000,
    ...extra,
  };
}

export function buildSeed(): DB {
  // In production the published demo password must not work unless explicitly enabled.
  const demoEnabled =
    process.env["NODE_ENV"] !== "production" || process.env["ALLOW_DEMO_ACCOUNTS"] === "true";
  const demo = demoEnabled ? hashSync(DEMO_PASSWORD) : NO_LOGIN;
  const users: User[] = [
    user("u-lesego", "Lesego M.", "lesego@mycput.ac.za", "student", demo, {
      badges: ["Early Adopter", "Trusted Trader"],
    }),
    user("u-thandi", "Mama Thandi's Kitchen", "thandi@kitchen.co.za", "vendor", demo, {
      loyaltyPoints: 1890,
      badges: ["Community Star"],
    }),
    user("u-zanele", "Dr. Zanele N.", "zanele@cput.ac.za", "faculty", demo),
    user("u-pieter", "Pieter v.d. Berg", "pieter@gmail.com", "resident", demo, { badges: [] }),
    user("u-ayanda", "Ayanda K.", "ayanda@mycput.ac.za", "student", NO_LOGIN, {
      loyaltyPoints: 2450,
      badges: ["Top Seller"],
    }),
    user("u-sipho", "Sipho N.", "sipho@mycput.ac.za", "student", NO_LOGIN, {
      loyaltyPoints: 1650,
      badges: ["Fast Responder"],
    }),
    user("u-naledi", "Naledi P.", "naledi@mycput.ac.za", "student", NO_LOGIN, {
      loyaltyPoints: 980,
      badges: ["Rising Star"],
    }),
    user("u-kyle", "Kyle J.", "kyle@mycput.ac.za", "student", NO_LOGIN),
    user("u-reslife", "Res Life Shop", "reslife@shop.co.za", "vendor", NO_LOGIN),
    user("u-techhub", "TechHub Bellville", "techhub@shop.co.za", "vendor", NO_LOGIN),
    user("u-freshfold", "Fresh Fold Laundry", "freshfold@shop.co.za", "vendor", NO_LOGIN),
  ];

  const p = (
    id: string,
    title: string,
    price: number,
    category: string,
    condition: string,
    sellerId: string,
    seller: string,
    baseRating: number,
    description: string,
    quantity: number,
    campusZone = "",
    studentDiscount = 0,
  ): Product => ({
    id,
    title,
    price,
    category,
    condition,
    sellerId,
    seller,
    image: `asset:${category}`,
    description,
    quantity,
    campusZone,
    studentDiscount,
    baseRating,
    boostType: "",
    boostedUntil: 0,
    removed: false,
    createdAt: Date.now() - Number(id) * 3_600_000,
  });

  const products: Product[] = [
    p("1", "Calculus: Early Transcendentals 8th Ed", 450, "Textbooks", "Like New", "u-ayanda", "Ayanda K.", 4.8, "Barely used, no highlights. Perfect for MAT1 courses.", 1),
    p("2", 'MacBook Pro 13" + Headphones bundle', 8999, "Electronics", "Used - Good", "u-sipho", "Sipho N.", 4.6, "Battery health 86%. Comes with charger and over-ear headphones.", 1),
    p("3", "Dorm Starter Kit: Lamp, Kettle & Storage", 650, "Dorm Essentials", "Like New", "u-reslife", "Res Life Shop", 4.9, "Everything you need for res. Collect on campus.", 4, "District Six", 10),
    p("4", "Bunny Chow & Vetkoek Combo", 75, "Local Food & Services", "New", "u-thandi", "Mama Thandi's Kitchen", 4.9, "Freshly made daily. Delivered to residences 12h–14h.", 20, "Bellville", 5),
    p("5", "Biology & Chemistry textbook set", 780, "Textbooks", "Used - Good", "u-naledi", "Naledi P.", 4.5, "Two first-year science textbooks, some notes in pencil.", 1),
    p("6", "Noise-cancelling headphones", 1200, "Electronics", "Like New", "u-techhub", "TechHub Bellville", 4.7, "Ideal for library study sessions. 30h battery.", 3, "Bellville", 8),
    p("7", "CPUT Hoodie (Size M)", 220, "Apparel", "Used - Good", "u-kyle", "Kyle J.", 4.4, "Official campus hoodie, warm and comfy.", 1),
    p("8", "Laundry & Ironing Service (per load)", 60, "Local Food & Services", "New", "u-freshfold", "Fresh Fold Laundry", 4.8, "Same-day turnaround, pick-up from res.", 10),
  ];

  const n = (
    id: string,
    type: string,
    title: string,
    body: string,
    authorId: string,
    author: string,
    baseLikes: number,
    hoursAgo: number,
    extra: Partial<Notice> = {},
  ): Notice => ({
    id,
    type,
    title,
    body,
    authorId,
    author,
    likedBy: [],
    baseLikes,
    comments: [],
    contact: "",
    expiresAt: "",
    removed: false,
    createdAt: Date.now() - hoursAgo * 3_600_000,
    ...extra,
  });

  const notices: Notice[] = [
    n("n1", "Announcement", "Library open 24/7 during exams", "The main library on District Six campus will stay open around the clock from 20 Oct.", "u-zanele", "Campus Admin", 34, 2, { expiresAt: "2026-11-01" }),
    n("n2", "Lost & Found", "Found: blue student card holder", "Found near the Engineering building cafeteria. Contact me to claim.", "u-kyle", "Thabo M.", 8, 5, { contact: "thabo@cput.ac.za" }),
    n("n3", "Club Event", "Robotics Club Hack Night", "Friday 18h00, Lab 3. Pizza provided. All skill levels welcome!", "u-zanele", "Robotics Society", 52, 24, { expiresAt: "2026-12-10" }),
    n("n4", "Service Request", "Looking for a maths tutor", "Need help with Mathematics II, twice a week. Willing to pay R150/hr.", "u-pieter", "Pieter v.d. Berg", 5, 26, { contact: "pieter@gmail.com" }),
  ];

  return {
    users,
    products,
    notices,
    reviews: [],
    orders: [],
    notifications: [],
    messages: [],
    flags: [],
    fraudAlerts: [],
    tokens: [],
  };
}
