import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { VEHICLE_LABEL } from "@/lib/riders";
import { formatNigerianPhone } from "@/lib/phone";
import { formatDateTime } from "@/lib/time";
import { ApprovalBadge } from "@/components/approval";
import { DecisionForm } from "@/components/forms/admin-forms";
import { Card, DefinitionList, Notice, Page, SectionTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Rider" };

export default async function AdminRiderDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireUser("ADMIN");
  const rider = await db.rider.findUnique({ where: { id: (await params).id }, include: { user: true } });
  if (!rider) notFound();

  return (
    <Page>
      <div className="space-y-1">
        <h1 className="text-xl font-extrabold">
          {rider.user.firstName} {rider.user.lastName}
        </h1>
        <ApprovalBadge status={rider.status} />
      </div>
      {rider.statusReason && (
        <Notice tone="red" title="Reason on record">
          {rider.statusReason}
        </Notice>
      )}
      <Card>
        <SectionTitle>Decision</SectionTitle>
        <DecisionForm kind="rider" id={rider.id} status={rider.status} />
      </Card>
      <Card>
        <SectionTitle>Rider</SectionTitle>
        <DefinitionList
          items={[
            ["Phone", <a key="p" href={`tel:${rider.user.phone}`} className="underline">{formatNigerianPhone(rider.user.phone)}</a>],
            ["Email", rider.user.email],
            ["Account", rider.user.status === "ACTIVE" ? "Active" : "Suspended"],
            ["Online", rider.isOnline ? "Yes" : "No"],
            ["Registered", formatDateTime(rider.createdAt)],
            ["Approved", rider.approvedAt ? formatDateTime(rider.approvedAt) : null],
          ]}
        />
      </Card>
      <Card>
        <SectionTitle>Vehicle</SectionTitle>
        <DefinitionList
          items={[
            ["Type", VEHICLE_LABEL[rider.vehicleType]],
            ["Plate number", rider.plateNumber],
            ["Make / model", rider.vehicleMake],
            ["Colour", rider.vehicleColor],
            ["Driver's licence", rider.driversLicense],
          ]}
        />
      </Card>
    </Page>
  );
}
