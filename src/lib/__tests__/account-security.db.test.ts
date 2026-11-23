// Integration tests against a real Postgres (uses DATABASE_URL; skipped without it).
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const enabled = Boolean(process.env.DATABASE_URL);

describe.skipIf(!enabled)("account security (database)", async () => {
  const { db } = await import("../db");
  const { lockedFor, recordAttempt, clearFailures, LIMITS } = await import("../throttle");
  const { createResetToken, findValidToken, resetPassword } = await import("../password-reset");
  const { verifyPassword } = await import("../password");

  const tag = `t${Date.now()}`;
  let userId = "";

  beforeAll(async () => {
    const u = await db.user.create({
      data: { role: "CUSTOMER", firstName: "R", lastName: "R", email: `reset@${tag}.test`, phone: `+23481${String(Date.now()).slice(-8)}`, passwordHash: "x" },
    });
    userId = u.id;
  });
  afterAll(async () => {
    await db.authAttempt.deleteMany({ where: { identifier: { contains: tag } } });
    await db.user.deleteMany({ where: { id: userId } });
  });

  it("locks an identifier after repeated failures and unlocks on success", async () => {
    const id = `who@${tag}.test`;
    for (let i = 0; i < LIMITS.login.perIdentifier - 1; i++) await recordAttempt("login", id, null, false);
    expect(await lockedFor("login", id, null)).toBe(0);
    await recordAttempt("login", id, null, false);
    const wait = await lockedFor("login", id, null);
    expect(wait).toBeGreaterThan(0);
    expect(wait).toBeLessThanOrEqual(LIMITS.login.windowMinutes);
    // Another account isn't affected.
    expect(await lockedFor("login", `other@${tag}.test`, null)).toBe(0);
    await clearFailures(id);
    expect(await lockedFor("login", id, null)).toBe(0);
  });

  it("frees the lock once failures age out of the window", async () => {
    const id = `old@${tag}.test`;
    for (let i = 0; i < LIMITS.login.perIdentifier; i++) await recordAttempt("login", id, null, false);
    const later = new Date(Date.now() + (LIMITS.login.windowMinutes + 1) * 60_000);
    expect(await lockedFor("login", id, null, later)).toBe(0);
  });

  it("resets a password exactly once and signs out other sessions", async () => {
    const before = await db.user.findUniqueOrThrow({ where: { id: userId } });
    const token = await createResetToken(userId);
    expect(await findValidToken(token)).not.toBeNull();
    const [a, b] = await Promise.all([resetPassword(token, "new-password-1"), resetPassword(token, "new-password-2")]);
    const winners = [a, b].filter(Boolean);
    expect(winners).toHaveLength(1);
    const after = await db.user.findUniqueOrThrow({ where: { id: userId } });
    expect(after.sessionVersion).toBe(before.sessionVersion + 1);
    expect((await verifyPassword("new-password-1", after.passwordHash)) || (await verifyPassword("new-password-2", after.passwordHash))).toBe(true);
    expect(await findValidToken(token)).toBeNull();
  });

  it("only the newest link works, and links expire", async () => {
    const first = await createResetToken(userId);
    const second = await createResetToken(userId);
    expect(await findValidToken(first)).toBeNull();
    expect(await findValidToken(second)).not.toBeNull();
    expect(await findValidToken(second, new Date(Date.now() + 61 * 60_000))).toBeNull();
    expect(await findValidToken("not-a-real-token")).toBeNull();
  });
});
