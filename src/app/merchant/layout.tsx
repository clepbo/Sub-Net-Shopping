import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard-shell";

export const metadata: Metadata = { title: { default: "Merchant", template: "%s · Merchant · Sub Net" } };

export default async function MerchantLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("SUPERMARKET");
  return <DashboardShell user={user}>{children}</DashboardShell>;
}
