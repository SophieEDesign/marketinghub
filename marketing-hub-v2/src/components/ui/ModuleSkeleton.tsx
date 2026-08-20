export function ModuleSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-6 p-1">
      <div className="space-y-2">
        <div className="h-9 w-48 rounded-md bg-sand" />
        <div className="h-4 w-96 max-w-full rounded bg-sand/80" />
      </div>
      <div className="flex gap-2">
        <div className="h-9 w-24 rounded-lg bg-sand" />
        <div className="h-9 w-24 rounded-lg bg-sand" />
        <div className="h-9 w-24 rounded-lg bg-sand" />
      </div>
      <div className="surface-card space-y-3 p-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-10 rounded bg-sand/70" />
        ))}
      </div>
    </div>
  );
}
