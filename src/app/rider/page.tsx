import Link from "next/link";
import { requireRider, VEHICLE_LABEL } from "@/lib/riders";
import { formatDateTime } from "@/lib/time";
import { ApprovalBadge, ApprovalNotice } from "@/components/approval";
import { OnlineToggle } from "@/components/forms/rider-forms";
import { Card, DefinitionList, Page, SectionTitle } from "@/components/ui";

export default async function RiderDashboard() {
  const { user, rider } = await requireRider();
  return (
    <Page>
      <div className="flex items-center justify-between rounded-2xl bg-brand-900 p-4 text-white shadow-md">
        <div className="min-w-0">
          <p className="text-[10px] font-bold tracking-wider text-accent-400 uppercase">Sub Net rider</p>
          <h1 className="truncate text-lg font-black">
            {user.firstName} {user.lastName}
          </h1>
          <p className="text-xs text-brand-200">
            {VEHICLE_LABEL[rider.vehicleType]} · {rider.plateNumber}
          </p>
        </div>
        <ApprovalBadge status={rider.status} />
      </div>

      <ApprovalNotice status={rider.status} reason={rider.statusReason} kind="rider" />

      <Card>
        <OnlineToggle online={rider.isOnline} canGoOnline={rider.status === "APPROVED"} />
      </Card>

      <Card>
        <SectionTitle
          action={
            <Link href="/rider/vehicle" className="text-xs font-bold text-brand-700">
              Edit
            </Link>
          }
        >
          Vehicle
        </SectionTitle>
        <DefinitionList
          items={[
            ["Type", VEHICLE_LABEL[rider.vehicleType]],
            ["Plate number", rider.plateNumber],
            ["Make / model", rider.vehicleMake],
            ["Colour", rider.vehicleColor],
            ["Driver's licence", rider.driversLicense],
            ["Last online", rider.lastOnlineAt ? formatDateTime(rider.lastOnlineAt) : "Never"],
          ]}
        />
      </Card>
    </Page>
  );
}
