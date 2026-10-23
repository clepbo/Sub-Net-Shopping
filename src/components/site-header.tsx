import Link from "next/link";
import { Bell, ChevronDown, LayoutDashboard, LayoutGrid, MapPin, ShoppingCart, User } from "lucide-react";
import { cartCount } from "@/lib/cart";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { listCategories } from "@/lib/catalog";
import { ROLE_HOME } from "@/lib/session-token";
import { LogoMark } from "./logo";
import { SearchBox } from "./search-box";

const ROLE_LABEL = { CUSTOMER: null, SUPERMARKET: "Merchant", RIDER: "Rider", ADMIN: "Admin" } as const;

export async function SiteHeader() {
  const [user, categories] = await Promise.all([getCurrentUser(), listCategories()]);
  const active = user?.status === "ACTIVE" ? user : null;
  const [unread, inCart] = active
    ? await Promise.all([
        db.notification.count({ where: { userId: active.id, readAt: null } }),
        active.role === "CUSTOMER" ? cartCount(active.id) : Promise.resolve(0),
      ])
    : [0, 0];
  const roleLabel = active ? ROLE_LABEL[active.role] : null;

  const bell = active && (
    <Link
      href="/notifications"
      className="relative rounded-xl bg-brand-700/80 p-2 hover:bg-brand-700"
      aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
    >
      <Bell className="h-5 w-5" aria-hidden />
      {unread > 0 && (
        <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-brand-800 bg-accent-400 px-1 text-[10px] font-bold text-brand-950">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );

  return (
    <header className="sticky top-0 z-40 bg-brand-800 text-white shadow-md">
      {/* Utility bar */}
      <div className="border-b border-brand-700/60 bg-brand-900/50 text-xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-1.5">
          <span className="flex items-center gap-1 text-brand-100">
            <MapPin className="h-3.5 w-3.5" aria-hidden />
            Benin City, Edo State
          </span>
          <div className="flex items-center gap-4">
            {!active && (
              <span className="hidden gap-4 lg:flex">
                <Link href="/register/supermarket" className="text-brand-100 hover:text-white">
                  Sell on Sub Net
                </Link>
                <Link href="/register/rider" className="text-brand-100 hover:text-white">
                  Deliver with Sub Net
                </Link>
              </span>
            )}
            {active ? (
              <span className="truncate text-brand-100">
                {roleLabel && (
                  <span className="mr-1 rounded-full bg-accent-400 px-2 py-0.5 text-[10px] font-extrabold text-brand-950 uppercase">{roleLabel}</span>
                )}
                Hi, {active.firstName}
              </span>
            ) : (
              <Link href="/login" className="rounded-full bg-accent-400 px-2.5 py-0.5 text-[11px] font-extrabold text-brand-950 uppercase lg:hidden">
                Sign in / Register
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Main bar */}
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 lg:gap-8">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <LogoMark />
          <span>
            <span className="block text-lg leading-none font-extrabold tracking-tight lg:text-xl">
              Sub Net <span className="text-accent-400">Shopping</span>
            </span>
            <span className="text-[11px] text-brand-200">Verified supermarkets near you</span>
          </span>
        </Link>
        <SearchBox className="hidden flex-1 lg:flex" />
        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          {active && active.role !== "CUSTOMER" && (
            <Link
              href={ROLE_HOME[active.role]}
              className="hidden items-center gap-1.5 rounded-xl bg-brand-700/80 px-3 py-2 text-sm font-bold hover:bg-brand-700 lg:flex"
            >
              <LayoutDashboard className="h-4 w-4" aria-hidden /> Dashboard
            </Link>
          )}
          {bell}
          {(!active || active.role === "CUSTOMER") && (
            <Link
              href="/cart"
              className="relative flex items-center gap-1.5 rounded-xl bg-brand-700/80 p-2 text-sm font-bold hover:bg-brand-700 lg:px-3"
              aria-label={inCart ? `Cart, ${inCart} items` : "Cart"}
            >
              <ShoppingCart className="h-5 w-5" aria-hidden />
              <span className="hidden lg:inline">Cart</span>
              {inCart > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-brand-800 bg-accent-400 px-1 text-[10px] font-bold text-brand-950">
                  {inCart > 99 ? "99+" : inCart}
                </span>
              )}
            </Link>
          )}
          {active ? (
            <Link href="/account" className="hidden items-center gap-1.5 rounded-xl bg-brand-700/80 px-3 py-2 text-sm font-bold hover:bg-brand-700 lg:flex">
              <User className="h-4 w-4" aria-hidden /> Account
            </Link>
          ) : (
            <span className="hidden gap-2 lg:flex">
              <Link href="/login" className="rounded-xl px-3 py-2 text-sm font-bold hover:bg-brand-700">
                Sign in
              </Link>
              <Link href="/register" className="rounded-xl bg-accent-400 px-3 py-2 text-sm font-extrabold text-brand-950 hover:bg-accent-300">
                Create account
              </Link>
            </span>
          )}
        </div>
      </div>

      {/* Phone search */}
      <div className="px-4 pb-3 lg:hidden">
        <SearchBox />
      </div>

      {/* Category menu (desktop) */}
      <nav className="hidden bg-brand-900 lg:block" aria-label="Categories">
        <ul className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-4 text-sm">
          <li>
            <Link href="/categories" className="flex items-center gap-1.5 py-2.5 pr-3 font-bold whitespace-nowrap text-accent-400">
              <LayoutGrid className="h-4 w-4" aria-hidden /> All categories <ChevronDown className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </li>
          {categories.slice(0, 8).map((c) => (
            <li key={c.id}>
              <Link href={`/categories/${c.slug}`} className="block rounded-lg px-3 py-2.5 whitespace-nowrap text-brand-100 hover:bg-brand-800 hover:text-white">
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
