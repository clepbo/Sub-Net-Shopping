// Signs and verifies session tokens. Kept free of next/headers so the
// proxy can use it too.
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "sns_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14; // 14 days

export type Role = "CUSTOMER" | "SUPERMARKET" | "RIDER" | "ADMIN";

export type SessionPayload = {
  uid: string;
  role: Role;
  /** Must match User.sessionVersion, so sessions can be revoked. */
  ver: number;
};

function secretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set to at least 32 characters");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload) {
  return new SignJWT({ role: payload.role, ver: payload.ver })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.uid)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string" || typeof payload.role !== "string" || typeof payload.ver !== "number") {
      return null;
    }
    return { uid: payload.sub, role: payload.role as Role, ver: payload.ver };
  } catch {
    return null;
  }
}

/** Where each role lands after signing in. */
export const ROLE_HOME: Record<Role, string> = {
  CUSTOMER: "/",
  SUPERMARKET: "/merchant",
  RIDER: "/rider",
  ADMIN: "/admin",
};
