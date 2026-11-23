import "server-only";
import { headers } from "next/headers";
import { db } from "./db";

/** How many failures are allowed in the window before we make people wait. */
export const LIMITS = {
  login: { perIdentifier: 5, perIp: 30, windowMinutes: 15 },
  reset: { perIdentifier: 3, perIp: 10, windowMinutes: 60 },
} as const;

export type AttemptKind = keyof typeof LIMITS;

export async function clientIp(): Promise<string | null> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
}

/**
 * Minutes until another attempt is allowed, or 0 when it's allowed now.
 * Login counts failures only; reset counts every request.
 */
export async function lockedFor(kind: AttemptKind, identifier: string, ip: string | null, now = new Date()): Promise<number> {
  const limit = LIMITS[kind];
  const since = new Date(now.getTime() - limit.windowMinutes * 60_000);
  const failuresOnly = kind === "login" ? { success: false } : {};
  const [byId, byIp] = await Promise.all([
    db.authAttempt.findMany({
      where: { kind, identifier, createdAt: { gte: since }, ...failuresOnly },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
    ip ? db.authAttempt.count({ where: { kind, ip, createdAt: { gte: since }, ...failuresOnly } }) : Promise.resolve(0),
  ]);
  const overId = byId.length >= limit.perIdentifier;
  if (!overId && byIp < limit.perIp) return 0;
  // Wait until the oldest counted attempt leaves the window.
  const oldest = overId ? byId[byId.length - limit.perIdentifier].createdAt : since;
  const freeAt = oldest.getTime() + limit.windowMinutes * 60_000;
  return Math.max(1, Math.ceil((freeAt - now.getTime()) / 60_000));
}

export async function recordAttempt(kind: AttemptKind, identifier: string, ip: string | null, success: boolean) {
  await db.authAttempt.create({ data: { kind, identifier, ip, success } });
}

/** A successful sign-in clears the account's failure count. */
export async function clearFailures(identifier: string) {
  await db.authAttempt.deleteMany({ where: { kind: "login", identifier, success: false } });
}

/** Drops attempt rows older than a day (run by the background jobs). */
export async function pruneAttempts(now = new Date()) {
  await db.authAttempt.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 24 * 3600_000) } } });
}
