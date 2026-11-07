import type { ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";
import { LogoMark } from "./logo";
import { cx } from "./ui";

export type AuthAudience = "customer" | "supermarket" | "rider";

const PANEL: Record<AuthAudience, { title: string; points: string[] }> = {
  customer: {
    title: "Your trusted supermarkets, in one place",
    points: [
      "Compare prices across verified supermarkets",
      "See what's in stock and who's open right now",
      "Pick up at a time that suits you, or get it delivered",
    ],
  },
  supermarket: {
    title: "Grow your supermarket online",
    points: [
      "Reach shoppers across Benin City",
      "Import your products from your POS or a spreadsheet",
      "Take pickup and delivery orders, paid online or in store",
    ],
  },
  rider: {
    title: "Earn delivering with SubNet",
    points: [
      "Go online whenever you want to work",
      "See what each delivery pays before you accept",
      "Get paid for every completed delivery",
    ],
  },
};

/** Sign-in and sign-up pages: a centred card with a brand panel on desktop. */
export function AuthLayout({
  audience = "customer",
  eyebrow,
  title,
  subtitle,
  wide = false,
  children,
  footer,
}: {
  audience?: AuthAudience;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  /** Long forms (supermarket, rider) get a wider form column. */
  wide?: boolean;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const panel = PANEL[audience];
  return (
    <div className="px-4 py-6 lg:px-6 lg:py-12">
      <div
        className={cx(
          "mx-auto grid overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]",
          wide ? "max-w-6xl" : "max-w-5xl",
        )}
      >
        <aside className="relative hidden bg-gradient-to-br from-brand-900 to-brand-700 p-10 text-white lg:block">
          <div className="sticky top-40 space-y-8">
            <LogoMark className="h-16 w-16 shadow-lg" />
            <h2 className="text-3xl leading-tight font-extrabold">{panel.title}</h2>
            <ul className="space-y-4">
              {panel.points.map((p) => (
                <li key={p} className="flex gap-3 text-brand-100">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-accent-400" aria-hidden />
                  {p}
                </li>
              ))}
            </ul>
            <p className="text-sm text-brand-200">Benin City, Edo State</p>
          </div>
        </aside>
        <div className="p-5 sm:p-8 lg:p-12">
          <div className={cx("mx-auto space-y-6", wide ? "max-w-xl" : "max-w-md")}>
            <div>
              {eyebrow && <p className="text-[11px] font-bold tracking-wider text-brand-700 uppercase">{eyebrow}</p>}
              <h1 className="text-2xl font-extrabold text-gray-900 lg:text-3xl">{title}</h1>
              {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
            </div>
            {children}
            {footer && <div className="space-y-2 border-t border-gray-100 pt-5 text-center text-sm">{footer}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
