import React from "react";
import { KOCHI_DIRECTORY } from "@/lib/data/directory";
import { DirectoryCard } from "@/components/directory/DirectoryCard";
import { SectionHeader } from "@/components/home/SectionHeader";

/** Real Kochi workspaces that are not on SpaceGo (static directory data, never bookable). */
export function KochiDirectoryPreview() {
  const preview = KOCHI_DIRECTORY.slice(0, 6);

  return (
    <section aria-labelledby="kochi-directory-heading" className="mx-auto max-w-7xl px-4 pt-16 sm:px-6 sm:pt-24 lg:px-8">
      <SectionHeader
        id="kochi-directory-heading"
        title="Real Kochi spaces, not on SpaceGo yet"
        description="From public listings. You can't book these here: visit their website or open them in Maps."
        action={{ href: "/directory/kochi", label: `See all ${KOCHI_DIRECTORY.length} in Kochi` }}
      />
      <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {preview.map((entry) => (
          <li key={entry.id}>
            <DirectoryCard entry={entry} />
          </li>
        ))}
      </ul>
    </section>
  );
}
