"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV, isActive, type NavRole } from "./nav-config";
import { cx } from "./ui";

export function DashboardSidebarNav({ role }: { role: NavRole }) {
  const pathname = usePathname();
  return (
    <ul className="space-y-1">
      {NAV[role].map((item) => {
        const active = isActive(pathname, item);
        const Icon = item.icon;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cx(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold",
                active ? "bg-brand-700 text-white" : "text-brand-100 hover:bg-brand-800 hover:text-white",
              )}
            >
              <Icon className="h-5 w-5" aria-hidden />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
