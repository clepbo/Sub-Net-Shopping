import type { Metadata } from "next";
import Form from "next/form";
import { Users } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatNigerianPhone, normalizeNigerianPhone } from "@/lib/phone";
import type { Prisma } from "@/generated/prisma/client";
import { AccountStatusButton } from "@/components/forms/admin-forms";
import { Badge, EmptyState, Page, PageTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Users" };

const ROLES = ["CUSTOMER", "SUPERMARKET", "RIDER", "ADMIN"] as const;
const ROLE_NAME = { CUSTOMER: "Customer", SUPERMARKET: "Supermarket", RIDER: "Rider", ADMIN: "Admin" } as const;

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string; role?: string }> }) {
  const admin = await requireUser("ADMIN");
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 80);
  const role = ROLES.find((r) => r === sp.role);
  const phone = q ? normalizeNigerianPhone(q) : null;

  const where: Prisma.UserWhereInput = {
    ...(role ? { role } : {}),
    ...(q
      ? {
          OR: [
            { email: { contains: q, mode: "insensitive" } },
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
            ...(phone ? [{ phone }] : []),
          ],
        }
      : {}),
  };
  const users = await db.user.findMany({ where, orderBy: { createdAt: "desc" }, take: 100 });

  return (
    <Page>
      <PageTitle eyebrow="Admin" title="Users" subtitle="Search by name, email or phone." />
      <Form action="/admin/users" className="flex gap-2">
        <input
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Search users"
          aria-label="Search users"
          className="min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-3 py-2"
        />
        <select name="role" defaultValue={role ?? ""} aria-label="Role" className="rounded-xl border border-gray-300 bg-white px-2 py-2 text-sm">
          <option value="">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_NAME[r]}
            </option>
          ))}
        </select>
      </Form>
      {users.length === 0 ? (
        <EmptyState icon={<Users className="h-8 w-8" />} title="No users found" />
      ) : (
        <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white">
          {users.map((u) => (
            <li key={u.id} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">
                  {u.firstName} {u.lastName}
                </p>
                <p className="truncate text-xs text-gray-500">
                  {u.email} · {formatNigerianPhone(u.phone)}
                </p>
                <div className="mt-1 flex gap-1">
                  <Badge tone="blue">{ROLE_NAME[u.role]}</Badge>
                  {u.status === "SUSPENDED" && <Badge tone="red">Suspended</Badge>}
                </div>
              </div>
              {u.id !== admin.id && <AccountStatusButton id={u.id} suspended={u.status === "SUSPENDED"} />}
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
