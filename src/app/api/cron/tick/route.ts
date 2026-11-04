import { NextResponse } from "next/server";
import { runBackgroundJobs } from "@/lib/jobs";

export const maxDuration = 300;

/**
 * Expires unpaid orders and sends pickup reminders. Vercel Cron calls it
 * (with "Authorization: Bearer $CRON_SECRET"); for reminders on time, also
 * call it every 5 minutes from a free scheduler such as cron-job.org.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await runBackgroundJobs());
}
