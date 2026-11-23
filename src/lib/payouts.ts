import "server-only";
// Automatic payouts ("10 PM Merchant Settlement" spec). Every night at 22:00
// Lagos time each supermarket's completed, unsettled orders are grouped into
// one settlement and its balance is sent to the store's bank account in a
// single transfer, from SubNet's wallet (the "master corporate account"), not
// from individual customer payments. Cash still held by riders is recovered
// as they remit it.
import { db } from "./db";
import { lagosParts } from "./time";
import { createSettlement, markSettlementPaid, unsettledByStore } from "./settlements";
import { notifyStoreStaff } from "./order-notify";
import { monnifyPayoutsConfigured, singleTransfer, validateAccount } from "./payments/monnify";
import { createTransferRecipient, initiateTransfer, paystackConfigured, resolveAccount } from "./payments/paystack";

export type PayoutProvider = "MONNIFY" | "PAYSTACK";

/** PAYOUT_PROVIDER ("monnify", "paystack" or "manual"), else whichever is configured. Null: pay by hand. */
export function payoutProvider(): PayoutProvider | null {
  const wanted = process.env.PAYOUT_PROVIDER?.toUpperCase();
  if (wanted === "MANUAL") return null;
  if (wanted === "PAYSTACK" && paystackConfigured()) return "PAYSTACK";
  if (wanted === "MONNIFY" && monnifyPayoutsConfigured()) return "MONNIFY";
  if (monnifyPayoutsConfigured()) return "MONNIFY";
  if (paystackConfigured()) return "PAYSTACK";
  return null;
}

/** Looks up the account holder's name, to confirm bank details before saving them. */
export async function lookupAccountName(bankCode: string, accountNumber: string): Promise<string | null> {
  try {
    if (monnifyPayoutsConfigured()) return (await validateAccount(bankCode, accountNumber)).accountName;
    if (paystackConfigured()) return (await resolveAccount(accountNumber, bankCode)).account_name;
  } catch {
    // Unknown account or provider unavailable: the caller decides what to say.
  }
  return null;
}

export const PAYOUT_HOUR = 22;

/**
 * Sends a settlement's balance to the store's bank. Claimed with a
 * conditional update first, so two runs can't pay the same settlement twice.
 */
export async function sendSettlementPayout(settlementId: string) {
  const provider = payoutProvider();
  if (!provider) return "manual" as const;
  const s = await db.settlement.findUniqueOrThrow({ where: { id: settlementId }, include: { supermarket: true } });
  const store = s.supermarket;
  if (s.payableKobo <= 0) return "nothing-to-pay" as const;
  if (!store.bankCode || !store.bankAccountNumber) {
    await db.settlement.update({ where: { id: s.id }, data: { payoutError: "No bank account on file" } });
    return "no-bank" as const;
  }
  // A fresh reference per attempt: providers refuse to reuse one, even after a failure.
  const reference = `SN${s.id}T${Date.now().toString(36)}`.slice(0, 40);
  const claimed = await db.settlement.updateMany({
    where: { id: s.id, status: { in: ["PENDING", "FAILED"] } },
    data: { status: "PROCESSING", payoutProvider: provider, payoutReference: reference, payoutAttemptedAt: new Date(), payoutError: null },
  });
  if (claimed.count !== 1) return "already-sent" as const;

  const narration = `SubNet payout ${s.id.slice(-8).toUpperCase()}`;
  try {
    let status: "success" | "pending" | "failed";
    if (provider === "MONNIFY") {
      const r = await singleTransfer({ amountKobo: s.payableKobo, reference, narration, bankCode: store.bankCode, accountNumber: store.bankAccountNumber });
      status = r.status === "SUCCESS" ? "success" : ["FAILED", "REVERSED", "EXPIRED"].includes(r.status) ? "failed" : "pending";
    } else {
      const recipient = await createTransferRecipient({ name: store.bankAccountName ?? store.name, accountNumber: store.bankAccountNumber, bankCode: store.bankCode });
      const r = await initiateTransfer({ amountKobo: s.payableKobo, recipient: recipient.recipient_code, reference, reason: narration });
      status = r.status === "success" ? "success" : ["failed", "reversed", "abandoned", "blocked", "rejected"].includes(r.status) ? "failed" : "pending";
    }
    await applyTransferResult(reference, status, status === "failed" ? "The bank transfer was declined" : null);
    return status;
  } catch (err) {
    await applyTransferResult(reference, "failed", err instanceof Error ? err.message : String(err));
    return "failed" as const;
  }
}

/** Records a transfer outcome, from the initial call or a provider webhook. */
export async function applyTransferResult(reference: string, status: "success" | "pending" | "failed", error: string | null = null) {
  const s = await db.settlement.findUnique({ where: { payoutReference: reference } });
  if (!s || s.status === "PAID") return;
  if (status === "success") {
    await markSettlementPaid(s.id, reference, ["PROCESSING", "FAILED", "PENDING"]);
  } else if (status === "failed") {
    await db.settlement.update({ where: { id: s.id }, data: { status: "FAILED", payoutError: error ?? "Transfer failed" } });
    await db.$transaction((tx) =>
      notifyStoreStaff(tx, s.supermarketId, "Payout delayed", "Tonight's transfer didn't go through. SubNet will retry; check your bank details on your Store page."),
    );
  }
}

/**
 * The nightly run: settle and pay every store owed money. Stores that owe
 * SubNet (pay-at-store commission) carry the balance forward instead.
 */
export async function runDailySettlement(now = new Date()) {
  const results: { supermarketId: string; settlementId: string; outcome: string }[] = [];
  const due = (await unsettledByStore()).filter((s) => s.payableKobo > 0);
  for (const row of due) {
    const settlement = await createSettlement(row.supermarket.id, null);
    if (!settlement) continue;
    const outcome = settlement.payableKobo > 0 ? await sendSettlementPayout(settlement.id) : "nothing-to-pay";
    results.push({ supermarketId: row.supermarket.id, settlementId: settlement.id, outcome });
  }
  // Earlier failures get another try each night.
  const retry = await db.settlement.findMany({ where: { status: "FAILED", createdAt: { lt: now } }, select: { id: true }, take: 50 });
  for (const r of retry) results.push({ supermarketId: "", settlementId: r.id, outcome: await sendSettlementPayout(r.id) });
  return results;
}

/**
 * Runs the nightly settlement once per Lagos day, at or after 22:00. Called
 * from the cron endpoint and from background jobs, so a late or missed cron
 * still pays out. The day is claimed atomically, so only one run happens.
 */
export async function maybeRunDailySettlement(now = new Date()) {
  const p = lagosParts(now);
  if (p.hour < PAYOUT_HOUR) return null;
  const day = `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
  const claimed = await db.$queryRaw<{ key: string }[]>`
    INSERT INTO "PlatformSetting" ("key", "value", "updatedAt") VALUES ('dailySettlementDay', ${day}, NOW())
    ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = NOW()
    WHERE "PlatformSetting"."value" <> EXCLUDED."value"
    RETURNING "key"`;
  if (claimed.length === 0) return null;
  return runDailySettlement(now);
}
