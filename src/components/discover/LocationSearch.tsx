"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { Loader2, LocateFixed, MapPin, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { matchKnownPlaces } from "@/lib/geo/places";
import type { SearchCenter } from "@/lib/geo";
import type { GeoStatus } from "@/lib/geo/useGeolocation";

interface Suggestion {
  label: string;
  lat: number;
  lng: number;
  kind: "known" | "geocoder";
}

interface LocationSearchProps {
  value: string;
  onPick: (center: SearchCenter) => void;
  onUseMyLocation: () => void;
  geoStatus: GeoStatus;
  className?: string;
  /** Larger variant for the empty "where to?" state. */
  size?: "md" | "lg";
  autoFocus?: boolean;
  /** Inside another <form>: render a plain container (forms can't nest). */
  embedded?: boolean;
}

// One answer per session: once the server says no provider is configured,
// stop asking and rely on the built-in list.
let geocoderAvailable: boolean | null = null;

export function LocationSearch({
  value,
  onPick,
  onUseMyLocation,
  geoStatus,
  className,
  size = "md",
  autoFocus,
  embedded = false,
}: LocationSearchProps) {
  const uid = useId();
  const inputId = `${uid}-input`;
  const listId = `${uid}-list`;
  const [text, setText] = useState(value);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [remote, setRemote] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Follow the committed value when it changes from outside (URL, map).
  const [syncedValue, setSyncedValue] = useState(value);
  if (value !== syncedValue) {
    setSyncedValue(value);
    setText(value);
  }

  const query = text.trim();
  const known: Suggestion[] = matchKnownPlaces(query).map((p) => ({ ...p, kind: "known" }));
  const seen = new Set(known.map((k) => k.label.toLowerCase()));
  const suggestions = [...known, ...remote.filter((r) => !seen.has(r.label.toLowerCase()))].slice(0, 8);

  useEffect(() => {
    if (query.length < 2 || query === value || geocoderAvailable === false) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        if (res.status === 503) {
          geocoderAvailable = false;
          setRemote([]);
          return;
        }
        if (!res.ok) return;
        geocoderAvailable = true;
        const body = (await res.json()) as { results?: { label: string; lat: number; lng: number }[] };
        setRemote((body.results ?? []).map((r) => ({ ...r, kind: "geocoder" as const })));
      } catch {
        // Aborted or offline: the built-in suggestions still work.
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, value]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  const pick = (s: Suggestion) => {
    setText(s.label);
    setOpen(false);
    setActive(-1);
    setNotFound(false);
    onPick({ lat: s.lat, lng: s.lng, label: s.label, source: "place" });
  };

  const submit = (e: React.SyntheticEvent) => {
    e.preventDefault();
    const choice = active >= 0 ? suggestions[active] : suggestions[0];
    if (choice) pick(choice);
    else if (query.length > 0) {
      setNotFound(true);
      setOpen(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && embedded) {
      // Don't submit the surrounding form; pick the place instead.
      submit(e);
    } else if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
    }
  };

  const showList = open && query.length > 0 && (suggestions.length > 0 || loading);
  const locating = geoStatus === "locating";
  const tall = size === "lg";
  const Wrapper = embedded ? "div" : "form";

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <Wrapper role="search" aria-label="Search by location" onSubmit={embedded ? undefined : submit} className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <label htmlFor={inputId} className="sr-only">Area, neighbourhood or city</label>
          <Search
            className={cn("pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle", tall && "left-4 h-5 w-5")}
            aria-hidden="true"
          />
          <input
            id={inputId}
            type="text"
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
            autoComplete="off"
            autoFocus={autoFocus}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setOpen(true);
              setActive(-1);
              setNotFound(false);
              if (e.target.value.trim().length < 2) setRemote([]);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder="Area, neighbourhood or city"
            className={cn(
              "w-full rounded-md border border-line-strong bg-surface text-base text-ink placeholder:text-ink-subtle",
              "transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30 focus-visible:outline-none",
              tall ? "h-14 pl-12 pr-12 text-lg" : "h-12 pl-10 pr-11"
            )}
          />
          {text && (
            <button
              type="button"
              onClick={() => {
                setText("");
                setRemote([]);
                setNotFound(false);
                setOpen(false);
              }}
              className="absolute right-0.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md text-ink-subtle transition-colors hover:text-ink"
              aria-label="Clear location"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onUseMyLocation}
          disabled={locating}
          aria-label="Use my current location"
          className={cn(
            "inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-line-strong bg-surface px-3 text-sm font-medium text-ink",
            "transition-[background-color,transform] duration-150 hover:bg-surface-muted active:scale-[0.97] disabled:opacity-70",
            tall ? "h-14 sm:px-5" : "h-12 sm:px-4"
          )}
        >
          {locating ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <LocateFixed className="h-4 w-4" aria-hidden="true" />
          )}
          <span className="hidden sm:inline">{locating ? "Locating…" : "Near me"}</span>
        </button>
      </Wrapper>

      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Suggested places"
          className="absolute inset-x-0 top-full z-30 mt-1.5 max-h-80 overflow-auto rounded-lg border border-line bg-surface p-1 shadow-md animate-dialog-in"
        >
          {suggestions.map((s, i) => (
            <li
              key={`${s.kind}-${s.label}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => pick(s)}
              onMouseEnter={() => setActive(i)}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-3 text-sm text-ink",
                i === active && "bg-surface-muted"
              )}
            >
              <MapPin className="h-4 w-4 shrink-0 text-ink-subtle" aria-hidden="true" />
              <span className="truncate">{s.label}</span>
            </li>
          ))}
          {loading && suggestions.length === 0 && (
            <li className="flex min-h-11 items-center gap-3 px-3 text-sm text-ink-muted" role="presentation">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Looking up places…
            </li>
          )}
        </ul>
      )}

      {notFound && (
        <p className="mt-2 text-sm text-ink-muted" role="status">
          We couldn&apos;t find &ldquo;{query}&rdquo;. Try a neighbourhood or city, or use your location.
        </p>
      )}
    </div>
  );
}
