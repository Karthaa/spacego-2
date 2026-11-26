"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { MapPin } from "lucide-react";
import type { Space } from "@/types";
import type { LatLng } from "@/lib/geo";
import { SpaceGoStore } from "@/lib/data/store";

const SpaceAreaMap = dynamic(() => import("./SpaceAreaMap"), {
  ssr: false,
  loading: () => <div className="h-72 rounded-lg skeleton-shimmer sm:h-80" aria-hidden="true" />,
});

/** "Where you'll be": approximate-area map plus a link to nearby spaces. */
export function SpaceLocationSection({ space }: { space: Space }) {
  const [state, setState] = useState<{ id: string; point: LatLng | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    SpaceGoStore.getPublicPoint(space.id).then((result) => {
      if (!cancelled) setState({ id: space.id, point: result.ok ? result.data : null });
    });
    return () => {
      cancelled = true;
    };
  }, [space.id]);

  const area = [space.location.landmark, space.location.city].filter(Boolean).join(", ") || space.location.city;
  const point = state?.id === space.id ? state.point : null;
  const loading = state?.id !== space.id;

  if (!loading && !point) return null;

  const nearby = point
    ? `/discover?${new URLSearchParams({ lat: point.lat.toFixed(5), lng: point.lng.toFixed(5), near: area || "This area" })}`
    : null;

  return (
    <section aria-labelledby="location-heading">
      <h2 id="location-heading" className="text-xl font-semibold text-ink">Where you&apos;ll be</h2>
      <p className="mt-2 flex items-start gap-2 text-base text-ink-muted">
        <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-ink-subtle" aria-hidden="true" />
        <span>
          {area}
          <span className="block text-sm">The shaded circle shows the approximate area, not the exact building.</span>
        </span>
      </p>
      <div className="mt-4">
        {point ? <SpaceAreaMap point={point} label={area} /> : <div className="h-72 rounded-lg skeleton-shimmer sm:h-80" aria-hidden="true" />}
      </div>
      {nearby && (
        <p className="mt-3 text-sm">
          <Link href={nearby} className="rounded-sm font-medium text-accent hover:underline">
            See other spaces nearby
          </Link>
        </p>
      )}
    </section>
  );
}
