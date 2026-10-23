"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bike,
  Clock,
  LayoutDashboard,
  Search,
  Settings,
  Store,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cx } from "./ui";

type Item = { href: string; label: string; icon: LucideIcon; exact?: boolean };

const NAV: Record<string, Item[]> = {
  GUEST: [
    { href: "/", label: "Stores", icon: Store, exact: true },
    { href: "/search", label: "Search", icon: Search },
    { href: "/login", label: "Sign in", icon: User },
  ],
  CUSTOMER: [
    { href: "/", label: "Stores", icon: Store, exact: true },
    { href: "/search", label: "Search", icon: Search },
    { href: "/account", label: "Profile", icon: User },
  ],
  SUPERMARKET: [
    { href: "/merchant", label: "Dashboard", icon: LayoutDashboard, exact: true },
    { href: "/merchant/profile", label: "Store", icon: Store },
    { href: "/merchant/hours", label: "Hours", icon: Clock },
    { href: "/account", label: "Account", icon: User },
  ],
  RIDER: [
    { href: "/rider", label: "Dashboard", icon: LayoutDashboard, exact: true },
    { href: "/rider/vehicle", label: "Vehicle", icon: Bike },
    { href: "/account", label: "Account", icon: User },
  ],
  ADMIN: [
    { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
    { href: "/admin/supermarkets", label: "Stores", icon: Store },
    { href: "/admin/riders", label: "Riders", icon: Bike },
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/settings", label: "Settings", icon: Settings },
  ],
};

export function BottomNav({ role }: { role: keyof typeof NAV }) {
  const pathname = usePathname();
  const items = NAV[role];
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t border-gray-200 bg-white md:max-w-2xl" aria-label="Main">
      <ul className="flex">
        {items.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold",
                  active ? "text-brand-700" : "text-gray-500 hover:text-gray-800",
                )}
              >
                <Icon className={cx("h-5 w-5", active && "stroke-[2.5]")} aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
