export function Bar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-ink/[0.06] ${className}`} />;
}

/** Placeholder shown instantly while a customer page loads. */
export function CustomerPageSkeleton() {
  return (
    <div className="px-5 pt-[calc(var(--safe-top)+1.5rem)]" aria-busy="true" aria-label="Loading">
      <Bar className="h-9 w-40" />
      <Bar className="mt-3 h-4 w-60" />
      <div className="mt-6 h-72 animate-pulse rounded-[var(--radius-sheet)] bg-olive-deep/80" />
      <Bar className="mt-5 h-14 w-full rounded-full" />
      <Bar className="mt-8 h-32 w-full" />
    </div>
  );
}

/** Placeholder shown instantly while an admin or staff page loads. */
export function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Bar className="h-9 w-56" />
      <Bar className="mt-3 h-4 w-80" />
      <div className="mt-8 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Bar key={i} className="h-28" />
        ))}
      </div>
      <Bar className="mt-8 h-64 w-full" />
    </div>
  );
}
