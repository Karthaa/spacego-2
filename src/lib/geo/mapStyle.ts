/**
 * Basemap style for MapLibre: NEXT_PUBLIC_MAP_STYLE_URL if set, MapTiler when
 * NEXT_PUBLIC_MAPTILER_KEY is set, otherwise OpenFreeMap (free, no key; its
 * styles carry the OpenStreetMap attribution MapLibre displays).
 */
const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY;
export const MAP_STYLE_OVERRIDE = process.env.NEXT_PUBLIC_MAP_STYLE_URL;
export const FALLBACK_MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

export function mapStyleUrl(theme: "light" | "dark"): string {
  if (MAP_STYLE_OVERRIDE) return MAP_STYLE_OVERRIDE;
  if (MAPTILER_KEY) {
    const id = theme === "dark" ? "dataviz-dark" : "dataviz";
    return `https://api.maptiler.com/maps/${id}/style.json?key=${encodeURIComponent(MAPTILER_KEY)}`;
  }
  return `https://tiles.openfreemap.org/styles/${theme === "dark" ? "dark" : "positron"}`;
}
