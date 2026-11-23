import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireMerchantStore } from "@/lib/supermarkets";
import { AddStaffForm, StaffRowActions } from "@/components/forms/staff-forms";
import { Badge, Card, Page, PageTitle, SectionTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Staff" };

export default async function MerchantStaffPage() {
  const { user, store } = await requireMerchantStore({ managerOnly: true });
  const members = await db.supermarketStaff.findMany({
    where: { supermarketId: store.id },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    include: { user: { include: { resetTokens: { where: { usedAt: { not: null } }, take: 1, select: { id: true } } } } },
  });

  return (
    <Page>
      <PageTitle
        eyebrow="Merchant"
        title="Staff logins"
        subtitle="Give each person their own login. Staff can handle orders, pickup and stock; managers can also change store details, hours, payouts and staff."
      />
      <Card className="space-y-3">
        <SectionTitle>People at {store.name}</SectionTitle>
        <ul className="divide-y divide-gray-100">
          {members.map((m) => {
            const owner = m.userId === store.ownerId;
            const self = m.userId === user.id;
            // Invited staff start with an unusable password until they use their link.
            const pending = !owner && m.user.resetTokens.length === 0;
            return (
              <li key={m.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-bold">
                    {m.user.firstName} {m.user.lastName} {self && <span className="text-xs font-normal text-gray-500">(you)</span>}
                  </p>
                  <p className="text-xs text-gray-500">
                    {m.user.email} · {m.user.phone}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Badge tone={m.role === "MANAGER" ? "blue" : "gray"}>{owner ? "Owner" : m.role === "MANAGER" ? "Manager" : "Staff"}</Badge>
                    {pending && <Badge tone="yellow">Invite sent</Badge>}
                  </div>
                </div>
                {!owner && !self && <StaffRowActions memberId={m.id} role={m.role} pending={pending} />}
              </li>
            );
          })}
        </ul>
      </Card>
      <Card className="space-y-3">
        <SectionTitle>Add someone</SectionTitle>
        <AddStaffForm />
      </Card>
    </Page>
  );
}
