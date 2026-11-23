import "server-only";
// Handles Monnify webhook events. The signature proves the sender; money
// movements are still confirmed with Monnify's API before anything is applied.
import { db } from "../db";
import { applyMonnifyRefundEvent, verifyAndApply } from "./index";
import { amountPaidKobo, getTransaction } from "./monnify";
import { creditRemittance } from "../rider-wallet";
import { applyTransferResult } from "../payouts";

type MonnifyEvent = { eventType?: string; eventData?: Record<string, unknown> };

export async function handleMonnifyEvent(event: MonnifyEvent) {
  const data = event.eventData ?? {};
  switch (event.eventType) {
    case "SUCCESSFUL_TRANSACTION": {
      const product = data.product as { type?: string; reference?: string } | undefined;
      if (product?.type === "RESERVED_ACCOUNT" && typeof data.transactionReference === "string") {
        return remittance(data.transactionReference, product.reference);
      }
      if (typeof data.paymentReference === "string") return verifyAndApply(data.paymentReference);
      return;
    }
    case "SUCCESSFUL_REFUND":
    case "FAILED_REFUND":
      return applyMonnifyRefundEvent(event.eventType, data as { refundReference?: string });
    case "SUCCESSFUL_DISBURSEMENT":
    case "FAILED_DISBURSEMENT":
    case "REVERSED_DISBURSEMENT":
      if (typeof data.reference === "string") {
        const ok = event.eventType === "SUCCESSFUL_DISBURSEMENT";
        return applyTransferResult(data.reference, ok ? "success" : "failed", ok ? null : String(data.transactionDescription ?? event.eventType));
      }
      return;
  }
}

/** A transfer into a rider's virtual account: credit their cash wallet once. */
async function remittance(transactionReference: string, accountReference: string | undefined) {
  const tx = await getTransaction(transactionReference);
  if (tx.paymentStatus !== "PAID" && tx.paymentStatus !== "OVERPAID") return;
  const ref = tx.product?.reference ?? accountReference;
  const rider = ref ? await db.rider.findUnique({ where: { virtualAccountRef: ref }, select: { id: true } }) : null;
  if (!rider) {
    console.warn("Monnify transfer to an unknown reserved account", ref);
    return;
  }
  return creditRemittance({ riderId: rider.id, amountKobo: amountPaidKobo(tx), reference: `MNFY:${transactionReference}`, note: "Bank transfer to your SubNet account" });
}
