/**
 * Built-in list of well-known areas, used for suggestions when no geocoding
 * provider is configured (and as instant suggestions when one is). These are
 * public place centroids, rounded; they say nothing about where listings are.
 */
export interface KnownPlace {
  label: string;
  /** Extra words that should match, e.g. the city a neighbourhood is in. */
  aliases?: string;
  lat: number;
  lng: number;
}

export const KNOWN_PLACES: KnownPlace[] = [
  { label: "Kochi", aliases: "cochin ernakulam kerala", lat: 9.9816, lng: 76.2999 },
  { label: "Kakkanad, Kochi", aliases: "kerala", lat: 10.0159, lng: 76.3419 },
  { label: "Infopark, Kochi", aliases: "kakkanad kerala", lat: 10.0105, lng: 76.3638 },
  { label: "Edappally, Kochi", aliases: "edapally lulu kerala", lat: 10.0261, lng: 76.3086 },
  { label: "MG Road, Kochi", aliases: "ernakulam kerala", lat: 9.9706, lng: 76.2856 },
  { label: "Kaloor, Kochi", aliases: "ernakulam kerala", lat: 9.9975, lng: 76.292 },
  { label: "Vyttila, Kochi", aliases: "ernakulam kerala", lat: 9.9674, lng: 76.3203 },
  { label: "Palarivattom, Kochi", aliases: "ernakulam kerala", lat: 10.0037, lng: 76.3075 },
  { label: "Panampilly Nagar, Kochi", aliases: "ernakulam kerala", lat: 9.9592, lng: 76.295 },
  { label: "Fort Kochi", aliases: "cochin kerala", lat: 9.9658, lng: 76.2421 },
  { label: "Aluva", aliases: "kochi kerala", lat: 10.1076, lng: 76.3516 },
  { label: "Thrippunithura", aliases: "tripunithura kochi kerala", lat: 9.9439, lng: 76.3489 },
  { label: "Thiruvananthapuram", aliases: "trivandrum kerala", lat: 8.5241, lng: 76.9366 },
  { label: "Technopark, Thiruvananthapuram", aliases: "trivandrum kazhakootam kerala", lat: 8.558, lng: 76.881 },
  { label: "Kozhikode", aliases: "calicut kerala", lat: 11.2588, lng: 75.7804 },
  { label: "Thrissur", aliases: "trichur kerala", lat: 10.5276, lng: 76.2144 },
  { label: "Coimbatore", aliases: "tamil nadu", lat: 11.0168, lng: 76.9558 },
  { label: "Bengaluru", aliases: "bangalore karnataka", lat: 12.9716, lng: 77.5946 },
  { label: "Chennai", aliases: "madras tamil nadu", lat: 13.0827, lng: 80.2707 },
  { label: "Hyderabad", aliases: "telangana", lat: 17.385, lng: 78.4867 },
  { label: "Mumbai", aliases: "bombay maharashtra", lat: 19.076, lng: 72.8777 },
  { label: "Pune", aliases: "maharashtra", lat: 18.5204, lng: 73.8567 },
  { label: "New Delhi", aliases: "delhi ncr", lat: 28.6139, lng: 77.209 },
  { label: "Gurugram", aliases: "gurgaon ncr haryana", lat: 28.4595, lng: 77.0266 },
  { label: "San Francisco", aliases: "sf california usa", lat: 37.7749, lng: -122.4194 },
  { label: "New York", aliases: "nyc manhattan usa", lat: 40.7128, lng: -74.006 },
  { label: "London", aliases: "uk england", lat: 51.5074, lng: -0.1278 },
  { label: "Berlin", aliases: "germany", lat: 52.52, lng: 13.405 },
  { label: "Singapore", lat: 1.3521, lng: 103.8198 },
];

export function matchKnownPlaces(query: string, limit = 6): KnownPlace[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored: { place: KnownPlace; score: number }[] = [];
  for (const place of KNOWN_PLACES) {
    const label = place.label.toLowerCase();
    const hay = `${label} ${place.aliases ?? ""}`;
    let score = -1;
    if (label.startsWith(q)) score = 3;
    else if (label.split(/[\s,]+/).some((w) => w.startsWith(q))) score = 2;
    else if (hay.includes(q)) score = 1;
    if (score >= 0) scored.push({ place, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.place.label.length - b.place.label.length)
    .slice(0, limit)
    .map((s) => s.place);
}
