// Works out what a supermarket can do right now: whether the store is open,
// and whether pickup and delivery are available (PRD §6, §19, §20). Pure so
// it can be unit-tested and reused by checkout when orders arrive.
import { lagosClock, toMinutes } from "./time";

export type StoreSchedule = {
  hours: { dayOfWeek: number; isOpen: boolean; opensAt: string | null; closesAt: string | null }[];
  lastOrderTime: string | null;
  temporarilyClosed: boolean;
  pickupEnabled: boolean;
  pickupStart: string | null;
  pickupEnd: string | null;
  pickupPausedUntil: Date | null;
  deliveryEnabled: boolean;
  deliveryStart: string | null;
  deliveryEnd: string | null;
  lastDeliveryOrderTime: string | null;
  deliveryPausedUntil: Date | null;
};

export type StoreState = "OPEN" | "CLOSED" | "TEMPORARILY_CLOSED";

export type ServiceState =
  | "AVAILABLE"
  | "PAUSED" // temporarily paused by the store, e.g. heavy rain
  | "OUTSIDE_HOURS" // store open but outside this service's window
  | "CUTOFF_PASSED" // last order time for today has passed
  | "STORE_CLOSED"
  | "NOT_OFFERED"; // the store doesn't offer this service

export type ServiceStatus = { state: ServiceState; pausedUntil?: Date };

export type Availability = {
  store: StoreState;
  /** True when the store is open and before its last order time. */
  acceptingOrders: boolean;
  pickup: ServiceStatus;
  delivery: ServiceStatus;
  /** Today's hours, if open today. */
  today: { opensAt: string; closesAt: string } | null;
};

function within(minutes: number, start: string | null, end: string | null) {
  if (!start || !end) return true;
  return minutes >= toMinutes(start) && minutes < toMinutes(end);
}

export function computeAvailability(s: StoreSchedule, now: Date = new Date()): Availability {
  const { dayOfWeek, minutes } = lagosClock(now);
  const todayRow = s.hours.find((h) => h.dayOfWeek === dayOfWeek);
  const today =
    todayRow?.isOpen && todayRow.opensAt && todayRow.closesAt
      ? { opensAt: todayRow.opensAt, closesAt: todayRow.closesAt }
      : null;

  let store: StoreState;
  if (s.temporarilyClosed) store = "TEMPORARILY_CLOSED";
  else if (today && within(minutes, today.opensAt, today.closesAt)) store = "OPEN";
  else store = "CLOSED";

  const beforeCutoff = (cutoff: string | null) => !cutoff || minutes < toMinutes(cutoff);
  const acceptingOrders = store === "OPEN" && beforeCutoff(s.lastOrderTime);

  function service(
    enabled: boolean,
    pausedUntil: Date | null,
    start: string | null,
    end: string | null,
    cutoffs: (string | null)[],
  ): ServiceStatus {
    if (!enabled) return { state: "NOT_OFFERED" };
    if (store !== "OPEN") return { state: "STORE_CLOSED" };
    if (pausedUntil && pausedUntil > now) return { state: "PAUSED", pausedUntil };
    if (!within(minutes, start, end)) return { state: "OUTSIDE_HOURS" };
    if (!cutoffs.every(beforeCutoff)) return { state: "CUTOFF_PASSED" };
    return { state: "AVAILABLE" };
  }

  return {
    store,
    acceptingOrders,
    today,
    pickup: service(s.pickupEnabled, s.pickupPausedUntil, s.pickupStart, s.pickupEnd, [s.lastOrderTime]),
    delivery: service(s.deliveryEnabled, s.deliveryPausedUntil, s.deliveryStart, s.deliveryEnd, [
      s.lastOrderTime,
      s.lastDeliveryOrderTime,
    ]),
  };
}

export const STORE_STATE_LABEL: Record<StoreState, string> = {
  OPEN: "Open now",
  CLOSED: "Closed",
  TEMPORARILY_CLOSED: "Temporarily closed",
};

export function serviceLabel(name: "Pickup" | "Delivery", status: ServiceStatus): string {
  switch (status.state) {
    case "AVAILABLE":
      return `${name} available`;
    case "PAUSED":
      return `${name} temporarily unavailable`;
    case "OUTSIDE_HOURS":
      return `${name} not running now`;
    case "CUTOFF_PASSED":
      return `${name} closed for today`;
    case "STORE_CLOSED":
      return `${name} unavailable`;
    case "NOT_OFFERED":
      return `No ${name.toLowerCase()}`;
  }
}
