import "server-only";
import { pruneAttempts } from "./throttle";
import { pruneGuestCarts } from "./cart-owner";
import { maybeRunDailySettlement } from "./payouts";
import { syncDueFeeds } from "./pos/connections";
import { expireStalePayments } from "./payments/expiry";
import { sendPickupReminders } from "./reminders";

/** Time-based work: expire unpaid orders and send pickup reminders. */
export async function runBackgroundJobs(now = new Date()) {
  const [expired, reminders] = await Promise.all([expireStalePayments(now), sendPickupReminders(now), pruneAttempts(now), pruneGuestCarts(now)]);
  // Once a day from 22:00 Lagos time: settle and pay supermarkets.
  const payouts = await maybeRunDailySettlement(now);
  // Live POS feeds are re-read hourly.
  const posFeeds = await syncDueFeeds(now).catch((err) => (console.error("POS feeds failed", err), 0));
  return { expired, reminders, payouts, posFeeds };
}

let lastRun = 0;

/**
 * Called after page responses (via after()) as well as by the cron endpoint,
 * at most once a minute per server instance, so jobs keep running even on
 * hosting plans where scheduled jobs are infrequent.
 */
export async function runBackgroundJobsThrottled() {
  if (Date.now() - lastRun < 60_000) return;
  lastRun = Date.now();
  await runBackgroundJobs().catch((err) => console.error("background jobs failed", err));
}
