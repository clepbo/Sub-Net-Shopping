import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard-shell";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin · Sub Net" } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("ADMIN");
  return <DashboardShell user={user}>{children}</DashboardShell>;
}
