import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("space-y-5 p-4", className)}>{children}</div>;
}

export function PageTitle({ eyebrow, title, subtitle, action }: { eyebrow?: string; title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && <p className="text-[11px] font-bold uppercase tracking-wider text-brand-700">{eyebrow}</p>}
        <h1 className="text-xl font-extrabold leading-tight text-gray-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx("rounded-2xl border border-gray-200 bg-white p-4", className)}>{children}</section>;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-xs font-bold uppercase tracking-wider text-gray-600">{children}</h2>
      {action}
    </div>
  );
}

const tones = {
  green: "bg-brand-100 text-brand-800",
  yellow: "bg-amber-100 text-amber-800",
  red: "bg-red-100 text-red-700",
  gray: "bg-gray-100 text-gray-700",
  blue: "bg-sky-100 text-sky-800",
} as const;

export type Tone = keyof typeof tones;

export function Badge({ tone = "gray", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold", tones[tone], className)}>
      {children}
    </span>
  );
}

export function Notice({ tone = "gray", title, children }: { tone?: Tone; title: string; children?: ReactNode }) {
  const styles: Record<Tone, string> = {
    green: "border-brand-200 bg-brand-50 text-brand-900",
    yellow: "border-amber-200 bg-amber-50 text-amber-900",
    red: "border-red-200 bg-red-50 text-red-900",
    gray: "border-gray-200 bg-gray-50 text-gray-800",
    blue: "border-sky-200 bg-sky-50 text-sky-900",
  };
  return (
    <div className={cx("rounded-2xl border p-4 text-sm", styles[tone])} role="status">
      <p className="font-bold">{title}</p>
      {children && <div className="mt-1 opacity-90">{children}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-10 text-center">
      {icon && <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center text-gray-400">{icon}</div>}
      <p className="font-semibold text-gray-800">{title}</p>
      {children && <div className="mt-1 text-sm text-gray-500">{children}</div>}
    </div>
  );
}

const buttonStyles = {
  primary: "bg-brand-700 text-white hover:bg-brand-800 disabled:bg-brand-700/60",
  accent: "bg-accent-400 text-brand-950 hover:bg-accent-300 disabled:opacity-60",
  secondary: "border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 disabled:opacity-60",
  danger: "bg-red-600 text-white hover:bg-red-700 disabled:opacity-60",
  ghost: "text-brand-800 hover:bg-brand-50",
} as const;

export type ButtonVariant = keyof typeof buttonStyles;

export function buttonClass(variant: ButtonVariant = "primary", size: "md" | "sm" = "md") {
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-xl font-bold transition disabled:cursor-not-allowed",
    size === "md" ? "min-h-11 px-4 py-2.5 text-sm" : "min-h-9 px-3 py-1.5 text-xs",
    buttonStyles[variant],
  );
}

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: "md" | "sm" }) {
  return <Link {...props} className={cx(buttonClass(variant, size), className)} />;
}

export function StatTile({ label, value, tone = "gray", hint }: { label: string; value: ReactNode; tone?: Tone; hint?: string }) {
  const styles: Record<Tone, string> = {
    green: "border-brand-200 bg-brand-50 text-brand-900",
    yellow: "border-amber-200 bg-amber-50 text-amber-900",
    red: "border-red-200 bg-red-50 text-red-900",
    gray: "border-gray-200 bg-white text-gray-900",
    blue: "border-sky-200 bg-sky-50 text-sky-900",
  };
  return (
    <div className={cx("rounded-2xl border p-3", styles[tone])}>
      <p className="text-[10px] font-extrabold uppercase tracking-wide opacity-80">{label}</p>
      <p className="mt-0.5 text-2xl font-black tabular-nums">{value}</p>
      {hint && <p className="text-[11px] opacity-70">{hint}</p>}
    </div>
  );
}

export function DefinitionList({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="divide-y divide-gray-100 text-sm">
      {items.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-4 py-2">
          <dt className="shrink-0 text-gray-500">{k}</dt>
          <dd className="min-w-0 text-right font-medium break-words text-gray-900">{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
