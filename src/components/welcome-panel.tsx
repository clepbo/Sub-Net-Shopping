import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

type Step = { title: string; body: string; href?: string };

/** Shown once, straight after registering, so people know it worked and what comes next. */
export function WelcomePanel({ title, intro, steps }: { title: string; intro: string; steps: Step[] }) {
  return (
    <section className="rounded-2xl border-2 border-brand-500 bg-white p-5 shadow-sm" role="status">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="h-8 w-8 shrink-0 text-brand-600" aria-hidden />
        <div>
          <h2 className="text-lg font-extrabold text-gray-900">{title}</h2>
          <p className="text-sm text-gray-600">{intro}</p>
        </div>
      </div>
      <ol className="mt-4 space-y-3">
        {steps.map((s, i) => (
          <li key={s.title} className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-800 text-sm font-bold text-white">{i + 1}</span>
            <div className="text-sm">
              <p className="font-bold text-gray-900">{s.href ? <Link href={s.href} className="underline decoration-brand-500 underline-offset-2">{s.title}</Link> : s.title}</p>
              <p className="text-gray-600">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
