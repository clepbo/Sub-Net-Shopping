import {
  Activity,
  Bike,
  Clock,
  LayoutDashboard,
  LayoutGrid,
  Package,
  Receipt,
  ShoppingCart,
  Search,
  Settings,
  Store,
  Tags,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean; /** Hidden from the phone tab bar. */ desktopOnly?: boolean };

export type NavRole = "GUEST" | "CUSTOMER" | "SUPERMARKET" | "RIDER" | "ADMIN";

export const NAV: Record<NavRole, NavItem[]> = {
  GUEST: [
    { href: "/", label: "Home", icon: Store, exact: true },
    { href: "/categories", label: "Categories", icon: LayoutGrid },
    { href: "/search", label: "Search", icon: Search },
    { href: "/login", label: "Sign in", icon: User },
  ],
  CUSTOMER: [
    { href: "/", label: "Home", icon: Store, exact: true },
    { href: "/categories", label: "Categories", icon: LayoutGrid },
    { href: "/cart", label: "Cart", icon: ShoppingCart },
    { href: "/orders", label: "Orders", icon: Receipt },
    { href: "/account", label: "Profile", icon: User },
  ],
  SUPERMARKET: [
    { href: "/merchant", label: "Dashboard", icon: LayoutDashboard, exact: true },
    { href: "/merchant/orders", label: "Orders", icon: Receipt },
    { href: "/merchant/products", label: "Products", icon: Package },
    { href: "/merchant/profile", label: "Store", icon: Store },
    { href: "/merchant/hours", label: "Hours", icon: Clock, desktopOnly: true },
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
    { href: "/admin/orders", label: "Orders", icon: Receipt, desktopOnly: true },
    { href: "/admin/categories", label: "Categories", icon: Tags, desktopOnly: true },
    { href: "/admin/activity", label: "Activity", icon: Activity, desktopOnly: true },
    { href: "/admin/settings", label: "Settings", icon: Settings },
  ],
};

export function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}
