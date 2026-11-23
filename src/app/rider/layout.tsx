import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { DashboardShell } from "@/components/dashboard-shell";
import { PendingApprovalScreen } from "@/components/pending-approval";

export const metadata: Metadata = { title: { default: "Rider", template: "%s · Rider · SubNet" } };

export default async function RiderLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("RIDER");
  const rider = await db.rider.findUnique({ where: { userId: user.id }, select: { status: true, statusReason: true, createdAt: true } });
  if (rider && (rider.status === "PENDING" || rider.status === "REJECTED")) {
    return (
      <PendingApprovalScreen
        kind="rider"
        name={`${user.firstName} ${user.lastName}`}
        status={rider.status}
        reason={rider.statusReason}
        submittedAt={rider.createdAt}
      />
    );
  }
  return <DashboardShell user={user}>{children}</DashboardShell>;
}
