import "server-only";
// Rider cash accountability ("Rider Accountability System" spec). Cash a rider
// collects on delivery is a debt to SubNet: the wallet goes negative by the
// order total. Riders past the limit are paused until they pay it in, usually
// by transfer to their own Monnify virtual account, which credits the wallet
// automatically through the webhook.
import { db } from "./db";
import { getSettings } from "./settings";
import { overLimit } from "./rider-wallet-rules";
export { cashJobAllowed, overLimit } from "./rider-wallet-rules";
import { queuePush } from "./push";
import { queueSms } from "./sms";
import { formatNaira } from "./money";
import { createReservedAccount, monnifyConfigured } from "./payments/monnify";
import type { Prisma, WalletEntryType } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

export async function cashLimitKobo() {
  return Math.round((Number((await getSettings()).riderMaxCashDebt) || 0) * 100);
}

export const BLOCKED_MESSAGE = "Account paused: you're holding too much collected cash. Pay it into your SubNet account to keep delivering.";

/**
 * Adds a ledger entry and updates the cached balance under a row lock, then
 * pauses or un-pauses the rider. Returns the new balance and what changed.
 */
async function post(
  tx: Tx,
  entry: { riderId: string; type: WalletEntryType; amountKobo: number; orderId?: string; reference?: string; note?: string; createdById?: string | null },
  limitKobo: number,
) {
  await tx.$queryRaw`SELECT 1 FROM "Rider" WHERE "id" = ${entry.riderId} FOR UPDATE`;
  const rider = await tx.rider.findUniqueOrThrow({ where: { id: entry.riderId }, select: { walletBalanceKobo: true, cashBlockedAt: true, userId: true } });
  const balanceKobo = rider.walletBalanceKobo + entry.amountKobo;
  await tx.riderWalletEntry.create({ data: { ...entry, balanceKobo } });
  const nowBlocked = overLimit(balanceKobo, limitKobo);
  const change = nowBlocked && !rider.cashBlockedAt ? "blocked" : !nowBlocked && rider.cashBlockedAt ? "unblocked" : null;
  await tx.rider.update({
    where: { id: entry.riderId },
    data: { walletBalanceKobo: balanceKobo, ...(change === "blocked" ? { cashBlockedAt: new Date() } : change === "unblocked" ? { cashBlockedAt: null } : {}) },
  });
  if (change === "blocked") await tx.notification.create({ data: { userId: rider.userId, title: "Account paused", body: BLOCKED_MESSAGE } });
  if (change === "unblocked") await tx.notification.create({ data: { userId: rider.userId, title: "You're back on", body: "Thanks for paying in your cash. You can take deliveries again." } });
  return { balanceKobo, change, userId: rider.userId };
}

function announce(result: { change: string | null; userId: string; balanceKobo: number }) {
  if (result.change === "blocked") {
    queuePush([result.userId], { title: "Account paused", body: "Account suspended. Please remit collected cash.", url: "/rider/wallet" });
    queueSms({ userIds: [result.userId] }, `SubNet: ${BLOCKED_MESSAGE} You owe ${formatNaira(-result.balanceKobo)}.`);
  }
  if (result.change === "unblocked") queuePush([result.userId], { title: "You're back on", body: "You can take deliveries again.", url: "/rider" });
}

/** Called inside the DELIVERED transition of a cash order: the rider now owes the order total. */
export async function recordCashCollected(tx: Tx, order: { id: string; number: string; totalKobo: number }, riderId: string) {
  const result = await post(tx, { riderId, type: "CASH_COLLECTED", amountKobo: -order.totalKobo, orderId: order.id, note: `Cash for ${order.number}` }, await cashLimitKobo());
  return () => announce(result);
}

/**
 * Credits cash paid in. `reference` (e.g. Monnify's transaction reference)
 * makes it idempotent: the same transfer is never applied twice.
 */
export async function creditRemittance(input: { riderId: string; amountKobo: number; reference?: string; note: string; createdById?: string | null; type?: "REMITTANCE" | "ADJUSTMENT" }) {
  if (!Number.isInteger(input.amountKobo) || input.amountKobo === 0) throw new Error("Enter an amount");
  if (input.reference && (await db.riderWalletEntry.findUnique({ where: { reference: input.reference }, select: { id: true } }))) return { duplicate: true as const };
  const limit = await cashLimitKobo();
  try {
    const result = await db.$transaction((tx) =>
      post(tx, { riderId: input.riderId, type: input.type ?? "REMITTANCE", amountKobo: input.amountKobo, reference: input.reference, note: input.note, createdById: input.createdById }, limit),
    );
    announce(result);
    return { duplicate: false as const, balanceKobo: result.balanceKobo };
  } catch (err) {
    // Two deliveries of the same webhook racing: the unique reference stops the second.
    if ((err as { code?: string }).code === "P2002") return { duplicate: true as const };
    throw err;
  }
}

/** Gives the rider a permanent Monnify account number for paying in cash (once). */
export async function ensureVirtualAccount(riderId: string) {
  if (!monnifyConfigured()) return null;
  const rider = await db.rider.findUniqueOrThrow({ where: { id: riderId }, include: { user: true } });
  if (rider.virtualAccountNumber) return rider;
  const reference = rider.virtualAccountRef ?? `RIDER-${rider.id}`;
  const res = await createReservedAccount({
    accountReference: reference,
    accountName: `SubNet ${rider.user.firstName} ${rider.user.lastName}`.slice(0, 40),
    customerEmail: rider.user.email,
    customerName: `${rider.user.firstName} ${rider.user.lastName}`,
  });
  const acct = res.accounts?.[0];
  return db.rider.update({
    where: { id: riderId },
    data: { virtualAccountRef: reference, virtualAccountNumber: acct?.accountNumber ?? null, virtualAccountBank: acct?.bankName ?? null, virtualAccountName: acct?.accountName ?? null },
  });
}

/** Riders holding the most cash first, for the admin. */
export function ridersHoldingCash() {
  return db.rider.findMany({
    where: { walletBalanceKobo: { lt: 0 } },
    orderBy: { walletBalanceKobo: "asc" },
    include: { user: { select: { firstName: true, lastName: true, phone: true } } },
    take: 100,
  });
}
