// Rule-based fraud screening. This is deliberately NOT machine learning: it applies simple,
// explainable rules and records an alert for moderators to review.
import { getDb, uid } from "./db.ts";
import type { FraudAlert, Order, Product, User } from "./db.ts";

function raise(
  type: FraudAlert["type"],
  severity: FraudAlert["severity"],
  description: string,
  targetId: string,
): void {
  const db = getDb();
  const dup = db.fraudAlerts.some((a) => a.targetId === targetId && a.description === description);
  if (dup) return;
  db.fraudAlerts.unshift({ id: uid(), type, severity, description, targetId, createdAt: Date.now() });
}

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? (s[m] ?? 0) : ((s[m - 1] ?? 0) + (s[m] ?? 0)) / 2;
};

export function screenListing(product: Product, seller: User): void {
  const db = getDb();
  const day = 86_400_000;
  const mine = db.products.filter((p) => p.sellerId === seller.id && !p.removed);
  if (Date.now() - seller.createdAt < day && mine.length > 3) {
    raise("suspicious_listing", "medium", `New account "${seller.name}" has posted ${mine.length} listings in its first 24 hours.`, product.id);
  }
  const peers = db.products
    .filter((p) => p.category === product.category && p.id !== product.id && !p.removed)
    .map((p) => p.price);
  if (peers.length >= 3) {
    const m = median(peers);
    if (product.price > m * 5) {
      raise("suspicious_listing", "medium", `"${product.title}" is priced over 5x the ${product.category} median (R${m.toFixed(0)}).`, product.id);
    } else if (product.price < m * 0.1) {
      raise("suspicious_listing", "medium", `"${product.title}" is priced under 10% of the ${product.category} median (R${m.toFixed(0)}).`, product.id);
    }
  }
  if (mine.filter((p) => p.title.toLowerCase() === product.title.toLowerCase()).length > 1) {
    raise("suspicious_listing", "low", `Duplicate listing title "${product.title}" by ${seller.name}.`, product.id);
  }
}

export function screenOrder(order: Order, buyer: User): void {
  const ageDays = (Date.now() - buyer.createdAt) / 86_400_000;
  if (order.total >= 5000 && ageDays < 7) {
    raise("abnormal_transaction", "high", `Account "${buyer.name}" (${ageDays.toFixed(1)} days old) placed an order of R${order.total.toFixed(2)}.`, order.id);
  }
  const recent = getDb().orders.filter(
    (o) => o.buyerId === buyer.id && Date.now() - o.createdAt < 3_600_000,
  );
  if (recent.length >= 5) {
    raise("abnormal_transaction", "medium", `Account "${buyer.name}" created ${recent.length} orders within one hour.`, order.id);
  }
}

export function screenRegistrationBurst(ip: string, count: number, userId: string): void {
  if (count >= 4) {
    raise("fake_account", "medium", `${count} accounts were registered from the same network address within an hour.`, userId);
  }
}
