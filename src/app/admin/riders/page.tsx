import type { Metadata } from "next";
import Link from "next/link";
import { Bike } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { APPROVAL_STATUSES, parseApprovalStatus } from "@/lib/admin";
import { VEHICLE_LABEL } from "@/lib/riders";
import { ApprovalBadge, APPROVAL_LABEL } from "@/components/approval";
import { FilterTabs } from "@/components/admin-tabs";
import { EmptyState, Page, PageTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Riders" };

export default async function AdminRiders({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireUser("ADMIN");
  const status = parseApprovalStatus((await searchParams).status);
  const [riders, counts] = await Promise.all([
    db.rider.findMany({
      where: status ? { status } : {},
      include: { user: { select: { firstName: true, lastName: true, phone: true } } },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 200,
    }),
    db.rider.groupBy({ by: ["status"], _count: true }),
  ]);
  const count = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;

  return (
    <Page>
      <PageTitle eyebrow="Admin" title="Riders" />
      <FilterTabs
        base="/admin/riders"
        current={status ?? ""}
        tabs={[
          { value: "", label: "All", count: counts.reduce((n, c) => n + c._count, 0) },
          ...APPROVAL_STATUSES.map((s) => ({ value: s, label: APPROVAL_LABEL[s], count: count(s) })),
        ]}
      />
      {riders.length === 0 ? (
        <EmptyState icon={<Bike className="h-8 w-8" />} title="No riders here" />
      ) : (
        <ul className="space-y-2">
          {riders.map((r) => (
            <li key={r.id}>
              <Link href={`/admin/riders/${r.id}`} className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3 hover:border-brand-500">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">
                    {r.user.firstName} {r.user.lastName}
                    {r.isOnline && <span className="ml-2 inline-block h-2 w-2 rounded-full bg-brand-500" aria-label="Online" />}
                  </p>
                  <p className="text-xs text-gray-500">
                    {VEHICLE_LABEL[r.vehicleType]} · {r.plateNumber}
                  </p>
                </div>
                <ApprovalBadge status={r.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
