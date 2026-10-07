// Shared by the client (cart preview) and the server (authoritative order total) so the
// numbers a buyer sees are exactly the numbers they are charged.
export const ESCROW_FEE_RATE = 0.02;

export const round2 = (n: number): number => Math.round(n * 100) / 100;

export function unitPrice(price: number, studentDiscount: number | undefined, role: string): number {
  if (role === "student" && studentDiscount && studentDiscount > 0) {
    return round2(price * (1 - studentDiscount / 100));
  }
  return round2(price);
}

export function orderTotals(lines: { unit: number; qty: number }[]): {
  subtotal: number;
  fee: number;
  total: number;
} {
  const subtotal = round2(lines.reduce((s, l) => s + l.unit * l.qty, 0));
  const fee = subtotal ? round2(subtotal * ESCROW_FEE_RATE) : 0;
  return { subtotal, fee, total: round2(subtotal + fee) };
}
