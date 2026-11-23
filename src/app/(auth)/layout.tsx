import Link from "next/link";
import { BackButton } from "@/components/back-button";
import { Wordmark } from "@/components/logo";

/** Sign-in and sign-up: no shop header or footer, just a way back. */
export default function AuthGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-gray-50">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3">
        <BackButton />
        <Link href="/" aria-label="SubNet Shopping home">
          <Wordmark className="h-9 w-auto" />
        </Link>
        <span className="w-16" aria-hidden />
      </header>
      <main className="flex flex-1 items-start justify-center lg:items-center">{children}</main>
      <footer className="flex flex-wrap justify-center gap-x-4 gap-y-1 px-4 py-4 text-xs text-gray-500">
        <Link href="/terms" className="hover:text-brand-800">Terms</Link>
        <Link href="/privacy" className="hover:text-brand-800">Privacy</Link>
        <Link href="/refunds" className="hover:text-brand-800">Refunds</Link>
        <span>© {new Date().getFullYear()} SubNet Shopping</span>
      </footer>
    </div>
  );
}
