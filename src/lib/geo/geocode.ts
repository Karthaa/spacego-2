/**
 * Geocoding provider abstraction (server-side only).
 *
 * The only provider wired today is MapTiler, enabled by MAPTILER_API_KEY.
 * Without a key the API route answers 503 and the UI falls back to the cities
 * that real listings are in. Public Nominatim is deliberately not used: its
 * usage policy forbids autocomplete-style traffic from apps like this one.
 */

export interface GeocodeResult {
  label: string;
  lat: number;
  lng: number;
}

export interface GeocodeProvider {
  name: string;
  search(query: string, opts: { country?: string; signal?: AbortSignal }): Promise<GeocodeResult[]>;
}

interface MapTilerFeature {
  place_name?: string;
  text?: string;
  center?: [number, number];
}

function mapTiler(key: string): GeocodeProvider {
  return {
    name: "maptiler",
    async search(query, { country, signal }) {
      const url = new URL(`https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json`);
      url.searchParams.set("key", key);
      url.searchParams.set("limit", "6");
      url.searchParams.set("autocomplete", "true");
      url.searchParams.set("types", "region,subregion,county,joint_municipality,municipality,municipal_district,locality,neighbourhood,place,postal_code,address,poi");
      if (country) url.searchParams.set("country", country);

      const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`Geocoder responded ${res.status}`);
      const body = (await res.json()) as { features?: MapTilerFeature[] };
      return (body.features ?? [])
        .filter((f) => Array.isArray(f.center) && f.center.length === 2)
        .map((f) => ({
          label: (f.place_name || f.text || query).slice(0, 160),
          lng: Number(f.center![0]),
          lat: Number(f.center![1]),
        }))
        .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng));
    },
  };
}

export function getGeocodeProvider(): GeocodeProvider | null {
  const key = process.env.MAPTILER_API_KEY;
  if (key && key.trim()) return mapTiler(key.trim());
  return null;
}
