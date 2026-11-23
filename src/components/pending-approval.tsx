import Link from "next/link";
import { Bell, CheckCircle2, Clock, LogOut, XCircle } from "lucide-react";
import type { ApprovalStatus } from "@/generated/prisma/enums";
import { logout } from "@/app/actions/auth";
import { Wordmark } from "./logo";
import { buttonClass, cx } from "./ui";
import { SUPPORT_EMAIL } from "@/lib/support";

/**
 * What a supermarket or rider sees until an admin approves them. Nothing else
 * in their dashboard is reachable until then.
 */
export function PendingApprovalScreen({
  kind,
  name,
  status,
  reason,
  submittedAt,
}: {
  kind: "supermarket" | "rider";
  name: string;
  status: ApprovalStatus;
  reason: string | null;
  submittedAt: Date;
}) {
  const rejected = status === "REJECTED";
  const steps = [
    { done: true, title: "Application received", body: `Submitted ${submittedAt.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" })}` },
    {
      done: false,
      title: rejected ? "Not approved" : "Our team is reviewing it",
      body: rejected
        ? reason
          ? `Reason: ${reason}`
          : "Contact SubNet support to find out more."
        : kind === "supermarket"
          ? "We check your business details. This usually takes 1–2 working days."
          : "We check your details and vehicle. This usually takes 1–2 working days.",
    },
    {
      done: false,
      title: kind === "supermarket" ? "Set up and go live" : "Go online and deliver",
      body: kind === "supermarket" ? "Once approved, you'll set your opening hours and add products." : "Once approved, you can go online to receive deliveries.",
    },
  ];

  return (
    <div className="flex min-h-dvh flex-col bg-gray-50">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-3">
        <Link href="/" aria-label="SubNet Shopping home">
          <Wordmark className="h-9 w-auto" />
        </Link>
        <div className="flex items-center gap-1">
          <Link href="/notifications" className="rounded-xl p-2 text-brand-800 hover:bg-brand-50" aria-label="Notifications">
            <Bell className="h-5 w-5" aria-hidden />
          </Link>
          <form action={logout}>
            <button className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold text-brand-800 hover:bg-brand-50">
              <LogOut className="h-4 w-4" aria-hidden /> Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 py-6 lg:items-center">
        <div className="w-full max-w-lg space-y-6 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="text-center">
            <span
              className={cx(
                "mx-auto flex h-16 w-16 items-center justify-center rounded-full",
                rejected ? "bg-red-50 text-red-600" : "bg-accent-300/40 text-brand-900",
              )}
            >
              {rejected ? <XCircle className="h-8 w-8" aria-hidden /> : <Clock className="h-8 w-8" aria-hidden />}
            </span>
            <h1 className="mt-4 text-2xl font-extrabold text-gray-900">{rejected ? "Application not approved" : "Waiting for approval"}</h1>
            <p className="mt-1 text-sm text-gray-500">
              {rejected
                ? `${name} wasn't approved this time.`
                : `Thanks for registering ${name}. We'll notify you here as soon as an admin has reviewed it.`}
            </p>
          </div>
          <ol className="space-y-4">
            {steps.map((s, i) => (
              <li key={s.title} className="flex gap-3">
                <span
                  className={cx(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold",
                    s.done ? "bg-brand-700 text-white" : i === 1 ? (rejected ? "bg-red-100 text-red-700" : "bg-accent-400 text-brand-950") : "bg-gray-100 text-gray-500",
                  )}
                >
                  {s.done ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : i + 1}
                </span>
                <div>
                  <p className="font-bold text-gray-900">{s.title}</p>
                  <p className="text-sm text-gray-500">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href="/notifications" className={cx(buttonClass("secondary"), "flex-1")}>
              Check notifications
            </Link>
            <a href={`mailto:${SUPPORT_EMAIL}`} className={cx(buttonClass("primary"), "flex-1")}>
              Contact support
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
