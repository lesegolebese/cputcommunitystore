import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect, type ReactNode } from "react";
import {
  Bell,
  ShoppingCart,
  Search,
  Store,
  Megaphone,
  Plus,
  Minus,
  X,
  Star,
  BadgeCheck,
  ShieldCheck,
  Heart,
  User,
  Home,
  Mail,
  ChevronDown,
  Trash2,
  CheckCircle2,
  MessageCircle,
  LockKeyhole,
  Percent,
  MapPin,
  ShieldAlert,
  Trophy,
  Zap,
  Flag,
  Award,
} from "lucide-react";
import {
  CATEGORIES,
  CONDITIONS,
  IMAGES,
  NOTICES,
  NOTICE_TYPES,
  PRODUCTS,
  ROLES,
  type Notice,
  type Product,
  type Role,
  type FlaggedItem,
  type FraudAlert,
} from "@/components/store/data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Community Store & Campus Marketplace" },
      {
        name: "description",
        content:
          "Buy, sell and connect with students, vendors and residents on your campus marketplace.",
      },
      { property: "og:title", content: "Community Store & Campus Marketplace" },
      {
        property: "og:description",
        content:
          "Textbooks, electronics, dorm essentials and local food — plus a community bulletin board.",
      },
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
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [campusZone, setCampusZone] = useState("Any");
  const [maxPrice, setMaxPrice] = useState<number>(10000);
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [listingOpen, setListingOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [chatProduct, setChatProduct] = useState<Product | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  // New feature states
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [twoFactorModalOpen, setTwoFactorModalOpen] = useState(false);
  const [twoFactorCallback, setTwoFactorCallback] = useState<(() => void) | null>(null);
  const [loyaltyPoints, setLoyaltyPoints] = useState(150);
  const [credibilityBadges, setCredibilityBadges] = useState<string[]>([
    "Early Adopter",
    "Trusted Trader",
  ]);
  const [flaggedItems, setFlaggedItems] = useState<FlaggedItem[]>([]);
  const [moderationOpen, setModerationOpen] = useState(false);
  const [fraudAlerts, setFraudAlerts] = useState<FraudAlert[]>([]);
  const [fraudPanelOpen, setFraudPanelOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [boostModalOpen, setBoostModalOpen] = useState(false);
  const [boostProduct, setBoostProduct] = useState<Product | null>(null);

  // Real-time notifications
  const [notifications, setNotifications] = useState([
    {
      id: "1",
      type: "order",
      message: "Your escrow order is ready for collection",
      time: "2m ago",
      read: false,
    },
    {
      id: "2",
      type: "message",
      message: "Mama Thandi replied to your message",
      time: "15m ago",
      read: false,
    },
    {
      id: "3",
      type: "system",
      message: "New listing matches your saved search",
      time: "1h ago",
      read: true,
    },
  ]);
  const unreadCount = notifications.filter((n) => !n.read).length;

  // Simulate real-time notifications
  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() > 0.7) {
        const newNotifications = [
          { id: "order", message: "Your escrow order is ready for collection", time: "Just now" },
          { id: "message", message: "Someone viewed your listing", time: "Just now" },
          { id: "system", message: "Price drop alert: item in your wishlist", time: "Just now" },
        ];
        const random = newNotifications[Math.floor(Math.random() * newNotifications.length)];
        setNotifications((prev) => [{ ...random, id: crypto.randomUUID(), read: false }, ...prev]);
        flash("New notification!");
      }
    }, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const me = ROLES.find((r) => r.id === role)!;
  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);
  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2200);
  };

  const requireTwoFactor = (callback: () => void) => {
    if (twoFactorEnabled) {
      setTwoFactorCallback(() => callback);
      setTwoFactorModalOpen(true);
    } else {
      callback();
    }
  };

  const add = (p: Product) => {
    setCart((c) => ({ ...c, [p.id]: Math.min(p.quantity, (c[p.id] ?? 0) + 1) }));
    flash(p.quantity > 0 ? `Added "${p.title}" to cart` : "This listing is out of stock");
  };
  const setQty = (id: string, q: number) =>
    setCart((c) => {
      const n = { ...c };
      if (q <= 0) delete n[id];
      else n[id] = q;
      return n;
    });

  const filtered = useMemo(
    () =>
      products.filter(
        (p) =>
          (category === "All" || p.category === category) &&
          (condition === "Any" || p.condition === condition) &&
          (!verifiedOnly ||
            p.sellerBadge === "Verified Vendor" ||
            p.sellerBadge === "Verified Student") &&
          (campusZone === "Any" || p.campusZone === campusZone) &&
          p.price <= maxPrice &&
          (p.title + p.seller + p.category).toLowerCase().includes(query.toLowerCase()),
      ),
    [products, category, condition, verifiedOnly, campusZone, maxPrice, query],
  );

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      {/* Role banner */}
      <div className="bg-foreground text-background">
        <div className="mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto px-4 py-2 text-xs">
          <span className="shrink-0 font-semibold text-accent">DEMO ROLE:</span>
          {ROLES.map((r) => (
            <button
              key={r.id}
              onClick={() => {
                setRole(r.id);
                flash(`Switched to ${r.label}`);
              }}
              className={`shrink-0 rounded-full px-3 py-1 font-medium transition ${role === r.id ? "bg-accent text-accent-foreground" : "bg-background/10 hover:bg-background/20"}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <button onClick={() => setTab("market")} className="flex shrink-0 items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Store className="h-5 w-5" />
            </span>
            <span className="hidden text-lg font-extrabold sm:block">
              Community<span className="text-primary"> Store</span>
            </span>
          </button>
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setTab("market");
              }}
              placeholder="Search textbooks, gadgets, food…"
              className="w-full rounded-xl border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <nav className="hidden items-center gap-1 md:flex">
            <NavBtn active={tab === "market"} onClick={() => setTab("market")}>
              Marketplace
            </NavBtn>
            <NavBtn active={tab === "board"} onClick={() => setTab("board")}>
              Bulletin Board
            </NavBtn>
          </nav>
          <button
            onClick={() => setNotificationsOpen((open) => !open)}
            className="relative hidden rounded-xl p-2 hover:bg-muted sm:block"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent" />
            )}
          </button>
          {notificationsOpen && (
            <div className="absolute right-16 top-14 z-40 w-80 rounded-xl border bg-popover p-3 text-sm shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <p className="font-bold">Notifications</p>
                <button
                  onClick={() => setNotifications((ns) => ns.map((n) => ({ ...n, read: true })))}
                  className="text-xs text-primary hover:underline"
                >
                  Mark all read
                </button>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`rounded-lg p-2 ${!n.read ? "bg-primary-soft text-primary" : "bg-muted"}`}
                  >
                    <p className="font-medium">{n.message}</p>
                    <p className="text-xs opacity-70 mt-1">{n.time}</p>
                  </div>
                ))}
                {notifications.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">No notifications</p>
                )}
              </div>
            </div>
          )}
          <button
            onClick={() => setCartOpen(true)}
            className="relative rounded-xl p-2 hover:bg-muted"
            aria-label="Cart"
          >
            <ShoppingCart className="h-5 w-5" />
            {cartCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">
                {cartCount}
              </span>
            )}
          </button>
          <ProfileMenu
            me={me}
            onProfile={() => setTab("profile")}
            onAccount={() => setAccountOpen(true)}
            onLeaderboard={() => setLeaderboardOpen(true)}
            onModeration={() => setModerationOpen(true)}
            onFraudPanel={() => setFraudPanelOpen(true)}
            loyaltyPoints={loyaltyPoints}
          />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {tab === "market" && (
          <>
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="text-2xl font-extrabold">Hi {me.name.split(" ")[0]} 👋</h1>
                <p className="text-sm text-muted-foreground">
                  Browse what your campus community is selling today.
                </p>
              </div>
              {role !== "resident" && (
                <button
                  onClick={() => setListingOpen(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground shadow-sm hover:opacity-90"
                >
                  <Plus className="h-4 w-4" /> {role === "vendor" ? "Add Product" : "Sell an Item"}
                </button>
              )}
            </div>

            <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition ${category === c ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary"}`}
                >
                  {c}
                </button>
              ))}
            </div>

            <div className="mb-6 grid grid-cols-2 gap-3 rounded-xl border bg-card p-3 shadow-sm sm:flex sm:items-center">
              <label className="flex flex-col text-xs font-medium text-muted-foreground sm:flex-row sm:items-center sm:gap-2">
                Condition
                <select
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                  className="mt-1 rounded-lg border bg-background px-2 py-1.5 text-sm text-foreground sm:mt-0"
                >
                  {CONDITIONS.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col text-xs font-medium text-muted-foreground sm:flex-1 sm:flex-row sm:items-center sm:gap-2">
                Max price: <span className="font-semibold text-foreground">{zar(maxPrice)}</span>
                <input
                  type="range"
                  min={50}
                  max={10000}
                  step={50}
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(+e.target.value)}
                  className="mt-2 accent-primary sm:mt-0 sm:flex-1"
                />
              </label>
              <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <input
                  type="checkbox"
                  checked={verifiedOnly}
                  onChange={(e) => setVerifiedOnly(e.target.checked)}
                  className="accent-primary"
                />{" "}
                Verified sellers
              </label>
              <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                <select
                  value={campusZone}
                  onChange={(e) => setCampusZone(e.target.value)}
                  className="rounded-lg border bg-background px-2 py-1.5 text-sm text-foreground"
                >
                  <option>Any</option>
                  <option>Bellville</option>
                  <option>District Six</option>
                </select>
              </label>
              <span className="col-span-2 text-xs text-muted-foreground sm:ml-auto">
                {filtered.length} items
              </span>
            </div>

            {filtered.length === 0 ? (
              <p className="rounded-xl border bg-card p-10 text-center text-muted-foreground">
                No items match your filters.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                {filtered.map((p) => (
                  <ProductCard
                    key={p.id}
                    p={p}
                    onOpen={() => setDetail(p)}
                    onAdd={() => add(p)}
                    onBoost={() => {
                      setBoostProduct(p);
                      setBoostModalOpen(true);
                    }}
                    isVendor={role === "vendor"}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {tab === "board" && (
          <Board
            notices={notices}
            me={me.name}
            onLike={(id) =>
              setNotices((ns) =>
                ns.map((n) =>
                  n.id === id ? { ...n, liked: !n.liked, likes: n.likes + (n.liked ? -1 : 1) } : n,
                ),
              )
            }
            onPost={() => setNoticeOpen(true)}
          />
        )}

        {tab === "profile" && (
          <TrustPanel
            me={me}
            role={role}
            loyaltyPoints={loyaltyPoints}
            credibilityBadges={credibilityBadges}
          />
        )}
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t bg-card md:hidden">
        <BottomBtn
          icon={<Home className="h-5 w-5" />}
          label="Market"
          active={tab === "market"}
          onClick={() => setTab("market")}
        />
        <BottomBtn
          icon={<Megaphone className="h-5 w-5" />}
          label="Board"
          active={tab === "board"}
          onClick={() => setTab("board")}
        />
        <BottomBtn
          icon={<ShoppingCart className="h-5 w-5" />}
          label={`Cart${cartCount ? ` (${cartCount})` : ""}`}
          active={cartOpen}
          onClick={() => setCartOpen(true)}
        />
        <BottomBtn
          icon={<User className="h-5 w-5" />}
          label="Profile"
          active={tab === "profile"}
          onClick={() => setTab("profile")}
        />
      </nav>

      {detail && (
        <Modal onClose={() => setDetail(null)}>
          <img
            src={detail.image}
            alt={detail.title}
            className="aspect-video w-full rounded-xl object-cover"
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <CondBadge c={detail.condition} />
            <SellerBadge b={detail.sellerBadge} />
          </div>
          <h2 className="mt-3 text-xl font-bold">{detail.title}</h2>
          <p className="mt-1 text-2xl font-extrabold text-primary">{zar(detail.price)}</p>
          <p className="mt-3 text-sm text-muted-foreground">{detail.description}</p>
          <p className="mt-3 text-sm">
            Sold by <b>{detail.seller}</b> · <span className="text-accent">★</span> {detail.rating}{" "}
            · {detail.quantity} available
          </p>
          {detail.studentDiscount && (
            <p className="mt-2 inline-flex items-center gap-1 rounded-lg bg-accent-soft px-2 py-1 text-xs font-semibold">
              <Percent className="h-3.5 w-3.5" /> {detail.studentDiscount}% student discount
            </p>
          )}
          <div className="mt-5 flex gap-2">
            <button
              onClick={() => {
                add(detail);
                setDetail(null);
              }}
              disabled={detail.quantity < 1}
              className="flex-1 rounded-xl bg-primary py-3 font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {detail.quantity < 1 ? "Sold out" : "Add to Cart"}
            </button>
            <button
              onClick={() => {
                setFlaggedItems((prev) => [
                  ...prev,
                  {
                    id: crypto.randomUUID(),
                    type: "product",
                    itemId: detail.id,
                    reason: "Suspicious listing",
                    reporter: me.name,
                    timestamp: "Just now",
                    status: "pending",
                  },
                ]);
                flash("Listing flagged for community review");
              }}
              className="rounded-xl border px-3 text-sm font-semibold hover:bg-muted"
            >
              Report
            </button>
            <button
              onClick={() => setChatProduct(detail)}
              className="rounded-xl border p-3 hover:bg-muted"
              aria-label="Message seller"
            >
              <MessageCircle className="h-4 w-4" />
            </button>
          </div>
        </Modal>
      )}

      {cartOpen && (
        <CartDrawer
          cart={cart}
          products={products}
          setQty={setQty}
          onClose={() => setCartOpen(false)}
          requireTwoFactor={requireTwoFactor}
          onPaid={(m) => {
            setCart({});
            setCartOpen(false);
            flash(m);
          }}
        />
      )}

      {noticeOpen && (
        <NoticeForm
          onClose={() => setNoticeOpen(false)}
          onSubmit={(n) => {
            setNotices((ns) => [
              { ...n, id: crypto.randomUUID(), author: me.name, time: "Just now", likes: 0 },
              ...ns,
            ]);
            setNoticeOpen(false);
            flash("Notice posted to the board");
          }}
        />
      )}

      {listingOpen && (
        <ListingForm
          me={me}
          onClose={() => setListingOpen(false)}
          onSubmit={(p) => {
            setProducts((ps) => [p, ...ps]);
            setListingOpen(false);
            setCategory("All");
            flash("Your listing is live!");
          }}
        />
      )}
      {accountOpen && (
        <OnboardingModal
          role={role}
          twoFactorEnabled={twoFactorEnabled}
          onTwoFactorToggle={(enabled) => setTwoFactorEnabled(enabled)}
          onClose={() => setAccountOpen(false)}
          onDone={() => {
            setAccountOpen(false);
            flash("Account verification details saved");
          }}
        />
      )}
      {chatProduct && <ChatModal product={chatProduct} onClose={() => setChatProduct(null)} />}
      {twoFactorModalOpen && twoFactorCallback && (
        <TwoFactorModal
          onClose={() => {
            setTwoFactorModalOpen(false);
            setTwoFactorCallback(null);
          }}
          onVerified={() => {
            twoFactorCallback();
            setTwoFactorCallback(null);
          }}
        />
      )}
      {leaderboardOpen && (
        <LeaderboardModal
          onClose={() => setLeaderboardOpen(false)}
          loyaltyPoints={loyaltyPoints}
          credibilityBadges={credibilityBadges}
        />
      )}
      {moderationOpen && (
        <ModerationModal
          onClose={() => setModerationOpen(false)}
          flaggedItems={flaggedItems}
          products={products}
          notices={notices}
        />
      )}
      {fraudPanelOpen && (
        <FraudAlertPanel onClose={() => setFraudPanelOpen(false)} fraudAlerts={fraudAlerts} />
      )}
      {boostModalOpen && boostProduct && (
        <BoostModal
          product={boostProduct}
          onClose={() => {
            setBoostModalOpen(false);
            setBoostProduct(null);
          }}
          onBoost={(type, duration) => {
            setLoyaltyPoints(
              (prev) => prev - (type === "featured" ? duration * 50 : duration * 30),
            );
            setBoostModalOpen(false);
            setBoostProduct(null);
            flash(`Listing boosted for ${duration} days!`);
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm text-background shadow-lg animate-in fade-in slide-in-from-bottom-2 md:bottom-6">
          <CheckCircle2 className="h-4 w-4 text-brand-light" /> {toast}
        </div>
      )}
    </div>
  );
}

function NavBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl px-3 py-2 text-sm font-semibold ${active ? "bg-primary-soft text-primary" : "text-muted-foreground hover:text-foreground"}`}
    >
      {children}
    </button>
  );
}
function BottomBtn({
  icon,
  label,
  active,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${active ? "text-primary" : "text-muted-foreground"}`}
    >
      {icon}
      {label}
    </button>
  );
}

function ProfileMenu({
  me,
  onProfile,
  onAccount,
  onLeaderboard,
  onModeration,
  onFraudPanel,
  loyaltyPoints,
}: {
  me: (typeof ROLES)[number];
  onProfile: () => void;
  onAccount: () => void;
  onLeaderboard: () => void;
  onModeration: () => void;
  onFraudPanel: () => void;
  loyaltyPoints: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 rounded-xl p-1 hover:bg-muted"
      >
        <span className="grid h-8 w-8 place-items-center rounded-full bg-primary-soft text-sm font-bold text-primary">
          {me.name[0]}
        </span>
        <ChevronDown className="hidden h-4 w-4 sm:block" />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl border bg-popover p-2 shadow-lg">
          <p className="px-2 pt-1 text-sm font-semibold">{me.name}</p>
          <p className="px-2 pb-2 text-xs text-muted-foreground">{me.email}</p>
          <div className="flex items-center gap-2 rounded-lg bg-primary-soft px-2 py-2 text-xs">
            <Zap className="h-4 w-4 text-primary" />
            <span className="font-semibold text-primary">{loyaltyPoints} pts</span>
          </div>
          <button
            onClick={() => {
              onProfile();
              setOpen(false);
            }}
            className="mt-2 w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-muted"
          >
            Trust & Verification
          </button>
          <button
            onClick={() => {
              onLeaderboard();
              setOpen(false);
            }}
            className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-muted"
          >
            <Trophy className="h-4 w-4" /> Leaderboard
          </button>
          <button
            onClick={() => {
              onAccount();
              setOpen(false);
            }}
            className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-muted"
          >
            <LockKeyhole className="h-4 w-4" /> Account security & verification
          </button>
          {(me.id === "faculty" || me.id === "vendor") && (
            <button
              onClick={() => {
                onModeration();
                setOpen(false);
              }}
              className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-muted"
            >
              <Flag className="h-4 w-4" /> Content moderation
            </button>
          )}
          {me.id === "faculty" && (
            <button
              onClick={() => {
                onFraudPanel();
                setOpen(false);
              }}
              className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-muted"
            >
              <ShieldAlert className="h-4 w-4" /> Fraud alerts
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function CondBadge({ c }: { c: string }) {
  return (
    <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
      {c}
    </span>
  );
}
function SellerBadge({ b }: { b: string }) {
  const vendor = b === "Verified Vendor";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${vendor ? "bg-accent-soft text-accent-foreground" : "bg-primary-soft text-primary"}`}
    >
      <BadgeCheck className="h-3 w-3" />
      {b}
    </span>
  );
}

function ProductCard({
  p,
  onOpen,
  onAdd,
  onBoost,
  isVendor,
}: {
  p: Product;
  onOpen: () => void;
  onAdd: () => void;
  onBoost: () => void;
  isVendor: boolean;
}) {
  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <button onClick={onOpen} className="relative aspect-square overflow-hidden">
        <img
          src={p.image}
          alt={p.title}
          loading="lazy"
          className="h-full w-full object-cover transition group-hover:scale-105"
        />
        <span className="absolute left-2 top-2">
          <CondBadge c={p.condition} />
        </span>
      </button>
      <div className="flex flex-1 flex-col p-3">
        <SellerBadge b={p.sellerBadge} />
        <button
          onClick={onOpen}
          className="mt-2 line-clamp-2 text-left text-sm font-semibold leading-snug hover:text-primary"
        >
          {p.title}
        </button>
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="font-extrabold">{zar(p.price)}</span>
          <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
            <Star className="h-3 w-3 fill-accent text-accent" />
            {p.rating}
          </span>
        </div>
        <button
          onClick={onAdd}
          className="mt-3 rounded-xl bg-primary py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          Add to Cart
        </button>
        {isVendor && (
          <button
            onClick={onBoost}
            className="mt-2 rounded-xl border border-accent bg-accent-soft py-2 text-xs font-semibold text-accent hover:bg-accent/20"
          >
            <Zap className="mr-1 inline h-3 w-3" />
            Boost Listing
          </button>
        )}
      </div>
    </div>
  );
}

function Modal({
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

function CartDrawer({
  cart,
  products,
  setQty,
  onClose,
  onPaid,
  requireTwoFactor,
}: {
  cart: Record<string, number>;
  products: Product[];
  setQty: (id: string, q: number) => void;
  onClose: () => void;
  onPaid: (m: string) => void;
  requireTwoFactor: (callback: () => void) => void;
}) {
  const [paying, setPaying] = useState<string | null>(null);
  const items = products.filter((p) => cart[p.id]);
  const subtotal = items.reduce((s, p) => s + p.price * (cart[p.id] ?? 0), 0);
  const fee = subtotal ? Math.round(subtotal * 0.02 * 100) / 100 : 0;
  const pay = (via: string) => {
    requireTwoFactor(() => {
      setPaying(via);
      setTimeout(() => onPaid(`Payment via ${via} successful — funds held in escrow`), 1400);
    });
  };
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-overlay" onClick={onClose}>
      <aside
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-md flex-col bg-card shadow-xl animate-in slide-in-from-right"
      >
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-lg font-bold">Your Cart</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {items.length === 0 && (
            <p className="py-16 text-center text-muted-foreground">Your cart is empty.</p>
          )}
          {items.map((p) => (
            <div key={p.id} className="flex gap-3 rounded-xl border p-2">
              <img src={p.image} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{p.title}</p>
                <p className="text-sm text-primary">{zar(p.price)}</p>
                <div className="mt-1 flex items-center gap-2">
                  <button
                    onClick={() => setQty(p.id, (cart[p.id] ?? 0) - 1)}
                    className="rounded-md border p-1"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-5 text-center text-sm">{cart[p.id]}</span>
                  <button
                    onClick={() => setQty(p.id, (cart[p.id] ?? 0) + 1)}
                    className="rounded-md border p-1"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => setQty(p.id, 0)}
                    className="ml-auto text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        {items.length > 0 && (
          <div className="space-y-3 border-t p-4">
            <div className="space-y-1 text-sm">
              <Row l="Subtotal" r={zar(subtotal)} />
              <Row l="Escrow service fee (2%)" r={zar(fee)} />
              <Row l={<b>Order total</b>} r={<b className="text-lg">{zar(subtotal + fee)}</b>} />
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-primary-soft p-3 text-xs text-primary">
              <ShieldCheck className="h-5 w-5 shrink-0" />
              <span>
                <b>Escrow Protection Enabled.</b> Funds release to the seller only after you confirm
                collection.
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                disabled={!!paying}
                onClick={() => pay("PayFast")}
                className="rounded-xl bg-foreground py-3 text-sm font-bold text-background disabled:opacity-60"
              >
                {paying === "PayFast" ? "Processing…" : "Pay with PayFast"}
              </button>
              <button
                disabled={!!paying}
                onClick={() => pay("SnapScan")}
                className="rounded-xl bg-accent py-3 text-sm font-bold text-accent-foreground disabled:opacity-60"
              >
                {paying === "SnapScan" ? "Processing…" : "Pay with SnapScan"}
              </button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
function Row({ l, r }: { l: ReactNode; r: ReactNode }) {
  return (
    <div className="flex justify-between">
      {l}
      <span>{r}</span>
    </div>
  );
}

const typeStyle: Record<string, string> = {
  Announcement: "bg-primary-soft text-primary",
  "Lost & Found": "bg-accent-soft text-accent-foreground",
  "Club Event": "bg-muted text-foreground",
  "Service Request": "bg-secondary text-muted-foreground",
};

function Board({
  notices,
  onLike,
  onPost,
  me,
}: {
  notices: Notice[];
  onLike: (id: string) => void;
  onPost: () => void;
  me: string;
}) {
  const [filter, setFilter] = useState("All");
  const list = notices.filter((n) => filter === "All" || n.type === filter);
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold">Community Bulletin Board</h1>
          <p className="text-sm text-muted-foreground">
            Announcements, lost & found, events and requests — no selling here.
          </p>
        </div>
        <button
          onClick={onPost}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground shadow-sm"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Post a Notice</span>
        </button>
      </div>
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
        {["All", ...NOTICE_TYPES].map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`shrink-0 rounded-full border px-3 py-1 text-sm font-medium ${filter === t ? "border-primary bg-primary text-primary-foreground" : "bg-card"}`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {list.map((n) => (
          <article key={n.id} className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <span
                className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${typeStyle[n.type]}`}
              >
                {n.type}
              </span>
              <span className="text-xs text-muted-foreground">{n.time}</span>
            </div>
            <h3 className="mt-2 font-bold">{n.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
            {(n.contact || n.expiresAt) && (
              <p className="mt-2 text-xs text-muted-foreground">
                {n.contact && (
                  <>
                    Contact: <b className="text-foreground">{n.contact}</b>
                  </>
                )}
                {n.contact && n.expiresAt && " · "}
                {n.expiresAt && <>Expires {n.expiresAt}</>}
              </p>
            )}
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                by <b className="text-foreground">{n.author}</b>
                {n.author === me && " (you)"}
              </span>
              <button
                onClick={() => onLike(n.id)}
                className={`flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-muted ${n.liked ? "text-destructive" : "text-muted-foreground"}`}
              >
                <Heart className={`h-4 w-4 ${n.liked ? "fill-current" : ""}`} />
                {n.likes}
              </button>
            </div>
          </article>
        ))}
        {list.length === 0 && (
          <p className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
            Nothing here yet.
          </p>
        )}
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

function NoticeForm({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (n: {
    type: string;
    title: string;
    body: string;
    contact?: string;
    expiresAt?: string;
  }) => void;
}) {
  const [type, setType] = useState<string>(NOTICE_TYPES[0]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [contact, setContact] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  return (
    <Modal title="Post a Notice" onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim() && body.trim())
            onSubmit({
              type,
              title: title.trim(),
              body: body.trim(),
              ...(contact.trim() && { contact: contact.trim() }),
              ...(expiresAt && { expiresAt }),
            });
        }}
      >
        <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
          {NOTICE_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <input
          required
          maxLength={100}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          className={inputCls}
        />
        <textarea
          required
          maxLength={500}
          rows={4}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Details…"
          className={inputCls}
        />
        <input
          maxLength={120}
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="Contact details (optional)"
          className={inputCls}
        />
        <label className="block text-xs font-medium text-muted-foreground">
          Auto-expiry (optional)
          <input
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className={`${inputCls} mt-1`}
          />
        </label>
        <button className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground">
          Post to Board
        </button>
      </form>
    </Modal>
  );
}

function ListingForm({
  me,
  onClose,
  onSubmit,
}: {
  me: (typeof ROLES)[number];
  onClose: () => void;
  onSubmit: (p: Product) => void;
}) {
  const [f, setF] = useState({
    title: "",
    price: "",
    quantity: "1",
    category: "Textbooks",
    condition: "Like New",
    description: "",
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF({ ...f, [k]: e.target.value });
  return (
    <Modal title={me.id === "vendor" ? "Add a Product" : "Sell an Item"} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const price = Number(f.price);
          if (!f.title.trim() || !(price > 0)) return;
          onSubmit({
            id: crypto.randomUUID(),
            title: f.title.trim(),
            price,
            category: f.category,
            condition: f.condition,
            quantity: Number(f.quantity),
            description: f.description || "No description provided.",
            seller: me.name,
            sellerBadge: me.id === "vendor" ? "Verified Vendor" : "Verified Student",
            rating: 5.0,
            image: IMAGES[f.category] ?? "",
          });
        }}
      >
        <input
          required
          maxLength={80}
          value={f.title}
          onChange={set("title")}
          placeholder="Item title"
          className={inputCls}
        />
        <div className="grid grid-cols-3 gap-3">
          <input
            required
            type="number"
            min={1}
            value={f.price}
            onChange={set("price")}
            placeholder="Price (R)"
            className={inputCls}
          />
          <input
            required
            type="number"
            min={1}
            max={999}
            value={f.quantity}
            onChange={set("quantity")}
            placeholder="Quantity"
            className={inputCls}
          />
          <select value={f.condition} onChange={set("condition")} className={inputCls}>
            {CONDITIONS.slice(1).map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <select value={f.category} onChange={set("category")} className={inputCls}>
          {CATEGORIES.slice(1).map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <textarea
          rows={3}
          maxLength={400}
          value={f.description}
          onChange={set("description")}
          placeholder="Description"
          className={inputCls}
        />
        <button className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground">
          Publish Listing
        </button>
      </form>
    </Modal>
  );
}

function TrustPanel({
  me,
  role,
  loyaltyPoints,
  credibilityBadges,
}: {
  me: (typeof ROLES)[number];
  role: Role;
  loyaltyPoints: number;
  credibilityBadges: string[];
}) {
  const [email, setEmail] = useState(me.email);
  const [checked, setChecked] = useState<boolean | null>(null);
  const isAcademic = /@([a-z0-9-]+\.)*ac\.za$/i.test(email.trim());
  const score = role === "student" ? 4.9 : role === "vendor" ? 4.8 : role === "faculty" ? 4.9 : 4.5;
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="h-24 bg-gradient-to-r from-primary to-brand-light" />
        <div className="-mt-10 flex flex-col gap-3 p-5 sm:flex-row sm:items-end">
          <span className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl border-4 border-card bg-primary-soft text-3xl font-extrabold text-primary">
            {me.name[0]}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-extrabold">{me.name}</h1>
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              <Mail className="h-4 w-4" />
              {me.email}
            </p>
          </div>
          <span className="inline-flex items-center gap-1 self-start rounded-full bg-accent-soft px-3 py-1 text-sm font-semibold sm:self-auto">
            <BadgeCheck className="h-4 w-4 text-primary" />
            {me.badge}
          </span>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Community trust rating</p>
          <p className="mt-1 text-4xl font-extrabold">
            {score}
            <span className="text-lg text-accent"> ★</span>
          </p>
          <div className="mt-3 h-2 rounded-full bg-muted">
            <div className="h-2 rounded-full bg-primary" style={{ width: `${score * 20}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Based on completed trades and reviews.
          </p>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Loyalty points</p>
          <div className="mt-1 flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            <p className="text-4xl font-extrabold text-primary">{loyaltyPoints}</p>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Earn points through trades and community engagement. Redeem for listing boosts.
          </p>
        </div>
      </div>
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <p className="font-semibold flex items-center gap-2">
          <Award className="h-5 w-5 text-primary" /> Credibility badges
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {credibilityBadges.map((badge) => (
            <span
              key={badge}
              className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-3 py-1 text-sm font-semibold text-primary"
            >
              <Award className="h-3.5 w-3.5" />
              {badge}
            </span>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Badges unlock as you build trust and complete successful transactions.
        </p>
      </div>
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <p className="font-semibold">Email domain verification</p>
        <p className="text-xs text-muted-foreground">
          Students verify with an @cput.ac.za or any .ac.za email.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setChecked(null);
            }}
            className={inputCls}
          />
          <button
            onClick={() => setChecked(isAcademic)}
            className="shrink-0 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground"
          >
            Verify
          </button>
        </div>
        {checked === true && (
          <p className="mt-2 flex items-center gap-1 text-sm font-medium text-primary">
            <CheckCircle2 className="h-4 w-4" />
            Academic email verified
          </p>
        )}
        {checked === false && (
          <p className="mt-2 text-sm font-medium text-destructive">
            Not a .ac.za address — verified as community member only.
          </p>
        )}
      </div>
    </div>
  );
}

function OnboardingModal({
  role,
  twoFactorEnabled,
  onTwoFactorToggle,
  onClose,
  onDone,
}: {
  role: Role;
  twoFactorEnabled: boolean;
  onTwoFactorToggle: (enabled: boolean) => void;
  onClose: () => void;
  onDone: () => void;
}) {
  const [email, setEmail] = useState("");
  const [twoFactor, setTwoFactor] = useState(twoFactorEnabled);
  const [documentName, setDocumentName] = useState("");
  const academic = /@([a-z0-9-]+\.)*ac\.za$/i.test(email.trim());
  const needsDocument = role === "vendor";
  return (
    <Modal title="Account onboarding & security" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          onTwoFactorToggle(twoFactor);
          onDone();
        }}
      >
        <div className="rounded-xl bg-primary-soft p-3 text-sm text-primary">
          <b>{ROLES.find((item) => item.id === role)?.label}</b>
          <p className="mt-1">
            Verification protects campus buyers and unlocks trusted trading features.
          </p>
        </div>
        <label className="block text-sm font-medium">
          University or account email
          <input
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@cput.ac.za"
            className={`${inputCls} mt-1`}
          />
        </label>
        {(role === "student" || role === "faculty") && (
          <p className={`text-xs ${academic ? "text-primary" : "text-muted-foreground"}`}>
            {academic
              ? "Academic domain accepted. A verification token would be sent here."
              : "Use a valid .ac.za campus address to receive a verification token."}
          </p>
        )}
        {needsDocument && (
          <label className="block text-sm font-medium">
            Business registration or official ID
            <input
              required
              type="file"
              onChange={(event) => setDocumentName(event.target.files?.[0]?.name ?? "")}
              className={`${inputCls} mt-1`}
            />
            {documentName && (
              <span className="mt-1 block text-xs text-primary">
                Ready to submit: {documentName}
              </span>
            )}
          </label>
        )}
        <label className="flex items-center gap-2 rounded-xl border p-3 text-sm">
          <input
            type="checkbox"
            checked={twoFactor}
            onChange={(event) => setTwoFactor(event.target.checked)}
            className="accent-primary"
          />
          Require 2FA for sensitive profile edits and high-value orders
        </label>
        <button
          disabled={(role === "student" || role === "faculty") && !academic}
          className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-50"
        >
          Save verification settings
        </button>
      </form>
    </Modal>
  );
}

function ChatModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  return (
    <Modal title={`Message ${product.seller}`} onClose={onClose}>
      <div className="rounded-xl bg-muted p-3 text-sm">
        <b>Safe campus chat</b>
        <p className="mt-1 text-muted-foreground">
          Arrange collection without sharing your private phone number.
        </p>
      </div>
      {sent && (
        <p className="mt-3 rounded-lg bg-primary-soft p-2 text-sm text-primary">
          Message sent. Replies appear in Notifications.
        </p>
      )}
      <form
        className="mt-4 space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (message.trim()) {
            setSent(true);
            setMessage("");
          }
        }}
      >
        <textarea
          required
          rows={3}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Hi, is this still available? Suggest a safe pickup point..."
          className={inputCls}
        />
        <button className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground">
          Send secure message
        </button>
      </form>
    </Modal>
  );
}

function TwoFactorModal({ onClose, onVerified }: { onClose: () => void; onVerified: () => void }) {
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setVerifying(true);
    setTimeout(() => {
      setVerifying(false);
      onVerified();
      onClose();
    }, 1000);
  };
  return (
    <Modal title="Two-Factor Authentication" onClose={onClose}>
      <div className="rounded-xl bg-primary-soft p-3 text-sm text-primary">
        <b>Enter the 6-digit code sent to your device</b>
        <p className="mt-1">
          This protects sensitive operations like profile edits and high-value transactions.
        </p>
      </div>
      <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
        <input
          required
          maxLength={6}
          pattern="[0-9]{6}"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder="000000"
          className={`${inputCls} text-center text-2xl tracking-widest`}
        />
        <button
          disabled={verifying || code.length !== 6}
          className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-50"
        >
          {verifying ? "Verifying..." : "Verify & Continue"}
        </button>
      </form>
    </Modal>
  );
}

function LeaderboardModal({
  onClose,
  loyaltyPoints,
  credibilityBadges,
}: {
  onClose: () => void;
  loyaltyPoints: number;
  credibilityBadges: string[];
}) {
  const leaders = [
    { name: "Ayanda K.", points: 2450, badge: "Top Seller" },
    { name: "Mama Thandi's Kitchen", points: 1890, badge: "Community Star" },
    { name: "Sipho N.", points: 1650, badge: "Fast Responder" },
    { name: "You", points: loyaltyPoints, badge: credibilityBadges[0] },
    { name: "Naledi P.", points: 980, badge: "Rising Star" },
  ];
  return (
    <Modal title="Community Leaderboard" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Top traders this month based on completed transactions and community engagement.
        </p>
        {leaders.map((leader, i) => (
          <div
            key={leader.name}
            className={`flex items-center gap-3 rounded-xl border p-3 ${leader.name === "You" ? "bg-primary-soft border-primary" : "bg-card"}`}
          >
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full font-bold ${i === 0 ? "bg-accent text-accent-foreground" : i === 1 ? "bg-muted" : i === 2 ? "bg-muted/70" : "bg-muted/50"}`}
            >
              {i + 1}
            </span>
            <div className="flex-1">
              <p className="font-semibold">{leader.name}</p>
              <p className="text-xs text-muted-foreground">{leader.badge}</p>
            </div>
            <div className="flex items-center gap-1">
              <Zap className="h-4 w-4 text-primary" />
              <span className="font-bold text-primary">{leader.points}</span>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

function ModerationModal({
  onClose,
  flaggedItems,
  products,
  notices,
}: {
  onClose: () => void;
  flaggedItems: FlaggedItem[];
  products: Product[];
  notices: Notice[];
}) {
  const handleResolve = (id: string) => {
    // In a real app, this would update the backend
    onClose();
  };
  return (
    <Modal title="Content Moderation" onClose={onClose}>
      <div className="space-y-3">
        {flaggedItems.length === 0 ? (
          <p className="rounded-xl bg-muted p-4 text-center text-sm text-muted-foreground">
            No pending flagged items to review.
          </p>
        ) : (
          flaggedItems.map((item) => {
            const target =
              item.type === "product"
                ? products.find((p) => p.id === item.itemId)
                : notices.find((n) => n.id === item.itemId);
            return (
              <div key={item.id} className="rounded-xl border bg-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="font-semibold">
                      {target?.title || target?.title || "Unknown item"}
                    </p>
                    <p className="text-xs text-muted-foreground">Reason: {item.reason}</p>
                    <p className="text-xs text-muted-foreground">
                      Reported by: {item.reporter} · {item.timestamp}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                      item.status === "pending"
                        ? "bg-destructive/10 text-destructive"
                        : item.status === "reviewed"
                          ? "bg-accent/10 text-accent"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => handleResolve(item.id)}
                    className="flex-1 rounded-lg bg-destructive py-1.5 text-xs font-semibold text-destructive-foreground hover:opacity-90"
                  >
                    Remove
                  </button>
                  <button
                    onClick={() => handleResolve(item.id)}
                    className="flex-1 rounded-lg border py-1.5 text-xs font-semibold hover:bg-muted"
                  >
                    Keep
                  </button>
                </div>
              </div>
            );
          })
        )}
        <button
          onClick={() => onClose()}
          className="w-full rounded-xl bg-muted py-2 text-sm font-semibold hover:bg-muted/80"
        >
          Close Panel
        </button>
      </div>
    </Modal>
  );
}

function FraudAlertPanel({
  onClose,
  fraudAlerts,
}: {
  onClose: () => void;
  fraudAlerts: FraudAlert[];
}) {
  return (
    <Modal title="AI Fraud Detection Alerts" onClose={onClose}>
      <div className="space-y-3">
        {fraudAlerts.length === 0 ? (
          <div className="rounded-xl bg-primary-soft p-4 text-center text-sm text-primary">
            <ShieldAlert className="mx-auto h-8 w-8 mb-2" />
            <p className="font-semibold">No suspicious activity detected</p>
            <p className="text-xs mt-1">AI monitoring is active and will flag anomalies.</p>
          </div>
        ) : (
          fraudAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`rounded-xl border p-3 ${
                alert.severity === "high"
                  ? "bg-destructive/5 border-destructive/50"
                  : alert.severity === "medium"
                    ? "bg-accent/5 border-accent/50"
                    : "bg-muted/30"
              }`}
            >
              <div className="flex items-start gap-2">
                <ShieldAlert
                  className={`h-5 w-5 mt-0.5 ${
                    alert.severity === "high"
                      ? "text-destructive"
                      : alert.severity === "medium"
                        ? "text-accent"
                        : "text-muted-foreground"
                  }`}
                />
                <div className="flex-1">
                  <p className="font-semibold">{alert.type.replace(/_/g, " ").toUpperCase()}</p>
                  <p className="text-sm text-muted-foreground">{alert.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">{alert.timestamp}</p>
                </div>
                <span
                  className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                    alert.severity === "high"
                      ? "bg-destructive text-destructive-foreground"
                      : alert.severity === "medium"
                        ? "bg-accent text-accent-foreground"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {alert.severity}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </Modal>
  );
}

function BoostModal({
  product,
  onClose,
  onBoost,
}: {
  product: Product;
  onClose: () => void;
  onBoost: (type: string, duration: number) => void;
}) {
  const [selected, setSelected] = useState<"featured" | "urgent" | null>(null);
  const [duration, setDuration] = useState(3);
  return (
    <Modal title="Boost Your Listing" onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-xl bg-primary-soft p-3 text-sm text-primary">
          <b>{product.title}</b>
          <p className="mt-1">
            Increase visibility and attract more buyers with promotional boosts.
          </p>
        </div>

        <div className="space-y-2">
          <label
            className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${selected === "featured" ? "border-primary bg-primary-soft" : "hover:border-primary/50"}`}
          >
            <input
              type="radio"
              name="boost"
              checked={selected === "featured"}
              onChange={() => setSelected("featured")}
              className="accent-primary"
            />
            <div className="flex-1">
              <p className="font-semibold">Featured Listing</p>
              <p className="text-xs text-muted-foreground">
                Appear at top of search results for {duration} days
              </p>
            </div>
            <span className="font-bold text-primary">{duration * 50} pts</span>
          </label>

          <label
            className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${selected === "urgent" ? "border-accent bg-accent-soft" : "hover:border-accent/50"}`}
          >
            <input
              type="radio"
              name="boost"
              checked={selected === "urgent"}
              onChange={() => setSelected("urgent")}
              className="accent-primary"
            />
            <div className="flex-1">
              <p className="font-semibold">Urgent Sale Badge</p>
              <p className="text-xs text-muted-foreground">
                Highlight as quick-sale for {duration} days
              </p>
            </div>
            <span className="font-bold text-accent">{duration * 30} pts</span>
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium">Duration (days)</label>
          <select
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className={`${inputCls} mt-1`}
          >
            <option value={1}>1 day</option>
            <option value={3}>3 days</option>
            <option value={7}>7 days</option>
          </select>
        </div>

        <button
          disabled={!selected}
          onClick={() => selected && onBoost(selected, duration)}
          className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-50"
        >
          Activate Boost
        </button>
      </div>
    </Modal>
  );
}
