import Link from "next/link";
import { BadgeCheck, Bike, Scale, ShoppingBasket, Store, Timer } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { homeRails, listCategories } from "@/lib/catalog";
import { availabilityOf, listApprovedSupermarkets } from "@/lib/supermarkets";
import { CategoryTiles } from "@/components/category-tiles";
import { ProductRail } from "@/components/product-card";
import { StoreList } from "@/components/store-list";
import { toStoreCards } from "@/components/store-cards";
import { EmptyState, LinkButton, Page } from "@/components/ui";

const FEATURES = [
  { icon: Scale, title: "Compare prices", body: "See what each supermarket charges for the same product." },
  { icon: BadgeCheck, title: "Verified stores only", body: "Every supermarket is checked by the Sub Net team." },
  { icon: Timer, title: "Live opening status", body: "Know who's open, and who's offering pickup or delivery right now." },
];

export default async function HomePage() {
  const [user, stores, categories, rails] = await Promise.all([getCurrentUser(), listApprovedSupermarkets(), listCategories(), homeRails()]);
  const now = new Date();
  const openCount = stores.filter((s) => availabilityOf(s, now).store === "OPEN").length;

  return (
    <Page className="space-y-8 lg:py-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-800 to-brand-600 p-5 text-white shadow-lg lg:col-span-2 lg:p-10">
          <span className="inline-block rounded-full bg-accent-400 px-2 py-0.5 text-[10px] font-extrabold text-brand-950 uppercase">Benin City</span>
          <h1 className="mt-2 max-w-xl text-2xl leading-tight font-extrabold lg:text-4xl">Your trusted supermarkets, in one place</h1>
          <p className="mt-2 max-w-lg text-sm text-brand-100 lg:text-base">
            Compare prices across verified supermarkets, check what&apos;s in stock, and see who&apos;s open right now.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <LinkButton href="/products" variant="accent">
              Browse products
            </LinkButton>
            {!user && (
              <LinkButton href="/register" variant="secondary" className="border-white/40 bg-white/10 text-white hover:bg-white/20">
                Create account
              </LinkButton>
            )}
          </div>
          <ShoppingBasket className="absolute -right-6 -bottom-6 h-36 w-36 text-white/10 lg:h-56 lg:w-56" aria-hidden />
        </section>
        <ul className="hidden gap-3 lg:grid">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-3 rounded-2xl border border-gray-200 bg-white p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <span>
                <span className="block font-bold text-gray-900">{title}</span>
                <span className="text-sm text-gray-600">{body}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-lg font-extrabold text-gray-900">Shop by category</h2>
          <Link href="/categories" className="text-sm font-bold text-brand-700 hover:underline">
            All categories
          </Link>
        </div>
        <CategoryTiles categories={categories} />
      </section>

      {rails.map((r) => (
        <ProductRail key={r.category.id} title={r.category.name} href={`/categories/${r.category.slug}`} products={r.items} />
      ))}

      <section>
        <div className="mb-3">
          <h2 className="text-lg font-extrabold text-gray-900">Verified supermarkets</h2>
          <p className="text-xs text-gray-500">
            {stores.length === 0 ? "No supermarkets yet" : `${stores.length} supermarket${stores.length === 1 ? "" : "s"} · ${openCount} open now`}
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
        <section className="grid gap-3 sm:grid-cols-2">
          <Link href="/register/supermarket" className="flex items-center gap-4 rounded-2xl bg-brand-900 p-5 text-white hover:bg-brand-800">
            <Store className="h-10 w-10 shrink-0 text-accent-400" aria-hidden />
            <span>
              <span className="block font-extrabold">Own a supermarket?</span>
              <span className="text-sm text-brand-200">Reach more shoppers by selling on Sub Net.</span>
            </span>
          </Link>
          <Link href="/register/rider" className="flex items-center gap-4 rounded-2xl bg-accent-400 p-5 text-brand-950 hover:bg-accent-300">
            <Bike className="h-10 w-10 shrink-0" aria-hidden />
            <span>
              <span className="block font-extrabold">Have a bike, car or van?</span>
              <span className="text-sm">Earn by delivering supermarket orders.</span>
            </span>
          </Link>
        </section>
      )}
    </Page>
  );
}
