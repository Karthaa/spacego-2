import { Skeleton } from "@/components/ui/Skeleton";

// Renders inside AdminShell's content area, so only the page content is drawn.
export default function AdminLoading() {
  return (
    <div className="space-y-8" aria-busy="true">
      <span className="sr-only" role="status">
        Loading administration
      </span>

      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-5 w-80 max-w-full" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((n) => (
          <div key={n} className="space-y-3 rounded-lg border border-line bg-surface p-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-16" />
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <div className="flex gap-1">
          {[0, 1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-9 w-24" />
          ))}
        </div>
        <div className="rounded-lg border border-line bg-surface">
          {[0, 1, 2, 3, 4, 5].map((n) => (
            <div key={n} className="flex items-center gap-4 border-b border-line p-4 last:border-b-0">
              <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-4 w-1/3" />
              </div>
              <Skeleton className="hidden h-5 w-28 md:block" />
              <Skeleton className="h-9 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
