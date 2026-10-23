import Link from "next/link";
import { Bell, MapPin } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { LogoMark } from "./logo";

const ROLE_LABEL = { CUSTOMER: null, SUPERMARKET: "Merchant", RIDER: "Rider", ADMIN: "Admin" } as const;

export async function AppHeader() {
  const user = await getCurrentUser();
  const unread = user ? await db.notification.count({ where: { userId: user.id, readAt: null } }) : 0;
  const roleLabel = user ? ROLE_LABEL[user.role] : null;

  return (
    <header className="sticky top-0 z-40 bg-brand-800 text-white shadow-md">
      <div className="flex items-center justify-between border-b border-brand-700/60 bg-brand-900/50 px-4 py-1.5 text-xs">
        <span className="flex items-center gap-1 text-brand-100">
          <MapPin className="h-3.5 w-3.5" aria-hidden />
          Benin City, Edo State
        </span>
        {user ? (
          <span className="truncate text-brand-100">
            {roleLabel && <span className="mr-1 rounded-full bg-accent-400 px-2 py-0.5 text-[10px] font-extrabold text-brand-950 uppercase">{roleLabel}</span>}
            Hi, {user.firstName}
          </span>
        ) : (
          <Link href="/login" className="rounded-full bg-accent-400 px-2.5 py-0.5 text-[11px] font-extrabold text-brand-950 uppercase">
            Sign in / Register
          </Link>
        )}
      </div>
      <div className="flex items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <LogoMark />
          <span>
            <span className="block text-lg leading-none font-extrabold tracking-tight">
              Sub Net <span className="text-accent-400">Shopping</span>
            </span>
            <span className="text-[11px] text-brand-200">Verified supermarkets near you</span>
          </span>
        </Link>
        {user && (
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
        )}
      </div>
    </header>
  );
}
