"use client";

import React from "react";
import Link from "next/link";
import { Building2, Search } from "lucide-react";
import type { Space } from "@/types";
import { SpaceCard } from "@/components/common/SpaceCard";
import { buttonClasses } from "@/components/ui/Button";
import { SectionHeader } from "@/components/home/SectionHeader";

export function FeaturedSpaces({ spaces }: { spaces: Space[] }) {
  const featured = spaces.slice(0, 8);

  return (
    <section aria-labelledby="featured-heading" className="mx-auto max-w-7xl px-4 pt-16 sm:px-6 sm:pt-24 lg:px-8">
      <SectionHeader
        id="featured-heading"
        title="Spaces you can book"
        description="Recently listed by SpaceGo hosts, with the host's price per hour, day or month."
        action={featured.length > 0 ? { href: "/spaces", label: "See all spaces" } : undefined}
      />

      {featured.length === 0 ? (
        // No published spaces yet: say so plainly and offer the two useful next steps.
        <div className="mt-8 grid gap-6 rounded-xl border border-line bg-surface p-6 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="max-w-xl">
            <p className="text-lg font-semibold text-ink">New spaces are being added</p>
            <p className="mt-2 text-base text-ink-muted">
              Hosts are listing their workspaces now. Tell us the area and size you need and we&apos;ll look for a
              match, or list your own space and be one of the first hosts.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/discover" className={buttonClasses({ variant: "ink", size: "lg" })}>
              <Search className="h-4 w-4" aria-hidden="true" />
              Search by area
            </Link>
            <Link href="/owner/spaces/new" className={buttonClasses({ variant: "outline", size: "lg" })}>
              <Building2 className="h-4 w-4" aria-hidden="true" />
              List your space
            </Link>
          </div>
        </div>
      ) : (
        <ul className="mt-8 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((space) => (
            <li key={space.id}>
              <SpaceCard space={space} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
