"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapLibreMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Crosshair, LocateFixed, MapPinOff, RotateCw } from "lucide-react";
import type { NearbySpace } from "@/lib/data/store";
import { circlePolygon, radiusForBounds, zoomForRadius, type SearchCenter } from "@/lib/geo";
import { useResolvedTheme } from "@/lib/theme";
import { FALLBACK_MAP_STYLE as FALLBACK_STYLE, MAP_STYLE_OVERRIDE as STYLE_OVERRIDE, mapStyleUrl as styleUrl } from "@/lib/geo/mapStyle";
import { cn, formatCurrency } from "@/lib/utils";
import { headlinePrice } from "@/components/common/SpaceCard";

/**
 * Discovery map (MapLibre GL, loaded only in the browser).
 *
 * Tiles: OpenFreeMap (no key) by default, MapTiler when
 * NEXT_PUBLIC_MAPTILER_KEY is set, or any style URL in
 * NEXT_PUBLIC_MAP_STYLE_URL. Markers are real <button>s so they are keyboard
 * and screen-reader reachable. All points are approximate public locations.
 */

export interface DiscoverMapProps {
  items: NearbySpace[];
  center: SearchCenter | null;
  radiusM: number;
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (id: string | null) => void;
  onSearchArea: (center: { lat: number; lng: number }, radiusM: number) => void;
  /** Changes whenever a new search should re-frame the map. */
  frameKey: string;
  className?: string;
}

function compactPrice(item: NearbySpace): string {
  const price = headlinePrice(item.space);
  if (!price) return "Ask";
  const currency = item.space.pricing.currency || "INR";
  if (price.amount >= 10_000) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(price.amount);
  }
  return formatCurrency(price.amount, currency);
}

function priceSentence(item: NearbySpace): string {
  const price = headlinePrice(item.space);
  if (!price) return "price on request";
  return `${formatCurrency(price.amount, item.space.pricing.currency)} per ${price.unit}`;
}

function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export function DiscoverMap({
  items,
  center,
  radiusM,
  selectedId,
  hoveredId,
  onSelect,
  onSearchArea,
  frameKey,
  className,
}: DiscoverMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const libRef = useRef<typeof import("maplibre-gl") | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const originRef = useRef<Marker | null>(null);
  const itemsRef = useRef(items);
  const stateRef = useRef({ center, radiusM, selectedId, hoveredId });
  const onSelectRef = useRef(onSelect);
  const userMovedRef = useRef(false);
  const triedFallbackRef = useRef(false);

  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [showSearchArea, setShowSearchArea] = useState(false);
  const theme = useResolvedTheme();
  const themeRef = useRef(theme);

  useEffect(() => {
    itemsRef.current = items;
    stateRef.current = { center, radiusM, selectedId, hoveredId };
    onSelectRef.current = onSelect;
  });

  const geojson = useCallback((list: NearbySpace[]) => ({
    type: "FeatureCollection" as const,
    features: list.map((item) => ({
      type: "Feature" as const,
      id: item.space.id,
      properties: { id: item.space.id },
      geometry: { type: "Point" as const, coordinates: [item.point.lng, item.point.lat] },
    })),
  }), []);

  const radiusGeojson = useCallback(() => {
    const { center: c, radiusM: r } = stateRef.current;
    return {
      type: "FeatureCollection" as const,
      features: c
        ? [{
            type: "Feature" as const,
            properties: {},
            geometry: { type: "Polygon" as const, coordinates: [circlePolygon(c, r)] },
          }]
        : [],
    };
  }, []);

  /** Rebuild the HTML markers for whatever is currently rendered. */
  const syncMarkers = useCallback(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!map || !lib || !map.getSource("spaces") || !map.isSourceLoaded("spaces")) return;

    const byId = new Map(itemsRef.current.map((item) => [item.space.id, item]));
    const seen = new Set<string>();
    const features = map.querySourceFeatures("spaces");

    for (const feature of features) {
      const props = feature.properties as Record<string, unknown>;
      const geometry = feature.geometry as GeoJSON.Point;
      const isCluster = Boolean(props.cluster);
      const key = isCluster ? `c-${props.cluster_id}` : `p-${props.id}`;
      if (seen.has(key)) continue;
      seen.add(key);

      let marker = markersRef.current.get(key);
      if (!marker) {
        const el = document.createElement("button");
        el.type = "button";
        if (isCluster) {
          const count = Number(props.point_count) || 0;
          el.className = "sg-cluster-marker";
          el.textContent = String(props.point_count_abbreviated ?? count);
          el.setAttribute("aria-label", `${count} spaces here. Zoom in`);
          const clusterId = Number(props.cluster_id);
          const lngLat = geometry.coordinates as [number, number];
          el.addEventListener("click", async (e) => {
            e.stopPropagation();
            const source = map.getSource("spaces") as GeoJSONSource | undefined;
            if (!source) return;
            const zoom = await source.getClusterExpansionZoom(clusterId);
            map.easeTo({ center: lngLat, zoom: Math.min(zoom + 0.5, 17), duration: reducedMotion() ? 0 : 450 });
          });
        } else {
          const item = byId.get(String(props.id));
          if (!item) continue;
          el.className = "sg-price-marker";
          el.dataset.id = item.space.id;
          el.textContent = compactPrice(item);
          el.setAttribute("aria-label", `${item.space.title}, ${priceSentence(item)}`);
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            onSelectRef.current(item.space.id);
          });
        }
        marker = new lib.Marker({ element: el, anchor: "center" })
          .setLngLat(geometry.coordinates as [number, number])
          .addTo(map);
        markersRef.current.set(key, marker);
      }

      if (!isCluster) {
        const el = marker.getElement();
        const id = String(props.id);
        const { selectedId: sel, hoveredId: hov } = stateRef.current;
        el.dataset.state = id === sel ? "selected" : id === hov ? "hovered" : "idle";
        el.setAttribute("aria-pressed", id === sel ? "true" : "false");
        el.style.zIndex = id === sel ? "3" : id === hov ? "2" : "1";
      }
    }

    for (const [key, marker] of markersRef.current) {
      if (!seen.has(key)) {
        marker.remove();
        markersRef.current.delete(key);
      }
    }
  }, []);

  const clearMarkers = useCallback(() => {
    for (const marker of markersRef.current.values()) marker.remove();
    markersRef.current.clear();
  }, []);

  const addLayers = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    clearMarkers();

    if (!map.getSource("radius")) {
      map.addSource("radius", { type: "geojson", data: radiusGeojson() });
      map.addLayer({
        id: "radius-fill",
        type: "fill",
        source: "radius",
        paint: { "fill-color": "#0d9488", "fill-opacity": themeRef.current === "dark" ? 0.12 : 0.07 },
      });
      map.addLayer({
        id: "radius-line",
        type: "line",
        source: "radius",
        paint: { "line-color": "#0d9488", "line-width": 1.5, "line-dasharray": [2, 2], "line-opacity": 0.8 },
      });
    }

    if (!map.getSource("spaces")) {
      map.addSource("spaces", {
        type: "geojson",
        data: geojson(itemsRef.current),
        cluster: true,
        clusterRadius: 44,
        clusterMaxZoom: 15,
      });
      // Invisible layer: makes the source load tiles so markers can be built.
      map.addLayer({
        id: "spaces-anchor",
        type: "circle",
        source: "spaces",
        paint: { "circle-radius": 0, "circle-opacity": 0 },
      });
    }
    syncMarkers();
  }, [clearMarkers, geojson, radiusGeojson, syncMarkers]);

  const frame = useCallback((animate: boolean) => {
    const map = mapRef.current;
    const lib = libRef.current;
    const { center: c, radiusM: r } = stateRef.current;
    if (!map || !lib || !c) return;
    const ring = circlePolygon(c, r, 16);
    const bounds = ring.reduce(
      (b, p) => b.extend(p),
      new lib.LngLatBounds(ring[0], ring[0])
    );
    map.fitBounds(bounds, { padding: 32, duration: animate && !reducedMotion() ? 500 : 0, maxZoom: 15 });
    userMovedRef.current = false;
    setShowSearchArea(false);
  }, []);

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | null = null;
    let raf = 0;

    (async () => {
      const lib = await import("maplibre-gl");
      if (cancelled || !containerRef.current) return;
      libRef.current = lib;
      const c = stateRef.current.center;
      map = new lib.Map({
        container: containerRef.current,
        style: styleUrl(themeRef.current),
        center: c ? [c.lng, c.lat] : [76.2999, 9.9816],
        zoom: c ? zoomForRadius(stateRef.current.radiusM) : 4,
        attributionControl: { compact: true },
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        cooperativeGestures: false,
      });
      map.touchZoomRotate.disableRotation();
      map.addControl(new lib.NavigationControl({ showCompass: false }), "top-right");
      mapRef.current = map;

      map.on("style.load", () => {
        addLayers();
        setReady(true);
        setFailed(false);
      });
      map.on("error", (e) => {
        // A style that fails to load leaves an empty canvas: try the default
        // OpenFreeMap style once, then show the failure state.
        const status = (e.error as { status?: number } | undefined)?.status;
        if (!map || map.isStyleLoaded()) return;
        if (!triedFallbackRef.current && !STYLE_OVERRIDE) {
          triedFallbackRef.current = true;
          map.setStyle(FALLBACK_STYLE);
          return;
        }
        if (status !== undefined || !map.isStyleLoaded()) setFailed(true);
      });
      map.on("render", () => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(syncMarkers);
      });
      map.on("movestart", (e) => {
        if ((e as { originalEvent?: Event }).originalEvent) userMovedRef.current = true;
      });
      map.on("moveend", () => {
        if (userMovedRef.current) setShowSearchArea(true);
      });
      map.on("click", () => onSelectRef.current(null));
      if (c) frame(false);
    })();

    const markers = markersRef.current;
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      for (const marker of markers.values()) marker.remove();
      markers.clear();
      originRef.current?.remove();
      map?.remove();
      mapRef.current = null;
    };
    // The map is created once; later prop changes are pushed in below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Theme switch: swap the basemap, then re-add our layers on style.load.
  useEffect(() => {
    if (themeRef.current === theme) return;
    themeRef.current = theme;
    const map = mapRef.current;
    if (!map) return;
    triedFallbackRef.current = false;
    map.setStyle(styleUrl(theme), { diff: false });
  }, [theme]);

  // New results.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    clearMarkers();
    (map.getSource("spaces") as GeoJSONSource | undefined)?.setData(geojson(items));
  }, [items, ready, clearMarkers, geojson]);

  // New search centre or radius: redraw the circle, origin marker and frame.
  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!ready || !map || !lib) return;
    (map.getSource("radius") as GeoJSONSource | undefined)?.setData(radiusGeojson());

    originRef.current?.remove();
    originRef.current = null;
    if (center) {
      const el = document.createElement("div");
      el.className = center.source === "device" ? "sg-origin sg-origin-device" : "sg-origin";
      el.setAttribute("aria-hidden", "true");
      originRef.current = new lib.Marker({ element: el, anchor: "center" })
        .setLngLat([center.lng, center.lat])
        .addTo(map);
    }
    frame(true);
    // frameKey changes per search; center/radius are read from stateRef.
  }, [frameKey, ready, frame, radiusGeojson, center]);

  // Selection / hover highlight, and bring the selected marker into view.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    syncMarkers();
    if (!selectedId) return;
    const item = itemsRef.current.find((i) => i.space.id === selectedId);
    if (!item) return;
    const bounds = map.getBounds();
    if (!bounds.contains([item.point.lng, item.point.lat])) {
      map.easeTo({ center: [item.point.lng, item.point.lat], duration: reducedMotion() ? 0 : 400 });
    }
  }, [selectedId, hoveredId, ready, syncMarkers]);

  const searchThisArea = () => {
    const map = mapRef.current;
    if (!map) return;
    const c = map.getCenter();
    const ne = map.getBounds().getNorthEast();
    const radius = radiusForBounds({ lat: c.lat, lng: c.lng }, { lat: ne.lat, lng: ne.lng });
    userMovedRef.current = false;
    setShowSearchArea(false);
    onSearchArea({ lat: c.lat, lng: c.lng }, radius);
  };

  return (
    <div className={cn("relative h-full w-full overflow-hidden bg-surface-muted", className)}>
      <div
        ref={containerRef}
        // MapLibre adds position: relative to its container, so size it
        // directly instead of with absolute insets.
        className="h-full w-full"
        role="region"
        aria-label="Map of workspaces. Locations are approximate."
      />

      {!ready && !failed && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="rounded-full bg-surface px-4 py-2 text-sm text-ink-muted shadow-sm">Loading map…</span>
        </div>
      )}

      {failed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface-muted p-6 text-center">
          <MapPinOff className="h-6 w-6 text-ink-subtle" aria-hidden="true" />
          <p className="max-w-xs text-sm text-ink-muted">
            The map couldn&apos;t load. The list still shows every result.
          </p>
          <button
            type="button"
            onClick={() => {
              triedFallbackRef.current = false;
              setFailed(false);
              mapRef.current?.setStyle(styleUrl(themeRef.current), { diff: false });
            }}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-line-strong bg-surface px-4 text-sm font-medium text-ink hover:bg-surface-muted"
          >
            <RotateCw className="h-4 w-4" aria-hidden="true" />
            Try again
          </button>
        </div>
      )}

      {ready && showSearchArea && (
        <button
          type="button"
          onClick={searchThisArea}
          className="sg-float-in absolute left-1/2 top-3 z-10 inline-flex h-10 -translate-x-1/2 items-center gap-2 rounded-full bg-ink px-4 text-sm font-semibold text-surface shadow-md transition-transform duration-150 active:scale-[0.97]"
        >
          <Crosshair className="h-4 w-4" aria-hidden="true" />
          Search this area
        </button>
      )}

      {ready && center && (
        <button
          type="button"
          onClick={() => frame(true)}
          aria-label="Recenter on search area"
          title="Recenter"
          className="absolute bottom-9 right-2.5 z-10 flex h-10 w-10 items-center justify-center rounded-md border border-line bg-surface text-ink shadow-sm transition-colors hover:bg-surface-muted"
        >
          <LocateFixed className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export default DiscoverMap;
