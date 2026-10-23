import { ShieldX } from "lucide-react";
import { EmptyState, LinkButton, Page } from "@/components/ui";

export default function ForbiddenPage() {
  return (
    <Page>
      <EmptyState icon={<ShieldX className="h-8 w-8" />} title="You don't have access to this page">
        <p>This area belongs to a different kind of account.</p>
        <LinkButton href="/" variant="secondary" size="sm" className="mt-4">
          Go home
        </LinkButton>
      </EmptyState>
    </Page>
  );
}
