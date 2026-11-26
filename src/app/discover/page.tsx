"use client";

import React, { Suspense, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Building2, Info, List, Map as MapIcon, SlidersHorizontal } from "lucide-react";
import { Navbar } from "@/components/navigation/Navbar";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { fieldClasses } from "@/components/ui/Input";
import { DemandRequestModal } from "@/components/common/DemandRequestModal";
import { LocationSearch } from "@/components/discover/LocationSearch";
import { NearbyCard } from "@/components/discover/NearbyCard";
import { SpaceGoStore, type NearbySearchResult, type NearbySort, type PriceUnit } from "@/lib/data/store";
import { useSpaceGoVersion } from "@/context/SpaceGoDataProvider";
import { CATEGORIES } from "@/lib/categories";
import {
  DEFAULT_RADIUS_KM,
  MAX_RADIUS_M,
  RADIUS_OPTIONS_KM,
  parseCenter,
  parseRadius,
  type SearchCenter,
} from "@/lib/geo";
import { useGeolocation } from "@/lib/geo/useGeolocation";
import { cn } from "@/lib/utils";
import type { WorkspaceCategory } from "@/types";

const DiscoverMap = dynamic(() => import("@/components/discover/DiscoverMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full skeleton-shimmer" aria-hidden="true" />,
});

const PAGE_SIZE = 24;
const POPULAR_AREAS: SearchCenter[] = [
  { label: "Kakkanad, Kochi", lat: 10.0159, lng: 76.3419, source: "place" },
  { label: "Edappally, Kochi", lat: 10.0261, lng: 76.3086, source: "place" },
  { label: "MG Road, Kochi", lat: 9.9706, lng: 76.2856, source: "place" },
  { label: "Vyttila, Kochi", lat: 9.9674, lng: 76.3203, source: "place" },
  { label: "Fort Kochi", lat: 9.9658, lng: 76.2421, source: "place" },
];

interface Filters {
  categories: WorkspaceCategory[];
  unit: PriceUnit | null;
  min: string;
  max: string;
  seats: string;
  verified: boolean;
  instant: boolean;
  amenities: string[];
}

const SORTS: { id: NearbySort; label: string }[] = [
  { id: "distance", label: "Nearest first" },
  { id: "price_asc", label: "Price: low to high" },
  { id: "price_desc", label: "Price: high to low" },
  { id: "newest", label: "Newest" },
];

function readFilters(p: URLSearchParams): Filters {
  const cats = (p.get("cat") ?? "").split(",").filter((c) => CATEGORIES.some((x) => x.id === c)) as WorkspaceCategory[];
  const unit = p.get("unit");
  const num = (k: string) => {
    const v = p.get(k);
    return v && Number(v) > 0 ? String(Number(v)) : "";
  };
  return {
    categories: cats,
    unit: unit === "hourly" || unit === "daily" || unit === "monthly" ? unit : null,
    min: num("min"),
    max: num("max"),
    seats: num("seats"),
    verified: p.get("verified") === "1",
    instant: p.get("instant") === "1",
    amenities: (p.get("amen") ?? "").split("|").filter(Boolean).slice(0, 20),
  };
}

function readSort(p: URLSearchParams): NearbySort {
  const s = p.get("sort");
  return SORTS.some((x) => x.id === s) ? (s as NearbySort) : "distance";
}

function activeCount(f: Filters): number {
  return (
    (f.unit ? 1 : 0) +
    (f.min || f.max ? 1 : 0) +
    (f.seats ? 1 : 0) +
    (f.verified ? 1 : 0) +
    (f.instant ? 1 : 0) +
    f.amenities.length
  );
}

export default function DiscoverPage() {
  return (
    <Suspense fallback={<DiscoverShell />}>
      <DiscoverContent />
    </Suspense>
  );
}

function DiscoverShell() {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <Navbar />
      <main id="main" className="flex-1">
        <h1 className="sr-only">Workspaces near you</h1>
      </main>
    </div>
  );
}

function DiscoverContent() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const paramsKey = params.toString();
  const dataVersion = useSpaceGoVersion();
  const geo = useGeolocation();
  const isDemo = !SpaceGoStore.isRemoteEnabled();

  const center = useMemo(() => parseCenter(new URLSearchParams(paramsKey)), [paramsKey]);
  const radiusKm = useMemo(() => parseRadius(new URLSearchParams(paramsKey)), [paramsKey]);
  const customRadiusM = useMemo(() => {
    const p = new URLSearchParams(paramsKey);
    const rm = Number(p.get("rm"));
    return p.get("src") === "map" && rm >= 500 && rm <= MAX_RADIUS_M ? Math.round(rm) : null;
  }, [paramsKey]);
  const radiusM = customRadiusM ?? radiusKm * 1000;
  const filters = useMemo(() => readFilters(new URLSearchParams(paramsKey)), [paramsKey]);
  const sort = useMemo(() => readSort(new URLSearchParams(paramsKey)), [paramsKey]);
  const view = params.get("view") === "map" ? "map" : "list";

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [demandOpen, setDemandOpen] = useState(false);
  const [pages, setPages] = useState(1);
  const cardRefs = useRef(new Map<string, HTMLElement>());

  /** Write state to the URL (the URL is the source of truth). */
  const update = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(paramsKey);
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "") next.delete(k);
        else next.set(k, v);
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [paramsKey, pathname, router]
  );

  const setCenter = useCallback(
    (c: SearchCenter, radius?: { rm: number }) => {
      setSelectedId(null);
      setPages(1);
      update({
        lat: c.lat.toFixed(5),
        lng: c.lng.toFixed(5),
        near: c.label,
        src: c.source === "place" ? null : c.source,
        rm: radius ? String(radius.rm) : null,
        r: radius || radiusKm === DEFAULT_RADIUS_KM ? null : String(radiusKm),
      });
    },
    [radiusKm, update]
  );

  const setFilters = useCallback(
    (f: Filters) => {
      setPages(1);
      update({
        cat: f.categories.join(",") || null,
        unit: f.unit,
        min: f.min || null,
        max: f.max || null,
        seats: f.seats || null,
        verified: f.verified ? "1" : null,
        instant: f.instant ? "1" : null,
        amen: f.amenities.join("|") || null,
      });
    },
    [update]
  );

  const useMyLocation = async () => {
    const pos = await geo.locate();
    if (pos) setCenter({ ...pos, label: "Your location", source: "device" });
  };

  // ---- Search -------------------------------------------------------------
  const requestKey = center
    ? JSON.stringify([center.lat, center.lng, radiusM, filters, sort, pages, dataVersion])
    : null;
  const [response, setResponse] = useState<{
    key: string;
    result: { ok: true; data: NearbySearchResult } | { ok: false; error: string };
  } | null>(null);

  useEffect(() => {
    if (!center || !requestKey) return;
    let cancelled = false;
    SpaceGoStore.searchNearby({
      center,
      radiusM,
      categories: filters.categories,
      priceUnit: filters.unit,
      minPrice: filters.min ? Number(filters.min) : null,
      maxPrice: filters.max ? Number(filters.max) : null,
      amenities: filters.amenities,
      minCapacity: filters.seats ? Number(filters.seats) : null,
      verifiedOnly: filters.verified,
      instantOnly: filters.instant,
      sort,
      limit: Math.min(PAGE_SIZE * pages, 50),
      offset: 0,
    }).then((result) => {
      if (!cancelled) setResponse({ key: requestKey, result });
    });
    return () => {
      cancelled = true;
    };
    // requestKey captures every input above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  const loading = Boolean(center) && response?.key !== requestKey;
  const result = response?.result;
  const data = result?.ok ? result.data : null;
  // Keep showing the previous results while a new search loads.
  const [shown, setShown] = useState<NearbySearchResult | null>(null);
  if (data && data !== shown) setShown(data);
  const items = useMemo(() => (center ? shown?.items ?? [] : []), [center, shown]);
  const total = center ? shown?.total ?? 0 : 0;
  const error = result && !result.ok && !loading ? result.error : null;

  // Amenity options come from the current results (plus any already chosen).
  const amenityOptions = useMemo(() => {
    const counts = new Map<string, number>();
    items.forEach((i) => i.space.amenities.forEach((a) => counts.set(a, (counts.get(a) ?? 0) + 1)));
    filters.amenities.forEach((a) => counts.set(a, counts.get(a) ?? 0));
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 14).map(([a]) => a);
  }, [items, filters.amenities]);

  const selectFromMap = useCallback((id: string | null) => {
    setSelectedId(id);
    if (!id) return;
    const el = cardRefs.current.get(id);
    if (el && window.matchMedia("(min-width: 1024px)").matches) {
      el.scrollIntoView({ block: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }
  }, []);

  const frameKey = center ? `${center.lat},${center.lng},${radiusM}` : "none";
  const selectedItem = items.find((i) => i.space.id === selectedId) ?? null;
  const filterCount = activeCount(filters);
  const nextRadius = RADIUS_OPTIONS_KM.find((r) => r * 1000 > radiusM);

  const place =
    center?.source === "device" ? "you" : center?.source === "map" ? "the map centre" : center?.label ?? "";
  const summary = !center ? null : loading && !shown ? (
    "Searching…"
  ) : (
    <>
      <span className="font-semibold text-ink tabular-nums">{total}</span> {total === 1 ? "space" : "spaces"}{" "}
      {customRadiusM ? (
        "in this map area"
      ) : (
        <>
          within {radiusKm} km of <span className="font-medium text-ink">{place}</span>
        </>
      )}
    </>
  );

  // ---- Render -------------------------------------------------------------
  if (!center) {
    return (
      <div className="flex min-h-dvh flex-col bg-canvas">
        <Navbar />
        <main id="main" className="flex flex-1 items-start justify-center px-4 pb-16 pt-14 sm:pt-24">
          <div className="w-full max-w-xl">
            <p className="text-sm font-semibold text-accent">Find a workspace</p>
            <h1 className="mt-2 text-balance text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              Where do you want to work?
            </h1>
            <p className="mt-3 text-pretty text-base text-ink-muted">
              Search an area or use your location. We&apos;ll show desks, meeting rooms and offices nearby, on a list
              and a map.
            </p>
            <LocationSearch
              className="mt-8"
              size="lg"
              value=""
              autoFocus
              onPick={(c) => setCenter(c)}
              onUseMyLocation={useMyLocation}
              geoStatus={geo.status}
            />
            {geo.message && (
              <p className="mt-3 text-sm text-warning" role="alert">{geo.message}</p>
            )}
            <div className="mt-8">
              <h2 className="text-sm font-medium text-ink-muted">Popular in Kochi</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {POPULAR_AREAS.map((a) => (
                  <li key={a.label}>
                    <button
                      type="button"
                      onClick={() => setCenter(a)}
                      className="h-10 rounded-full border border-line-strong bg-surface px-4 text-sm font-medium text-ink transition-[background-color,transform] duration-150 hover:bg-surface-muted active:scale-[0.97] pointer-coarse:h-11"
                    >
                      {a.label.replace(", Kochi", "")}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <p className="mt-10 flex items-start gap-2 text-sm text-ink-muted">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              Your location is only used when you press Near me, only for this search, and is never saved.
            </p>
            <p className="mt-3 text-sm text-ink-muted">
              Prefer to browse?{" "}
              <Link href="/spaces" className="rounded-sm font-medium text-accent hover:underline">See all spaces</Link>
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    // Large screens and the small-screen map view are app-like: the page is
    // exactly one viewport tall and only the results list scrolls.
    <div className={cn("flex min-h-dvh flex-col bg-canvas lg:h-dvh lg:overflow-hidden", view === "map" && "h-dvh overflow-hidden")}>
      <Navbar />
      <main id="main" className="flex min-h-0 flex-1 flex-col">
        <h1 className="sr-only">Workspaces near {place}</h1>

        {/* Search controls */}
        <div className="border-b border-line bg-surface">
          <div className="px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex gap-2">
              <LocationSearch
                className="min-w-0 flex-1 lg:max-w-xl"
                value={center.source === "map" ? "" : center.label}
                onPick={(c) => setCenter(c)}
                onUseMyLocation={useMyLocation}
                geoStatus={geo.status}
              />
              <Button
                variant="outline"
                size="lg"
                className="h-12 shrink-0 px-3.5 sm:px-5"
                onClick={() => setFiltersOpen(true)}
                aria-label={filterCount > 0 ? `Filters, ${filterCount} active` : "Filters"}
              >
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Filters</span>
                {filterCount > 0 && (
                  <span className="rounded-sm bg-accent px-1.5 text-xs font-semibold text-accent-ink tabular-nums">{filterCount}</span>
                )}
              </Button>
            </div>
            {geo.message && <p className="mt-2 text-sm text-warning" role="alert">{geo.message}</p>}

            <div className="-mx-4 mt-3 flex items-center gap-2 overflow-x-auto px-4 pb-0.5 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
              <div role="group" aria-label="Distance" className="flex shrink-0 rounded-full border border-line-strong p-0.5">
                {RADIUS_OPTIONS_KM.map((r) => {
                  const active = !customRadiusM && r === radiusKm;
                  return (
                    <button
                      key={r}
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        setPages(1);
                        update({ r: r === DEFAULT_RADIUS_KM ? null : String(r), rm: null });
                      }}
                      className={cn(
                        "h-9 whitespace-nowrap rounded-full px-3 text-sm font-medium tabular-nums transition-colors pointer-coarse:h-10",
                        active ? "bg-ink text-surface" : "text-ink hover:bg-surface-muted"
                      )}
                    >
                      {r} km
                    </button>
                  );
                })}
              </div>
              <span className="mx-1 h-6 w-px shrink-0 bg-line" aria-hidden="true" />
              <ul className="flex shrink-0 gap-2" aria-label="Type of space">
                {[{ id: "all" as const, label: "All types" }, ...CATEGORIES].map((c) => {
                  const active = c.id === "all" ? filters.categories.length === 0 : filters.categories.includes(c.id);
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        aria-pressed={active}
                        onClick={() =>
                          setFilters({
                            ...filters,
                            categories:
                              c.id === "all"
                                ? []
                                : filters.categories.includes(c.id)
                                  ? filters.categories.filter((x) => x !== c.id)
                                  : [...filters.categories, c.id],
                          })
                        }
                        className={cn(
                          "h-10 whitespace-nowrap rounded-full border px-4 text-sm font-medium transition-colors pointer-coarse:h-11",
                          active ? "border-ink bg-ink text-surface" : "border-line-strong bg-surface text-ink hover:bg-surface-muted"
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

        {isDemo && (
          <div className="border-b border-line bg-warning-soft px-4 py-2.5 text-sm text-warning sm:px-6 lg:px-8" role="note">
            <strong className="font-semibold">Sample data.</strong> No database is connected, so these are sample listings,
            not real workspaces.
          </div>
        )}

        <div className="relative grid min-h-0 flex-1 grid-cols-1 grid-rows-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,7fr)_minmax(0,6fr)]">
          {/* Results list */}
          <section
            aria-labelledby="results-heading"
            className={cn(
              "min-w-0 px-4 pb-28 pt-5 sm:px-6 lg:h-full lg:overflow-y-auto lg:overscroll-contain lg:px-8 lg:pb-12",
              view === "map" && "hidden lg:block"
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 id="results-heading" className="text-base text-ink-muted" aria-live="polite">
                  {summary}
                </h2>
                <p className="mt-0.5 text-sm text-ink-subtle">Approximate locations · straight-line distances</p>
              </div>
              <SortSelect value={sort} onChange={(s) => update({ sort: s === "distance" ? null : s })} />
            </div>

            <div className={cn("mt-5 transition-opacity duration-150", loading && shown && "opacity-60")} aria-busy={loading}>
              {error ? (
                <EmptyState
                  icon={<Building2 />}
                  title="Location search isn't available"
                  description={error}
                  action={
                    <Link href="/spaces" className="inline-flex h-11 items-center rounded-md bg-accent px-5 text-sm font-semibold text-accent-ink hover:bg-accent-hover">
                      Browse all spaces
                    </Link>
                  }
                />
              ) : loading && !shown ? (
                <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2" aria-label="Loading results">
                  {[1, 2, 3, 4].map((n) => (
                    <li key={n} className="h-72 rounded-lg skeleton-shimmer lg:h-40 xl:h-72" />
                  ))}
                </ul>
              ) : items.length === 0 ? (
                <EmptyState
                  icon={<Building2 />}
                  title={`Nothing within ${customRadiusM ? "this area" : `${radiusKm} km`}`}
                  description={
                    filterCount + filters.categories.length > 0
                      ? "No spaces here match your filters. Try removing some, or search a wider area."
                      : "There are no published spaces here yet. Try a wider area, or tell us what you need and we'll look for it."
                  }
                  action={
                    <div className="flex flex-col gap-2 sm:flex-row">
                      {nextRadius && (
                        <Button variant="outline" onClick={() => update({ r: String(nextRadius), rm: null })}>
                          Search within {nextRadius} km
                        </Button>
                      )}
                      {filterCount + filters.categories.length > 0 && (
                        <Button variant="outline" onClick={() => setFilters({ ...readFilters(new URLSearchParams()) })}>
                          Clear filters
                        </Button>
                      )}
                      <Button onClick={() => setDemandOpen(true)}>Request a space</Button>
                    </div>
                  }
                />
              ) : (
                <>
                  <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                    {items.map((item) => (
                      <li key={item.space.id}>
                        <NearbyCard
                          ref={(el) => {
                            if (el) cardRefs.current.set(item.space.id, el);
                            else cardRefs.current.delete(item.space.id);
                          }}
                          item={item}
                          selected={item.space.id === selectedId}
                          hovered={item.space.id === hoveredId}
                          onHover={setHoveredId}
                        />
                      </li>
                    ))}
                  </ul>
                  {items.length < total && items.length < 50 && (
                    <div className="mt-8 flex justify-center">
                      <Button variant="outline" onClick={() => setPages((p) => p + 1)} isLoading={loading}>
                        Show more
                      </Button>
                    </div>
                  )}
                  {items.length >= 50 && total > 50 && (
                    <p className="mt-8 text-center text-sm text-ink-muted">
                      Showing the nearest 50. Narrow the distance or add filters to see others.
                    </p>
                  )}
                </>
              )}
            </div>
          </section>

          {/* Map */}
          <div
            className={cn(
              "relative lg:block lg:h-full lg:border-l lg:border-line",
              view === "map" ? "block h-full" : "hidden"
            )}
          >
            <DiscoverMap
              items={items}
              center={center}
              radiusM={radiusM}
              selectedId={selectedId}
              hoveredId={hoveredId}
              onSelect={selectFromMap}
              onSearchArea={(c, rm) => setCenter({ ...c, label: "Map area", source: "map" }, { rm })}
              frameKey={frameKey}
            />

            {/* Small screens: preview of the tapped pin */}
            {view === "map" && selectedItem && (
              <div className="absolute inset-x-3 bottom-20 z-20 animate-sheet-in lg:hidden">
                <NearbyCard item={selectedItem} layout="row" selected onClose={() => setSelectedId(null)} />
              </div>
            )}
          </div>

          {/* Small screens: list/map switch */}
          <div className="pointer-events-none fixed inset-x-0 bottom-5 z-30 flex justify-center lg:hidden">
            <button
              type="button"
              onClick={() => {
                setSelectedId(null);
                update({ view: view === "map" ? null : "map" });
              }}
              className="pointer-events-auto inline-flex h-12 items-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-surface shadow-md transition-transform duration-150 active:scale-[0.97]"
            >
              {view === "map" ? (
                <>
                  <List className="h-4 w-4" aria-hidden="true" /> Show list
                </>
              ) : (
                <>
                  <MapIcon className="h-4 w-4" aria-hidden="true" /> Show map
                </>
              )}
            </button>
          </div>
        </div>
      </main>

      <Modal isOpen={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filters" maxWidth="md">
        <FilterForm
          initial={filters}
          amenityOptions={amenityOptions}
          onApply={(f) => {
            setFilters(f);
            setFiltersOpen(false);
          }}
        />
      </Modal>

      <DemandRequestModal
        isOpen={demandOpen}
        onClose={() => setDemandOpen(false)}
        defaultLocation={center.source === "place" ? center.label : ""}
        defaultCategory={filters.categories.length === 1 ? filters.categories[0] : "all"}
      />
    </div>
  );
}

function SortSelect({ value, onChange }: { value: NearbySort; onChange: (s: NearbySort) => void }) {
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="sr-only">Sort by</label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as NearbySort)}
        className={cn(fieldClasses, "h-10 w-auto cursor-pointer text-sm")}
      >
        {SORTS.map((s) => (
          <option key={s.id} value={s.id}>{s.label}</option>
        ))}
      </select>
    </div>
  );
}

function FilterForm({
  initial,
  amenityOptions,
  onApply,
}: {
  initial: Filters;
  amenityOptions: string[];
  onApply: (f: Filters) => void;
}) {
  const [f, setF] = useState<Filters>(initial);
  const uid = useId();
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setF((prev) => ({ ...prev, [k]: v }));
  const legend = "mb-2 text-sm font-semibold text-ink";

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        onApply(f);
      }}
    >
      <fieldset>
        <legend className={legend}>Booking length</legend>
        <div className="grid grid-cols-2 gap-2">
          {([null, "hourly", "daily", "monthly"] as const).map((u) => (
            <button
              key={u ?? "any"}
              type="button"
              aria-pressed={f.unit === u}
              onClick={() => set("unit", u)}
              className={cn(
                "h-11 rounded-md border text-sm font-medium transition-colors",
                f.unit === u
                  ? "border-accent bg-accent-soft text-accent-soft-ink"
                  : "border-line-strong bg-surface text-ink hover:bg-surface-muted"
              )}
            >
              {u === null ? "Any" : u === "hourly" ? "By the hour" : u === "daily" ? "By the day" : "By the month"}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className={legend}>Price {f.unit ? `per ${f.unit === "hourly" ? "hour" : f.unit === "daily" ? "day" : "month"}` : ""}</legend>
        <div className="grid grid-cols-2 gap-2">
          {(["min", "max"] as const).map((k) => (
            <div key={k}>
              <label htmlFor={`${uid}-${k}`} className="mb-1 block text-sm text-ink-muted">{k === "min" ? "Min" : "Max"}</label>
              <input
                id={`${uid}-${k}`}
                type="number"
                inputMode="numeric"
                min={0}
                value={f[k]}
                onChange={(e) => set(k, e.target.value)}
                placeholder={k === "min" ? "0" : "Any"}
                className={cn(fieldClasses, "h-11")}
              />
            </div>
          ))}
        </div>
        {!f.unit && <p className="mt-1.5 text-sm text-ink-muted">Compared with the daily rate, or hourly or monthly when there is no daily rate.</p>}
      </fieldset>

      <div>
        <label htmlFor={`${uid}-seats`} className={cn(legend, "block")}>People</label>
        <input
          id={`${uid}-seats`}
          type="number"
          inputMode="numeric"
          min={1}
          value={f.seats}
          onChange={(e) => set("seats", e.target.value)}
          placeholder="Any number"
          className={cn(fieldClasses, "h-11")}
        />
      </div>

      <div className="space-y-1">
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-base text-ink">
          <input
            type="checkbox"
            checked={f.verified}
            onChange={(e) => set("verified", e.target.checked)}
            className="h-5 w-5 rounded-sm border-line-strong accent-accent"
          />
          Reviewed by SpaceGo only
        </label>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-base text-ink">
          <input
            type="checkbox"
            checked={f.instant}
            onChange={(e) => set("instant", e.target.checked)}
            className="h-5 w-5 rounded-sm border-line-strong accent-accent"
          />
          Instant Book only
        </label>
      </div>

      {amenityOptions.length > 0 && (
        <fieldset>
          <legend className={legend}>Amenities</legend>
          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            {amenityOptions.map((a) => (
              <label key={a} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={f.amenities.includes(a)}
                  onChange={() =>
                    set("amenities", f.amenities.includes(a) ? f.amenities.filter((x) => x !== a) : [...f.amenities, a])
                  }
                  className="h-5 w-5 shrink-0 rounded-sm border-line-strong accent-accent"
                />
                <span>{a}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="sticky bottom-0 -mx-5 flex gap-2 border-t border-line bg-surface px-5 pt-4 sm:-mx-6 sm:px-6">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={() => setF({ ...initial, unit: null, min: "", max: "", seats: "", verified: false, instant: false, amenities: [] })}
        >
          Clear
        </Button>
        <Button type="submit" className="flex-1">Show results</Button>
      </div>
    </form>
  );
}
