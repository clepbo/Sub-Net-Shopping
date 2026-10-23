import "server-only";
// Minimal Paystack client (https://paystack.com/docs/api/). All calls are
// server-side with the secret key; nothing payment-related reaches the browser
// except Paystack's own hosted checkout page.
import { createHmac, timingSafeEqual } from "node:crypto";

const BASE_URL = () => (process.env.PAYSTACK_BASE_URL ?? "https://api.paystack.co").replace(/\/$/, "");

export function paystackConfigured() {
  return Boolean(process.env.PAYSTACK_SECRET_KEY);
}

function secret() {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("PAYSTACK_SECRET_KEY is not set");
  return key;
}

export class PaystackError extends Error {}

async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL()}${path}`, {
      method,
      headers: { Authorization: `Bearer ${secret()}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
  } catch (err) {
    throw new PaystackError(`Couldn't reach Paystack: ${err instanceof Error ? err.message : err}`);
  }
  const json = (await res.json().catch(() => null)) as { status?: boolean; message?: string; data?: T } | null;
  if (!res.ok || !json?.status) throw new PaystackError(json?.message ?? `Paystack returned HTTP ${res.status}`);
  return json.data as T;
}

export type PaystackTransaction = {
  id: number;
  reference: string;
  status: "success" | "failed" | "abandoned" | "ongoing" | "pending" | "processing" | "queued" | "reversed";
  amount: number;
  currency: string;
  channel?: string;
  paid_at?: string | null;
  gateway_response?: string;
};

export function initializeTransaction(input: { email: string; amountKobo: number; reference: string; callbackUrl: string; metadata: Record<string, string> }) {
  return call<{ authorization_url: string; access_code: string; reference: string }>("POST", "/transaction/initialize", {
    email: input.email,
    amount: input.amountKobo,
    currency: "NGN",
    reference: input.reference,
    callback_url: input.callbackUrl,
    metadata: input.metadata,
  });
}

export function verifyTransaction(reference: string) {
  return call<PaystackTransaction>("GET", `/transaction/verify/${encodeURIComponent(reference)}`);
}

export function createRefund(input: { reference: string; amountKobo: number; note: string }) {
  return call<{ id: number; status: string }>("POST", "/refund", {
    transaction: input.reference,
    amount: input.amountKobo,
    merchant_note: input.note,
  });
}

/** Checks the x-paystack-signature header (HMAC-SHA512 of the raw body). */
export function validWebhookSignature(rawBody: string, signature: string | null) {
  if (!signature || !process.env.PAYSTACK_SECRET_KEY) return false;
  const expected = createHmac("sha512", secret()).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
