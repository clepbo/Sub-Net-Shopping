import type { Metadata, Viewport } from "next";
import { getCurrentUser } from "@/lib/auth";
import { AppHeader } from "@/components/app-header";
import { BottomNav } from "@/components/bottom-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Sub Net Shopping", template: "%s · Sub Net Shopping" },
  description: "Shop verified supermarkets in Benin City — compare, reserve and pick up, or get it delivered.",
  applicationName: "Sub Net Shopping",
  appleWebApp: { capable: true, title: "Sub Net", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#166534",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  return (
    <html lang="en-NG">
      <body>
        <div className="relative mx-auto flex min-h-dvh max-w-md flex-col bg-gray-50 shadow-xl md:max-w-2xl">
          <AppHeader />
          <main className="flex-1 pb-24">{children}</main>
        </div>
        <BottomNav role={user && user.status === "ACTIVE" ? user.role : "GUEST"} />
      </body>
    </html>
  );
}
