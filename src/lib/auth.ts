import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "./db";
import { readSession } from "./session";
import type { Role } from "./session-token";

/**
 * The signed-in user, re-checked against the database on every request so
 * suspensions and revoked sessions take effect immediately. Returns null
 * when there is no valid session.
 */
export const getCurrentUser = cache(async () => {
  const session = await readSession();
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.uid },
    select: {
      id: true,
      role: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      status: true,
      sessionVersion: true,
    },
  });
  if (!user || user.sessionVersion !== session.ver || user.role !== session.role) return null;
  return user;
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/**
 * Data-access guard for pages and server actions. Redirects to login when
 * signed out, and to /forbidden when the role doesn't match. Suspended
 * accounts are sent to /suspended.
 */
export async function requireUser(...roles: Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.status === "SUSPENDED") redirect("/suspended");
  if (roles.length > 0 && !roles.includes(user.role)) redirect("/forbidden");
  return user;
}
