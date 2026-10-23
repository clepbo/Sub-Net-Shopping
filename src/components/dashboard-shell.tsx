import { after } from "next/server";
import { expireStalePaymentsThrottled } from "@/lib/payments/expiry";
import Link from "next/link";
import { Bell, ExternalLink, LogOut } from "lucide-react";
import { db } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { logout } from "@/app/actions/auth";
import { BottomNav } from "./bottom-nav";
import { DashboardSidebarNav } from "./dashboard-sidebar";
import { LogoMark } from "./logo";
import type { NavRole } from "./nav-config";

const TITLE: Record<string, string> = { SUPERMARKET: "Merchant portal", RIDER: "Rider", ADMIN: "Admin" };

/**
 * Layout for merchant, rider and admin areas: a sidebar on desktop, and a
 * compact header with a bottom tab bar on phones.
 */
export async function DashboardShell({ user, children }: { user: CurrentUser; children: React.ReactNode }) {
  const role = user.role as NavRole;
  // Releases stock held by unpaid online orders once their 30 minutes are up.
  after(expireStalePaymentsThrottled);
  const unread = await db.notification.count({ where: { userId: user.id, readAt: null } });

  const bell = (
    <Link href="/notifications" className="relative rounded-xl p-2 hover:bg-brand-700" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}>
      <Bell className="h-5 w-5" aria-hidden />
      {unread > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-brand-800 bg-accent-400 px-1 text-[10px] font-bold text-brand-950">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );

  return (
    <div className="min-h-dvh lg:flex">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col bg-brand-900 p-4 text-white lg:flex">
        <Link href="/" className="mb-6 flex items-center gap-2">
          <LogoMark />
          <span>
            <span className="block leading-none font-extrabold">
              Sub Net <span className="text-accent-400">Shopping</span>
            </span>
            <span className="text-[11px] text-brand-200">{TITLE[role]}</span>
          </span>
        </Link>
        <nav className="flex-1" aria-label="Dashboard">
          <DashboardSidebarNav role={role} />
        </nav>
        <div className="space-y-1 border-t border-brand-800 pt-3 text-sm">
          <Link href="/" className="flex items-center gap-3 rounded-xl px-3 py-2 text-brand-100 hover:bg-brand-800 hover:text-white">
            <ExternalLink className="h-4 w-4" aria-hidden /> View shop
          </Link>
          <form action={logout}>
            <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-brand-100 hover:bg-brand-800 hover:text-white">
              <LogOut className="h-4 w-4" aria-hidden /> Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 bg-brand-800 text-white shadow-md">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2 lg:hidden">
              <LogoMark className="h-8 w-8" />
              <span className="leading-tight">
                <span className="block font-extrabold">
                  Sub Net <span className="text-accent-400">Shopping</span>
                </span>
                <span className="text-[11px] text-brand-200">{TITLE[role]}</span>
              </span>
            </Link>
            <p className="hidden text-sm text-brand-100 lg:block">
              Signed in as <span className="font-bold text-white">{user.firstName} {user.lastName}</span>
            </p>
            {bell}
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 pb-24 lg:pb-10">{children}</main>
      </div>
      <BottomNav role={role} />
    </div>
  );
}
