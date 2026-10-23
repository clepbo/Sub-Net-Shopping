import "server-only";
import { db } from "./db";
import { computeAvailability, type Availability as StoreAvailability } from "./availability";
import { VISIBLE_AVAILABILITY } from "./inventory";

const cartInclude = {
  inventory: {
    include: {
      product: { include: { images: { orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }], take: 1 } } },
      supermarket: { include: { hours: true } },
    },
  },
};

export type CartLine = {
  id: string;
  inventoryId: string;
  productId: string;
  name: string;
  unit: string | null;
  image: string | null;
  unitPriceKobo: number;
  quantity: number;
  lineTotalKobo: number;
  /** Stock left, when the store tracks it. */
  stockQuantity: number | null;
  /** Why this line can't be checked out as it is. */
  issue: string | null;
};

export type CartGroup = {
  supermarket: { id: string; name: string; address: string; area: string | null; logoUrl: string | null };
  availability: StoreAvailability;
  lines: CartLine[];
  subtotalKobo: number;
  /** Why this store's items can't be checked out right now. */
  blocker: string | null;
};

function lineIssue(inv: { availability: string; stockQuantity: number | null; supermarket: { status: string } }, quantity: number) {
  if (inv.supermarket.status !== "APPROVED" || !VISIBLE_AVAILABILITY.includes(inv.availability as never)) return "No longer available";
  if (inv.availability === "OUT_OF_STOCK") return "Out of stock";
  if (inv.stockQuantity !== null && quantity > inv.stockQuantity) return `Only ${inv.stockQuantity} left`;
  return null;
}

/** Why a store can't take a pickup order right now, or null if it can. */
export function pickupBlocker(a: StoreAvailability): string | null {
  if (a.store === "TEMPORARILY_CLOSED") return "This supermarket is temporarily closed.";
  if (a.store === "CLOSED") return "This supermarket is closed right now.";
  if (!a.acceptingOrders) return "This supermarket has stopped taking orders for today.";
  switch (a.pickup.state) {
    case "AVAILABLE":
      return null;
    case "PAUSED":
      return "Pickup is temporarily paused at this supermarket.";
    case "NOT_OFFERED":
      return "This supermarket doesn't offer pickup.";
    default:
      return "Pickup isn't available at this time.";
  }
}

/** The customer's cart, grouped by supermarket, with every line re-checked. */
export async function getCart(userId: string, now = new Date()): Promise<CartGroup[]> {
  const items = await db.cartItem.findMany({ where: { userId }, include: cartInclude, orderBy: { createdAt: "asc" } });
  const groups = new Map<string, CartGroup>();
  for (const item of items) {
    const inv = item.inventory;
    const s = inv.supermarket;
    let group = groups.get(s.id);
    if (!group) {
      const availability = computeAvailability(s, now);
      group = {
        supermarket: { id: s.id, name: s.name, address: s.address, area: s.area, logoUrl: s.logoUrl },
        availability,
        lines: [],
        subtotalKobo: 0,
        blocker: s.status === "APPROVED" ? pickupBlocker(availability) : "This supermarket isn't available on Sub Net right now.",
      };
      groups.set(s.id, group);
    }
    const issue = lineIssue(inv, item.quantity);
    const lineTotalKobo = inv.priceKobo * item.quantity;
    group.lines.push({
      id: item.id,
      inventoryId: inv.id,
      productId: inv.productId,
      name: inv.product.name,
      unit: inv.product.unit,
      image: inv.product.images[0]?.url ?? null,
      unitPriceKobo: inv.priceKobo,
      quantity: item.quantity,
      lineTotalKobo,
      stockQuantity: inv.stockQuantity,
      issue,
    });
    if (!issue) group.subtotalKobo += lineTotalKobo;
  }
  for (const g of groups.values()) {
    if (!g.blocker && g.lines.some((l) => l.issue)) g.blocker = "Fix or remove the highlighted items to check out.";
  }
  return [...groups.values()];
}

export async function cartCount(userId: string) {
  const r = await db.cartItem.aggregate({ where: { userId }, _sum: { quantity: true } });
  return r._sum.quantity ?? 0;
}
