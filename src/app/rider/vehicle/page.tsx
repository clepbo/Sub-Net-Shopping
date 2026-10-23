import type { Metadata } from "next";
import { requireRider } from "@/lib/riders";
import { VehicleForm } from "@/components/forms/rider-forms";
import { Card, Page, PageTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Vehicle" };

export default async function RiderVehiclePage() {
  const { rider } = await requireRider();
  return (
    <Page>
      <PageTitle eyebrow="Rider" title="Vehicle details" subtitle="Deliveries are matched to the vehicle you ride." />
      <Card>
        <VehicleForm
          disabled={rider.status === "SUSPENDED"}
          vehicle={{
            vehicleType: rider.vehicleType,
            plateNumber: rider.plateNumber,
            vehicleMake: rider.vehicleMake,
            vehicleColor: rider.vehicleColor,
            driversLicense: rider.driversLicense,
          }}
        />
      </Card>
    </Page>
  );
}
