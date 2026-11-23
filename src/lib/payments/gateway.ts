import "server-only";
// One interface over the payment providers, so orders don't care which is in use.
import type { PaymentProvider } from "@/generated/prisma/enums";
import * as paystack from "./paystack";
import * as monnify from "./monnify";

/** A provider's answer about a payment, in SubNet's terms (kobo). */
export type VerifiedTransaction = {
  reference: string;
  status: "success" | "failed" | "pending";
  amountKobo: number;
  currency: string;
  channel: string | null;
  paidAt: Date | null;
  providerTransactionId: string;
  detail: string | null;
};

/**
 * Which provider takes new payments: PAYMENT_PROVIDER ("monnify" or
 * "paystack") if set and configured, otherwise whichever is configured
 * (Monnify first). Null means online payment is off.
 */
export function activeProvider(): PaymentProvider | null {
  const wanted = process.env.PAYMENT_PROVIDER?.toUpperCase();
  if (wanted === "PAYSTACK" && paystack.paystackConfigured()) return "PAYSTACK";
  if (wanted === "MONNIFY" && monnify.monnifyConfigured()) return "MONNIFY";
  if (monnify.monnifyConfigured()) return "MONNIFY";
  if (paystack.paystackConfigured()) return "PAYSTACK";
  return null;
}

export function onlinePaymentsAvailable() {
  return activeProvider() !== null;
}

export const PROVIDER_LABEL: Record<PaymentProvider, string> = { PAYSTACK: "Paystack", MONNIFY: "Monnify" };

export async function initializePayment(
  provider: PaymentProvider,
  input: { reference: string; amountKobo: number; email: string; customerName: string; description: string; callbackBase: string; metadata: Record<string, string> },
): Promise<string> {
  if (provider === "MONNIFY") {
    const r = await monnify.initTransaction({
      amountKobo: input.amountKobo,
      reference: input.reference,
      customerName: input.customerName,
      customerEmail: input.email,
      description: input.description,
      redirectUrl: `${input.callbackBase}/payments/monnify/callback`,
      metadata: input.metadata,
    });
    return r.checkoutUrl;
  }
  const r = await paystack.initializeTransaction({
    email: input.email,
    amountKobo: input.amountKobo,
    reference: input.reference,
    callbackUrl: `${input.callbackBase}/payments/paystack/callback`,
    metadata: input.metadata,
  });
  return r.authorization_url;
}

export async function verifyPayment(provider: PaymentProvider, reference: string): Promise<VerifiedTransaction> {
  if (provider === "MONNIFY") {
    const t = await monnify.queryByPaymentReference(reference);
    const status = t.paymentStatus === "PAID" || t.paymentStatus === "OVERPAID" ? "success" : ["FAILED", "CANCELLED", "EXPIRED", "REVERSED", "ABANDONED"].includes(t.paymentStatus) ? "failed" : "pending";
    return {
      reference: t.paymentReference ?? reference,
      status,
      amountKobo: monnify.amountPaidKobo(t),
      currency: t.currency ?? t.currencyCode ?? "NGN",
      channel: t.paymentMethod ? t.paymentMethod.toLowerCase() : null,
      paidAt: status === "success" ? new Date() : null,
      providerTransactionId: t.transactionReference,
      detail: t.paymentStatus,
    };
  }
  const t = await paystack.verifyTransaction(reference);
  return {
    reference: t.reference,
    status: t.status === "success" ? "success" : ["failed", "abandoned", "reversed"].includes(t.status) ? "failed" : "pending",
    amountKobo: t.amount,
    currency: t.currency,
    channel: t.channel ?? null,
    paidAt: t.paid_at ? new Date(t.paid_at) : null,
    providerTransactionId: String(t.id),
    detail: t.gateway_response ?? t.status,
  };
}

/** Sends a refund; returns the provider's id for it and whether it's already done. */
export async function sendProviderRefund(
  provider: PaymentProvider,
  input: { refundId: string; reference: string; providerTransactionId: string | null; amountKobo: number; reason: string },
): Promise<{ providerRefundId: string; processed: boolean }> {
  if (provider === "MONNIFY") {
    if (!input.providerTransactionId) throw new Error("Missing Monnify transaction reference");
    const r = await monnify.initiateRefund({ transactionReference: input.providerTransactionId, refundReference: input.refundId, amountKobo: input.amountKobo, reason: input.reason });
    return { providerRefundId: r.refundReference ?? input.refundId, processed: r.refundStatus === "COMPLETED" };
  }
  const r = await paystack.createRefund({ reference: input.reference, amountKobo: input.amountKobo, note: input.reason });
  return { providerRefundId: String(r.id), processed: r.status === "processed" };
}
