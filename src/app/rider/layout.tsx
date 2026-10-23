import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard-shell";

export const metadata: Metadata = { title: { default: "Rider", template: "%s · Rider · Sub Net" } };

export default async function RiderLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("RIDER");
  return <DashboardShell user={user}>{children}</DashboardShell>;
}
