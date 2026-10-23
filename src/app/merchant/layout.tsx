import type { Metadata } from "next";

export const metadata: Metadata = { title: { default: "Merchant", template: "%s · Merchant · Sub Net" } };

export default function MerchantLayout({ children }: { children: React.ReactNode }) {
  return children;
}
