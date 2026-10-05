import books from "@/assets/p-books.jpg";
import tech from "@/assets/p-tech.jpg";
import dorm from "@/assets/p-dorm.jpg";
import food from "@/assets/p-food.jpg";

export type Role = "student" | "vendor" | "faculty" | "resident";
export const ROLES: { id: Role; label: string; name: string; email: string; badge: string }[] = [
  {
    id: "student",
    label: "Student View",
    name: "Lesego M.",
    email: "lesego@mycput.ac.za",
    badge: "Verified Student",
  },
  {
    id: "vendor",
    label: "Local Vendor View",
    name: "Mama Thandi's Kitchen",
    email: "thandi@kitchen.co.za",
    badge: "Verified Vendor",
  },
  {
    id: "faculty",
    label: "Faculty View",
    name: "Dr. Zanele N.",
    email: "zanele@cput.ac.za",
    badge: "Verified Faculty",
  },
  {
    id: "resident",
    label: "Community Resident View",
    name: "Pieter v.d. Berg",
    email: "pieter@gmail.com",
    badge: "Community Member",
  },
];

export const CATEGORIES = [
  "All",
  "Textbooks",
  "Electronics",
  "Dorm Essentials",
  "Local Food & Services",
  "Apparel",
] as const;
export const CONDITIONS = ["Any", "New", "Like New", "Used - Good", "Used - Fair"] as const;

export type Product = {
  id: string;
  title: string;
  price: number;
  category: string;
  condition: string;
  seller: string;
  sellerBadge: "Verified Student" | "Verified Vendor";
  rating: number;
  image: string;
  description: string;
  quantity: number;
  campusZone?: string;
  studentDiscount?: number;
};

export const IMAGES: Record<string, string> = {
  Textbooks: books,
  Electronics: tech,
  "Dorm Essentials": dorm,
  "Local Food & Services": food,
  Apparel: dorm,
};

export const PRODUCTS: Product[] = [
  {
    id: "1",
    title: "Calculus: Early Transcendentals 8th Ed",
    price: 450,
    category: "Textbooks",
    condition: "Like New",
    seller: "Ayanda K.",
    sellerBadge: "Verified Student",
    rating: 4.8,
    image: books,
    description: "Barely used, no highlights. Perfect for MAT1 courses.",
    quantity: 1,
  },
  {
    id: "2",
    title: 'MacBook Pro 13" + Headphones bundle',
    price: 8999,
    category: "Electronics",
    condition: "Used - Good",
    seller: "Sipho N.",
    sellerBadge: "Verified Student",
    rating: 4.6,
    image: tech,
    description: "Battery health 86%. Comes with charger and over-ear headphones.",
    quantity: 1,
  },
  {
    id: "3",
    title: "Dorm Starter Kit: Lamp, Kettle & Storage",
    price: 650,
    category: "Dorm Essentials",
    condition: "Like New",
    seller: "Res Life Shop",
    sellerBadge: "Verified Vendor",
    rating: 4.9,
    image: dorm,
    description: "Everything you need for res. Collect on campus.",
    quantity: 4,
    campusZone: "District Six",
    studentDiscount: 10,
  },
  {
    id: "4",
    title: "Bunny Chow & Vetkoek Combo",
    price: 75,
    category: "Local Food & Services",
    condition: "New",
    seller: "Mama Thandi's Kitchen",
    sellerBadge: "Verified Vendor",
    rating: 4.9,
    image: food,
    description: "Freshly made daily. Delivered to residences 12h–14h.",
    quantity: 20,
    campusZone: "Bellville",
    studentDiscount: 5,
  },
  {
    id: "5",
    title: "Biology & Chemistry textbook set",
    price: 780,
    category: "Textbooks",
    condition: "Used - Good",
    seller: "Naledi P.",
    sellerBadge: "Verified Student",
    rating: 4.5,
    image: books,
    description: "Two first-year science textbooks, some notes in pencil.",
    quantity: 1,
  },
  {
    id: "6",
    title: "Noise-cancelling headphones",
    price: 1200,
    category: "Electronics",
    condition: "Like New",
    seller: "TechHub Bellville",
    sellerBadge: "Verified Vendor",
    rating: 4.7,
    image: tech,
    description: "Ideal for library study sessions. 30h battery.",
    quantity: 3,
    campusZone: "Bellville",
    studentDiscount: 8,
  },
  {
    id: "7",
    title: "CPUT Hoodie (Size M)",
    price: 220,
    category: "Apparel",
    condition: "Used - Good",
    seller: "Kyle J.",
    sellerBadge: "Verified Student",
    rating: 4.4,
    image: dorm,
    description: "Official campus hoodie, warm and comfy.",
    quantity: 1,
  },
  {
    id: "8",
    title: "Laundry & Ironing Service (per load)",
    price: 60,
    category: "Local Food & Services",
    condition: "New",
    seller: "Fresh Fold Laundry",
    sellerBadge: "Verified Vendor",
    rating: 4.8,
    image: food,
    description: "Same-day turnaround, pick-up from res.",
    quantity: 10,
  },
];

export type Notice = {
  id: string;
  type: string;
  title: string;
  body: string;
  author: string;
  time: string;
  likes: number;
  contact?: string;
  expiresAt?: string;
  liked?: boolean;
  flagged?: boolean;
  flagReason?: string;
};
export const NOTICE_TYPES = [
  "Announcement",
  "Lost & Found",
  "Club Event",
  "Service Request",
] as const;

export type UserProfile = {
  id: string;
  name: string;
  email: string;
  role: Role;
  badge: string;
  twoFactorEnabled: boolean;
  loyaltyPoints: number;
  credibilityBadges: string[];
  completedTrades: number;
  averageRating: number;
};

export type FlaggedItem = {
  id: string;
  type: "product" | "notice";
  itemId: string;
  reason: string;
  reporter: string;
  timestamp: string;
  status: "pending" | "reviewed" | "resolved";
};

export type FraudAlert = {
  id: string;
  type: "suspicious_listing" | "abnormal_transaction" | "fake_account";
  description: string;
  severity: "low" | "medium" | "high";
  targetId: string;
  timestamp: string;
};
export const NOTICES: Notice[] = [
  {
    id: "n1",
    type: "Announcement",
    title: "Library open 24/7 during exams",
    body: "The main library on District Six campus will stay open around the clock from 20 Oct.",
    author: "Campus Admin",
    time: "2h ago",
    likes: 34,
    expiresAt: "2026-11-01",
  },
  {
    id: "n2",
    type: "Lost & Found",
    title: "Found: blue student card holder",
    body: "Found near the Engineering building cafeteria. Contact me to claim.",
    author: "Thabo M.",
    time: "5h ago",
    likes: 8,
    contact: "thabo@cput.ac.za",
  },
  {
    id: "n3",
    type: "Club Event",
    title: "Robotics Club Hack Night",
    body: "Friday 18h00, Lab 3. Pizza provided. All skill levels welcome!",
    author: "Robotics Society",
    time: "1d ago",
    likes: 52,
    expiresAt: "2026-10-10",
  },
  {
    id: "n4",
    type: "Service Request",
    title: "Looking for a maths tutor",
    body: "Need help with Mathematics II, twice a week. Willing to pay R150/hr.",
    author: "Pieter v.d. Berg",
    time: "1d ago",
    likes: 5,
    contact: "pieter@gmail.com",
  },
];
