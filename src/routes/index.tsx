import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import {
  Bell, ShoppingCart, Search, Store, Megaphone, Plus, Minus, X, Star, BadgeCheck,
  ShieldCheck, Heart, User, Home, Mail, ChevronDown, Trash2, CheckCircle2,
} from "lucide-react";
import {
  CATEGORIES, CONDITIONS, IMAGES, NOTICES, NOTICE_TYPES, PRODUCTS, ROLES,
  type Notice, type Product, type Role,
} from "@/components/store/data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Community Store — Campus Marketplace" },
      { name: "description", content: "Buy, sell and connect with students, vendors and residents on your campus marketplace." },
      { property: "og:title", content: "Community Store — Campus Marketplace" },
      { property: "og:description", content: "Textbooks, electronics, dorm essentials and local food — plus a community bulletin board." },
    ],
  }),
  component: App,
});

const zar = (n: number) => `R ${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, " ")}`;
type Tab = "market" | "board" | "profile";

function App() {
  const [role, setRole] = useState<Role>("student");
  const [tab, setTab] = useState<Tab>("market");
  const [products, setProducts] = useState<Product[]>(PRODUCTS);
  const [notices, setNotices] = useState<Notice[]>(NOTICES);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [category, setCategory] = useState<string>("All");
  const [condition, setCondition] = useState<string>("Any");
  const [maxPrice, setMaxPrice] = useState<number>(10000);
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [listingOpen, setListingOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const me = ROLES.find((r) => r.id === role)!;
  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2200); };
  const add = (p: Product) => { setCart((c) => ({ ...c, [p.id]: (c[p.id] ?? 0) + 1 })); flash(`Added "${p.title}" to cart`); };
  const setQty = (id: string, q: number) => setCart((c) => { const n = { ...c }; if (q <= 0) delete n[id]; else n[id] = q; return n; });

  const filtered = useMemo(() => products.filter((p) =>
    (category === "All" || p.category === category) &&
    (condition === "Any" || p.condition === condition) &&
    p.price <= maxPrice &&
    (p.title + p.seller + p.category).toLowerCase().includes(query.toLowerCase())
  ), [products, category, condition, maxPrice, query]);

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      {/* Role banner */}
      <div className="bg-foreground text-background">
        <div className="mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto px-4 py-2 text-xs">
          <span className="shrink-0 font-semibold text-accent">DEMO ROLE:</span>
          {ROLES.map((r) => (
            <button key={r.id} onClick={() => { setRole(r.id); flash(`Switched to ${r.label}`); }}
              className={`shrink-0 rounded-full px-3 py-1 font-medium transition ${role === r.id ? "bg-accent text-accent-foreground" : "bg-background/10 hover:bg-background/20"}`}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <button onClick={() => setTab("market")} className="flex shrink-0 items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground"><Store className="h-5 w-5" /></span>
            <span className="hidden text-lg font-extrabold sm:block">Community<span className="text-primary"> Store</span></span>
          </button>
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={query} onChange={(e) => { setQuery(e.target.value); setTab("market"); }}
              placeholder="Search textbooks, gadgets, food…"
              className="w-full rounded-xl border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <nav className="hidden items-center gap-1 md:flex">
            <NavBtn active={tab === "market"} onClick={() => setTab("market")}>Marketplace</NavBtn>
            <NavBtn active={tab === "board"} onClick={() => setTab("board")}>Bulletin Board</NavBtn>
          </nav>
          <button onClick={() => flash("No new notifications")} className="relative hidden rounded-xl p-2 hover:bg-muted sm:block">
            <Bell className="h-5 w-5" /><span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent" />
          </button>
          <button onClick={() => setCartOpen(true)} className="relative rounded-xl p-2 hover:bg-muted" aria-label="Cart">
            <ShoppingCart className="h-5 w-5" />
            {cartCount > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">{cartCount}</span>}
          </button>
          <ProfileMenu me={me} onProfile={() => setTab("profile")} />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {tab === "market" && (
          <>
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="text-2xl font-extrabold">Hi {me.name.split(" ")[0]} 👋</h1>
                <p className="text-sm text-muted-foreground">Browse what your campus community is selling today.</p>
              </div>
              {role !== "resident" && (
                <button onClick={() => setListingOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground shadow-sm hover:opacity-90">
                  <Plus className="h-4 w-4" /> {role === "vendor" ? "Add Product" : "Sell an Item"}
                </button>
              )}
            </div>

            <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
              {CATEGORIES.map((c) => (
                <button key={c} onClick={() => setCategory(c)}
                  className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition ${category === c ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary"}`}>
                  {c}
                </button>
              ))}
            </div>

            <div className="mb-6 grid grid-cols-2 gap-3 rounded-xl border bg-card p-3 shadow-sm sm:flex sm:items-center">
              <label className="flex flex-col text-xs font-medium text-muted-foreground sm:flex-row sm:items-center sm:gap-2">
                Condition
                <select value={condition} onChange={(e) => setCondition(e.target.value)} className="mt-1 rounded-lg border bg-background px-2 py-1.5 text-sm text-foreground sm:mt-0">
                  {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
              <label className="flex flex-col text-xs font-medium text-muted-foreground sm:flex-1 sm:flex-row sm:items-center sm:gap-2">
                Max price: <span className="font-semibold text-foreground">{zar(maxPrice)}</span>
                <input type="range" min={50} max={10000} step={50} value={maxPrice} onChange={(e) => setMaxPrice(+e.target.value)} className="mt-2 accent-primary sm:mt-0 sm:flex-1" />
              </label>
              <span className="col-span-2 text-xs text-muted-foreground sm:ml-auto">{filtered.length} items</span>
            </div>

            {filtered.length === 0 ? (
              <p className="rounded-xl border bg-card p-10 text-center text-muted-foreground">No items match your filters.</p>
            ) : (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                {filtered.map((p) => <ProductCard key={p.id} p={p} onOpen={() => setDetail(p)} onAdd={() => add(p)} />)}
              </div>
            )}
          </>
        )}

        {tab === "board" && (
          <Board notices={notices} me={me.name}
            onLike={(id) => setNotices((ns) => ns.map((n) => n.id === id ? { ...n, liked: !n.liked, likes: n.likes + (n.liked ? -1 : 1) } : n))}
            onPost={() => setNoticeOpen(true)} />
        )}

        {tab === "profile" && <TrustPanel me={me} role={role} />}
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t bg-card md:hidden">
        <BottomBtn icon={<Home className="h-5 w-5" />} label="Market" active={tab === "market"} onClick={() => setTab("market")} />
        <BottomBtn icon={<Megaphone className="h-5 w-5" />} label="Board" active={tab === "board"} onClick={() => setTab("board")} />
        <BottomBtn icon={<ShoppingCart className="h-5 w-5" />} label={`Cart${cartCount ? ` (${cartCount})` : ""}`} active={cartOpen} onClick={() => setCartOpen(true)} />
        <BottomBtn icon={<User className="h-5 w-5" />} label="Profile" active={tab === "profile"} onClick={() => setTab("profile")} />
      </nav>

      {detail && (
        <Modal onClose={() => setDetail(null)}>
          <img src={detail.image} alt={detail.title} className="aspect-video w-full rounded-xl object-cover" />
          <div className="mt-4 flex flex-wrap gap-2"><CondBadge c={detail.condition} /><SellerBadge b={detail.sellerBadge} /></div>
          <h2 className="mt-3 text-xl font-bold">{detail.title}</h2>
          <p className="mt-1 text-2xl font-extrabold text-primary">{zar(detail.price)}</p>
          <p className="mt-3 text-sm text-muted-foreground">{detail.description}</p>
          <p className="mt-3 text-sm">Sold by <b>{detail.seller}</b> · <span className="text-accent">★</span> {detail.rating}</p>
          <button onClick={() => { add(detail); setDetail(null); }} className="mt-5 w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground hover:opacity-90">Add to Cart</button>
        </Modal>
      )}

      {cartOpen && <CartDrawer cart={cart} products={products} setQty={setQty} onClose={() => setCartOpen(false)}
        onPaid={(m) => { setCart({}); setCartOpen(false); flash(m); }} />}

      {noticeOpen && <NoticeForm onClose={() => setNoticeOpen(false)} onSubmit={(n) => {
        setNotices((ns) => [{ ...n, id: crypto.randomUUID(), author: me.name, time: "Just now", likes: 0 }, ...ns]);
        setNoticeOpen(false); flash("Notice posted to the board");
      }} />}

      {listingOpen && <ListingForm me={me} onClose={() => setListingOpen(false)} onSubmit={(p) => {
        setProducts((ps) => [p, ...ps]); setListingOpen(false); setCategory("All"); flash("Your listing is live!");
      }} />}

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm text-background shadow-lg animate-in fade-in slide-in-from-bottom-2 md:bottom-6">
          <CheckCircle2 className="h-4 w-4 text-brand-light" /> {toast}
        </div>
      )}
    </div>
  );
}

function NavBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return <button onClick={onClick} className={`rounded-xl px-3 py-2 text-sm font-semibold ${active ? "bg-primary-soft text-primary" : "text-muted-foreground hover:text-foreground"}`}>{children}</button>;
}
function BottomBtn({ icon, label, active, onClick }: { icon: ReactNode; label: string; active: boolean; onClick: () => void }) {
  return <button onClick={onClick} className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${active ? "text-primary" : "text-muted-foreground"}`}>{icon}{label}</button>;
}

function ProfileMenu({ me, onProfile }: { me: (typeof ROLES)[number]; onProfile: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative shrink-0">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-1 rounded-xl p-1 hover:bg-muted">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-primary-soft text-sm font-bold text-primary">{me.name[0]}</span>
        <ChevronDown className="hidden h-4 w-4 sm:block" />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl border bg-popover p-2 shadow-lg">
          <p className="px-2 pt-1 text-sm font-semibold">{me.name}</p>
          <p className="px-2 pb-2 text-xs text-muted-foreground">{me.email}</p>
          <button onClick={() => { onProfile(); setOpen(false); }} className="w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-muted">Trust & Verification</button>
        </div>
      )}
    </div>
  );
}

function CondBadge({ c }: { c: string }) {
  return <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">{c}</span>;
}
function SellerBadge({ b }: { b: string }) {
  const vendor = b === "Verified Vendor";
  return <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${vendor ? "bg-accent-soft text-accent-foreground" : "bg-primary-soft text-primary"}`}><BadgeCheck className="h-3 w-3" />{b}</span>;
}

function ProductCard({ p, onOpen, onAdd }: { p: Product; onOpen: () => void; onAdd: () => void }) {
  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <button onClick={onOpen} className="relative aspect-square overflow-hidden">
        <img src={p.image} alt={p.title} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
        <span className="absolute left-2 top-2"><CondBadge c={p.condition} /></span>
      </button>
      <div className="flex flex-1 flex-col p-3">
        <SellerBadge b={p.sellerBadge} />
        <button onClick={onOpen} className="mt-2 line-clamp-2 text-left text-sm font-semibold leading-snug hover:text-primary">{p.title}</button>
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="font-extrabold">{zar(p.price)}</span>
          <span className="flex items-center gap-0.5 text-xs text-muted-foreground"><Star className="h-3 w-3 fill-accent text-accent" />{p.rating}</span>
        </div>
        <button onClick={onAdd} className="mt-3 rounded-xl bg-primary py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">Add to Cart</button>
      </div>
    </div>
  );
}

function Modal({ onClose, children, title }: { onClose: () => void; children: ReactNode; title?: string }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-overlay sm:items-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-card p-5 shadow-xl animate-in slide-in-from-bottom-4 sm:max-w-lg sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-muted" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CartDrawer({ cart, products, setQty, onClose, onPaid }: {
  cart: Record<string, number>; products: Product[]; setQty: (id: string, q: number) => void; onClose: () => void; onPaid: (m: string) => void;
}) {
  const [paying, setPaying] = useState<string | null>(null);
  const items = products.filter((p) => cart[p.id]);
  const subtotal = items.reduce((s, p) => s + p.price * (cart[p.id] ?? 0), 0);
  const fee = subtotal ? Math.round(subtotal * 0.02 * 100) / 100 : 0;
  const pay = (via: string) => { setPaying(via); setTimeout(() => onPaid(`Payment via ${via} successful — funds held in escrow`), 1400); };
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-overlay" onClick={onClose}>
      <aside onClick={(e) => e.stopPropagation()} className="flex h-full w-full max-w-md flex-col bg-card shadow-xl animate-in slide-in-from-right">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-lg font-bold">Your Cart</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {items.length === 0 && <p className="py-16 text-center text-muted-foreground">Your cart is empty.</p>}
          {items.map((p) => (
            <div key={p.id} className="flex gap-3 rounded-xl border p-2">
              <img src={p.image} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{p.title}</p>
                <p className="text-sm text-primary">{zar(p.price)}</p>
                <div className="mt-1 flex items-center gap-2">
                  <button onClick={() => setQty(p.id, (cart[p.id] ?? 0) - 1)} className="rounded-md border p-1"><Minus className="h-3 w-3" /></button>
                  <span className="w-5 text-center text-sm">{cart[p.id]}</span>
                  <button onClick={() => setQty(p.id, (cart[p.id] ?? 0) + 1)} className="rounded-md border p-1"><Plus className="h-3 w-3" /></button>
                  <button onClick={() => setQty(p.id, 0)} className="ml-auto text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
        {items.length > 0 && (
          <div className="space-y-3 border-t p-4">
            <div className="space-y-1 text-sm">
              <Row l="Subtotal" r={zar(subtotal)} /><Row l="Escrow service fee (2%)" r={zar(fee)} />
              <Row l={<b>Order total</b>} r={<b className="text-lg">{zar(subtotal + fee)}</b>} />
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-primary-soft p-3 text-xs text-primary">
              <ShieldCheck className="h-5 w-5 shrink-0" /><span><b>Escrow Protection Enabled.</b> Funds release to the seller only after you confirm collection.</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button disabled={!!paying} onClick={() => pay("PayFast")} className="rounded-xl bg-foreground py-3 text-sm font-bold text-background disabled:opacity-60">{paying === "PayFast" ? "Processing…" : "Pay with PayFast"}</button>
              <button disabled={!!paying} onClick={() => pay("SnapScan")} className="rounded-xl bg-accent py-3 text-sm font-bold text-accent-foreground disabled:opacity-60">{paying === "SnapScan" ? "Processing…" : "Pay with SnapScan"}</button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
function Row({ l, r }: { l: ReactNode; r: ReactNode }) { return <div className="flex justify-between">{l}<span>{r}</span></div>; }

const typeStyle: Record<string, string> = {
  Announcement: "bg-primary-soft text-primary", "Lost & Found": "bg-accent-soft text-accent-foreground",
  "Club Event": "bg-muted text-foreground", "Service Request": "bg-secondary text-muted-foreground",
};

function Board({ notices, onLike, onPost, me }: { notices: Notice[]; onLike: (id: string) => void; onPost: () => void; me: string }) {
  const [filter, setFilter] = useState("All");
  const list = notices.filter((n) => filter === "All" || n.type === filter);
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold">Community Bulletin Board</h1>
          <p className="text-sm text-muted-foreground">Announcements, lost & found, events and requests — no selling here.</p>
        </div>
        <button onClick={onPost} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground shadow-sm"><Plus className="h-4 w-4" /><span className="hidden sm:inline">Post a Notice</span></button>
      </div>
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
        {["All", ...NOTICE_TYPES].map((t) => (
          <button key={t} onClick={() => setFilter(t)} className={`shrink-0 rounded-full border px-3 py-1 text-sm font-medium ${filter === t ? "border-primary bg-primary text-primary-foreground" : "bg-card"}`}>{t}</button>
        ))}
      </div>
      <div className="space-y-3">
        {list.map((n) => (
          <article key={n.id} className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${typeStyle[n.type]}`}>{n.type}</span>
              <span className="text-xs text-muted-foreground">{n.time}</span>
            </div>
            <h3 className="mt-2 font-bold">{n.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">by <b className="text-foreground">{n.author}</b>{n.author === me && " (you)"}</span>
              <button onClick={() => onLike(n.id)} className={`flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-muted ${n.liked ? "text-destructive" : "text-muted-foreground"}`}>
                <Heart className={`h-4 w-4 ${n.liked ? "fill-current" : ""}`} />{n.likes}
              </button>
            </div>
          </article>
        ))}
        {list.length === 0 && <p className="rounded-xl border bg-card p-8 text-center text-muted-foreground">Nothing here yet.</p>}
      </div>
    </div>
  );
}

const inputCls = "w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

function NoticeForm({ onClose, onSubmit }: { onClose: () => void; onSubmit: (n: { type: string; title: string; body: string }) => void }) {
  const [type, setType] = useState<string>(NOTICE_TYPES[0]);
  const [title, setTitle] = useState(""); const [body, setBody] = useState("");
  return (
    <Modal title="Post a Notice" onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (title.trim() && body.trim()) onSubmit({ type, title: title.trim(), body: body.trim() }); }}>
        <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>{NOTICE_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
        <input required maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className={inputCls} />
        <textarea required maxLength={500} rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Details…" className={inputCls} />
        <button className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground">Post to Board</button>
      </form>
    </Modal>
  );
}

function ListingForm({ me, onClose, onSubmit }: { me: (typeof ROLES)[number]; onClose: () => void; onSubmit: (p: Product) => void }) {
  const [f, setF] = useState({ title: "", price: "", category: "Textbooks", condition: "Like New", description: "" });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal title={me.id === "vendor" ? "Add a Product" : "Sell an Item"} onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => {
        e.preventDefault(); const price = Number(f.price);
        if (!f.title.trim() || !(price > 0)) return;
        onSubmit({ id: crypto.randomUUID(), title: f.title.trim(), price, category: f.category, condition: f.condition,
          description: f.description || "No description provided.", seller: me.name,
          sellerBadge: me.id === "vendor" ? "Verified Vendor" : "Verified Student", rating: 5.0, image: IMAGES[f.category] ?? "" });
      }}>
        <input required maxLength={80} value={f.title} onChange={set("title")} placeholder="Item title" className={inputCls} />
        <div className="grid grid-cols-2 gap-3">
          <input required type="number" min={1} value={f.price} onChange={set("price")} placeholder="Price (R)" className={inputCls} />
          <select value={f.condition} onChange={set("condition")} className={inputCls}>{CONDITIONS.slice(1).map((c) => <option key={c}>{c}</option>)}</select>
        </div>
        <select value={f.category} onChange={set("category")} className={inputCls}>{CATEGORIES.slice(1).map((c) => <option key={c}>{c}</option>)}</select>
        <textarea rows={3} maxLength={400} value={f.description} onChange={set("description")} placeholder="Description" className={inputCls} />
        <button className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground">Publish Listing</button>
      </form>
    </Modal>
  );
}

function TrustPanel({ me, role }: { me: (typeof ROLES)[number]; role: Role }) {
  const [email, setEmail] = useState(me.email);
  const [checked, setChecked] = useState<boolean | null>(null);
  const isAcademic = /@([a-z0-9-]+\.)*ac\.za$/i.test(email.trim());
  const score = role === "student" ? 4.9 : role === "vendor" ? 4.8 : 4.5;
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="h-24 bg-gradient-to-r from-primary to-brand-light" />
        <div className="-mt-10 flex flex-col gap-3 p-5 sm:flex-row sm:items-end">
          <span className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl border-4 border-card bg-primary-soft text-3xl font-extrabold text-primary">{me.name[0]}</span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-extrabold">{me.name}</h1>
            <p className="flex items-center gap-1 text-sm text-muted-foreground"><Mail className="h-4 w-4" />{me.email}</p>
          </div>
          <span className="inline-flex items-center gap-1 self-start rounded-full bg-accent-soft px-3 py-1 text-sm font-semibold sm:self-auto"><BadgeCheck className="h-4 w-4 text-primary" />{me.badge}</span>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Community trust rating</p>
          <p className="mt-1 text-4xl font-extrabold">{score}<span className="text-lg text-accent"> ★</span></p>
          <div className="mt-3 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${score * 20}%` }} /></div>
          <p className="mt-2 text-xs text-muted-foreground">Based on completed trades and reviews.</p>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <p className="font-semibold">Email domain verification</p>
          <p className="text-xs text-muted-foreground">Students verify with an @cput.ac.za or any .ac.za email.</p>
          <div className="mt-3 flex gap-2">
            <input value={email} onChange={(e) => { setEmail(e.target.value); setChecked(null); }} className={inputCls} />
            <button onClick={() => setChecked(isAcademic)} className="shrink-0 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground">Verify</button>
          </div>
          {checked === true && <p className="mt-2 flex items-center gap-1 text-sm font-medium text-primary"><CheckCircle2 className="h-4 w-4" />Academic email verified</p>}
          {checked === false && <p className="mt-2 text-sm font-medium text-destructive">Not a .ac.za address — verified as community member only.</p>}
        </div>
      </div>
    </div>
  );
}
