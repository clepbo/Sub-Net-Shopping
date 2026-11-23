import type { ReactNode } from "react";
import Link from "next/link";
import { Page } from "../ui";

export const LEGAL_UPDATED = "23 November 2026";

/** Shared frame for the Terms, Privacy and Refund pages. */
export function LegalPage({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <Page>
      <article className="mx-auto max-w-3xl space-y-6 rounded-3xl border border-gray-200 bg-white p-6 sm:p-10">
        <header className="space-y-2 border-b border-gray-100 pb-5">
          <p className="text-[11px] font-bold tracking-wider text-brand-700 uppercase">Legal</p>
          <h1 className="text-3xl font-extrabold text-gray-900">{title}</h1>
          <p className="text-sm text-gray-500">Last updated {LEGAL_UPDATED}</p>
          <p className="text-gray-700">{intro}</p>
          <nav className="flex gap-3 pt-1 text-sm font-bold text-brand-700">
            <Link href="/terms">Terms</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/refunds">Refunds</Link>
          </nav>
        </header>
        <div className="space-y-6 text-[15px] leading-relaxed text-gray-700 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-extrabold [&_h2]:text-gray-900 [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1">
          {children}
        </div>
      </article>
    </Page>
  );
}
