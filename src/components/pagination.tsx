import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonClass, cx } from "./ui";

/** Previous/next links that keep the current filters. */
export function Pagination({ page, pageSize, total, basePath, params }: { page: number; pageSize: number; total: number; basePath: string; params: Record<string, string | undefined> }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const href = (p: number) => {
    const qs = new URLSearchParams(Object.entries({ ...params, page: p > 1 ? String(p) : undefined }).filter((e): e is [string, string] => Boolean(e[1])));
    const s = qs.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  return (
    <nav className="flex items-center justify-between gap-3 pt-4" aria-label="Pages">
      {page > 1 ? (
        <Link href={href(page - 1)} className={buttonClass("secondary", "sm")}>
          <ChevronLeft className="h-4 w-4" aria-hidden /> Previous
        </Link>
      ) : (
        <span />
      )}
      <span className="text-sm text-gray-600">
        Page {page} of {pages}
      </span>
      {page < pages ? (
        <Link href={href(page + 1)} className={cx(buttonClass("secondary", "sm"))}>
          Next <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
