import { Check } from "lucide-react";
import type { OrderStatus } from "@/generated/prisma/enums";
import { formatNaira } from "@/lib/money";
import { CUSTOMER_STEPS, ORDER_STATUS_LABEL } from "@/lib/order-rules";
import { formatDateTime } from "@/lib/time";
import { Badge, cx, type Tone } from "./ui";

export const ORDER_TONE: Record<OrderStatus, Tone> = {
  PLACED: "yellow",
  CONFIRMED: "blue",
  READY_FOR_PICKUP: "green",
  COLLECTED: "gray",
  CANCELLED: "red",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge tone={ORDER_TONE[status]} className="whitespace-nowrap">
      {ORDER_STATUS_LABEL[status]}
    </Badge>
  );
}

/** Horizontal progress through placed → collected. */
export function OrderProgress({ status }: { status: OrderStatus }) {
  if (status === "CANCELLED") return null;
  const current = CUSTOMER_STEPS.indexOf(status);
  return (
    <ol className="grid grid-cols-4 gap-1 text-center text-[11px] font-semibold">
      {CUSTOMER_STEPS.map((s, i) => (
        <li key={s} className="space-y-1.5">
          <div className={cx("h-1.5 rounded-full", i <= current ? "bg-brand-600" : "bg-gray-200")} />
          <span className={cx("flex items-center justify-center gap-1", i <= current ? "text-brand-800" : "text-gray-400")}>
            {i < current && <Check className="h-3 w-3" aria-hidden />}
            {ORDER_STATUS_LABEL[s]}
          </span>
        </li>
      ))}
    </ol>
  );
}

type Item = { id: string; name: string; unit: string | null; unitPriceKobo: number; requestedQuantity: number; quantity: number; lineTotalKobo: number };

export function OrderItemsList({ items, renderAction }: { items: Item[]; renderAction?: (item: Item) => React.ReactNode }) {
  return (
    <ul className="divide-y divide-gray-100">
      {items.map((item) => (
        <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
          <div className="min-w-0">
            <p className={cx("font-medium", item.quantity === 0 && "text-gray-400 line-through")}>{item.name}</p>
            <p className="text-xs text-gray-500">
              {item.unit && `${item.unit} · `}
              {item.quantity} × {formatNaira(item.unitPriceKobo)}
              {item.quantity !== item.requestedQuantity && (
                <span className="ml-1 font-semibold text-amber-700">
                  ({item.quantity === 0 ? "unavailable" : `you asked for ${item.requestedQuantity}`})
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {renderAction?.(item)}
            <span className="font-bold tabular-nums">{formatNaira(item.lineTotalKobo)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function OrderTotals({ subtotalKobo, deliveryFeeKobo, totalKobo }: { subtotalKobo: number; deliveryFeeKobo: number; totalKobo: number }) {
  return (
    <dl className="space-y-1 border-t border-gray-200 pt-3 text-sm">
      <div className="flex justify-between">
        <dt className="text-gray-600">Subtotal</dt>
        <dd className="tabular-nums">{formatNaira(subtotalKobo)}</dd>
      </div>
      {deliveryFeeKobo > 0 && (
        <div className="flex justify-between">
          <dt className="text-gray-600">Delivery</dt>
          <dd className="tabular-nums">{formatNaira(deliveryFeeKobo)}</dd>
        </div>
      )}
      <div className="flex justify-between text-base font-extrabold">
        <dt>Total</dt>
        <dd className="tabular-nums">{formatNaira(totalKobo)}</dd>
      </div>
    </dl>
  );
}

export function OrderTimeline({ events }: { events: { id: string; status: OrderStatus; note: string | null; createdAt: Date }[] }) {
  return (
    <ol className="space-y-3 border-l-2 border-gray-200 pl-4 text-sm">
      {events.map((e) => (
        <li key={e.id} className="relative">
          <span className="absolute top-1.5 -left-[21px] h-2.5 w-2.5 rounded-full bg-brand-600" aria-hidden />
          <p className="font-semibold">{e.note ?? ORDER_STATUS_LABEL[e.status]}</p>
          <p className="text-xs text-gray-500">{formatDateTime(e.createdAt)}</p>
        </li>
      ))}
    </ol>
  );
}
