import "server-only";
// Web push (phone/browser notifications). Off until VAPID keys are set;
// generate them with `npm run push:keys`.
import { after } from "next/server";
import webpush from "web-push";
import { db } from "./db";

export type PushMessage = { title: string; body: string; url: string };

export function pushConfigured() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export function vapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY ?? null;
}

let configured = false;
function setup() {
  if (configured) return;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:support@subnet.ng", process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  configured = true;
}

/** Sends to every device the users have enabled; forgets devices that have unsubscribed. */
export async function sendPush(userIds: string[], message: PushMessage) {
  if (!pushConfigured() || userIds.length === 0) return;
  setup();
  const subs = await db.pushSubscription.findMany({ where: { userId: { in: [...new Set(userIds)] } } });
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(message), { TTL: 3600 });
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await db.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        else console.error("web push failed", status ?? err);
      }
    }),
  );
}

/** Sends after the response where possible, so pushing never slows a page or action. */
export function queuePush(userIds: string[], message: PushMessage) {
  if (!pushConfigured() || userIds.length === 0) return;
  const job = () => sendPush(userIds, message).catch((err) => console.error("web push failed", err));
  try {
    after(job);
  } catch {
    void job(); // outside a request (scripts, tests)
  }
}
