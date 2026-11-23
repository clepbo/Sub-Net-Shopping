import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { db } from "./db";
import { hashPassword } from "./password";

export const RESET_TTL_MINUTES = 60;

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Creates a single-use reset (or staff invite) token and returns the raw token, which is only ever sent to the person. */
export const INVITE_TTL_MINUTES = 72 * 60;

export async function createResetToken(userId: string, now = new Date(), ttlMinutes = RESET_TTL_MINUTES) {
  const token = randomBytes(32).toString("base64url");
  // Only the newest link works.
  await db.passwordResetToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: now } });
  await db.passwordResetToken.create({
    data: { userId, tokenHash: hashToken(token), expiresAt: new Date(now.getTime() + ttlMinutes * 60_000) },
  });
  return token;
}

/** The token's row when it's unused and unexpired. */
export async function findValidToken(token: string, now = new Date()) {
  if (!token) return null;
  const row = await db.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
  if (!row || row.usedAt || row.expiresAt <= now || row.user.status === "SUSPENDED") return null;
  return row;
}

/**
 * Sets a new password with the token. The token is claimed with a conditional
 * update so it works exactly once, and every existing session is signed out.
 */
export async function resetPassword(token: string, newPassword: string, now = new Date()) {
  const row = await findValidToken(token, now);
  if (!row) return null;
  const passwordHash = await hashPassword(newPassword);
  return db.$transaction(async (tx) => {
    const claimed = await tx.passwordResetToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: now } });
    if (claimed.count !== 1) return null;
    return tx.user.update({
      where: { id: row.userId },
      data: { passwordHash, sessionVersion: { increment: 1 } },
    });
  });
}
