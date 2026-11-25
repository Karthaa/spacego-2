"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Search, Users } from "lucide-react";
import { SpaceGoStore } from "@/lib/data/store";
import { CATEGORIES } from "@/lib/categories";
import type { Space, WorkspaceCategory } from "@/types";
import { Button } from "@/components/ui/Button";
import { fieldClasses } from "@/components/ui/Input";
import { SafeImage } from "@/components/ui/SafeImage";
import { cn } from "@/lib/utils";

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

    router.push(`/spaces${params.toString() ? `?${params.toString()}` : ""}`);
  };

  const fieldLabel = "mb-1 block text-sm font-medium text-ink";

  return (
    <section aria-labelledby="hero-heading" className="relative isolate overflow-hidden bg-black">
      {/* Decorative background photo: the LCP element, so load it first. */}
      <SafeImage
        fill
        src={HERO_IMAGE}
        alt=""
        width={2000}
        height={1333}
        sizes="100vw"
        loading="eager"
        fetchPriority="high"
        wrapperClassName="-z-10"
      />
      {/* Flat scrim for legible text on the photo (no gradient). */}
      <div className="absolute inset-0 -z-10 bg-black/55" aria-hidden="true" />

      <div className="mx-auto max-w-7xl px-4 pb-16 pt-20 sm:px-6 sm:pb-24 sm:pt-28 lg:px-8">
        <div className="max-w-2xl">
          <h1 id="hero-heading" className="text-4xl font-semibold tracking-tight text-photo-ink sm:text-5xl">
            Find the right space to work, meet and create
          </h1>
          <p className="mt-4 max-w-xl text-lg text-photo-ink/90">
            Desks, private offices, meeting rooms and studios from local hosts.
            Request a booking and the host confirms it, or book instantly where it&apos;s offered.
          </p>
        </div>

        <form
          onSubmit={handleSearch}
          role="search"
          aria-label="Search workspaces"
          className="mt-8 grid grid-cols-1 gap-3 rounded-lg border border-line bg-surface p-4 shadow-md sm:grid-cols-2 lg:grid-cols-[1.6fr_1.2fr_0.8fr_auto] lg:items-end"
        >
          <div className="sm:col-span-2 lg:col-span-1">
            <label htmlFor="hero-location" className={fieldLabel}>Where</label>
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" aria-hidden="true" />
              <input
                id="hero-location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City, neighbourhood or address"
                className={cn(fieldClasses, "h-12 pl-10")}
                autoComplete="off"
              />
            </div>
          </div>

          <div>
            <label htmlFor="hero-category" className={fieldLabel}>Type of space</label>
            <select
              id="hero-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as WorkspaceCategory | "all")}
              className={cn(fieldClasses, "h-12 cursor-pointer")}
            >
              <option value="all">Any type</option>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="hero-seats" className={fieldLabel}>People</label>
            <div className="relative">
              <Users className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" aria-hidden="true" />
              <input
                id="hero-seats"
                type="number"
                inputMode="numeric"
                min={1}
                max={500}
                value={seats}
                onChange={(e) => setSeats(e.target.value)}
                placeholder="Any"
                className={cn(fieldClasses, "h-12 pl-10")}
              />
            </div>
          </div>

          <Button type="submit" size="lg" className="w-full sm:col-span-2 lg:col-span-1 lg:w-auto">
            <Search className="h-4 w-4" aria-hidden="true" />
            Search
          </Button>
        </form>
      </div>
    </section>
  );
}
