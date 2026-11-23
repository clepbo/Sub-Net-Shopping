import type { Metadata } from "next";
import { requireMerchantStore } from "@/lib/supermarkets";
import { DashboardShell } from "@/components/dashboard-shell";
import { PendingApprovalScreen } from "@/components/pending-approval";

export const metadata: Metadata = { title: { default: "Merchant", template: "%s · Merchant · SubNet" } };

export default async function MerchantLayout({ children }: { children: React.ReactNode }) {
  const { user, store } = await requireMerchantStore();
  // Until approved, the waiting screen is all a supermarket can see.
  if (store.status === "PENDING" || store.status === "REJECTED") {
    return <PendingApprovalScreen kind="supermarket" name={store.name} status={store.status} reason={store.statusReason} submittedAt={store.createdAt} />;
  }
  return <DashboardShell user={user}>{children}</DashboardShell>;
}
