import React from "react";
import { ExternalLink, MapPin } from "lucide-react";
import type { DirectoryEntry } from "@/lib/data/directory";
import { Badge } from "@/components/ui/Badge";

const linkClasses =
  "inline-flex min-h-9 items-center gap-1.5 rounded-full text-sm font-semibold text-accent underline-offset-4 hover:underline pointer-coarse:min-h-11";

/**
 * A real workspace that is not on SpaceGo. Deliberately typographic: no photo,
 * price, rating or verification badge, and nothing that links to booking.
 */
export function DirectoryCard({ entry, headingLevel = 3 }: { entry: DirectoryEntry; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? "h2" : "h3";

  return (
    <article className="flex h-full flex-col rounded-lg border border-line bg-surface p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-subtle">{entry.kind}</p>
      <Heading className="mt-2 text-lg font-semibold tracking-tight text-ink">{entry.name}</Heading>
      <p className="mt-1 text-sm text-ink-muted">{entry.locality}</p>

      <div className="mt-3">
        <Badge variant="neutral">Not on SpaceGo yet</Badge>
      </div>

      <div className="mt-auto flex flex-wrap gap-x-5 gap-y-1 pt-4">
        {entry.website && (
          <a href={entry.website} target="_blank" rel="noopener noreferrer nofollow" className={linkClasses}>
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            Website
            <span className="sr-only">, {entry.name}, opens in a new tab</span>
          </a>
        )}
        <a href={entry.mapsUrl} target="_blank" rel="noopener noreferrer nofollow" className={linkClasses}>
          <MapPin className="h-4 w-4" aria-hidden="true" />
          Open in Maps
          <span className="sr-only">, {entry.name}, opens in a new tab</span>
        </a>
      </div>
    </article>
  );
}
