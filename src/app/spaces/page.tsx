"use client";

import React, { useId, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { LayoutGrid, List, MapPin, Search, SlidersHorizontal, X, Building2 } from "lucide-react";
import { Navbar } from "@/components/navigation/Navbar";
import { Footer } from "@/components/navigation/Footer";
import { SpaceCard, headlinePrice } from "@/components/common/SpaceCard";
import { DemandRequestModal } from "@/components/common/DemandRequestModal";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { SpaceCardSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { fieldClasses } from "@/components/ui/Input";
import { SpaceGoStore } from "@/lib/data/store";
import { useSpaceGoVersion } from "@/context/SpaceGoDataProvider";
import { CATEGORIES } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { Space, WorkspaceCategory, VerificationLevel } from "@/types";

type SortKey = "recommended" | "price_asc" | "price_desc" | "capacity";
type Duration = "all" | "hourly" | "daily" | "monthly";

interface Filters {
  category: WorkspaceCategory | "all";
  duration: Duration;
  minPrice: string;
  maxPrice: string;
  minSeats: string;
  verification: VerificationLevel | "all";
  amenities: string[];
  instantOnly: boolean;
}

const EMPTY_FILTERS: Filters = {
  category: "all",
  duration: "all",
  minPrice: "",
  maxPrice: "",
  minSeats: "",
  verification: "all",
  amenities: [],
  instantOnly: false,
};

export default function SpacesPage() {
  return (
    <Suspense fallback={<SpacesFallback />}>
      <SpacesContent />
    </Suspense>
  );
}

function SpacesFallback() {
  return (
    <main
      id="main"
      className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-3 lg:px-8"
    >
      <h1 className="sr-only">Find a workspace</h1>
      {[1, 2, 3].map((n) => (
        <SpaceCardSkeleton key={n} />
      ))}
    </main>
  );
}

function filtersFromParams(params: URLSearchParams): Filters {
  const cat = params.get("category");
  const seats = params.get("seats");
  return {
    ...EMPTY_FILTERS,
    category: CATEGORIES.some((c) => c.id === cat) ? (cat as WorkspaceCategory) : "all",
    minSeats: seats && Number(seats) > 0 ? seats : "",
  };
}

function SpacesContent() {
  const searchParams = useSearchParams();
  const dataVersion = useSpaceGoVersion();

  const spaces = useMemo<Space[]>(() => {
    void dataVersion;
    return SpaceGoStore.getPublishedSpaces();
  }, [dataVersion]);
  const isLoading = useMemo(() => {
    void dataVersion;
    return SpaceGoStore.isLoading() && spaces.length === 0;
  }, [dataVersion, spaces.length]);

  const [query, setQuery] = useState(searchParams.get("location") || "");
  const [filters, setFilters] = useState<Filters>(() => filtersFromParams(searchParams));
  const [sortBy, setSortBy] = useState<SortKey>("recommended");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showLocations, setShowLocations] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [isDemandModalOpen, setIsDemandModalOpen] = useState(false);

  // Sync from the URL when it changes (adjusting state during render rather
  // than in an effect avoids a cascading re-render).
  const paramsKey = searchParams.toString();
  const [syncedParamsKey, setSyncedParamsKey] = useState(paramsKey);
  if (paramsKey !== syncedParamsKey) {
    setSyncedParamsKey(paramsKey);
    setQuery(searchParams.get("location") || "");
    setFilters(filtersFromParams(searchParams));
  }

  // Amenity filter options come from the real listings, most common first.
  const amenityOptions = useMemo(() => {
    const counts = new Map<string, number>();
    spaces.forEach((s) => s.amenities.forEach((a) => counts.set(a, (counts.get(a) ?? 0) + 1)));
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 12)
      .map(([name]) => name);
  }, [spaces]);

  const results = useMemo(() => {
    const q = query.toLowerCase().trim();
    const priceOf = (s: Space) => headlinePrice(s)?.amount ?? 0;

    return spaces
      .filter((space) => {
        if (q) {
          const haystack = [
            space.location.city,
            space.location.address,
            space.location.country,
            space.location.landmark ?? "",
            space.title,
            space.headline,
          ].join(" ").toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        if (filters.category !== "all" && space.category !== filters.category) return false;
        if (filters.verification !== "all" && space.verification_level !== filters.verification) return false;
        if (filters.minSeats !== "" && space.capacity < Number(filters.minSeats)) return false;
        if (filters.instantOnly && !space.instant_book) return false;

        const price = priceOf(space);
        if (filters.minPrice !== "" && price < Number(filters.minPrice)) return false;
        if (filters.maxPrice !== "" && price > Number(filters.maxPrice)) return false;

        if (filters.duration === "hourly" && !space.pricing.hourly) return false;
        if (filters.duration === "daily" && !space.pricing.daily) return false;
        if (filters.duration === "monthly" && !space.pricing.monthly) return false;

        if (filters.amenities.length > 0 && !filters.amenities.every((a) => space.amenities.includes(a))) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case "price_asc":
            return priceOf(a) - priceOf(b);
          case "price_desc":
            return priceOf(b) - priceOf(a);
          case "capacity":
            return b.capacity - a.capacity;
          default:
            return (b.created_at ?? "").localeCompare(a.created_at ?? "");
        }
      });
  }, [spaces, query, filters, sortBy]);

  const activeFilterCount =
    (filters.category !== "all" ? 1 : 0) +
    (filters.duration !== "all" ? 1 : 0) +
    (filters.minPrice !== "" || filters.maxPrice !== "" ? 1 : 0) +
    (filters.minSeats !== "" ? 1 : 0) +
    (filters.verification !== "all" ? 1 : 0) +
    (filters.instantOnly ? 1 : 0) +
    filters.amenities.length;

  const locations = useMemo(() => {
    const byCity = new Map<string, number>();
    results.forEach((s) => {
      const key = [s.location.city, s.location.country].filter(Boolean).join(", ") || "Unknown location";
      byCity.set(key, (byCity.get(key) ?? 0) + 1);
    });
    return Array.from(byCity.entries()).sort((a, b) => b[1] - a[1]);
  }, [results]);

  const resetAll = () => {
    setQuery("");
    setFilters(EMPTY_FILTERS);
    setSortBy("recommended");
  };

  const filterPanel = (
    <FilterPanel filters={filters} onChange={setFilters} amenityOptions={amenityOptions} />
  );

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <Navbar />

      <main id="main" className="flex-1">
        {/* Search bar */}
        <div className="border-b border-line bg-surface">
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
            <h1 className="sr-only">Find a workspace</h1>
            <div className="flex gap-2">
              <form
                role="search"
                aria-label="Search workspaces"
                onSubmit={(e) => e.preventDefault()}
                className="relative flex-1"
              >
                <label htmlFor="spaces-search" className="sr-only">Search by city, address or name</label>
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" aria-hidden="true" />
                <input
                  id="spaces-search"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by city, address or name"
                  className={cn(fieldClasses, "h-12 pl-10 pr-11")}
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="absolute right-0.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md text-ink-subtle transition-colors hover:text-ink"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </form>
              <Button
                variant="outline"
                size="lg"
                className="lg:hidden"
                onClick={() => setFiltersOpen(true)}
                aria-label={activeFilterCount > 0 ? `Filters, ${activeFilterCount} active` : "Filters"}
              >
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Filters</span>
                {activeFilterCount > 0 && (
                  <span className="rounded-sm bg-accent px-1.5 text-xs font-semibold text-accent-ink">{activeFilterCount}</span>
                )}
              </Button>
            </div>

            {/* Category chips */}
            <div className="-mx-4 mt-3 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <ul className="flex gap-2 pb-1" aria-label="Type of space">
                {[{ id: "all" as const, label: "All spaces" }, ...CATEGORIES].map((c) => {
                  const active = filters.category === c.id;
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        aria-pressed={active}
                        onClick={() => setFilters((f) => ({ ...f, category: c.id }))}
                        className={cn(
                          "flex h-10 items-center whitespace-nowrap rounded-full border px-4 text-sm font-medium transition-colors pointer-coarse:h-11",
                          active
                            ? "border-ink bg-ink text-surface"
                            : "border-line-strong bg-surface text-ink hover:bg-surface-muted"
                        )}
                      >
                        {c.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>

        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[17rem_1fr] lg:px-8">
          {/* Desktop filters */}
          <aside aria-label="Filters" className="hidden lg:block">
            <div className="sticky top-24 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-ink">Filters</h2>
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilters(EMPTY_FILTERS)}
                    className="rounded-sm text-sm font-medium text-accent hover:underline"
                  >
                    Clear all
                  </button>
                )}
              </div>
              {filterPanel}
            </div>
          </aside>

          <section aria-labelledby="results-heading" className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="results-heading" className="text-base text-ink-muted" aria-live="polite">
                {isLoading ? "Loading spaces…" : (
                  <>
                    <span className="font-semibold text-ink">{results.length}</span>{" "}
                    {results.length === 1 ? "space" : "spaces"}
                    {query.trim() && <> matching &ldquo;{query.trim()}&rdquo;</>}
                  </>
                )}
              </h2>

              <div className="flex items-center gap-2">
                <label htmlFor="sort" className="sr-only">Sort by</label>
                <select
                  id="sort"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortKey)}
                  className={cn(fieldClasses, "h-11 w-auto cursor-pointer text-sm")}
                >
                  <option value="recommended">Newest</option>
                  <option value="price_asc">Price: low to high</option>
                  <option value="price_desc">Price: high to low</option>
                  <option value="capacity">Largest capacity</option>
                </select>

                <div className="flex rounded-md border border-line-strong bg-surface p-0.5" role="group" aria-label="Layout">
                  <ViewButton active={viewMode === "grid"} onClick={() => setViewMode("grid")} label="Grid view">
                    <LayoutGrid className="h-4 w-4" aria-hidden="true" />
                  </ViewButton>
                  <ViewButton active={viewMode === "list"} onClick={() => setViewMode("list")} label="List view">
                    <List className="h-4 w-4" aria-hidden="true" />
                  </ViewButton>
                  <ViewButton active={showLocations} onClick={() => setShowLocations((v) => !v)} label="Show locations">
                    <MapPin className="h-4 w-4" aria-hidden="true" />
                  </ViewButton>
                </div>
              </div>
            </div>

            {showLocations && !isLoading && (
              <div className="mt-6 rounded-lg border border-line bg-surface p-5">
                <h3 className="text-base font-semibold text-ink">Locations</h3>
                {locations.length === 0 ? (
                  <p className="mt-2 text-sm text-ink-muted">No locations match the current filters.</p>
                ) : (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {locations.map(([place, count]) => (
                      <li key={place}>
                        <button
                          type="button"
                          onClick={() => setQuery(place.split(",")[0])}
                          className="flex h-10 items-center gap-2 rounded-full border border-line-strong px-4 text-sm text-ink transition-colors hover:bg-surface-muted pointer-coarse:h-11"
                        >
                          <MapPin className="h-4 w-4 text-accent" aria-hidden="true" />
                          {place}
                          <span className="text-ink-muted">
                            {count}
                            <span className="sr-only"> {count === 1 ? "space" : "spaces"}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="mt-6">
              {isLoading ? (
                <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <SpaceCardSkeleton key={n} />
                  ))}
                </div>
              ) : results.length === 0 ? (
                <EmptyState
                  icon={<Building2 />}
                  title="No spaces match your search"
                  description="Try a different location or remove some filters. If nothing nearby fits, tell us what you need and we'll look for it."
                  action={
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button variant="outline" onClick={resetAll}>Clear search and filters</Button>
                      <Button onClick={() => setIsDemandModalOpen(true)}>Request a space</Button>
                    </div>
                  }
                />
              ) : (
                <ul
                  className={cn(
                    viewMode === "grid"
                      ? "grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3"
                      : "space-y-4"
                  )}
                >
                  {results.map((space) => (
                    <li key={space.id}>
                      <SpaceCard space={space} layout={viewMode} />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {!isLoading && results.length > 0 && (
              <div className="mt-12 flex flex-col items-start justify-between gap-4 rounded-lg border border-line bg-surface p-6 sm:flex-row sm:items-center">
                <div>
                  <h3 className="text-base font-semibold text-ink">Can&apos;t find what you need?</h3>
                  <p className="mt-1 text-sm text-ink-muted">Tell us the area and size and we&apos;ll look for a matching space.</p>
                </div>
                <Button variant="outline" onClick={() => setIsDemandModalOpen(true)}>Request a space</Button>
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Mobile / tablet filter sheet */}
      <Modal isOpen={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filters" maxWidth="md">
        <div className="space-y-6">
          {filterPanel}
          <div className="sticky bottom-0 -mx-5 flex gap-2 border-t border-line bg-surface px-5 pt-4 sm:-mx-6 sm:px-6">
            <Button variant="outline" className="flex-1" onClick={() => setFilters(EMPTY_FILTERS)}>
              Clear all
            </Button>
            <Button className="flex-1" onClick={() => setFiltersOpen(false)}>
              Show {results.length} {results.length === 1 ? "space" : "spaces"}
            </Button>
          </div>
        </div>
      </Modal>

      <DemandRequestModal
        isOpen={isDemandModalOpen}
        onClose={() => setIsDemandModalOpen(false)}
        defaultLocation={query}
        defaultCategory={filters.category}
      />

      <Footer />
    </div>
  );
}

function ViewButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-sm transition-colors",
        active ? "bg-surface-muted text-ink" : "text-ink-subtle hover:text-ink"
      )}
    >
      {children}
    </button>
  );
}

function FilterPanel({
  filters,
  onChange,
  amenityOptions,
}: {
  filters: Filters;
  onChange: React.Dispatch<React.SetStateAction<Filters>>;
  amenityOptions: string[];
}) {
  // The panel renders twice (desktop sidebar + mobile sheet), so ids must be
  // unique per instance or the sheet's labels point at the hidden sidebar.
  const uid = useId();
  const ids = {
    minPrice: `${uid}-min-price`,
    maxPrice: `${uid}-max-price`,
    minSeats: `${uid}-min-seats`,
    verification: `${uid}-verification`,
  };

  const set = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    onChange((f) => ({ ...f, [key]: value }));

  const legend = "mb-2 text-sm font-semibold text-ink";

  return (
    <div className="space-y-6">
      <fieldset>
        <legend className={legend}>Booking length</legend>
        <div className="grid grid-cols-2 gap-2">
          {(["all", "hourly", "daily", "monthly"] as const).map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={filters.duration === d}
              onClick={() => set("duration", d)}
              className={cn(
                "h-11 rounded-md border text-sm font-medium transition-colors",
                filters.duration === d
                  ? "border-accent bg-accent-soft text-accent-soft-ink"
                  : "border-line-strong bg-surface text-ink hover:bg-surface-muted"
              )}
            >
              {d === "all" ? "Any" : d === "hourly" ? "By the hour" : d === "daily" ? "By the day" : "By the month"}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className={legend}>Price</legend>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor={ids.minPrice} className="mb-1 block text-sm text-ink-muted">Min</label>
            <input
              id={ids.minPrice}
              type="number"
              inputMode="numeric"
              min={0}
              value={filters.minPrice}
              onChange={(e) => set("minPrice", e.target.value)}
              placeholder="0"
              className={cn(fieldClasses, "h-11")}
            />
          </div>
          <div>
            <label htmlFor={ids.maxPrice} className="mb-1 block text-sm text-ink-muted">Max</label>
            <input
              id={ids.maxPrice}
              type="number"
              inputMode="numeric"
              min={0}
              value={filters.maxPrice}
              onChange={(e) => set("maxPrice", e.target.value)}
              placeholder="Any"
              className={cn(fieldClasses, "h-11")}
            />
          </div>
        </div>
        <p className="mt-1.5 text-sm text-ink-muted">Compared against the daily rate, or hourly/monthly if no daily rate.</p>
      </fieldset>

      <div>
        <label htmlFor={ids.minSeats} className={cn(legend, "block")}>People</label>
        <input
          id={ids.minSeats}
          type="number"
          inputMode="numeric"
          min={1}
          value={filters.minSeats}
          onChange={(e) => set("minSeats", e.target.value)}
          placeholder="Any number"
          className={cn(fieldClasses, "h-11")}
        />
      </div>

      <div>
        <label htmlFor={ids.verification} className={cn(legend, "block")}>SpaceGo review</label>
        <select
          id={ids.verification}
          value={filters.verification}
          onChange={(e) => set("verification", e.target.value as VerificationLevel | "all")}
          className={cn(fieldClasses, "h-11 cursor-pointer")}
        >
          <option value="all">Any</option>
          <option value="pro">SpaceGo Pro</option>
          <option value="ready">SpaceGo Ready</option>
          <option value="checked">Reviewed by SpaceGo</option>
          <option value="listed">New listings</option>
        </select>
      </div>

      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-base text-ink">
        <input
          type="checkbox"
          checked={filters.instantOnly}
          onChange={(e) => set("instantOnly", e.target.checked)}
          className="h-5 w-5 rounded-sm border-line-strong accent-accent"
        />
        Instant Book only
      </label>

      {amenityOptions.length > 0 && (
        <fieldset>
          <legend className={legend}>Amenities</legend>
          <div className="space-y-1">
            {amenityOptions.map((amenity) => (
              <label key={amenity} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={filters.amenities.includes(amenity)}
                  onChange={() =>
                    onChange((f) => ({
                      ...f,
                      amenities: f.amenities.includes(amenity)
                        ? f.amenities.filter((a) => a !== amenity)
                        : [...f.amenities, amenity],
                    }))
                  }
                  className="h-5 w-5 shrink-0 rounded-sm border-line-strong accent-accent"
                />
                <span>{amenity}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <p className="text-sm text-ink-muted">
        Looking to list a space instead?{" "}
        <Link href="/owner/spaces/new" className="rounded-sm font-medium text-accent hover:underline">
          Become a host
        </Link>
      </p>
    </div>
  );
}
