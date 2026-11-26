"use client";

import React, { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { circlePolygon, type LatLng } from "@/lib/geo";
import { FALLBACK_MAP_STYLE, MAP_STYLE_OVERRIDE, mapStyleUrl } from "@/lib/geo/mapStyle";
import { useResolvedTheme } from "@/lib/theme";

/** Radius drawn around the approximate point: covers the 0.005 degree grid cell. */
const AREA_RADIUS_M = 600;

/**
 * Small map of a listing's approximate area: a shaded circle, no pin, so the
 * exact building is never pointed at. Scroll-zoom needs Ctrl/Cmd (or two
 * fingers) so the page still scrolls past it.
 */
export function SpaceAreaMap({ point, label }: { point: LatLng; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const theme = useResolvedTheme();
  const themeRef = useRef(theme);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let triedFallback = false;
    (async () => {
      const lib = await import("maplibre-gl");
      if (cancelled || !ref.current) return;
      const map = new lib.Map({
        container: ref.current,
        style: mapStyleUrl(themeRef.current),
        center: [point.lng, point.lat],
        zoom: 13.6,
        attributionControl: { compact: true },
        cooperativeGestures: true,
        dragRotate: false,
        pitchWithRotate: false,
      });
      map.touchZoomRotate.disableRotation();
      map.addControl(new lib.NavigationControl({ showCompass: false }), "top-right");
      mapRef.current = map;
      const addArea = () => {
        if (map.getSource("area")) return;
        map.addSource("area", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: { type: "Polygon", coordinates: [circlePolygon(point, AREA_RADIUS_M)] },
          },
        });
        map.addLayer({ id: "area-fill", type: "fill", source: "area", paint: { "fill-color": "#0d9488", "fill-opacity": 0.18 } });
        map.addLayer({ id: "area-line", type: "line", source: "area", paint: { "line-color": "#0d9488", "line-width": 2 } });
      };
      map.on("style.load", () => {
        setFailed(false);
        addArea();
      });
      map.on("error", () => {
        if (map.isStyleLoaded()) return;
        if (!triedFallback && !MAP_STYLE_OVERRIDE) {
          triedFallback = true;
          map.setStyle(FALLBACK_MAP_STYLE);
          return;
        }
        setFailed(true);
      });
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [point]);

  useEffect(() => {
    if (themeRef.current === theme) return;
    themeRef.current = theme;
    mapRef.current?.setStyle(mapStyleUrl(theme), { diff: false });
  }, [theme]);

  return (
    <div className="relative h-72 overflow-hidden rounded-lg border border-line bg-surface-muted sm:h-80">
      <div ref={ref} className="h-full w-full" role="region" aria-label={`Map of the approximate area: ${label}`} />
      {failed && (
        <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-ink-muted">
          The map couldn&apos;t load.
        </p>
      )}
    </div>
  );
}

export default SpaceAreaMap;
