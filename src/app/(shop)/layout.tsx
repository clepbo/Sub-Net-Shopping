import { after } from "next/server";
import { expireStalePaymentsThrottled } from "@/lib/payments/expiry";
import { getCurrentUser } from "@/lib/auth";
import { BottomNav } from "@/components/bottom-nav";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  // Releases stock held by unpaid online orders once their 30 minutes are up.
  after(expireStalePaymentsThrottled);
  return (
    <div className="flex min-h-dvh flex-col bg-gray-50">
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 pb-20 lg:pb-0">{children}</main>
      <div className="pb-16 lg:pb-0">
        <SiteFooter />
      </div>
      <BottomNav role={user && user.status === "ACTIVE" ? user.role : "GUEST"} />
    </div>
  );
}
