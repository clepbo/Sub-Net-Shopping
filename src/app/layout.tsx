import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "SubNet Shopping", template: "%s · SubNet Shopping" },
  description: "Shop verified supermarkets in Benin City — compare prices, see what's in stock, and reserve or get it delivered.",
  applicationName: "SubNet Shopping",
  appleWebApp: { capable: true, title: "SubNet", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#014b4e",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-NG">
      <body>{children}</body>
    </html>
  );
}
