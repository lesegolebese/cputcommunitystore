import type { ReactNode } from "react";
import { X } from "lucide-react";
import type { Role } from "./data";

/** The signed-in user as returned by GET /api/me (never includes the password hash). */
export type UserDto = {
  id: string;
  name: string;
  email: string;
  role: Role;
  badge: string;
  emailVerified: boolean;
  vendorStatus: "none" | "pending" | "approved" | "rejected";
  bio: string;
  avatar: string;
  campusZone: string;
  twoFactorEnabled: boolean;
  loyaltyPoints: number;
  credibilityBadges: string[];
  completedTrades: number;
  averageRating: number;
  reviewCount: number;
};

export const zar = (n: number) => `R ${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, " ")}`;

export const inputCls =
  "w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

export function Modal({
  onClose,
  children,
  title,
}: {
  onClose: () => void;
  children: ReactNode;
  title?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-overlay sm:items-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-card p-5 shadow-xl animate-in slide-in-from-bottom-4 sm:max-w-lg sm:rounded-2xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-muted" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Profile photo, or the user's initial when no photo has been uploaded. */
export function Avatar({ user, size = 32 }: { user: Pick<UserDto, "name" | "avatar">; size?: number }) {
  const style = { width: size, height: size };
  if (user.avatar) {
    return <img src={user.avatar} alt="" style={style} className="shrink-0 rounded-full object-cover" />;
  }
  return (
    <span
      style={{ ...style, fontSize: Math.max(12, Math.round(size / 2.4)) }}
      className="grid shrink-0 place-items-center rounded-full bg-primary-soft font-bold text-primary"
    >
      {(user.name[0] ?? "?").toUpperCase()}
    </span>
  );
}
