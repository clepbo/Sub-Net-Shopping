import "server-only";
import { db } from "./db";

export async function logActivity(entry: {
  actorId: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  details?: string;
}) {
  await db.activityLog.create({ data: entry });
}

export async function notify(userId: string, title: string, body: string) {
  await db.notification.create({ data: { userId, title, body } });
}
