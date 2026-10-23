import { NextResponse } from "next/server";
import { expireStalePayments } from "@/lib/payments/expiry";

export const maxDuration = 300;

// Scheduled by vercel.json. Vercel sends "Authorization: Bearer $CRON_SECRET".
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const expired = await expireStalePayments(new Date(), 500);
  return NextResponse.json({ expired });
}
