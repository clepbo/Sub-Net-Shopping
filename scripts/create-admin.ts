// Creates (or promotes) an admin account. Admins can't self-register.
//
//   npm run admin:create -- --email ops@subnet.ng --phone 08031234567 \
//     --first-name Ada --last-name Osagie
//
// The password is read from ADMIN_PASSWORD so it doesn't end up in shell history.
import "dotenv/config";
import { parseArgs } from "node:util";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { normalizeNigerianPhone } from "../src/lib/phone";

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    phone: { type: "string" },
    "first-name": { type: "string" },
    "last-name": { type: "string" },
  },
});

function fail(message: string): never {
  console.error(`✖ ${message}`);
  process.exit(1);
}

const email = values.email?.trim().toLowerCase() ?? fail("--email is required");
const phone = normalizeNigerianPhone(values.phone ?? "") ?? fail("--phone must be a valid Nigerian mobile number");
const firstName = values["first-name"]?.trim() || fail("--first-name is required");
const lastName = values["last-name"]?.trim() || fail("--last-name is required");
const password = process.env.ADMIN_PASSWORD ?? fail("Set ADMIN_PASSWORD in the environment");
if (password.length < 12) fail("ADMIN_PASSWORD must be at least 12 characters");

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

async function main() {
  const existing = await db.user.findFirst({ where: { OR: [{ email }, { phone }] } });
  if (existing && existing.role !== "ADMIN") {
    fail(`${existing.email} already exists as a ${existing.role.toLowerCase()} account; use a different email/phone`);
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const admin = existing
    ? await db.user.update({
        where: { id: existing.id },
        data: { passwordHash, status: "ACTIVE", sessionVersion: { increment: 1 } },
      })
    : await db.user.create({ data: { role: "ADMIN", email, phone, firstName, lastName, passwordHash } });
  await db.activityLog.create({
    data: { actorId: null, action: existing ? "admin.password_reset" : "admin.created", targetType: "user", targetId: admin.id, details: email },
  });
  console.log(`✔ Admin ${existing ? "updated" : "created"}: ${admin.email}`);
}

main().finally(() => db.$disconnect());
