import { Skeleton } from "@/components/ui/Skeleton";

// Renders inside DashboardShell's <main>, so only the page content is drawn.
export default function DashboardLoading() {
  return (
    <div className="space-y-8" aria-busy="true">
      <span className="sr-only" role="status">
        Loading your dashboard
      </span>

      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-5 w-full max-w-md" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((n) => (
          <div key={n} className="space-y-3 rounded-lg border border-line bg-surface p-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-16" />
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-line bg-surface">
        {[0, 1, 2, 3].map((n) => (
          <div key={n} className="flex items-center gap-4 border-b border-line p-4 last:border-b-0">
            <Skeleton className="h-14 w-20 shrink-0 rounded-md" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
            </div>
            <Skeleton className="hidden h-6 w-20 sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
