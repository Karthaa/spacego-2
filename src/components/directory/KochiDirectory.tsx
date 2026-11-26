"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { DIRECTORY_CHECKED_ON, KOCHI_DIRECTORY, KOCHI_DIRECTORY_AREAS, formatCheckedOn } from "@/lib/data/directory";
import { DirectoryCard } from "@/components/directory/DirectoryCard";
import { buttonClasses } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const ALL = "All";

export function KochiDirectory() {
  const [area, setArea] = useState<string>(ALL);

  const counts = useMemo(() => {
    const byArea = new Map<string, number>();
    for (const entry of KOCHI_DIRECTORY) byArea.set(entry.area, (byArea.get(entry.area) ?? 0) + 1);
    return byArea;
  }, []);

  const entries = useMemo(
    () => (area === ALL ? KOCHI_DIRECTORY : KOCHI_DIRECTORY.filter((entry) => entry.area === area)),
    [area]
  );

  const countLabel =
    area === ALL
      ? `${entries.length} ${entries.length === 1 ? "workspace" : "workspaces"} in Kochi`
      : `${entries.length} ${entries.length === 1 ? "workspace" : "workspaces"} in ${area}`;

  return (
    <>
      <section aria-labelledby="directory-heading" className="border-b border-line bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <p className="text-sm font-medium text-accent">Directory</p>
          <h1 id="directory-heading" className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Coworking spaces in Kochi
          </h1>
          <p className="mt-4 max-w-2xl text-base text-ink-muted sm:text-lg">
            Real workspaces in Kochi, from public listings. They aren&apos;t on SpaceGo yet, so you can&apos;t book
            them here. Visit their website or open them in Maps.
          </p>
        </div>
      </section>

      <section aria-labelledby="directory-results" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <ul className="flex gap-2 pb-1 sm:flex-wrap" aria-label="Filter by area">
            {[ALL, ...KOCHI_DIRECTORY_AREAS].map((option) => {
              const active = option === area;
              const count = option === ALL ? KOCHI_DIRECTORY.length : counts.get(option) ?? 0;
              return (
                <li key={option}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => setArea(option)}
                    className={cn(
                      "flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full border px-4 text-sm font-medium transition-colors pointer-coarse:h-11",
                      active
                        ? "border-ink bg-ink text-surface"
                        : "border-line-strong bg-surface text-ink hover:bg-surface-muted"
                    )}
                  >
                    {option}
                    <span className={active ? "text-surface/75" : "text-ink-subtle"}>{count}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <h2 id="directory-results" className="mt-6 text-sm font-medium text-ink-muted" aria-live="polite">
          {countLabel}
        </h2>

        <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {entries.map((entry) => (
            <li key={entry.id}>
              <DirectoryCard entry={entry} />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="directory-owners" className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 rounded-xl border border-line bg-surface-muted p-6 sm:p-10 lg:flex-row lg:items-center lg:justify-between">
          <h2 id="directory-owners" className="max-w-xl text-xl font-semibold tracking-tight text-ink sm:text-2xl">
            Run one of these spaces? List it on SpaceGo and take bookings directly
          </h2>
          <Link href="/owner/spaces/new" className={buttonClasses({ variant: "primary", size: "lg", className: "self-start lg:self-auto" })}>
            List your space
          </Link>
        </div>
        <p className="mt-6 max-w-2xl text-sm text-ink-subtle">
          From public listings, checked {formatCheckedOn(DIRECTORY_CHECKED_ON)}. Details can change. If you run one of these spaces and want it
          corrected or removed, tell us.
        </p>
      </section>
    </>
  );
}
