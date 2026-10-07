import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import {
  Bell,
  ShoppingCart,
  Search,
  Store as StoreIcon,
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
  LogOut,
} from "lucide-react";
import {
  CATEGORIES,
  CONDITIONS,
  NOTICE_TYPES,
  resolveImage,
  ROLES,
  type Notice,
  type Product,
  type Role,
} from "@/components/store/data";
import { AuthScreen } from "@/components/store/auth-screen";
import {
  ChatModal,
  FraudAlertPanel,
  LeaderboardModal,
  ListingForm,
  ModerationModal,
  ProfilePage,
  Replies,
  ReviewsSection,
  SecurityModal,
  type OrderDto,
} from "@/components/store/features";
import { Avatar, Modal, inputCls, zar, type UserDto } from "@/components/store/ui";
import { api, errMsg, getToken, setToken } from "@/lib/api";
import { orderTotals, unitPrice } from "@/lib/pricing";

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

type Tab = "market" | "board" | "profile";


type NotificationDto = { id: string; type: string; message: string; read: boolean; time: string };
type ChatTarget = {
  product: { id: string; title: string; seller: string };
  withUserId?: string;
  withName?: string;
};

function App() {
  // undefined = still checking the saved session, null = signed out
  const [user, setUser] = useState<UserDto | null | undefined>(undefined);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    // Links from verification / reset emails must open the sign-in screen, not a stale session.
    if (q.get("verify") || q.get("reset") || !getToken()) {
      setUser(null);
      return;
    }
    api<{ user: UserDto }>("me")
      .then((d) => setUser(d.user))
      .catch(() => {
        setToken(null);
        setUser(null);
      });
  }, []);

  useEffect(() => {
    const out = () => setUser(null);
    window.addEventListener("cs-logout", out);
    return () => window.removeEventListener("cs-logout", out);
  }, []);

  const logout = async () => {
    try {
      await api("auth/logout", { body: {} });
    } catch {
      /* the token is stateless; clearing it locally is what actually signs the user out */
    }
    setToken(null);
    setUser(null);
  };

  if (user === undefined) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (user === null) return <AuthScreen onAuthed={setUser} />;
  return <Store user={user} onUser={setUser} onLogout={logout} />;
}

function Store({
  user,
  onUser,
  onLogout,
}: {
  user: UserDto;
  onUser: (u: UserDto) => void;
  onLogout: () => void;
}) {
  const role: Role = user.role;
  const me = useMemo(
    () => ({
      id: role,
      label: ROLES.find((r) => r.id === role)?.label ?? role,
      name: user.name,
      email: user.email,
      badge: user.badge,
    }),
    [role, user.name, user.email, user.badge],
  );
  const [tab, setTab] = useState<Tab>("market");
  const [products, setProducts] = useState<Product[]>([]);
  const [productsErr, setProductsErr] = useState("");
  const [notices, setNotices] = useState<Notice[]>([]);
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
  const [editing, setEditing] = useState<Product | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [chat, setChat] = useState<ChatTarget | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [twoFactorCallback, setTwoFactorCallback] = useState<((code?: string) => void) | null>(
    null,
  );
  const [moderationOpen, setModerationOpen] = useState(false);
  const [fraudPanelOpen, setFraudPanelOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [boostProduct, setBoostProduct] = useState<Product | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const prevUnread = useRef(-1);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const canSell = role === "student" || (role === "vendor" && user.vendorStatus === "approved");
  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);

  const flash = useCallback((m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2600);
  }, []);

  const loadProducts = useCallback(
    () =>
      api<{ products: Product[] }>("products")
        .then((d) => {
          setProducts(d.products.map((p) => ({ ...p, image: resolveImage(p.image) })));
          setProductsErr("");
        })
        .catch((e) => setProductsErr(errMsg(e))),
    [],
  );
  const loadNotices = useCallback(
    () =>
      api<{ notices: Notice[] }>("notices")
        .then((d) => setNotices(d.notices))
        .catch(() => undefined),
    [],
  );
  const loadNotifications = useCallback(
    () =>
      api<{ notifications: NotificationDto[] }>("notifications")
        .then((d) => {
          setNotifications(d.notifications);
          const unread = d.notifications.filter((n) => !n.read).length;
          if (prevUnread.current >= 0 && unread > prevUnread.current) flash("New notification!");
          prevUnread.current = unread;
        })
        .catch(() => undefined),
    [flash],
  );
  const refreshMe = useCallback(
    () =>
      api<{ user: UserDto }>("me")
        .then((d) => onUser(d.user))
        .catch(() => undefined),
    [onUser],
  );

  useEffect(() => {
    loadProducts();
    loadNotices();
    loadNotifications();
    const t = setInterval(loadNotifications, 15000);
    return () => clearInterval(t);
  }, [loadProducts, loadNotices, loadNotifications]);

  // Keep the open product dialog in step with fresh data (e.g. after a review is posted).
  useEffect(() => {
    setDetail((d) => (d ? (products.find((p) => p.id === d.id) ?? d) : d));
  }, [products]);

  // Returning from the PayFast/SnapScan page: /?order=ID&status=return|cancel
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const id = q.get("order");
    if (!id) return;
    const status = q.get("status");
    window.history.replaceState(null, "", "/");
    if (status === "cancel") {
      flash("Payment cancelled. Your order has not been paid.");
      return;
    }
    let tries = 0;
    const check = () =>
      api<{ order: OrderDto }>(`orders/${id}`)
        .then((d) => {
          if (d.order.status === "pending_payment" && tries++ < 6) {
            setTimeout(check, 3000);
            return;
          }
          flash(
            d.order.status === "pending_payment"
              ? "Waiting for the payment provider to confirm…"
              : "Payment confirmed. Funds are held in escrow.",
          );
          loadProducts();
          loadNotifications();
          refreshMe();
          setReloadKey((k) => k + 1);
        })
        .catch(() => undefined);
    check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const markAllRead = async () => {
    setNotifications((ns) => ns.map((n) => ({ ...n, read: true })));
    prevUnread.current = 0;
    try {
      await api("notifications/read-all", { body: {} });
    } catch (e) {
      flash(errMsg(e));
    }
  };

  const requireTwoFactor = (callback: (code?: string) => void) => {
    if (user.twoFactorEnabled) setTwoFactorCallback(() => callback);
    else callback();
  };

  const reportListing = async (p: Product) => {
    const reason = window.prompt("Why are you reporting this listing?", "Suspicious listing");
    if (reason === null) return;
    try {
      await api("flags", { body: { type: "product", itemId: p.id, reason } });
      flash("Listing reported for moderator review");
    } catch (e) {
      flash(errMsg(e));
    }
  };

  const postNotice = async (n: {
    type: string;
    title: string;
    body: string;
    contact?: string;
    expiresAt?: string;
  }) => {
    try {
      await api("notices", { body: n });
      setNoticeOpen(false);
      loadNotices();
      refreshMe();
      flash("Notice posted to the board");
    } catch (e) {
      flash(errMsg(e));
    }
  };

  const likeNotice = async (id: string) => {
    try {
      const d = await api<{ notice: Notice }>(`notices/${id}/like`, { body: {} });
      setNotices((ns) => ns.map((n) => (n.id === id ? d.notice : n)));
    } catch (e) {
      flash(errMsg(e));
    }
  };

  const deleteNotice = async (id: string) => {
    try {
      await api(`notices/${id}`, { method: "DELETE" });
      setNotices((ns) => ns.filter((n) => n.id !== id));
      flash("Notice deleted");
    } catch (e) {
      flash(errMsg(e));
    }
  };

  const boost = async (type: string, duration: number) => {
    if (!boostProduct) return;
    try {
      const d = await api<{ user: UserDto }>(`products/${boostProduct.id}/boost`, {
        body: { type, duration },
      });
      onUser(d.user);
      loadProducts();
      flash(`Listing boosted for ${duration} days!`);
    } catch (e) {
      flash(errMsg(e));
    }
    setBoostProduct(null);
  };

  const add = (p: Product) => {
    if (p.sellerId === user.id) {
      flash("You can't buy your own listing");
      return;
    }
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
      {/* Signed-in bar */}
      <div className="bg-foreground text-background">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2 text-xs">
          <span className="shrink-0 font-semibold text-accent">Signed in:</span>
          <span className="min-w-0 truncate">
            {user.name} · {user.badge}
          </span>
          <button
            onClick={onLogout}
            className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-background/10 px-3 py-1 font-medium hover:bg-background/20"
          >
            <LogOut className="h-3 w-3" /> Log out
          </button>
        </div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <button onClick={() => setTab("market")} className="flex shrink-0 items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
              <StoreIcon className="h-5 w-5" />
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
            aria-label="Notifications"
            className="relative rounded-xl p-2 hover:bg-muted"
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
                  onClick={markAllRead}
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
            user={user}
            onProfile={() => setTab("profile")}
            onAccount={() => setSecurityOpen(true)}
            onLeaderboard={() => setLeaderboardOpen(true)}
            onModeration={() => setModerationOpen(true)}
            onFraudPanel={() => setFraudPanelOpen(true)}
            onLogout={onLogout}
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
              {canSell && (
                <button
                  onClick={() => {
                    setEditing(null);
                    setListingOpen(true);
                  }}
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

            {productsErr ? (
              <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
                <p className="text-destructive">Couldn't load listings: {productsErr}</p>
                <button
                  onClick={loadProducts}
                  className="mt-3 rounded-xl bg-primary px-4 py-2 font-semibold text-primary-foreground"
                >
                  Try again
                </button>
              </div>
            ) : filtered.length === 0 ? (
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
                    onBoost={() => setBoostProduct(p)}
                    isVendor={role === "vendor" && p.sellerId === user.id}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {tab === "board" && (
          <Board
            notices={notices}
            meId={user.id}
            isModerator={role === "faculty"}
            onLike={likeNotice}
            onPost={() => setNoticeOpen(true)}
            onDelete={deleteNotice}
            onReplied={(n) => setNotices((ns) => ns.map((x) => (x.id === n.id ? n : x)))}
          />
        )}

        {tab === "profile" && (
          <ProfilePage
            user={user}
            onUser={onUser}
            reloadKey={reloadKey}
            onEditListing={(p) => {
              setEditing(p);
              setListingOpen(true);
            }}
            onOpenChat={(t) =>
              setChat({
                product: { id: t.productId, title: t.title, seller: t.withName },
                withUserId: t.withId,
                withName: t.withName,
              })
            }
            onChanged={() => {
              loadProducts();
              loadNotifications();
            }}
            flash={flash}
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
          <p className="mt-1 text-2xl font-extrabold text-primary">
            {zar(unitPrice(detail.price, detail.studentDiscount, role))}
            {unitPrice(detail.price, detail.studentDiscount, role) !== detail.price && (
              <span className="ml-2 text-sm font-medium text-muted-foreground line-through">
                {zar(detail.price)}
              </span>
            )}
          </p>
          <p className="mt-3 text-sm text-muted-foreground">{detail.description}</p>
          <p className="mt-3 text-sm">
            Sold by <b>{detail.seller}</b> · <span className="text-accent">★</span>{" "}
            {detail.rating > 0 ? detail.rating : "New"}
            {detail.reviewCount ? ` (${detail.reviewCount})` : ""} · {detail.quantity} available
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
              disabled={detail.quantity < 1 || detail.sellerId === user.id}
              className="flex-1 rounded-xl bg-primary py-3 font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {detail.sellerId === user.id
                ? "Your listing"
                : detail.quantity < 1
                  ? "Sold out"
                  : "Add to Cart"}
            </button>
            {detail.sellerId !== user.id && (
              <>
                <button
                  onClick={() => reportListing(detail)}
                  className="rounded-xl border px-3 text-sm font-semibold hover:bg-muted"
                >
                  Report
                </button>
                <button
                  onClick={() =>
                    setChat({
                      product: { id: detail.id, title: detail.title, seller: detail.seller },
                    })
                  }
                  className="rounded-xl border p-3 hover:bg-muted"
                  aria-label="Message seller"
                >
                  <MessageCircle className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
          <ReviewsSection
            product={detail}
            isOwner={detail.sellerId === user.id}
            onPosted={() => {
              loadProducts();
              refreshMe();
            }}
          />
        </Modal>
      )}

      {cartOpen && (
        <CartDrawer
          cart={cart}
          products={products}
          role={role}
          setQty={setQty}
          onClose={() => setCartOpen(false)}
          requireTwoFactor={requireTwoFactor}
          onPaid={(m) => {
            setCart({});
            setCartOpen(false);
            flash(m);
            loadProducts();
            loadNotifications();
            refreshMe();
            setReloadKey((k) => k + 1);
          }}
        />
      )}

      {noticeOpen && <NoticeForm onClose={() => setNoticeOpen(false)} onSubmit={postNotice} />}

      {listingOpen && (
        <ListingForm
          me={user}
          existing={editing}
          onClose={() => {
            setListingOpen(false);
            setEditing(null);
          }}
          onSaved={(message) => {
            setListingOpen(false);
            setEditing(null);
            setCategory("All");
            loadProducts();
            setReloadKey((k) => k + 1);
            flash(message);
          }}
        />
      )}
      {securityOpen && (
        <SecurityModal user={user} onUser={onUser} onClose={() => setSecurityOpen(false)} />
      )}
      {chat && (
        <ChatModal
          product={chat.product}
          {...(chat.withUserId ? { withUserId: chat.withUserId } : {})}
          {...(chat.withName ? { withName: chat.withName } : {})}
          onClose={() => setChat(null)}
        />
      )}
      {twoFactorCallback && (
        <TwoFactorModal
          onClose={() => setTwoFactorCallback(null)}
          onSubmit={(code) => twoFactorCallback(code)}
        />
      )}
      {leaderboardOpen && <LeaderboardModal onClose={() => setLeaderboardOpen(false)} />}
      {moderationOpen && (
        <ModerationModal
          onClose={() => setModerationOpen(false)}
          onChanged={() => {
            loadProducts();
            loadNotices();
          }}
        />
      )}
      {fraudPanelOpen && <FraudAlertPanel onClose={() => setFraudPanelOpen(false)} />}
      {boostProduct && (
        <BoostModal product={boostProduct} onClose={() => setBoostProduct(null)} onBoost={boost} />
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
  user,
  onProfile,
  onAccount,
  onLeaderboard,
  onModeration,
  onFraudPanel,
  onLogout,
}: {
  user: UserDto;
  onProfile: () => void;
  onAccount: () => void;
  onLeaderboard: () => void;
  onModeration: () => void;
  onFraudPanel: () => void;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const item = "mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-muted";
  const pick = (fn: () => void) => () => {
    fn();
    setOpen(false);
  };
  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen(!open)}
        aria-label="Account menu"
        className="flex items-center gap-1 rounded-xl p-1 hover:bg-muted"
      >
        <Avatar user={user} size={32} />
        <ChevronDown className="hidden h-4 w-4 sm:block" />
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-56 rounded-xl border bg-popover p-2 shadow-lg">
          <p className="px-2 pt-1 text-sm font-semibold">{user.name}</p>
          <p className="truncate px-2 pb-2 text-xs text-muted-foreground">{user.email}</p>
          <div className="flex items-center gap-2 rounded-lg bg-primary-soft px-2 py-2 text-xs">
            <Zap className="h-4 w-4 text-primary" />
            <span className="font-semibold text-primary">{user.loyaltyPoints} pts</span>
          </div>
          <button onClick={pick(onProfile)} className={item}>
            <User className="h-4 w-4" /> Profile, orders & messages
          </button>
          <button onClick={pick(onLeaderboard)} className={item}>
            <Trophy className="h-4 w-4" /> Leaderboard
          </button>
          <button onClick={pick(onAccount)} className={item}>
            <LockKeyhole className="h-4 w-4" /> Account security (2FA)
          </button>
          {user.role === "faculty" && (
            <>
              <button onClick={pick(onModeration)} className={item}>
                <Flag className="h-4 w-4" /> Content moderation
              </button>
              <button onClick={pick(onFraudPanel)} className={item}>
                <ShieldAlert className="h-4 w-4" /> Fraud alerts
              </button>
            </>
          )}
          <button onClick={pick(onLogout)} className={`${item} text-destructive`}>
            <LogOut className="h-4 w-4" /> Log out
          </button>
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
        {p.boostType && (
          <span className="absolute right-2 top-2 rounded-md bg-accent px-2 py-0.5 text-[11px] font-bold text-accent-foreground">
            {p.boostType === "featured" ? "Featured" : "Urgent sale"}
          </span>
        )}
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
            {p.rating > 0 ? p.rating : "New"}
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

type PaymentResponse = {
  order: OrderDto;
  payment: {
    mode: string;
    provider?: string;
    action?: string;
    fields?: Record<string, string>;
    redirectUrl?: string;
  };
};

/** PayFast expects the browser itself to POST the signed fields to its hosted payment page. */
function postToGateway(action: string, fields: Record<string, string>) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = action;
  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}

function CartDrawer({
  cart,
  products,
  role,
  setQty,
  onClose,
  onPaid,
  requireTwoFactor,
}: {
  cart: Record<string, number>;
  products: Product[];
  role: Role;
  setQty: (id: string, q: number) => void;
  onClose: () => void;
  onPaid: (m: string) => void;
  requireTwoFactor: (callback: (code?: string) => void) => void;
}) {
  const [paying, setPaying] = useState<string | null>(null);
  const [error, setError] = useState("");
  const items = products.filter((p) => cart[p.id]);
  // Same pricing helpers the server uses, so the total shown is the total charged.
  const { subtotal, fee, total } = orderTotals(
    items.map((p) => ({
      unit: unitPrice(p.price, p.studentDiscount, role),
      qty: cart[p.id] ?? 0,
    })),
  );
  const pay = (via: "PayFast" | "SnapScan") =>
    requireTwoFactor(async (code) => {
      setPaying(via);
      setError("");
      try {
        const res = await api<PaymentResponse>("orders", {
          body: {
            via,
            items: items.map((p) => ({ productId: p.id, qty: cart[p.id] ?? 0 })),
            ...(code ? { code } : {}),
          },
        });
        const { action, fields, redirectUrl, mode } = res.payment;
        if (action && fields) {
          postToGateway(action, fields);
          return;
        }
        if (redirectUrl) {
          window.location.href = redirectUrl;
          return;
        }
        onPaid(
          `Payment via ${via} successful${mode === "simulated" ? " (test mode)" : ""}. Funds are held in escrow.`,
        );
      } catch (e) {
        setError(errMsg(e));
        setPaying(null);
      }
    });
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-overlay" onClick={onClose}>
      <aside
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-md flex-col bg-card shadow-xl animate-in slide-in-from-right"
      >
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-lg font-bold">Your Cart</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-muted" aria-label="Close cart">
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
                <p className="text-sm text-primary">
                  {zar(unitPrice(p.price, p.studentDiscount, role))}
                  {unitPrice(p.price, p.studentDiscount, role) !== p.price && (
                    <span className="ml-1 text-xs text-muted-foreground">(student discount)</span>
                  )}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <button
                    onClick={() => setQty(p.id, (cart[p.id] ?? 0) - 1)}
                    className="rounded-md border p-1"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-5 text-center text-sm">{cart[p.id]}</span>
                  <button
                    onClick={() => setQty(p.id, Math.min(p.quantity, (cart[p.id] ?? 0) + 1))}
                    className="rounded-md border p-1"
                    aria-label="Increase quantity"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => setQty(p.id, 0)}
                    className="ml-auto text-muted-foreground hover:text-destructive"
                    aria-label="Remove item"
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
              <Row l={<b>Order total</b>} r={<b className="text-lg">{zar(total)}</b>} />
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-primary-soft p-3 text-xs text-primary">
              <ShieldCheck className="h-5 w-5 shrink-0" />
              <span>
                <b>Escrow Protection Enabled.</b> Funds release to the seller only after you confirm
                collection.
              </span>
            </div>
            {error && (
              <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
                {error}
              </p>
            )}
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
  onDelete,
  onReplied,
  meId,
  isModerator,
}: {
  notices: Notice[];
  onLike: (id: string) => void;
  onPost: () => void;
  onDelete: (id: string) => void;
  onReplied: (n: Notice) => void;
  meId: string;
  isModerator: boolean;
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
                {n.authorId === meId && " (you)"}
              </span>
              <button
                onClick={() => onLike(n.id)}
                className={`flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-muted ${n.liked ? "text-destructive" : "text-muted-foreground"}`}
              >
                <Heart className={`h-4 w-4 ${n.liked ? "fill-current" : ""}`} />
                {n.likes}
              </button>
            </div>
            <Replies
              notice={{ id: n.id, comments: n.comments ?? [] }}
              onChanged={(x) => onReplied(x as Notice)}
            />
            {(n.authorId === meId || isModerator) && (
              <button
                onClick={() => onDelete(n.id)}
                className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete notice
              </button>
            )}
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

function TwoFactorModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (code: string) => void;
}) {
  const [code, setCode] = useState("");
  return (
    <Modal title="Two-Factor Authentication" onClose={onClose}>
      <div className="rounded-xl bg-primary-soft p-3 text-sm text-primary">
        <b>Enter the 6-digit code from your authenticator app</b>
        <p className="mt-1">Your account requires a code to confirm payments.</p>
      </div>
      <form
        className="mt-4 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(code);
          onClose();
        }}
      >
        <input
          required
          autoFocus
          inputMode="numeric"
          maxLength={6}
          pattern="[0-9]{6}"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder="000000"
          className={`${inputCls} text-center text-2xl tracking-widest`}
        />
        <button
          disabled={code.length !== 6}
          className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-50"
        >
          Verify & Pay
        </button>
      </form>
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
