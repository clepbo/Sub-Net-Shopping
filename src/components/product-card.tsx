/* eslint-disable @next/next/no-img-element -- product images come from runtime uploads */
import Link from "next/link";
import { ImageOff } from "lucide-react";
import type { ProductSummary } from "@/lib/catalog";
import { formatNaira } from "@/lib/money";
import { AddToCart } from "./add-to-cart";
import { cx } from "./ui";

export function ProductImage({ src, alt, className }: { src: string | null; alt: string; className?: string }) {
  return (
    <div className={cx("flex items-center justify-center overflow-hidden bg-white", className)}>
      {src ? (
        <img src={src} alt={alt} loading="lazy" className="h-full w-full object-contain" />
      ) : (
        <ImageOff className="h-8 w-8 text-gray-300" aria-label="No image" />
      )}
    </div>
  );
}

/** One product with its price range across supermarkets (or one store's price, in a store context). */
export function ProductCard({ product, storeContext = false }: { product: ProductSummary; storeContext?: boolean }) {
  const range = product.minPriceKobo !== product.maxPriceKobo;
  const outOfStock = product.inStockOffers === 0;
  const canAdd = storeContext && !outOfStock;
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white transition hover:border-brand-500 hover:shadow-md">
      <Link href={`/products/${product.id}`} className="group flex flex-1 flex-col">
        <div className="relative">
          <ProductImage src={product.image} alt={product.name} className={cx("aspect-square p-3", outOfStock && "opacity-50")} />
          {outOfStock && (
            <span className="absolute top-2 left-2 rounded-full bg-gray-900/80 px-2 py-0.5 text-[10px] font-bold text-white">
              Out of stock
            </span>
          )}
          {!storeContext && product.offers > 1 && (
            <span className="absolute top-2 right-2 rounded-full bg-accent-400 px-2 py-0.5 text-[10px] font-extrabold text-brand-950">
              {product.offers} stores
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1 border-t border-gray-100 p-3">
          {product.brand && <p className="truncate text-[11px] font-bold tracking-wide text-gray-500 uppercase">{product.brand}</p>}
          <h3 className="line-clamp-2 text-sm leading-snug font-semibold text-gray-900 group-hover:text-brand-800">{product.name}</h3>
          {product.unit && <p className="text-xs text-gray-500">{product.unit}</p>}
          <div className="mt-auto pt-1">
            <p className="font-extrabold text-brand-800">
              {range && <span className="text-xs font-semibold text-gray-500">from </span>}
              {formatNaira(product.minPriceKobo)}
            </p>
            {!storeContext && (
              <p className="text-[11px] text-gray-500">{product.offers > 1 ? `Compare ${product.offers} supermarkets` : "1 supermarket"}</p>
            )}
          </div>
        </div>
      </Link>
      {canAdd && (
        <div className="px-3 pb-3">
          <AddToCart inventoryId={product.listingId} returnTo={`/products/${product.id}`} compact />
        </div>
      )}
    </div>
  );
}

export function ProductGridList({ products, storeContext }: { products: ProductSummary[]; storeContext?: boolean }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
      {products.map((p) => (
        <li key={p.id}>
          <ProductCard product={p} storeContext={storeContext} />
        </li>
      ))}
    </ul>
  );
}

/** Horizontal rail on phones, a single row grid on desktop. */
export function ProductRail({ title, href, products }: { title: string; href: string; products: ProductSummary[] }) {
  return (
    <section>
      <div className="mb-3 flex items-end justify-between">
        <h2 className="text-lg font-extrabold text-gray-900">{title}</h2>
        <Link href={href} className="text-sm font-bold text-brand-700 hover:underline">
          View all
        </Link>
      </div>
      <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-5 lg:overflow-visible lg:px-0">
        {products.map((p, i) => (
          <li key={p.id} className={cx("w-40 shrink-0 snap-start sm:w-44 lg:w-auto", i >= 5 && "lg:hidden")}>
            <ProductCard product={p} />
          </li>
        ))}
      </ul>
    </section>
  );
}
