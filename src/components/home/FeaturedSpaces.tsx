"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Space } from "@/types";
import { SpaceCard } from "@/components/common/SpaceCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { buttonClasses } from "@/components/ui/Button";

export function FeaturedSpaces({ spaces }: { spaces: Space[] }) {
  const featured = spaces.slice(0, 8);

  return (
    <section aria-labelledby="featured-heading" className="border-y border-line bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="featured-heading" className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              Spaces you can book
            </h2>
            <p className="mt-2 text-base text-ink-muted">Recently listed workspaces from SpaceGo hosts.</p>
          </div>
          <Link href="/spaces" className={buttonClasses({ variant: "outline", className: "self-start sm:self-auto" })}>
            See all spaces
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        {featured.length === 0 ? (
          <EmptyState
            className="mt-8"
            title="No spaces listed yet"
            description="New workspaces appear here as soon as hosts publish them."
          />
        ) : (
          <ul className="mt-8 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((space) => (
              <li key={space.id}>
                <SpaceCard space={space} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
