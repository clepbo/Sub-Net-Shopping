import "server-only";
// SMS alerts through Termii (https://termii.com), for the moments a customer,
// store or rider must not miss even without the app open. Without
// TERMII_API_KEY, messages are printed to the server log instead.
import { after } from "next/server";
import { db } from "./db";

export function smsConfigured() {
  return Boolean(process.env.TERMII_API_KEY);
}

/** "+2348031234567" → "2348031234567", the format Termii expects. */
export function termiiNumber(e164: string) {
  return e164.replace(/^\+/, "");
}

/** Keeps a message to two SMS pages (306 characters) to control cost. */
export function smsText(text: string) {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > 306 ? `${t.slice(0, 303)}...` : t;
}

export async function sendSms(phones: string[], text: string): Promise<number> {
  const to = [...new Set(phones.filter(Boolean).map(termiiNumber))];
  if (to.length === 0) return 0;
  const sms = smsText(text);
  const key = process.env.TERMII_API_KEY;
  if (!key) {
    console.info(`[sms:dev] to=${to.join(",")} ${sms}`);
    return to.length;
  }
  let sent = 0;
  for (const number of to) {
    try {
      const res = await fetch(`${process.env.TERMII_BASE_URL ?? "https://v3.api.termii.com"}/api/sms/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: key,
          to: number,
          from: process.env.TERMII_SENDER_ID ?? "SubNet",
          sms,
          type: "plain",
          // "dnd" reaches numbers on Do-Not-Disturb (needs a registered sender ID); "generic" doesn't.
          channel: process.env.TERMII_CHANNEL ?? "dnd",
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) sent++;
      else console.error(`[sms] Termii ${res.status}: ${await res.text().catch(() => "")}`);
    } catch (err) {
      console.error("[sms] send failed", err);
    }
  }
  return sent;
}

/**
 * Sends after the response (like queuePush). Pass user IDs (their phone
 * numbers are looked up) and/or phone numbers directly.
 */
export function queueSms(target: { userIds?: string[]; phones?: string[] }, text: string) {
  const job = async () => {
    const users = target.userIds?.length ? await db.user.findMany({ where: { id: { in: target.userIds }, status: "ACTIVE" }, select: { phone: true } }) : [];
    await sendSms([...users.map((u) => u.phone), ...(target.phones ?? [])], text);
  };
  const run = () => job().catch((err) => console.error("sms failed", err));
  try {
    after(run);
  } catch {
    void run(); // outside a request (scripts, tests, cron)
  }
}
