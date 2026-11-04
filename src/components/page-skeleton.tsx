/** Shown instantly while a page loads, so taps feel responsive. */
export function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-5 p-4" role="status" aria-label="Loading">
      <div className="h-7 w-48 rounded-lg bg-gray-200" />
      <div className="h-4 w-72 max-w-full rounded bg-gray-200" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-gray-200" />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="h-20 rounded-2xl bg-gray-200" />
        ))}
      </div>
    </div>
  );
}
