import type { Metadata } from "next";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { logout } from "@/app/actions/auth";
import { PasswordForm, ProfileForm } from "@/components/forms/account-forms";
import { Card, DefinitionList, Page, PageTitle, SectionTitle, buttonClass, cx } from "@/components/ui";

export const metadata: Metadata = { title: "Account" };

const ROLE_NAME = { CUSTOMER: "Customer", SUPERMARKET: "Supermarket", RIDER: "Rider", ADMIN: "Administrator" } as const;

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <Page>
      <PageTitle title={`${user.firstName} ${user.lastName}`} subtitle={ROLE_NAME[user.role]} />
      <Card>
        <DefinitionList items={[["Email", user.email]]} />
        {user.role === "CUSTOMER" && (
          <Link href="/orders" className="mt-2 inline-block text-sm font-bold text-brand-700">
            My orders →
          </Link>
        )}
      </Card>
      <Card>
        <SectionTitle>Profile</SectionTitle>
        <ProfileForm user={user} />
      </Card>
      <Card>
        <SectionTitle>Password</SectionTitle>
        <PasswordForm />
      </Card>
      <form action={logout}>
        <button className={cx(buttonClass("secondary"), "w-full text-red-700")}>
          <LogOut className="h-4 w-4" aria-hidden /> Sign out
        </button>
      </form>
    </Page>
  );
}
