import { Ban } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { EmptyState, Page, buttonClass } from "@/components/ui";

export default function SuspendedPage() {
  return (
    <Page>
      <EmptyState icon={<Ban className="h-8 w-8" />} title="Your account is suspended">
        <p>Contact Sub Net support if you think this is a mistake.</p>
        <form action={logout} className="mt-4">
          <button className={buttonClass("secondary", "sm")}>Sign out</button>
        </form>
      </EmptyState>
    </Page>
  );
}
