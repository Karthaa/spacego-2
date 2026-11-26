import { Navbar } from "@/components/navigation/Navbar";
import { Skeleton, SpaceCardSkeleton } from "@/components/ui/Skeleton";

export default function SpacesLoading() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <Navbar />
      <main id="main" className="flex-1" aria-busy="true">
        <span className="sr-only" role="status">
          Loading workspaces
        </span>

        <div className="border-b border-line bg-surface">
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
            <Skeleton className="h-12 w-full" />
            <div className="mt-3 flex gap-2 overflow-hidden pb-1">
              {[24, 28, 32, 28, 24, 28].map((w, i) => (
                <Skeleton key={i} className="h-9 shrink-0 rounded-md" style={{ width: `${w * 4}px` }} />
              ))}
            </div>
          </div>
        </div>

        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[17rem_1fr] lg:px-8">
          <div className="hidden space-y-6 lg:block">
            {[0, 1, 2].map((n) => (
              <div key={n} className="space-y-3">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-11 w-full" />
                <Skeleton className="h-11 w-full" />
              </div>
            ))}
          </div>

          <div className="min-w-0">
            <div className="mb-6 flex items-center justify-between gap-4">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-11 w-24" />
            </div>
            <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <SpaceCardSkeleton key={n} />
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
