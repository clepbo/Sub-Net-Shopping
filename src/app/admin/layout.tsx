import type { Metadata } from "next";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin · Sub Net" } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
