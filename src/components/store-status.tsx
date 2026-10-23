import { Bike, ShoppingBag } from "lucide-react";
import { STORE_STATE_LABEL, serviceLabel, type Availability, type ServiceStatus } from "@/lib/availability";
import { formatInstant } from "@/lib/time";
import { Badge, type Tone } from "./ui";

export function storeTone(a: Availability): Tone {
  if (a.store === "OPEN") return a.acceptingOrders ? "green" : "yellow";
  return a.store === "TEMPORARILY_CLOSED" ? "red" : "gray";
}

export function serviceTone(s: ServiceStatus): Tone {
  if (s.state === "AVAILABLE") return "green";
  if (s.state === "PAUSED") return "yellow";
  return "gray";
}

export function StoreStateBadge({ availability }: { availability: Availability }) {
  const label =
    availability.store === "OPEN" && !availability.acceptingOrders ? "Open · orders closed" : STORE_STATE_LABEL[availability.store];
  return <Badge tone={storeTone(availability)}>{label}</Badge>;
}

export function ServiceBadges({ availability }: { availability: Availability }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <ServiceBadge name="Pickup" status={availability.pickup} />
      <ServiceBadge name="Delivery" status={availability.delivery} />
    </div>
  );
}

export function ServiceBadge({ name, status }: { name: "Pickup" | "Delivery"; status: ServiceStatus }) {
  const Icon = name === "Pickup" ? ShoppingBag : Bike;
  return (
    <Badge tone={serviceTone(status)}>
      <Icon className="h-3 w-3" aria-hidden />
      {serviceLabel(name, status)}
      {status.state === "PAUSED" && status.pausedUntil && ` until ${formatInstant(status.pausedUntil)}`}
    </Badge>
  );
}
