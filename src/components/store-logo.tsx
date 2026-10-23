/* eslint-disable @next/next/no-img-element -- logos come from runtime uploads */
import { cx } from "./ui";

export function StoreLogo({ name, url, size = "md" }: { name: string; url: string | null; size?: "md" | "lg" }) {
  const box = size === "lg" ? "h-20 w-20 text-2xl" : "h-16 w-16 text-lg";
  if (url) {
    return <img src={url} alt={`${name} logo`} className={cx(box, "shrink-0 rounded-xl border border-gray-200 bg-white object-cover")} />;
  }
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <div className={cx(box, "flex shrink-0 items-center justify-center rounded-xl bg-brand-100 font-black text-brand-800")} aria-hidden>
      {initials}
    </div>
  );
}
