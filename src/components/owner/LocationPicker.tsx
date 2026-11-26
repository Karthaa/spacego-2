"use client";

import React, { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapPin } from "lucide-react";
import { LocationSearch } from "@/components/discover/LocationSearch";
import { useGeolocation } from "@/lib/geo/useGeolocation";
import { isValidLatLng, type LatLng } from "@/lib/geo";
import { FALLBACK_MAP_STYLE, MAP_STYLE_OVERRIDE, mapStyleUrl } from "@/lib/geo/mapStyle";
import { useResolvedTheme } from "@/lib/theme";

interface LocationPickerProps {
  value: LatLng | null;
  onChange: (point: LatLng) => void;
  /** id for the error message, so the form can point at it. */
  errorId?: string;
  error?: string;
}

const KOCHI: LatLng = { lat: 9.9816, lng: 76.2999 };

/**
 * Host-side pin picker: search an area (or use the device location), then
 * click the map or drag the pin onto the building. The exact pin is stored
 * privately; guests only ever see an approximate area.
 */
export function LocationPicker({ value, onChange, errorId, error }: LocationPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const libRef = useRef<typeof import("maplibre-gl") | null>(null);
  const onChangeRef = useRef(onChange);
  const initialRef = useRef(value);
  const theme = useResolvedTheme();
  const themeRef = useRef(theme);
  const geo = useGeolocation();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const placePin = (point: LatLng, fly: boolean) => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!map || !lib) return;
    if (!markerRef.current) {
      const el = document.createElement("div");
      el.className = "sg-pin";
      el.setAttribute("aria-hidden", "true");
      markerRef.current = new lib.Marker({ element: el, draggable: true, anchor: "bottom" })
        .setLngLat([point.lng, point.lat])
        .addTo(map);
      markerRef.current.on("dragend", () => {
        const ll = markerRef.current!.getLngLat();
        onChangeRef.current({ lat: Number(ll.lat.toFixed(6)), lng: Number(ll.lng.toFixed(6)) });
      });
    } else {
      markerRef.current.setLngLat([point.lng, point.lat]);
    }
    if (fly) map.easeTo({ center: [point.lng, point.lat], zoom: Math.max(map.getZoom(), 16), duration: 400 });
  };

  useEffect(() => {
    let cancelled = false;
    let triedFallback = false;
    (async () => {
      const lib = await import("maplibre-gl");
      if (cancelled || !containerRef.current) return;
      libRef.current = lib;
      const start = initialRef.current && isValidLatLng(initialRef.current.lat, initialRef.current.lng) ? initialRef.current : null;
      const map = new lib.Map({
        container: containerRef.current,
        style: mapStyleUrl(themeRef.current),
        center: start ? [start.lng, start.lat] : [KOCHI.lng, KOCHI.lat],
        zoom: start ? 16 : 11,
        attributionControl: { compact: true },
        cooperativeGestures: true,
        dragRotate: false,
        pitchWithRotate: false,
      });
      map.touchZoomRotate.disableRotation();
      map.addControl(new lib.NavigationControl({ showCompass: false }), "top-right");
      mapRef.current = map;
      map.on("load", () => {
        if (start) placePin(start, false);
      });
      map.on("click", (e) => {
        const point = { lat: Number(e.lngLat.lat.toFixed(6)), lng: Number(e.lngLat.lng.toFixed(6)) };
        placePin(point, false);
        onChangeRef.current(point);
      });
      map.on("style.load", () => setFailed(false));
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
      markerRef.current?.remove();
      markerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // The map is created once.
  }, []);

  useEffect(() => {
    if (themeRef.current === theme) return;
    themeRef.current = theme;
    mapRef.current?.setStyle(mapStyleUrl(theme), { diff: false });
  }, [theme]);

  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-ink">
        <MapPin className="h-4 w-4 text-ink-subtle" aria-hidden="true" />
        Pin on the map <span className="text-danger" aria-hidden="true">*</span>
      </p>
      <LocationSearch
        value=""
        onPick={(c) => {
          mapRef.current?.easeTo({ center: [c.lng, c.lat], zoom: 15.5, duration: 400 });
        }}
        onUseMyLocation={async () => {
          const pos = await geo.locate();
          if (pos) {
            placePin(pos, true);
            onChangeRef.current({ lat: Number(pos.lat.toFixed(6)), lng: Number(pos.lng.toFixed(6)) });
          }
        }}
        geoStatus={geo.status}
      />
      {geo.message && <p className="mt-2 text-sm text-warning" role="alert">{geo.message}</p>}
      <div className="relative mt-3 h-72 overflow-hidden rounded-lg border border-line bg-surface-muted sm:h-80">
        <div
          ref={containerRef}
          className="h-full w-full"
          role="region"
          aria-label="Map. Click to place the pin on your building, or drag the pin to adjust it."
        />
        {failed && (
          <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-ink-muted">
            The map couldn&apos;t load. Reload the page to try again.
          </p>
        )}
      </div>
      <p className="mt-2 text-sm text-ink-muted" id={errorId && !error ? errorId : undefined}>
        {value
          ? "Pin set. Drag it if it isn't exactly on your building."
          : "Search your area, then click the map on your building."}{" "}
        Guests see only an approximate area of about 500 m on the map.
      </p>
      {error && (
        <p className="mt-1 text-sm font-medium text-danger" id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export default LocationPicker;
