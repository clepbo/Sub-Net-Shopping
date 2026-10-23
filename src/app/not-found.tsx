import { SearchX } from "lucide-react";
import { EmptyState, LinkButton, Page } from "@/components/ui";

export default function NotFound() {
  return (
    <Page>
      <EmptyState icon={<SearchX className="h-8 w-8" />} title="Page not found">
        <LinkButton href="/" variant="secondary" size="sm" className="mt-4">
          Go home
        </LinkButton>
      </EmptyState>
    </Page>
  );
}
