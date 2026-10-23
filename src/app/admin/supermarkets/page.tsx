import type { Metadata } from "next";
import Link from "next/link";
import { Store } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { APPROVAL_STATUSES, parseApprovalStatus } from "@/lib/admin";
import { formatDateTime } from "@/lib/time";
import { ApprovalBadge, APPROVAL_LABEL } from "@/components/approval";
import { FilterTabs } from "@/components/admin-tabs";
import { StoreLogo } from "@/components/store-logo";
import { EmptyState, Page, PageTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Supermarkets" };

export default async function AdminSupermarkets({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireUser("ADMIN");
  const status = parseApprovalStatus((await searchParams).status);
  const [stores, counts] = await Promise.all([
    db.supermarket.findMany({
      where: status ? { status } : {},
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 200,
    }),
    db.supermarket.groupBy({ by: ["status"], _count: true }),
  ]);
  const count = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;

  return (
    <Page>
      <PageTitle eyebrow="Admin" title="Supermarkets" />
      <FilterTabs
        base="/admin/supermarkets"
        current={status ?? ""}
        tabs={[
          { value: "", label: "All", count: counts.reduce((n, c) => n + c._count, 0) },
          ...APPROVAL_STATUSES.map((s) => ({ value: s, label: APPROVAL_LABEL[s], count: count(s) })),
        ]}
      />
      {stores.length === 0 ? (
        <EmptyState icon={<Store className="h-8 w-8" />} title="No supermarkets here" />
      ) : (
        <ul className="space-y-2">
          {stores.map((s) => (
            <li key={s.id}>
              <Link href={`/admin/supermarkets/${s.id}`} className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3 hover:border-brand-500">
                <StoreLogo name={s.name} url={s.logoUrl} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{s.name}</p>
                  <p className="truncate text-xs text-gray-500">{s.address}</p>
                  <p className="text-[11px] text-gray-400">Registered {formatDateTime(s.createdAt)}</p>
                </div>
                <ApprovalBadge status={s.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
