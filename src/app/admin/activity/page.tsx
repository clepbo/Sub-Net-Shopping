import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ActivityList } from "@/components/activity-list";
import { Card, Page, PageTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Activity" };

export default async function ActivityPage() {
  await requireUser("ADMIN");
  const entries = await db.activityLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { actor: { select: { firstName: true, lastName: true } } },
  });
  return (
    <Page>
      <PageTitle eyebrow="Admin" title="Platform activity" subtitle="The latest 200 events." />
      <Card>
        <ActivityList entries={entries} />
      </Card>
    </Page>
  );
}
