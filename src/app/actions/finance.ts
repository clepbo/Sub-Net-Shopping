"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { retryRefund } from "@/lib/payments";
import { createSettlement, markSettlementPaid } from "@/lib/settlements";
import type { ActionState } from "@/lib/action-state";

export async function createSettlementAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireUser("ADMIN");
  const supermarketId = String(formData.get("supermarketId") ?? "");
  const s = await createSettlement(supermarketId, admin.id);
  if (!s) return { error: "No collected orders are waiting to be settled" };
  await logActivity({ actorId: admin.id, action: "settlement.created", targetType: "settlement", targetId: s.id, details: `${s.orderCount} orders` });
  revalidatePath("/admin/settlements");
  return { ok: "Settlement created" };
}

export async function markSettlementPaidAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireUser("ADMIN");
  const reference = String(formData.get("reference") ?? "").trim().slice(0, 80);
  if (!reference) return { error: "Enter the transfer reference" };
  try {
    const s = await markSettlementPaid(String(formData.get("settlementId") ?? ""), reference);
    await logActivity({ actorId: admin.id, action: "settlement.paid", targetType: "settlement", targetId: s.id, details: reference });
  } catch {
    return { error: "This settlement is already paid or doesn't exist" };
  }
  revalidatePath("/admin/settlements");
  return { ok: "Marked paid" };
}

export async function retryRefundAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireUser("ADMIN");
  const id = String(formData.get("refundId") ?? "");
  await retryRefund(id);
  await logActivity({ actorId: admin.id, action: "refund.retried", targetType: "refund", targetId: id });
  revalidatePath("/admin/payments");
  return { ok: "Refund resent to Paystack" };
}
