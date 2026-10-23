import type { Metadata } from "next";
import Form from "next/form";
import { Search, SearchX } from "lucide-react";
import { listApprovedSupermarkets } from "@/lib/supermarkets";
import { StoreList } from "@/components/store-list";
import { toStoreCards } from "@/components/store-cards";
import { EmptyState, Page, PageTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").trim().slice(0, 80);
  const stores = q ? await listApprovedSupermarkets(q) : [];
  const now = new Date();

  return (
    <Page>
      <PageTitle title="Search supermarkets" subtitle="Find a verified supermarket by name, area or street." />
      <Form action="/search" className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-gray-400" aria-hidden />
        <input
          name="q"
          type="search"
          defaultValue={q}
          autoFocus={!q}
          placeholder="e.g. Ugbowo, Sapele Road, Hubmart"
          aria-label="Search supermarkets"
          className="w-full rounded-xl border border-gray-200 bg-white py-3 pr-3 pl-10 text-gray-900 shadow-sm focus:border-brand-600 focus:outline-none"
        />
      </Form>
      {q &&
        (stores.length === 0 ? (
          <EmptyState icon={<SearchX className="h-8 w-8" />} title={`No supermarkets match “${q}”`}>
            Try an area name like GRA or Ugbowo.
          </EmptyState>
        ) : (
          <StoreList stores={toStoreCards(stores, now)} />
        ))}
    </Page>
  );
}
