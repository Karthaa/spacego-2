import { Skeleton } from "@/components/ui/Skeleton";

// Renders inside OwnerShell's content area, so only the page content is drawn.
export default function OwnerLoading() {
  return (
    <div className="space-y-8" aria-busy="true">
      <span className="sr-only" role="status">
        Loading host dashboard
      </span>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-5 w-72 max-w-full" />
        </div>
        <Skeleton className="h-11 w-36" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((n) => (
          <div key={n} className="space-y-3 rounded-lg border border-line bg-surface p-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-16" />
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-line bg-surface">
        <div className="border-b border-line p-4">
          <Skeleton className="h-5 w-40" />
        </div>
        {[0, 1, 2, 3, 4].map((n) => (
          <div key={n} className="flex items-center gap-4 border-b border-line p-4 last:border-b-0">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-4 w-1/4" />
            </div>
            <Skeleton className="hidden h-5 w-24 md:block" />
            <Skeleton className="h-6 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
