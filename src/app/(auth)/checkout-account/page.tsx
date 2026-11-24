import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShoppingCart } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { cartCount } from "@/lib/cart";
import { cartOwner } from "@/lib/cart-owner";
import { AuthLayout } from "@/components/auth-layout";
import { CustomerRegisterForm } from "@/components/forms/register-forms";

export const metadata: Metadata = { title: "Create an account to check out" };

const safe = (v: string | undefined) => (v && v.startsWith("/") && !v.startsWith("//") ? v : "/cart");

/** Where guests land when they check out: sign up (or sign in) without losing their cart. */
export default async function CheckoutAccountPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safe((await searchParams).next);
  const user = await getCurrentUser();
  if (user?.status === "ACTIVE") redirect(user.role === "CUSTOMER" ? next : "/forbidden");
  const owner = await cartOwner();
  const items = owner && owner !== "not-a-shopper" ? await cartCount(owner) : 0;

  return (
    <AuthLayout
      eyebrow="Almost there"
      title="Create your account to check out"
      subtitle="It takes a minute. Your cart is saved and you'll go straight back to checkout."
      footer={
        <p>
          Already have an account?{" "}
          <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-bold text-brand-700 underline">
            Sign in to continue
          </Link>
        </p>
      }
    >
      {items > 0 && (
        <p className="flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-900">
          <ShoppingCart className="h-4 w-4" aria-hidden /> {items} item{items === 1 ? "" : "s"} saved in your cart
        </p>
      )}
      <CustomerRegisterForm next={next} />
    </AuthLayout>
  );
}
