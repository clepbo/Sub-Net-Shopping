import { NextResponse, type NextRequest } from "next/server";
import { verifyAndApply } from "@/lib/payments";

// Paystack sends the customer's browser here after checkout. The query
// string is never trusted: the reference is verified with Paystack first.
export async function GET(request: NextRequest) {
  const reference = request.nextUrl.searchParams.get("reference") ?? request.nextUrl.searchParams.get("trxref");
  if (!reference) return NextResponse.redirect(new URL("/orders", request.url));
  let outcome = "pending";
  let orderId: string | undefined;
  try {
    const result = await verifyAndApply(reference);
    outcome = result.outcome;
    orderId = result.orderId;
  } catch (err) {
    console.error("Paystack callback verification failed", err);
  }
  if (!orderId) return NextResponse.redirect(new URL("/orders", request.url));
  const state = ["paid", "restored", "already-processed"].includes(outcome) ? "success" : outcome === "failed" ? "failed" : outcome === "refunded" ? "refunded" : "pending";
  return NextResponse.redirect(new URL(`/orders/${orderId}?payment=${state}`, request.url));
}
