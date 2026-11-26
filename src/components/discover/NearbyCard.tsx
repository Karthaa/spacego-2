"use client";

import React, { forwardRef } from "react";
import Link from "next/link";
import { Navigation, Users, X, Zap } from "lucide-react";
import type { NearbySpace } from "@/lib/data/store";
import { formatDistance } from "@/lib/geo";
import { categoryNoun } from "@/lib/categories";
import { cn, formatCurrency } from "@/lib/utils";
import { SafeImage } from "@/components/ui/SafeImage";
import { headlinePrice } from "@/components/common/SpaceCard";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80";

interface NearbyCardProps {
  item: NearbySpace;
  /** "auto": stacked, but side-by-side in the narrow lg split column. "row": always side-by-side. */
  layout?: "auto" | "row";
  selected?: boolean;
  hovered?: boolean;
  onHover?: (id: string | null) => void;
  onClose?: () => void;
}

export function areaLabel(item: NearbySpace): string {
  const { landmark, city } = item.space.location;
  if (landmark && city && !landmark.toLowerCase().includes(city.toLowerCase())) return `${landmark}, ${city}`;
  return landmark || city || item.space.location.country || "";
}

export const NearbyCard = forwardRef<HTMLElement, NearbyCardProps>(function NearbyCard(
  { item, layout = "auto", selected, hovered, onHover, onClose },
  ref
) {
  const { space } = item;
  const price = headlinePrice(space);
  const cover = space.images?.find((i) => i.is_cover) ?? space.images?.[0];
  const row = layout === "row";

  return (
    <article
      ref={ref}
      data-space-id={space.id}
      onMouseEnter={() => onHover?.(space.id)}
      onMouseLeave={() => onHover?.(null)}
      onFocus={() => onHover?.(space.id)}
      onBlur={() => onHover?.(null)}
      className={cn(
        "group relative flex rounded-lg border bg-surface p-2.5 transition-[border-color,box-shadow] duration-150",
        row ? "flex-row gap-3" : "flex-col gap-3 lg:flex-row xl:flex-col",
        selected
          ? "border-ink shadow-md"
          : hovered
            ? "border-line-strong"
            : "border-line hover:border-line-strong"
      )}
    >
      <div
        className={cn(
          "relative shrink-0 overflow-hidden rounded-md bg-surface-muted",
          row ? "aspect-square w-24 sm:w-28" : "aspect-[3/2] w-full lg:aspect-square lg:w-36 xl:aspect-[3/2] xl:w-full"
        )}
      >
        <SafeImage
          fill
          src={cover?.url || FALLBACK_IMAGE}
          alt={cover?.caption || space.title}
          width={600}
          height={450}
          sizes={row ? "7rem" : "(min-width: 1280px) 22vw, (min-width: 1024px) 9rem, (min-width: 640px) 45vw, 100vw"}
        />
        {space.instant_book && !row && (
          <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-sm bg-black/60 px-2 py-1 text-xs font-medium text-photo-ink lg:hidden xl:inline-flex">
            <Zap className="h-3.5 w-3.5" aria-hidden="true" />
            Instant Book
          </span>
        )}
      </div>

      <div className={cn("flex min-w-0 flex-1 flex-col", !row && "px-1 pb-1 lg:px-0 lg:py-1 xl:px-1 xl:py-0")}>
        <h3 className="min-w-0 pr-8 text-base font-semibold leading-snug text-ink">
          <Link
            href={`/spaces/${space.id}`}
            className={cn(
              "line-clamp-2 decoration-1 underline-offset-2 group-hover:underline",
              "after:absolute after:inset-0 after:rounded-lg after:content-['']",
              "focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-ring"
            )}
          >
            {space.title}
          </Link>
        </h3>
        <p className="mt-0.5 truncate text-sm text-ink-muted">
          {categoryNoun(space.category)} &middot; {areaLabel(item)}
        </p>

        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
          <span className="inline-flex items-center gap-1 font-medium text-ink">
            <Navigation className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
            {formatDistance(item.distanceM)}
            <span className="sr-only"> away in a straight line</span>
            <span className="font-normal text-ink-muted" aria-hidden="true">away</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            {space.capacity}
            <span className="sr-only">{space.capacity === 1 ? " person" : " people"}</span>
          </span>
          {space.instant_book && (
            <span className={cn("items-center gap-1", row ? "inline-flex" : "hidden lg:inline-flex xl:hidden")}>
              <Zap className="h-3.5 w-3.5" aria-hidden="true" />
              Instant
            </span>
          )}
        </p>

        <p className="mt-auto pt-2 text-base text-ink">
          {price ? (
            <>
              <span className="font-semibold tabular-nums">{formatCurrency(price.amount, space.pricing.currency)}</span>
              <span className="text-ink-muted"> / {price.unit}</span>
            </>
          ) : (
            <span className="text-ink-muted">Price on request</span>
          )}
        </p>
      </div>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close preview"
          className="absolute right-1.5 top-1.5 z-10 flex h-9 w-9 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-surface-muted hover:text-ink"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </article>
  );
});
