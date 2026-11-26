"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LocateFixed, MapPin, Search, Users, LayoutGrid } from "lucide-react";
import { SpaceGoStore } from "@/lib/data/store";
import { CATEGORIES } from "@/lib/categories";
import type { Space, WorkspaceCategory } from "@/types";
import { SafeImage } from "@/components/ui/SafeImage";
import { cn } from "@/lib/utils";
import { matchKnownPlaces } from "@/lib/geo/places";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=2000&q=80";

function countMatches(spaces: Space[], location: string, category: string, seats: number): number {
  const q = location.trim().toLowerCase();
  return spaces.filter((s) => {
    if (category !== "all" && s.category !== category) return false;
    if (seats > 0 && s.capacity < seats) return false;
    if (!q) return true;
    return [s.location.city, s.location.address, s.location.country, s.title]
      .some((field) => field.toLowerCase().includes(q));
  }).length;
}

/*
 * Home hero: a rounded photo panel with the headline, and one segmented
 * search bar floating over its lower edge (a single pill on desktop, a stacked
 * card on phones). Every segment keeps a visible label.
 */
export function HeroSearch({ spaces }: { spaces: Space[] }) {
  const router = useRouter();
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState<WorkspaceCategory | "all">("all");
  const [seats, setSeats] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (location.trim()) params.set("location", location.trim());
    if (category !== "all") params.set("category", category);
    if (seats) params.set("seats", seats);

    if (location.trim()) {
      // Anonymous demand signal (best effort; never blocks navigation).
      void SpaceGoStore.logSearchQuery({
        location: location.trim(),
        category: category !== "all" ? category : undefined,
        seats: seats ? Number(seats) : undefined,
        resultCount: countMatches(spaces, location, category, Number(seats) || 0),
      });
    }

    // A recognised area goes to the location search (list + map); anything
    // else keeps the text search across all listings.
    const place = location.trim().length >= 3 ? matchKnownPlaces(location, 1)[0] : undefined;
    if (place) {
      const geo = new URLSearchParams({ lat: place.lat.toFixed(5), lng: place.lng.toFixed(5), near: place.label });
      if (category !== "all") geo.set("cat", category);
      if (seats) geo.set("seats", seats);
      router.push(`/discover?${geo.toString()}`);
      return;
    }

    router.push(`/spaces${params.toString() ? `?${params.toString()}` : ""}`);
  };

  // A segment: label above a borderless control. On phones each segment is a
  // bordered field; from lg the bar becomes one pill with hairline dividers.
  const segment =
    "relative flex flex-col justify-center rounded-md border border-line bg-surface px-4 py-2.5 transition-colors focus-within:border-ink lg:rounded-full lg:border-0 lg:px-6 lg:py-3 lg:hover:bg-surface-muted lg:focus-within:bg-surface-muted";
  const segmentLabel = "text-xs font-semibold text-ink";
  const segmentControl =
    "mt-0.5 w-full min-w-0 border-0 bg-transparent p-0 text-sm text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-0";

  return (
    <section aria-labelledby="hero-heading" className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 sm:pt-6 lg:px-8">
      <div className="relative isolate overflow-hidden rounded-xl bg-black">
        {/* Decorative background photo: the LCP element, so load it first. */}
        <SafeImage
          fill
          src={HERO_IMAGE}
          alt=""
          width={2000}
          height={1333}
          sizes="(min-width: 1280px) 80rem, 100vw"
          loading="eager"
          fetchPriority="high"
          wrapperClassName="-z-10"
        />
        {/* Flat scrim for legible text on the photo (no gradient). */}
        <div className="absolute inset-0 -z-10 bg-black/50" aria-hidden="true" />

        <div className="px-6 pb-28 pt-16 sm:px-10 sm:pb-32 sm:pt-24 lg:px-14 lg:pb-36 lg:pt-28">
          <p className="text-sm font-medium text-photo-ink/85">Desks, offices, meeting rooms and studios</p>
          <h1
            id="hero-heading"
            className="mt-3 max-w-3xl font-display text-5xl leading-[1.02] text-photo-ink sm:text-6xl lg:text-7xl"
          >
            Find the right space to work, meet and create
          </h1>
          <p className="mt-5 max-w-xl text-base text-photo-ink/85 sm:text-lg">
            Book by the hour, day or month from local hosts. The host confirms your request, or it&apos;s
            confirmed instantly where Instant Book is on.
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSearch}
        role="search"
        aria-label="Search workspaces"
        className={cn(
          "relative z-10 mx-auto -mt-20 grid max-w-5xl gap-2 rounded-lg border border-line bg-surface p-3 shadow-md",
          "sm:-mt-24 sm:grid-cols-2",
          "lg:-mt-12 lg:grid-cols-[1.6fr_1.2fr_0.9fr_auto] lg:items-center lg:gap-0 lg:rounded-full lg:p-2"
        )}
      >
        <div className={cn(segment, "sm:col-span-2 lg:col-span-1")}>
          <label htmlFor="hero-location" className={segmentLabel}>Where</label>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0 text-ink-subtle lg:hidden" aria-hidden="true" />
            <input
              id="hero-location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="City, neighbourhood or address"
              className={segmentControl}
              autoComplete="off"
            />
          </div>
        </div>

        <div className={cn(segment, "lg:before:absolute lg:before:left-0 lg:before:top-1/4 lg:before:h-1/2 lg:before:w-px lg:before:bg-line")}>
          <label htmlFor="hero-category" className={segmentLabel}>Type of space</label>
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4 shrink-0 text-ink-subtle lg:hidden" aria-hidden="true" />
            <select
              id="hero-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as WorkspaceCategory | "all")}
              className={cn(segmentControl, "cursor-pointer appearance-none")}
            >
              <option value="all">Any type</option>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className={cn(segment, "lg:before:absolute lg:before:left-0 lg:before:top-1/4 lg:before:h-1/2 lg:before:w-px lg:before:bg-line")}>
          <label htmlFor="hero-seats" className={segmentLabel}>People</label>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 shrink-0 text-ink-subtle lg:hidden" aria-hidden="true" />
            <input
              id="hero-seats"
              type="number"
              inputMode="numeric"
              min={1}
              max={500}
              value={seats}
              onChange={(e) => setSeats(e.target.value)}
              placeholder="Any"
              className={segmentControl}
            />
          </div>
        </div>

        <button
          type="submit"
          className={cn(
            "inline-flex h-12 items-center justify-center gap-2 rounded-full bg-accent px-6 text-base font-semibold text-accent-ink",
            "transition-colors duration-150 hover:bg-accent-hover active:bg-accent-hover sm:col-span-2",
            "lg:col-span-1 lg:ml-2 lg:h-14 lg:px-7"
          )}
        >
          <Search className="h-5 w-5" aria-hidden="true" />
          Search
        </button>
      </form>

      <p className="mt-4 flex justify-center">
        <Link
          href="/discover"
          className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-medium text-ink-muted underline-offset-4 hover:text-ink hover:underline"
        >
          <LocateFixed className="h-4 w-4" aria-hidden="true" />
          Or find spaces near you on a map
        </Link>
      </p>
    </section>
  );
}
