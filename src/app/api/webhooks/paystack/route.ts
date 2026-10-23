import { NextResponse } from "next/server";
import { applyRefundEvent, verifyAndApply } from "@/lib/payments";
import { validWebhookSignature } from "@/lib/payments/paystack";

// Paystack webhook. The signature proves it came from Paystack; charge
// results are still re-verified through the API before being applied.
export async function POST(request: Request) {
  const raw = await request.text();
  if (!validWebhookSignature(raw, request.headers.get("x-paystack-signature"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  let event: { event?: string; data?: Record<string, unknown> };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  try {
    if (event.event === "charge.success" && typeof event.data?.reference === "string") {
      await verifyAndApply(event.data.reference);
    } else if (event.event?.startsWith("refund.") && event.data) {
      await applyRefundEvent(event.data as Parameters<typeof applyRefundEvent>[0]);
    }
  } catch (err) {
    // A 5xx makes Paystack retry later.
    console.error("Paystack webhook failed", err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
