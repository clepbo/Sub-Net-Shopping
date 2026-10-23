"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV, isActive, type NavRole } from "./nav-config";
import { cx } from "./ui";

/** Phone tab bar; hidden on desktop, where headers and sidebars take over. */
export function BottomNav({ role }: { role: NavRole }) {
  const pathname = usePathname();
  const items = NAV[role].filter((i) => !i.desktopOnly);
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white lg:hidden" aria-label="Main">
      <ul className="mx-auto flex max-w-xl">
        {items.map((item) => {
          const active = isActive(pathname, item);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold",
                  active ? "text-brand-700" : "text-gray-500 hover:text-gray-800",
                )}
              >
                <Icon className={cx("h-5 w-5", active && "stroke-[2.5]")} aria-hidden />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
