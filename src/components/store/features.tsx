import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Award,
  BadgeCheck,
  Camera,
  CheckCircle2,
  Clock,
  Mail,
  ShieldAlert,
  Star,
  Trash2,
  Zap,
} from "lucide-react";
import { api, errMsg, readImage } from "@/lib/api";
import { CATEGORIES, CONDITIONS, resolveImage, type Product } from "./data";
import { Avatar, Modal, inputCls, zar, type UserDto } from "./ui";

// ---------- shared bits ----------
export type OrderDto = {
  id: string;
  items: { productId: string; title: string; unitPrice: number; qty: number; sellerId: string; seller: string }[];
  subtotal: number;
  fee: number;
  total: number;
  via: string;
  mode: string;
  status: "pending_payment" | "paid" | "ready" | "completed" | "cancelled";
  createdAt: number;
  perspective: "buyer" | "seller";
  buyer: string;
};

const STATUS_LABEL: Record<OrderDto["status"], string> = {
  pending_payment: "Awaiting payment",
  paid: "Paid — held in escrow",
  ready: "Ready for collection",
  completed: "Completed — funds released",
  cancelled: "Cancelled",
};

function Stars({ value, onChange }: { value: number; onChange?: (n: number) => void }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          className={onChange ? "cursor-pointer" : "cursor-default"}
        >
          <Star className={`h-4 w-4 ${n <= value ? "fill-accent text-accent" : "text-muted-foreground"}`} />
        </button>
      ))}
    </span>
  );
}

// ---------- create / edit listing ----------
export function ListingForm({
  me,
  existing,
  onClose,
  onSaved,
}: {
  me: UserDto;
  existing: Product | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [f, setF] = useState({
    title: existing?.title ?? "",
    price: existing ? String(existing.price) : "",
    quantity: existing ? String(existing.quantity) : "1",
    category: existing?.category ?? "Textbooks",
    condition: existing?.condition ?? "Like New",
    campusZone: existing?.campusZone ?? "",
    studentDiscount: existing?.studentDiscount ? String(existing.studentDiscount) : "0",
    description: existing?.description ?? "",
  });
  const [image, setImage] = useState<string>(existing?.image ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = {
        title: f.title,
        price: Number(f.price),
        quantity: Number(f.quantity),
        category: f.category,
        condition: f.condition,
        campusZone: f.campusZone,
        studentDiscount: me.role === "vendor" ? Number(f.studentDiscount) : 0,
        description: f.description,
        image,
      };
      if (existing) await api(`products/${existing.id}`, { method: "PUT", body });
      else await api("products", { body });
      onSaved(existing ? "Listing updated" : "Your listing is live!");
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const preview = image ? resolveImage(image) : "";
  return (
    <Modal title={existing ? "Edit listing" : me.role === "vendor" ? "Add a Product" : "Sell an Item"} onClose={onClose}>
      <form className="space-y-3" onSubmit={submit}>
        <input required minLength={3} maxLength={80} value={f.title} onChange={set("title")} placeholder="Item title" className={inputCls} />
        <div className="grid grid-cols-3 gap-3">
          <input required type="number" min={1} step="0.01" value={f.price} onChange={set("price")} placeholder="Price (R)" className={inputCls} />
          <input required type="number" min={1} max={999} value={f.quantity} onChange={set("quantity")} placeholder="Quantity" className={inputCls} />
          <select value={f.condition} onChange={set("condition")} className={inputCls}>
            {CONDITIONS.slice(1).map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <select value={f.category} onChange={set("category")} className={inputCls}>
            {CATEGORIES.slice(1).map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select value={f.campusZone} onChange={set("campusZone")} className={inputCls}>
            <option value="">Any campus zone</option>
            <option>Bellville</option>
            <option>District Six</option>
          </select>
        </div>
        {me.role === "vendor" && (
          <label className="block text-xs font-medium text-muted-foreground">
            Student discount (%)
            <input type="number" min={0} max={50} value={f.studentDiscount} onChange={set("studentDiscount")} className={`${inputCls} mt-1`} />
          </label>
        )}
        <textarea rows={3} maxLength={400} value={f.description} onChange={set("description")} placeholder="Description" className={inputCls} />
        <div className="flex items-center gap-3">
          {preview ? <img src={preview} alt="" className="h-16 w-16 rounded-lg object-cover" /> : <span className="grid h-16 w-16 place-items-center rounded-lg bg-muted text-xs text-muted-foreground">No photo</span>}
          <label className="flex-1 text-sm font-medium">
            Photo (PNG, JPEG or WebP, max 400 KB)
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className={`${inputCls} mt-1`}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  setImage(await readImage(file, 400 * 1024));
                  setError("");
                } catch (err) {
                  setError(errMsg(err));
                }
              }}
            />
          </label>
        </div>
        {error && <p role="alert" className="rounded-lg bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}
        <button disabled={busy} className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-60">
          {busy ? "Saving…" : existing ? "Save changes" : "Publish Listing"}
        </button>
      </form>
    </Modal>
  );
}

// ---------- reviews ----------
export function ReviewsSection({ product, isOwner, onPosted }: { product: Product; isOwner: boolean; onPosted: () => void }) {
  const [reviews, setReviews] = useState<{ id: string; reviewer: string; rating: number; comment: string; time: string }[]>([]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => {
    api<{ reviews: typeof reviews }>(`products/${product.id}/reviews`)
      .then((d) => setReviews(d.reviews))
      .catch(() => setReviews([]));
  }, [product.id]);
  useEffect(load, [load]);

  const submit = async () => {
    try {
      await api(`products/${product.id}/reviews`, { body: { rating, comment } });
      setMsg({ ok: true, text: "Thanks! Your review is published." });
      setComment("");
      load();
      onPosted();
    } catch (err) {
      setMsg({ ok: false, text: errMsg(err) });
    }
  };

  return (
    <div className="mt-5 border-t pt-4">
      <h3 className="text-sm font-bold">Ratings & reviews ({reviews.length})</h3>
      <div className="mt-2 max-h-40 space-y-2 overflow-y-auto">
        {reviews.length === 0 && <p className="text-sm text-muted-foreground">No reviews yet.</p>}
        {reviews.map((r) => (
          <div key={r.id} className="rounded-lg bg-muted p-2 text-sm">
            <div className="flex items-center justify-between">
              <b>{r.reviewer}</b>
              <Stars value={r.rating} />
            </div>
            {r.comment && <p className="mt-1 text-muted-foreground">{r.comment}</p>}
            <p className="mt-1 text-[11px] text-muted-foreground">{r.time}</p>
          </div>
        ))}
      </div>
      {!isOwner && (
        <div className="mt-3 space-y-2 rounded-xl border p-3">
          <div className="flex items-center justify-between text-sm font-medium">
            Your rating <Stars value={rating} onChange={setRating} />
          </div>
          <textarea rows={2} maxLength={300} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Share your experience (optional)" className={inputCls} />
          {msg && <p className={`text-xs ${msg.ok ? "text-primary" : "text-destructive"}`}>{msg.text}</p>}
          <button onClick={submit} className="w-full rounded-xl border py-2 text-sm font-semibold hover:bg-muted">
            Post review
          </button>
          <p className="text-[11px] text-muted-foreground">You can review an item once you have collected it and confirmed the order.</p>
        </div>
      )}
    </div>
  );
}

// ---------- chat ----------
export function ChatModal({
  product,
  withUserId,
  withName,
  onClose,
}: {
  product: { id: string; title: string; seller: string };
  withUserId?: string;
  withName?: string;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<{ id: string; mine: boolean; text: string; time: string }[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const qs = `productId=${encodeURIComponent(product.id)}${withUserId ? `&with=${encodeURIComponent(withUserId)}` : ""}`;

  const load = useCallback(() => {
    api<{ messages: typeof messages }>(`messages?${qs}`)
      .then((d) => setMessages(d.messages))
      .catch(() => undefined);
  }, [qs]);
  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [load]);

  const send = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      await api("messages", { body: { productId: product.id, text, ...(withUserId ? { toUserId: withUserId } : {}) } });
      setText("");
      setError("");
      load();
    } catch (err) {
      setError(errMsg(err));
    }
  };

  return (
    <Modal title={`Message ${withName ?? product.seller}`} onClose={onClose}>
      <div className="rounded-xl bg-muted p-3 text-sm">
        <b>Safe campus chat — {product.title}</b>
        <p className="mt-1 text-muted-foreground">Arrange collection here. Phone numbers are blocked for your safety.</p>
      </div>
      <div className="mt-3 max-h-60 space-y-2 overflow-y-auto">
        {messages.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No messages yet.</p>}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${m.mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
              <p>{m.text}</p>
              <p className="mt-0.5 text-[10px] opacity-70">{m.time}</p>
            </div>
          </div>
        ))}
      </div>
      <form className="mt-3 space-y-2" onSubmit={send}>
        <textarea required rows={2} maxLength={500} value={text} onChange={(e) => setText(e.target.value)} placeholder="Hi, is this still available? Suggest a safe pickup point…" className={inputCls} />
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        <button className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground">Send secure message</button>
      </form>
    </Modal>
  );
}

// ---------- bulletin board replies ----------
export function Replies({
  notice,
  onChanged,
}: {
  notice: { id: string; comments: { id: string; author: string; body: string; time: string }[] };
  onChanged: (n: unknown) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const send = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    try {
      const d = await api<{ notice: unknown }>(`notices/${notice.id}/comments`, { body: { body: text } });
      setText("");
      setError("");
      onChanged(d.notice);
    } catch (err) {
      setError(errMsg(err));
    }
  };
  return (
    <div className="mt-2 border-t pt-2">
      <button onClick={() => setOpen(!open)} className="text-xs font-semibold text-primary">
        {open ? "Hide replies" : `Replies (${notice.comments.length})`}
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {notice.comments.map((c) => (
            <p key={c.id} className="rounded-lg bg-muted p-2 text-sm">
              <b>{c.author}</b> <span className="text-[11px] text-muted-foreground">· {c.time}</span>
              <br />
              {c.body}
            </p>
          ))}
          <form onSubmit={send} className="flex gap-2">
            <input required maxLength={300} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a reply…" className={inputCls} />
            <button className="shrink-0 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground">Reply</button>
          </form>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      )}
    </div>
  );
}

// ---------- profile page ----------
type Thread = { productId: string; title: string; withId: string; withName: string; last: string; time: string };

export function ProfilePage({
  user,
  onUser,
  reloadKey,
  onEditListing,
  onOpenChat,
  onChanged,
  flash,
}: {
  user: UserDto;
  onUser: (u: UserDto) => void;
  reloadKey: number;
  onEditListing: (p: Product) => void;
  onOpenChat: (t: Thread) => void;
  onChanged: () => void;
  flash: (m: string) => void;
}) {
  const [listings, setListings] = useState<Product[]>([]);
  const [orders, setOrders] = useState<OrderDto[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [edit, setEdit] = useState({ name: user.name, bio: user.bio, campusZone: user.campusZone });
  const [reviewing, setReviewing] = useState<string | null>(null);

  const load = useCallback(() => {
    api<{ listings: Product[]; orders: OrderDto[] }>("me/history")
      .then((d) => {
        setListings(d.listings);
        setOrders(d.orders);
      })
      .catch(() => undefined);
    api<{ threads: Thread[] }>("messages/threads")
      .then((d) => setThreads(d.threads))
      .catch(() => undefined);
  }, []);
  useEffect(load, [load, reloadKey]);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      flash(ok);
      load();
      onChanged();
      const d = await api<{ user: UserDto }>("me");
      onUser(d.user);
    } catch (err) {
      flash(errMsg(err));
    }
  };

  const saveProfile = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    try {
      const d = await api<{ user: UserDto }>("me", { method: "PATCH", body: edit });
      onUser(d.user);
      flash("Profile saved");
    } catch (err) {
      flash(errMsg(err));
    }
  };

  const uploadAvatar = async (file: File | undefined) => {
    if (!file) return;
    try {
      const avatar = await readImage(file, 200 * 1024);
      const d = await api<{ user: UserDto }>("me", { method: "PATCH", body: { avatar } });
      onUser(d.user);
      flash("Profile photo updated");
    } catch (err) {
      flash(errMsg(err));
    }
  };

  const score = user.averageRating;
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="h-24 bg-gradient-to-r from-primary to-brand-light" />
        <div className="-mt-10 flex flex-col gap-3 p-5 sm:flex-row sm:items-end">
          <label className="relative cursor-pointer self-start" title="Change profile photo">
            <span className="block overflow-hidden rounded-2xl border-4 border-card">
              <Avatar user={user} size={80} />
            </span>
            <span className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground">
              <Camera className="h-3.5 w-3.5" />
            </span>
            <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => uploadAvatar(e.target.files?.[0])} />
          </label>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-extrabold">{user.name}</h1>
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              <Mail className="h-4 w-4" />
              {user.email}
            </p>
          </div>
          <span className="inline-flex items-center gap-1 self-start rounded-full bg-accent-soft px-3 py-1 text-sm font-semibold sm:self-auto">
            <BadgeCheck className="h-4 w-4 text-primary" />
            {user.badge}
          </span>
        </div>
      </div>

      {user.role === "vendor" && user.vendorStatus !== "approved" && (
        <p className="flex items-center gap-2 rounded-xl border border-accent bg-accent-soft p-3 text-sm">
          <Clock className="h-4 w-4 shrink-0" />
          {user.vendorStatus === "pending" ? "Your vendor registration is awaiting approval by campus staff. You can browse and buy meanwhile." : "Your vendor application was not approved. Contact campus IT."}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Community trust rating</p>
          <p className="mt-1 text-3xl font-extrabold">
            {user.reviewCount ? score : "—"}
            <span className="text-lg text-accent"> ★</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{user.reviewCount} review{user.reviewCount === 1 ? "" : "s"}</p>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Loyalty points</p>
          <p className="mt-1 flex items-center gap-1 text-3xl font-extrabold text-primary">
            <Zap className="h-6 w-6" />
            {user.loyaltyPoints}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Redeem for listing boosts.</p>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Completed trades</p>
          <p className="mt-1 text-3xl font-extrabold">{user.completedTrades}</p>
          <p className="mt-1 text-xs text-muted-foreground">5 trades earns “Trusted Trader”.</p>
        </div>
      </div>

      <Card title="Credibility badges" icon={<Award className="h-5 w-5 text-primary" />}>
        <div className="flex flex-wrap gap-2">
          {user.credibilityBadges.length === 0 && <p className="text-sm text-muted-foreground">No badges yet.</p>}
          {user.credibilityBadges.map((b) => (
            <span key={b} className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-3 py-1 text-sm font-semibold text-primary">
              <Award className="h-3.5 w-3.5" />
              {b}
            </span>
          ))}
        </div>
        <p className="mt-2 flex items-center gap-1 text-sm font-medium text-primary">
          <CheckCircle2 className="h-4 w-4" />
          Email verified
        </p>
      </Card>

      <Card title="Edit profile">
        <form onSubmit={saveProfile} className="space-y-2">
          <input required minLength={2} maxLength={60} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} className={inputCls} />
          <textarea rows={2} maxLength={200} value={edit.bio} onChange={(e) => setEdit({ ...edit, bio: e.target.value })} placeholder="A short bio" className={inputCls} />
          <select value={edit.campusZone} onChange={(e) => setEdit({ ...edit, campusZone: e.target.value })} className={inputCls}>
            <option value="">Campus zone (optional)</option>
            <option>Bellville</option>
            <option>District Six</option>
          </select>
          <button className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Save profile</button>
        </form>
      </Card>

      {(user.role === "student" || user.role === "vendor") && (
        <Card title={`My listings (${listings.length})`}>
          {listings.length === 0 && <p className="text-sm text-muted-foreground">You haven’t listed anything yet.</p>}
          <div className="space-y-2">
            {listings.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-xl border p-2">
                <img src={resolveImage(p.image)} alt="" className="h-12 w-12 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{p.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {zar(p.price)} · {p.quantity} in stock
                  </p>
                </div>
                <button onClick={() => onEditListing(p)} className="rounded-lg border px-2 py-1 text-xs font-semibold hover:bg-muted">
                  Edit
                </button>
                <button
                  onClick={() => {
                    if (window.confirm(`Delete "${p.title}"?`)) act(() => api(`products/${p.id}`, { method: "DELETE" }), "Listing deleted");
                  }}
                  className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive"
                  aria-label="Delete listing"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card title={`Order history (${orders.length})`}>
        {orders.length === 0 && <p className="text-sm text-muted-foreground">No orders yet.</p>}
        <div className="space-y-3">
          {orders.map((o) => (
            <div key={o.id} className="rounded-xl border p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">
                    Order #{o.id.slice(0, 8)} · {o.perspective === "buyer" ? "You bought" : `Sold to ${o.buyer}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(o.createdAt).toLocaleDateString()} · {o.via}
                    {o.mode === "simulated" ? " (simulated payment)" : o.mode === "sandbox" ? " (sandbox)" : ""}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary">{STATUS_LABEL[o.status]}</span>
              </div>
              <ul className="mt-2 space-y-0.5 text-muted-foreground">
                {o.items.map((i) => (
                  <li key={i.productId}>
                    {i.qty} × {i.title} — {zar(i.unitPrice * i.qty)}
                  </li>
                ))}
              </ul>
              <p className="mt-1 font-semibold">Total {zar(o.total)}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {o.perspective === "seller" && o.status === "paid" && (
                  <button onClick={() => act(() => api(`orders/${o.id}/ready`, { body: {} }), "Buyer notified")} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
                    Mark ready for collection
                  </button>
                )}
                {o.perspective === "buyer" && (o.status === "paid" || o.status === "ready") && (
                  <button onClick={() => act(() => api(`orders/${o.id}/confirm`, { body: {} }), "Order confirmed — escrow released")} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
                    I’ve collected it — release payment
                  </button>
                )}
                {o.perspective === "buyer" && o.status === "pending_payment" && (
                  <button onClick={() => act(() => api(`orders/${o.id}/cancel`, { body: {} }), "Order cancelled")} className="rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-muted">
                    Cancel
                  </button>
                )}
                {o.perspective === "buyer" && o.status === "completed" && (
                  <button onClick={() => setReviewing(reviewing === o.id ? null : o.id)} className="rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-muted">
                    Rate this order
                  </button>
                )}
              </div>
              {reviewing === o.id && (
                <div className="mt-2 space-y-2">
                  {o.items.map((i) => (
                    <QuickReview key={i.productId} productId={i.productId} title={i.title} onDone={() => { flash("Review posted"); onChanged(); }} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card title={`Messages (${threads.length})`}>
        {threads.length === 0 && <p className="text-sm text-muted-foreground">No conversations yet.</p>}
        <div className="space-y-2">
          {threads.map((t) => (
            <button key={`${t.productId}:${t.withId}`} onClick={() => onOpenChat(t)} className="flex w-full items-center justify-between gap-2 rounded-xl border p-2 text-left hover:bg-muted">
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">
                  {t.withName} · {t.title}
                </span>
                <span className="block truncate text-xs text-muted-foreground">{t.last}</span>
              </span>
              <span className="shrink-0 text-[11px] text-muted-foreground">{t.time}</span>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Card({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <p className="mb-3 flex items-center gap-2 font-semibold">
        {icon}
        {title}
      </p>
      {children}
    </div>
  );
}

function QuickReview({ productId, title, onDone }: { productId: string; title: string; onDone: () => void }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  return (
    <div className="rounded-lg bg-muted p-2">
      <div className="flex items-center justify-between text-xs font-semibold">
        <span className="truncate">{title}</span>
        <Stars value={rating} onChange={setRating} />
      </div>
      <div className="mt-1 flex gap-2">
        <input value={comment} maxLength={300} onChange={(e) => setComment(e.target.value)} placeholder="Comment (optional)" className={inputCls} />
        <button
          onClick={async () => {
            try {
              await api(`products/${productId}/reviews`, { body: { rating, comment } });
              onDone();
            } catch (err) {
              setError(errMsg(err));
            }
          }}
          className="shrink-0 rounded-xl bg-primary px-3 text-xs font-semibold text-primary-foreground"
        >
          Post
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ---------- account security (two-factor) ----------
export function SecurityModal({ user, onUser, onClose }: { user: UserDto; onUser: (u: UserDto) => void; onClose: () => void }) {
  const [secret, setSecret] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Account security" onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-xl bg-primary-soft p-3 text-sm text-primary">
          <b>Email verified</b>
          <p className="mt-1">{user.email} is confirmed. Two-factor authentication adds a 6-digit authenticator code to every checkout.</p>
        </div>
        {!user.twoFactorEnabled && !secret && (
          <button disabled={busy} onClick={() => run(async () => setSecret(await api("auth/2fa/setup", { body: {} })))} className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground">
            Set up two-factor authentication
          </button>
        )}
        {!user.twoFactorEnabled && secret && (
          <div className="space-y-3">
            <p className="text-sm">
              Add this key to Google Authenticator, Microsoft Authenticator or Authy (choose “enter a setup key”), then type the 6-digit code it shows.
            </p>
            <p className="select-all break-all rounded-lg bg-muted p-3 text-center font-mono text-sm tracking-wider">{secret.secret}</p>
            <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="000000" className={`${inputCls} text-center text-2xl tracking-widest`} />
            <button
              disabled={busy || code.length !== 6}
              onClick={() =>
                run(async () => {
                  const d = await api<{ user: UserDto }>("auth/2fa/enable", { body: { code } });
                  onUser(d.user);
                  setSecret(null);
                  setCode("");
                })
              }
              className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-50"
            >
              Turn on two-factor
            </button>
          </div>
        )}
        {user.twoFactorEnabled && (
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-primary">
              <CheckCircle2 className="h-4 w-4" /> Two-factor authentication is ON
            </p>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" className={inputCls} />
            <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="Current 6-digit code" className={inputCls} />
            <button
              disabled={busy || code.length !== 6 || !password}
              onClick={() =>
                run(async () => {
                  const d = await api<{ user: UserDto }>("auth/2fa/disable", { body: { code, password } });
                  onUser(d.user);
                  setCode("");
                  setPassword("");
                })
              }
              className="w-full rounded-xl border py-3 font-semibold hover:bg-muted disabled:opacity-50"
            >
              Turn off two-factor
            </button>
          </div>
        )}
        {error && <p role="alert" className="rounded-lg bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}
      </div>
    </Modal>
  );
}

// ---------- moderation (faculty) ----------
type FlagDto = { id: string; type: string; title: string; reason: string; reporter: string; timestamp: string; status: "pending" | "resolved"; resolution: string };
type VendorDto = { id: string; name: string; email: string; businessReg: string };

export function ModerationModal({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const [flags, setFlags] = useState<FlagDto[]>([]);
  const [vendors, setVendors] = useState<VendorDto[]>([]);
  const [tab, setTab] = useState<"flags" | "vendors">("flags");
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api<{ flags: FlagDto[] }>("admin/flags").then((d) => setFlags(d.flags)).catch((e) => setError(errMsg(e)));
    api<{ vendors: VendorDto[] }>("admin/vendors").then((d) => setVendors(d.vendors)).catch(() => undefined);
  }, []);
  useEffect(load, [load]);

  const decide = async (path: string, action: string) => {
    try {
      await api(path, { body: { action } });
      load();
      onChanged();
    } catch (err) {
      setError(errMsg(err));
    }
  };

  return (
    <Modal title="Content moderation" onClose={onClose}>
      <div className="mb-3 flex gap-2 text-sm">
        {(["flags", "vendors"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-full border px-3 py-1 font-medium ${tab === t ? "border-primary bg-primary text-primary-foreground" : "bg-card"}`}>
            {t === "flags" ? `Flagged content (${flags.filter((f) => f.status === "pending").length})` : `Vendor approvals (${vendors.length})`}
          </button>
        ))}
      </div>
      {error && <p className="mb-2 text-sm text-destructive">{error}</p>}
      {tab === "flags" && (
        <div className="space-y-3">
          {flags.length === 0 && <p className="rounded-xl bg-muted p-4 text-center text-sm text-muted-foreground">No flagged items.</p>}
          {flags.map((f) => (
            <div key={f.id} className="rounded-xl border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{f.title}</p>
                  <p className="text-xs text-muted-foreground">Reason: {f.reason}</p>
                  <p className="text-xs text-muted-foreground">
                    Reported by {f.reporter} · {f.timestamp}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${f.status === "pending" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>
                  {f.status === "pending" ? "pending" : f.resolution}
                </span>
              </div>
              {f.status === "pending" && (
                <div className="mt-2 flex gap-2">
                  <button onClick={() => decide(`admin/flags/${f.id}`, "remove")} className="flex-1 rounded-lg bg-destructive py-1.5 text-xs font-semibold text-destructive-foreground">
                    Remove
                  </button>
                  <button onClick={() => decide(`admin/flags/${f.id}`, "keep")} className="flex-1 rounded-lg border py-1.5 text-xs font-semibold hover:bg-muted">
                    Keep
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {tab === "vendors" && (
        <div className="space-y-3">
          {vendors.length === 0 && <p className="rounded-xl bg-muted p-4 text-center text-sm text-muted-foreground">No vendors awaiting approval.</p>}
          {vendors.map((v) => (
            <div key={v.id} className="rounded-xl border bg-card p-3">
              <p className="font-semibold">{v.name}</p>
              <p className="text-xs text-muted-foreground">
                {v.email} · Reg. {v.businessReg}
              </p>
              <div className="mt-2 flex gap-2">
                <button onClick={() => decide(`admin/vendors/${v.id}`, "approve")} className="flex-1 rounded-lg bg-primary py-1.5 text-xs font-semibold text-primary-foreground">
                  Approve
                </button>
                <button onClick={() => decide(`admin/vendors/${v.id}`, "reject")} className="flex-1 rounded-lg border py-1.5 text-xs font-semibold hover:bg-muted">
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

// ---------- fraud screening (faculty) ----------
type AlertDto = { id: string; type: string; description: string; severity: "low" | "medium" | "high"; timestamp: string };

export function FraudAlertPanel({ onClose }: { onClose: () => void }) {
  const [alerts, setAlerts] = useState<AlertDto[] | null>(null);
  useEffect(() => {
    api<{ alerts: AlertDto[] }>("admin/fraud").then((d) => setAlerts(d.alerts)).catch(() => setAlerts([]));
  }, []);
  const tone = (s: AlertDto["severity"]) => (s === "high" ? "border-destructive/50 bg-destructive/5" : s === "medium" ? "border-accent/50 bg-accent/5" : "bg-muted/30");
  return (
    <Modal title="Fraud screening alerts" onClose={onClose}>
      <p className="mb-3 text-xs text-muted-foreground">
        Rule-based checks: unusual pricing, brand-new accounts with large orders, order bursts and sign-up bursts. Review each alert before acting.
      </p>
      <div className="space-y-3">
        {alerts === null && <p className="text-sm text-muted-foreground">Loading…</p>}
        {alerts?.length === 0 && (
          <div className="rounded-xl bg-primary-soft p-4 text-center text-sm text-primary">
            <ShieldAlert className="mx-auto mb-2 h-8 w-8" />
            <p className="font-semibold">No suspicious activity detected</p>
          </div>
        )}
        {alerts?.map((a) => (
          <div key={a.id} className={`rounded-xl border p-3 ${tone(a.severity)}`}>
            <div className="flex items-start gap-2">
              <ShieldAlert className="mt-0.5 h-5 w-5" />
              <div className="flex-1">
                <p className="font-semibold">{a.type.replace(/_/g, " ").toUpperCase()}</p>
                <p className="text-sm text-muted-foreground">{a.description}</p>
                <p className="mt-1 text-xs text-muted-foreground">{a.timestamp}</p>
              </div>
              <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-bold uppercase">{a.severity}</span>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

// ---------- leaderboard ----------
export function LeaderboardModal({ onClose }: { onClose: () => void }) {
  const [leaders, setLeaders] = useState<{ id: string; name: string; points: number; badge: string; you: boolean }[]>([]);
  useEffect(() => {
    api<{ leaders: typeof leaders }>("leaderboard").then((d) => setLeaders(d.leaders)).catch(() => undefined);
  }, []);
  return (
    <Modal title="Community Leaderboard" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Top community members by loyalty points earned from trades, reviews and posts.</p>
        {leaders.map((l, i) => (
          <div key={l.id} className={`flex items-center gap-3 rounded-xl border p-3 ${l.you ? "border-primary bg-primary-soft" : "bg-card"}`}>
            <span className={`flex h-8 w-8 items-center justify-center rounded-full font-bold ${i === 0 ? "bg-accent text-accent-foreground" : "bg-muted"}`}>{i + 1}</span>
            <div className="flex-1">
              <p className="font-semibold">
                {l.name}
                {l.you && " (you)"}
              </p>
              <p className="text-xs text-muted-foreground">{l.badge}</p>
            </div>
            <div className="flex items-center gap-1">
              <Zap className="h-4 w-4 text-primary" />
              <span className="font-bold text-primary">{l.points}</span>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
