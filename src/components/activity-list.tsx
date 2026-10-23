import { formatDateTime } from "@/lib/time";

type Entry = {
  id: string;
  action: string;
  details: string | null;
  createdAt: Date;
  actor: { firstName: string; lastName: string } | null;
};

/** "supermarket.delivery_paused" → "Supermarket delivery paused" */
function describe(action: string) {
  const text = action.replace(/[._]/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function ActivityList({ entries }: { entries: Entry[] }) {
  if (entries.length === 0) return <p className="text-sm text-gray-500">No activity yet.</p>;
  return (
    <ul className="divide-y divide-gray-100 text-sm">
      {entries.map((e) => (
        <li key={e.id} className="py-2">
          <p className="font-medium text-gray-900">{describe(e.action)}</p>
          <p className="text-xs text-gray-500">
            {e.actor ? `${e.actor.firstName} ${e.actor.lastName}` : "System"} · {formatDateTime(e.createdAt)}
            {e.details && !/^\d{4}-\d\d-\d\dT/.test(e.details) && ` · ${e.details}`}
          </p>
        </li>
      ))}
    </ul>
  );
}
