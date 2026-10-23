import Form from "next/form";
import { Search } from "lucide-react";
import { cx } from "./ui";

/** Product and supermarket search; submits to /search. */
export function SearchBox({ defaultValue, className, autoFocus }: { defaultValue?: string; className?: string; autoFocus?: boolean }) {
  return (
    <Form action="/search" role="search" className={cx("flex", className)}>
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-gray-400" aria-hidden />
        <input
          name="q"
          type="search"
          defaultValue={defaultValue}
          autoFocus={autoFocus}
          placeholder="Search products, brands or supermarkets"
          aria-label="Search products and supermarkets"
          className="h-11 w-full rounded-l-xl border border-r-0 border-gray-200 bg-white pr-3 pl-10 text-gray-900 placeholder:text-gray-400 focus:border-brand-600 focus:outline-none"
        />
      </div>
      <button type="submit" className="h-11 rounded-r-xl bg-accent-400 px-4 text-sm font-extrabold text-brand-950 hover:bg-accent-300">
        Search
      </button>
    </Form>
  );
}
