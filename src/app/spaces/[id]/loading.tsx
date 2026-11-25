import { Navbar } from "@/components/navigation/Navbar";
import { Skeleton } from "@/components/ui/Skeleton";

export default function SpaceDetailLoading() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <Navbar />
      <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8" aria-busy="true">
        <span className="sr-only" role="status">
          Loading workspace
        </span>

        <Skeleton className="my-3.5 h-4 w-24" />

        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1 space-y-3">
            <Skeleton className="h-8 w-full max-w-lg" />
            <Skeleton className="h-5 w-56" />
          </div>
          <div className="flex shrink-0 gap-2">
            <Skeleton className="h-11 w-24" />
            <Skeleton className="h-11 w-24" />
          </div>
        </div>

        <div className="mt-6 grid gap-2 overflow-hidden rounded-lg md:h-[28rem] md:grid-cols-4 md:grid-rows-2">
          <Skeleton className="aspect-[4/3] rounded-none md:col-span-2 md:row-span-2 md:aspect-auto" />
          <Skeleton className="hidden rounded-none md:block" />
          <Skeleton className="hidden rounded-none md:block" />
          <Skeleton className="hidden rounded-none md:block" />
          <Skeleton className="hidden rounded-none md:block" />
        </div>

        <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_24rem]">
          <div className="min-w-0 space-y-8">
            <div className="space-y-3 border-b border-line pb-8">
              <Skeleton className="h-6 w-64" />
              <Skeleton className="h-5 w-80 max-w-full" />
            </div>
            <div className="space-y-2.5">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-4 w-2/3" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <Skeleton key={n} className="h-5 w-3/4" />
              ))}
            </div>
          </div>

          <div className="h-fit space-y-4 rounded-lg border border-line bg-surface p-6">
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-11 w-full" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
            </div>
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </main>
    </div>
  );
}
