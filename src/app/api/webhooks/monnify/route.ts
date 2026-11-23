import { NextResponse } from "next/server";
import { validMonnifySignature } from "@/lib/payments/monnify";
import { handleMonnifyEvent } from "@/lib/payments/monnify-events";

// Monnify webhook: customer payments, transfers into riders' virtual accounts
// (cash remittance), refunds and payout transfers.
export async function POST(request: Request) {
  const raw = await request.text();
  if (!validMonnifySignature(raw, request.headers.get("monnify-signature"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  try {
    await handleMonnifyEvent(event);
  } catch (err) {
    // A 5xx makes Monnify retry later.
    console.error("Monnify webhook failed", err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
