import type { Metadata } from "next";
import { BellOff } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/time";
import { markNotificationsRead } from "@/app/actions/account";
import { EmptyState, Page, PageTitle, buttonClass, cx } from "@/components/ui";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await requireUser();
  const items = await db.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const hasUnread = items.some((n) => !n.readAt);

  return (
    <Page>
      <PageTitle
        title="Notifications"
        action={
          hasUnread && (
            <form action={markNotificationsRead}>
              <button className={buttonClass("ghost", "sm")}>Mark all read</button>
            </form>
          )
        }
      />
      {items.length === 0 ? (
        <EmptyState icon={<BellOff className="h-8 w-8" />} title="No notifications yet" />
      ) : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li
              key={n.id}
              className={cx("rounded-2xl border p-3", n.readAt ? "border-gray-200 bg-white" : "border-brand-200 bg-brand-50")}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-bold text-gray-900">{n.title}</p>
                {!n.readAt && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" aria-label="Unread" />}
              </div>
              <p className="text-sm text-gray-700">{n.body}</p>
              <p className="mt-1 text-xs text-gray-400">{formatDateTime(n.createdAt)}</p>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
