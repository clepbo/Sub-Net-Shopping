import type { Metadata } from "next";
import Link from "next/link";
import { Bike, ChevronRight, ShoppingBasket, Store } from "lucide-react";
import { AuthLayout } from "@/components/auth-layout";

export const metadata: Metadata = { title: "Create account" };

const CHOICES = [
  { href: "/register/customer", icon: ShoppingBasket, title: "I want to shop", body: "Buy from supermarkets near you, for pickup or delivery." },
  { href: "/register/supermarket", icon: Store, title: "I own a supermarket", body: "List your store and products, and take orders online." },
  { href: "/register/rider", icon: Bike, title: "I want to deliver", body: "Earn by delivering supermarket orders as a rider or driver." },
];

export default function RegisterChooserPage() {
  return (
    <AuthLayout
      title="Create an account"
      subtitle="How will you use SubNet?"
      footer={
        <p>
          Already have an account?{" "}
          <Link href="/login" className="font-bold text-brand-700 underline">
            Sign in
          </Link>
        </p>
      }
    >
      <ul className="space-y-3">
        {CHOICES.map(({ href, icon: Icon, title, body }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex items-center gap-4 rounded-2xl border border-gray-200 p-4 transition hover:border-brand-600 hover:bg-brand-50"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                <Icon className="h-6 w-6" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-extrabold text-gray-900">{title}</span>
                <span className="block text-sm text-gray-500">{body}</span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-gray-400" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </AuthLayout>
  );
}
