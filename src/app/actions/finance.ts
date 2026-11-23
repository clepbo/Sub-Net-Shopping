"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { retryRefund } from "@/lib/payments";
import { createSettlement, markSettlementPaid } from "@/lib/settlements";
import { createRiderPayout, markRiderPayoutPaid } from "@/lib/rider-payouts";
import { formValues, type ActionState } from "@/lib/action-state";
import { creditRemittance } from "@/lib/rider-wallet";
import { sendSettlementPayout } from "@/lib/payouts";
import { parseNairaToKobo } from "@/lib/inventory";

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

export async function createRiderPayoutAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireUser("ADMIN");
  const payout = await createRiderPayout(String(formData.get("riderId") ?? ""), admin.id);
  if (!payout) return { error: "No completed deliveries are waiting to be paid" };
  await logActivity({ actorId: admin.id, action: "rider_payout.created", targetType: "rider_payout", targetId: payout.id, details: `${payout.deliveryCount} deliveries` });
  revalidatePath("/admin/settlements");
  return { ok: "Payout created" };
}

export async function markRiderPayoutPaidAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireUser("ADMIN");
  const reference = String(formData.get("reference") ?? "").trim().slice(0, 80);
  if (!reference) return { error: "Enter the transfer reference" };
  try {
    const p = await markRiderPayoutPaid(String(formData.get("payoutId") ?? ""), reference);
    await logActivity({ actorId: admin.id, action: "rider_payout.paid", targetType: "rider_payout", targetId: p.id, details: reference });
  } catch {
    return { error: "This payout is already paid or doesn't exist" };
  }
  revalidatePath("/admin/settlements");
  return { ok: "Marked paid" };
}

export async function recordRiderRemittance(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireUser("ADMIN");
  const values = formValues(formData);
  const kobo = parseNairaToKobo(String(formData.get("amount") ?? ""));
  if (!kobo) return { fieldErrors: { amount: "Enter an amount in naira" }, values };
  const note = String(formData.get("note") ?? "").trim().slice(0, 200);
  if (!note) return { fieldErrors: { note: "Add a note so the rider knows what this is" }, values };
  const kind = String(formData.get("type") ?? "REMITTANCE");
  const riderId = String(formData.get("riderId") ?? "");
  await creditRemittance({
    riderId,
    amountKobo: kind === "ADJUSTMENT_DEBIT" ? -kobo : kobo,
    note,
    createdById: admin.id,
    type: kind === "REMITTANCE" ? "REMITTANCE" : "ADJUSTMENT",
  });
  await logActivity({ actorId: admin.id, action: "rider.wallet_entry", targetType: "rider", targetId: riderId, details: `${kind} ₦${kobo / 100}: ${note}` });
  revalidatePath("/admin", "layout");
  return { ok: "Recorded" };
}

/** Sends (or re-sends) a settlement's payout through the payout provider. */
export async function sendPayoutAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireUser("ADMIN");
  const id = String(formData.get("settlementId") ?? "");
  const outcome = await sendSettlementPayout(id);
  await logActivity({ actorId: admin.id, action: "settlement.payout_sent", targetType: "settlement", targetId: id, details: outcome });
  revalidatePath("/admin/settlements");
  const messages: Record<string, string> = {
    success: "Paid",
    pending: "Transfer sent; waiting for the bank",
    failed: "The transfer failed. Check the store's bank details.",
    manual: "No payout provider is set up. Pay by hand and mark it paid.",
    "no-bank": "This store hasn't added a bank account",
    "already-sent": "This payout was already sent",
    "nothing-to-pay": "Nothing to pay",
  };
  return outcome === "success" || outcome === "pending" ? { ok: messages[outcome] } : { error: messages[outcome] };
}
