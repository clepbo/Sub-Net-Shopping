import "server-only";
// Minimal Monnify client (https://developers.monnify.com). Server-side only.
// Monnify amounts are in naira (decimals); SubNet works in kobo, so every
// amount is converted at this boundary.
import { createHmac, timingSafeEqual } from "node:crypto";

const BASE_URL = () => (process.env.MONNIFY_BASE_URL ?? "https://sandbox.monnify.com").replace(/\/$/, "");

export function monnifyConfigured() {
  return Boolean(process.env.MONNIFY_API_KEY && process.env.MONNIFY_SECRET_KEY && process.env.MONNIFY_CONTRACT_CODE);
}

/** Disbursements (payouts) also need the wallet account they're paid from. */
export function monnifyPayoutsConfigured() {
  return monnifyConfigured() && Boolean(process.env.MONNIFY_WALLET_ACCOUNT_NUMBER);
}

export class MonnifyError extends Error {}

const toNaira = (kobo: number) => Math.round(kobo) / 100;
const toKobo = (naira: number | string) => Math.round(Number(naira) * 100);

let token: { value: string; expiresAt: number } | null = null;

async function accessToken() {
  if (token && token.expiresAt > Date.now() + 60_000) return token.value;
  const basic = Buffer.from(`${process.env.MONNIFY_API_KEY}:${process.env.MONNIFY_SECRET_KEY}`).toString("base64");
  const body = await request<{ accessToken: string; expiresIn: number }>("POST", "/api/v1/auth/login", undefined, `Basic ${basic}`);
  token = { value: body.accessToken, expiresAt: Date.now() + (body.expiresIn ?? 3000) * 1000 };
  return token.value;
}

async function request<T>(method: "GET" | "POST", path: string, body?: unknown, auth?: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL()}${path}`, {
      method,
      headers: { Authorization: auth ?? `Bearer ${await accessToken()}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
  } catch (err) {
    throw new MonnifyError(`Couldn't reach Monnify: ${err instanceof Error ? err.message : err}`);
  }
  const json = (await res.json().catch(() => null)) as { requestSuccessful?: boolean; responseMessage?: string; responseBody?: T } | null;
  if (res.status === 401 && !auth) token = null;
  if (!res.ok || !json?.requestSuccessful) throw new MonnifyError(json?.responseMessage ?? `Monnify returned HTTP ${res.status}`);
  return json.responseBody as T;
}

// ─── Collections ───────────────────────────────────────────────────────

export function initTransaction(input: { amountKobo: number; reference: string; customerName: string; customerEmail: string; description: string; redirectUrl: string; metadata?: Record<string, string> }) {
  return request<{ transactionReference: string; paymentReference: string; checkoutUrl: string }>("POST", "/api/v1/merchant/transactions/init-transaction", {
    amount: toNaira(input.amountKobo),
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    paymentReference: input.reference,
    paymentDescription: input.description,
    currencyCode: "NGN",
    contractCode: process.env.MONNIFY_CONTRACT_CODE,
    redirectUrl: input.redirectUrl,
    paymentMethods: ["CARD", "ACCOUNT_TRANSFER", "USSD"],
    metaData: input.metadata,
  });
}

export type MonnifyTransaction = {
  transactionReference: string;
  paymentReference: string;
  amountPaid: number | string;
  totalPayable?: number | string;
  paymentStatus: "PAID" | "OVERPAID" | "PARTIALLY_PAID" | "PENDING" | "ABANDONED" | "CANCELLED" | "FAILED" | "REVERSED" | "EXPIRED";
  paymentMethod?: string;
  currency?: string;
  currencyCode?: string;
  paidOn?: string;
  product?: { type?: string; reference?: string };
};

/** Looks a payment up by our own reference. */
export function queryByPaymentReference(reference: string) {
  return request<MonnifyTransaction>("GET", `/api/v2/merchant/transactions/query?paymentReference=${encodeURIComponent(reference)}`);
}

/** Looks a transaction up by Monnify's reference (used for transfers into reserved accounts). */
export function getTransaction(transactionReference: string) {
  return request<MonnifyTransaction>("GET", `/api/v2/transactions/${encodeURIComponent(transactionReference)}`);
}

export const amountPaidKobo = (tx: MonnifyTransaction) => toKobo(tx.amountPaid);

export function initiateRefund(input: { transactionReference: string; refundReference: string; amountKobo: number; reason: string }) {
  return request<{ refundStatus: string; refundReference: string }>("POST", "/api/v1/refunds/initiate-refund", {
    transactionReference: input.transactionReference,
    refundReference: input.refundReference,
    refundAmount: toNaira(input.amountKobo),
    refundReason: input.reason.slice(0, 64),
    customerNote: input.reason.slice(0, 16),
  });
}

// ─── Reserved (virtual) accounts for rider cash remittance ─────────────

export function createReservedAccount(input: { accountReference: string; accountName: string; customerEmail: string; customerName: string }) {
  return request<{ accountReference: string; accounts: { bankName: string; accountNumber: string; accountName: string }[] }>(
    "POST",
    "/api/v2/bank-transfer/reserved-accounts",
    {
      accountReference: input.accountReference,
      accountName: input.accountName,
      currencyCode: "NGN",
      contractCode: process.env.MONNIFY_CONTRACT_CODE,
      customerEmail: input.customerEmail,
      customerName: input.customerName,
      getAllAvailableBanks: false,
      preferredBanks: ["50515"],
    },
  );
}

// ─── Disbursements (payouts) ───────────────────────────────────────────

export type DisbursementStatus = "SUCCESS" | "PENDING" | "IN_PROGRESS" | "PENDING_AUTHORIZATION" | "FAILED" | "REVERSED" | "EXPIRED";

export function singleTransfer(input: { amountKobo: number; reference: string; narration: string; bankCode: string; accountNumber: string }) {
  return request<{ status: DisbursementStatus; reference: string; transactionReference?: string }>("POST", "/api/v2/disbursements/single", {
    amount: toNaira(input.amountKobo),
    reference: input.reference,
    narration: input.narration.slice(0, 100),
    destinationBankCode: input.bankCode,
    destinationAccountNumber: input.accountNumber,
    currency: "NGN",
    sourceAccountNumber: process.env.MONNIFY_WALLET_ACCOUNT_NUMBER,
  });
}

export function transferStatus(reference: string) {
  return request<{ status: DisbursementStatus; reference: string }>("GET", `/api/v2/disbursements/single/summary?reference=${encodeURIComponent(reference)}`);
}

export function validateAccount(bankCode: string, accountNumber: string) {
  return request<{ accountNumber: string; accountName: string; bankCode: string }>(
    "GET",
    `/api/v1/disbursements/account/validate?accountNumber=${encodeURIComponent(accountNumber)}&bankCode=${encodeURIComponent(bankCode)}`,
  );
}

/** Checks the monnify-signature header: HMAC-SHA512 of the raw body with the secret key. */
export function validMonnifySignature(rawBody: string, signature: string | null) {
  const secret = process.env.MONNIFY_SECRET_KEY;
  if (!signature || !secret) return false;
  const expected = createHmac("sha512", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** For tests: forget the cached token. */
export function resetMonnifyToken() {
  token = null;
}
