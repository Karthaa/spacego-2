"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, Zap, ChevronLeft, ChevronRight, Users, BadgeCheck } from "lucide-react";
import { Space, VerificationLevel } from "@/types";
import { formatCurrency, cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { SpaceGoStore } from "@/lib/data/store";
import { useSpaceGoVersion } from "@/context/SpaceGoDataProvider";
import { categoryNoun } from "@/lib/categories";
import { SafeImage } from "@/components/ui/SafeImage";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80";

interface SpaceCardProps {
  space: Space;
  isFavorited?: boolean;
  onFavoriteToggle?: (spaceId: string) => void;
  /** "grid" (default) stacks the photo above the text; "list" places it beside. */
  layout?: "grid" | "list";
}

/** Short label for verification tiers a SpaceGo admin has recorded a dated check for. */
const TIER_LABEL: Partial<Record<VerificationLevel, string>> = {
  pro: "SpaceGo Pro",
  ready: "SpaceGo Ready",
  checked: "Reviewed by SpaceGo",
};

/** Headline price: daily first, then hourly, then monthly. */
export function headlinePrice(space: Space): { amount: number; unit: string } | null {
  if (space.pricing.daily) return { amount: space.pricing.daily, unit: "day" };
  if (space.pricing.hourly) return { amount: space.pricing.hourly, unit: "hour" };
  if (space.pricing.monthly) return { amount: space.pricing.monthly, unit: "month" };
  return null;
}

export function SpaceCard({ space, isFavorited, onFavoriteToggle, layout = "grid" }: SpaceCardProps) {
  const { user } = useAuth();
  const { error } = useToast();
  const router = useRouter();
  const dataVersion = useSpaceGoVersion();
  const [isSaving, setIsSaving] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);

  // The store is the source of truth; the prop is only a fallback before
  // favourites have loaded.
  const favorited = useMemo(() => {
    void dataVersion;
    if (!user) return Boolean(isFavorited);
    return SpaceGoStore.getUserFavourites(user.id).includes(space.id);
  }, [user, space.id, isFavorited, dataVersion]);

  const images = space.images && space.images.length > 0 ? space.images : [{ url: FALLBACK_IMAGE, caption: "" }];
  const price = headlinePrice(space);
  const href = `/spaces/${space.id}`;
  const place = [space.location.city, space.location.country].filter(Boolean).join(", ");

  const handleFavoriteClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      error("Sign in to save spaces", "Create an account or log in to keep a list of favourites.");
      router.push(`/auth/login?redirect=${encodeURIComponent(href)}`);
      return;
    }

    if (isSaving) return;
    setIsSaving(true);
    const result = await SpaceGoStore.toggleFavourite(user.id, space.id);
    setIsSaving(false);

    if (!result.ok) {
      error("Could not update favourites", result.error);
      return;
    }
    if (onFavoriteToggle) onFavoriteToggle(space.id);
  };

  const step = (delta: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setImageIndex((prev) => (prev + delta + images.length) % images.length);
  };

  const tier = TIER_LABEL[space.verification_level];

  return (
    <article
      className={cn(
        "group relative",
        layout === "list" &&
          "grid grid-cols-1 gap-4 rounded-lg border border-line bg-surface p-3 transition-[border-color,box-shadow] duration-150 hover:border-line-strong hover:shadow-sm sm:grid-cols-[16rem_1fr]"
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-surface-muted">
        <SafeImage
          fill
          src={images[imageIndex]?.url || FALLBACK_IMAGE}
          alt={images[imageIndex]?.caption || space.title}
          width={800}
          height={600}
          sizes={
            layout === "list"
              ? "(min-width: 640px) 16rem, 100vw"
              : "(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
          }
          className="object-cover transition-transform duration-300 ease-standard group-hover:scale-[1.03]"
        />

        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={step(-1)}
              className="absolute left-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-surface text-ink opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:hidden"
              aria-label="Previous photo"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={step(1)}
              className="absolute right-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-surface text-ink opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:hidden"
              aria-label="Next photo"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </>
        )}

        <button
          type="button"
          onClick={handleFavoriteClick}
          disabled={isSaving}
          aria-pressed={favorited}
          aria-label={favorited ? `Remove ${space.title} from saved spaces` : `Save ${space.title}`}
          className="group/fav absolute right-1.5 top-1.5 z-10 flex h-11 w-11 items-center justify-center rounded-full"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ffffff]/90 shadow-sm transition-transform duration-150 group-hover/fav:scale-105">
            <Heart
              aria-hidden="true"
              className={cn("h-4 w-4", favorited ? "fill-rose-500 text-rose-500" : "text-neutral-900")}
            />
          </span>
        </button>

        {/* One on-photo fact, white pill (always light, it sits on photography). */}
        {space.instant_book && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-[#ffffff]/95 px-2.5 py-1 text-xs font-semibold text-neutral-900 shadow-sm">
            <Zap className="h-3.5 w-3.5 text-[#b45309]" aria-hidden="true" />
            Instant Book
          </span>
        )}
      </div>

      <div className={cn(layout === "grid" ? "pt-3" : "flex flex-col justify-center")}>
        {/* Type eyebrow, then title. Ratings are intentionally not shown here:
            only reviews from completed bookings count, and stored rating
            values are demo data. */}
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-ink-subtle">
          {categoryNoun(space.category)}
          {tier && (
            <span className="inline-flex items-center gap-1 normal-case tracking-normal text-accent">
              <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
              {tier}
            </span>
          )}
        </p>
        <h3 className="mt-1 min-w-0 text-base font-semibold text-ink">
          {/* The title link covers the whole card for a large click target. */}
          <Link
            href={href}
            className={cn(
              "line-clamp-1 decoration-1 underline-offset-2 group-hover:underline",
              "after:absolute after:inset-0 after:rounded-lg after:content-['']",
              // The visible focus ring goes on the overlay, i.e. around the whole card.
              "focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-ring"
            )}
          >
            {space.title}
          </Link>
        </h3>

        {place && <p className="mt-0.5 truncate text-sm text-ink-muted">{place}</p>}

        {layout === "list" && space.headline && (
          <p className="mt-2 line-clamp-2 text-sm text-ink-muted">{space.headline}</p>
        )}

        <div className="mt-2 flex items-baseline justify-between gap-3">
          <p className="text-base text-ink">
            {price ? (
              <>
                <span className="font-semibold tabular-nums">{formatCurrency(price.amount, space.pricing.currency)}</span>
                <span className="text-sm text-ink-muted"> / {price.unit}</span>
              </>
            ) : (
              <span className="text-ink-muted">Price on request</span>
            )}
          </p>
          <p className="flex shrink-0 items-center gap-1 text-sm text-ink-muted">
            <Users className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Up to</span>
            {space.capacity}
            <span className="sr-only">{space.capacity === 1 ? "person" : "people"}</span>
          </p>
        </div>
      </div>
    </article>
  );
}
