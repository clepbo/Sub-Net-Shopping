import "server-only";
import bcrypt from "bcryptjs";

// Cost 11 takes ~0.2 s in Node (each +1 doubles it). Existing cost-12 hashes still verify.
const ROUNDS = 11;

export function hashPassword(plain: string) {
  return bcrypt.hash(plain, ROUNDS);
}

export function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}
