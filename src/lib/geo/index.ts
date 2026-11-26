/**
 * Location helpers shared by discovery, the map and the store.
 *
 * Distances are straight-line ("as the crow flies"), never travel distance or
 * time. Public points are approximate: coordinates are snapped to the same
 * 0.005 degree grid the database uses (see 20261126_spacego_geo_search.sql),
 * so the client never needs, or shows, a listing's exact position.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export type CenterSource = "place" | "device" | "map";

export interface SearchCenter extends LatLng {
  /** Human label, e.g. "Kakkanad, Kochi" or "Your location". */
  label: string;
  source: CenterSource;
}

export const RADIUS_OPTIONS_KM = [1, 3, 5, 10, 25] as const;
export type RadiusKm = (typeof RADIUS_OPTIONS_KM)[number];
export const DEFAULT_RADIUS_KM: RadiusKm = 5;
/** Matches the server cap in spacego_search_spaces. */
export const MAX_RADIUS_M = 50_000;

const GRID_DEG = 0.005;
const EARTH_RADIUS_M = 6_371_008.8;

export function isValidLatLng(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 85 &&
    Math.abs(lng) <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

/** Snap a coordinate to the public grid (same rule as the database). */
export function approximatePoint(point: LatLng): LatLng {
  const snap = (v: number) => Math.round(v / GRID_DEG) * GRID_DEG;
  return { lat: Number(snap(point.lat).toFixed(6)), lng: Number(snap(point.lng).toFixed(6)) };
}

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in metres. */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Rounded to 100 m, like the server, so both modes read the same. */
export function roundDistance(m: number): number {
  return Math.round(m / 100) * 100;
}

/** "800 m", "1.2 km", "14 km". */
export function formatDistance(m: number): string {
  if (m < 950) return `${Math.max(100, roundDistance(m))} m`;
  const km = m / 1000;
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

/** Radius (m) of the circle centred on `center` that covers the given bounds. */
export function radiusForBounds(center: LatLng, corner: LatLng): number {
  return Math.min(MAX_RADIUS_M, Math.max(500, Math.ceil(haversineMeters(center, corner))));
}

/** A closed ring approximating a circle, for drawing the search radius. */
export function circlePolygon(center: LatLng, radiusM: number, steps = 64): [number, number][] {
  const ring: [number, number][] = [];
  const latR = radiusM / EARTH_RADIUS_M;
  const lat0 = toRad(center.lat);
  const lng0 = toRad(center.lng);
  for (let i = 0; i <= steps; i++) {
    const bearing = (i / steps) * 2 * Math.PI;
    const lat = Math.asin(
      Math.sin(lat0) * Math.cos(latR) + Math.cos(lat0) * Math.sin(latR) * Math.cos(bearing)
    );
    const lng =
      lng0 +
      Math.atan2(
        Math.sin(bearing) * Math.sin(latR) * Math.cos(lat0),
        Math.cos(latR) - Math.sin(lat0) * Math.sin(lat)
      );
    ring.push([(lng * 180) / Math.PI, (lat * 180) / Math.PI]);
  }
  return ring;
}

/** Zoom level that roughly fits a radius on screen. */
export function zoomForRadius(radiusM: number): number {
  const km = radiusM / 1000;
  if (km <= 1) return 14;
  if (km <= 3) return 12.6;
  if (km <= 5) return 12;
  if (km <= 10) return 11;
  if (km <= 25) return 9.6;
  return 8.6;
}

/** Parse "lat,lng"-ish URL params. */
export function parseCenter(params: URLSearchParams): SearchCenter | null {
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  if (!params.get("lat") || !params.get("lng") || !isValidLatLng(lat, lng)) return null;
  const source = params.get("src");
  return {
    lat,
    lng,
    label: (params.get("near") || "").slice(0, 120) || "Selected area",
    source: source === "device" || source === "map" ? source : "place",
  };
}

export function parseRadius(params: URLSearchParams): RadiusKm {
  const r = Number(params.get("r"));
  return (RADIUS_OPTIONS_KM as readonly number[]).includes(r) ? (r as RadiusKm) : DEFAULT_RADIUS_KM;
}
