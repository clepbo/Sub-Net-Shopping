import Form from "next/form";
import { Search, ShoppingBasket, Store } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { availabilityOf, listApprovedSupermarkets } from "@/lib/supermarkets";
import { StoreList } from "@/components/store-list";
import { toStoreCards } from "@/components/store-cards";
import { EmptyState, LinkButton, Page } from "@/components/ui";

export default async function HomePage() {
  const [user, stores] = await Promise.all([getCurrentUser(), listApprovedSupermarkets()]);
  const now = new Date();
  const openCount = stores.filter((s) => availabilityOf(s, now).store === "OPEN").length;

  return (
    <Page>
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-800 to-brand-600 p-5 text-white shadow-lg">
        <span className="inline-block rounded-full bg-accent-400 px-2 py-0.5 text-[10px] font-extrabold text-brand-950 uppercase">
          Benin City
        </span>
        <h1 className="mt-2 text-2xl leading-tight font-extrabold">Your trusted supermarkets, in one place</h1>
        <p className="mt-1 text-sm text-brand-100">
          See which verified supermarkets are open, and whether they&apos;re offering pickup or delivery right now.
        </p>
        {!user && (
          <div className="mt-4 flex gap-2">
            <LinkButton href="/register" variant="accent" size="sm">
              Create account
            </LinkButton>
            <LinkButton href="/login" variant="secondary" size="sm" className="border-white/40 bg-white/10 text-white hover:bg-white/20">
              Sign in
            </LinkButton>
          </div>
        )}
        <ShoppingBasket className="absolute -right-4 -bottom-4 h-28 w-28 text-white/10" aria-hidden />
      </section>

      <Form action="/search" className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-gray-400" aria-hidden />
        <input
          name="q"
          type="search"
          placeholder="Search supermarkets or areas, e.g. GRA"
          aria-label="Search supermarkets"
          className="w-full rounded-xl border border-gray-200 bg-white py-3 pr-3 pl-10 text-gray-900 shadow-sm focus:border-brand-600 focus:outline-none"
        />
      </Form>

      <section>
        <div className="mb-3">
          <h2 className="font-bold text-gray-900">Verified supermarkets</h2>
          <p className="text-xs text-gray-500">
            {stores.length === 0
              ? "No supermarkets yet"
              : `${stores.length} supermarket${stores.length === 1 ? "" : "s"} · ${openCount} open now`}
          </p>
        </div>
        {stores.length === 0 ? (
          <EmptyState icon={<Store className="h-8 w-8" />} title="No verified supermarkets yet">
            Supermarkets appear here once they&apos;ve registered and been approved by the Sub Net team.
          </EmptyState>
        ) : (
          <StoreList stores={toStoreCards(stores, now)} />
        )}
      </section>

      {!user && (
        <section className="grid grid-cols-2 gap-3 text-sm">
          <LinkButton href="/register/supermarket" variant="secondary" className="h-auto flex-col py-3">
            <span>Own a supermarket?</span>
            <span className="text-xs font-medium text-gray-500">Sell on Sub Net</span>
          </LinkButton>
          <LinkButton href="/register/rider" variant="secondary" className="h-auto flex-col py-3">
            <span>Have a vehicle?</span>
            <span className="text-xs font-medium text-gray-500">Deliver with Sub Net</span>
          </LinkButton>
        </section>
      )}
    </Page>
  );
}
