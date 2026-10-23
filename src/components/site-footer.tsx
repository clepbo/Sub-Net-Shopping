import Link from "next/link";
import { LogoMark } from "./logo";

const COLUMNS: { title: string; links: [string, string][] }[] = [
  { title: "Shop", links: [["Supermarkets", "/"], ["All categories", "/categories"], ["All products", "/products"], ["Search", "/search"]] },
  { title: "Supermarkets", links: [["Sell on Sub Net", "/register/supermarket"], ["Merchant sign in", "/login"]] },
  { title: "Riders", links: [["Deliver with Sub Net", "/register/rider"], ["Rider sign in", "/login"]] },
];

export function SiteFooter() {
  return (
    <footer className="mt-10 bg-brand-950 text-brand-100">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
          <Link href="/" className="flex items-center gap-2 text-white">
            <LogoMark className="h-8 w-8" />
            <span className="font-extrabold">
              Sub Net <span className="text-accent-400">Shopping</span>
            </span>
          </Link>
          <p className="text-sm text-brand-200">Shop verified supermarkets across Benin City. Compare prices, see what&apos;s in stock and find the nearest store.</p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h2 className="mb-3 text-xs font-bold tracking-wider text-white uppercase">{col.title}</h2>
            <ul className="space-y-2 text-sm">
              {col.links.map(([label, href]) => (
                <li key={label}>
                  <Link href={href} className="hover:text-white">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="border-t border-brand-900 px-4 py-4 text-center text-xs text-brand-300">
        © {new Date().getFullYear()} Sub Net Shopping · Benin City, Edo State, Nigeria
      </p>
    </footer>
  );
}
