/**
 * Directory of real Kochi workspaces that are NOT on SpaceGo.
 *
 * These businesses have not joined SpaceGo. The entries are static reference
 * data taken from public listings: they are never written to the database,
 * never mixed into SpaceGoStore, and must not appear in /spaces, /discover,
 * the map, saved lists or search results. Nothing here is bookable.
 */

export type DirectoryKind = "Coworking space" | "Business centre";

export type DirectoryEntry = {
  id: string;
  name: string;
  /** Parent brand for chain centres. */
  operator?: string;
  /** Filter value (a broad area of Kochi). */
  area: string;
  /** Locality as the source publishes it. */
  locality: string;
  kind: DirectoryKind;
  /** Official website, only when confirmed. Empty means "Open in Maps" only. */
  website?: string;
  mapsUrl: string;
  /** Public listing the entry was taken from. */
  sourceUrl: string;
  /** ISO date the entry was last checked against its source. */
  checkedOn: string;
};

export const DIRECTORY_CHECKED_ON = "2026-11-26";
export const OTHER_AREAS = "Other areas";

const COFYND = "https://cofynd.com/coworking/kochi";
const COWORKER = "https://www.coworker.com/india/kochi/tablespace";
const INDIQUBE = "https://indiqube.com/kochi/";
const REGUS = "https://www.regus.com/en-gb/india/kochi/coworking";

type Seed = Omit<DirectoryEntry, "id" | "mapsUrl" | "checkedOn"> & {
  /** Maps search text, when name + locality would not find a single place. */
  mapsQuery?: string;
};

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** "2026-11-26" -> "26 Nov 2026" (fixed locale and zone, so server and client agree). */
export function formatCheckedOn(isoDate: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${isoDate}T00:00:00Z`)
  );
}

export function mapsSearchUrl(query: string): string {
  return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(query);
}

const SEEDS: Seed[] = [
  { name: "Anaarworx", area: "Kakkanad", locality: "Kakkanad", kind: "Coworking space", sourceUrl: COFYND },
  { name: "Worksphere", area: "Kakkanad", locality: "Infopark, Kakkanad", kind: "Coworking space", sourceUrl: COFYND },
  { name: "Collective Coworks (CoCo)", area: "Kakkanad", locality: "Infopark Road, Kakkanad", kind: "Coworking space", sourceUrl: COFYND },
  { name: "Cove Workspaces", area: "Kakkanad", locality: "Kakkanad", kind: "Coworking space", sourceUrl: COFYND },
  { name: "Spacelance", area: OTHER_AREAS, locality: "Valamkottil Towers", kind: "Coworking space", sourceUrl: COFYND },
  { name: "Bodhi Infotech", area: "Kalamassery", locality: "Kinfra Park", kind: "Coworking space", sourceUrl: COFYND },
  { name: "Arya Bhangy", area: "Kalamassery", locality: "Kalamassery", kind: "Coworking space", sourceUrl: COFYND },
  { name: "CORRAZONE", area: "Kalamassery", locality: "Kalamassery", kind: "Coworking space", sourceUrl: COFYND },
  { name: "Kssia Technocity", area: "Kalamassery", locality: "HMT Road", kind: "Coworking space", sourceUrl: COFYND },
  { name: "Wagmi Workspace", area: "Edappally", locality: "Edappally", kind: "Coworking space", sourceUrl: COFYND },
  { name: "MARQ", area: "Edappally", locality: "Edappally", kind: "Coworking space", sourceUrl: COFYND },
  { name: "Dotspace", area: "Edappally", locality: "Edappally", kind: "Coworking space", sourceUrl: COFYND },
  { name: "Calm Workspaces", area: "Palarivattom", locality: "Palarivattom", kind: "Coworking space", sourceUrl: COFYND },
  { name: "Cowired", area: "Palarivattom", locality: "Palarivattom", kind: "Coworking space", sourceUrl: COFYND },
  { name: "Centre A", area: "MG Road", locality: "MG Road", kind: "Coworking space", sourceUrl: COFYND },
  { name: "Fortune Cowork", area: "MG Road", locality: "Near MG Road metro station", kind: "Coworking space", sourceUrl: COFYND },
  { name: "Innerspace Coworking", area: "Ernakulam", locality: "SRM Road", kind: "Coworking space", sourceUrl: COFYND },
  { name: "Factorm", area: "Vyttila", locality: "October Road, Vyttila", kind: "Coworking space", sourceUrl: COFYND },
  { name: "Workzo", area: "Tripunithura", locality: "Tripunithura", kind: "Coworking space", sourceUrl: COFYND },
  { name: "Bee Worker", area: "Aluva", locality: "Grande Tower, Pulinchode Junction, Aluva", kind: "Coworking space", sourceUrl: COFYND },
  { name: "GreenNest Business Centre", area: "Ernakulam", locality: "Ernakulam", kind: "Business centre", sourceUrl: COFYND },
  { name: "dewSpace", area: "Ernakulam", locality: "Ernakulam", kind: "Coworking space", sourceUrl: COFYND },
  { name: "CIASL Business Centre", area: "Ernakulam", locality: "Ernakulam", kind: "Business centre", sourceUrl: COFYND },
  { name: "Next57", area: OTHER_AREAS, locality: "Kochi", kind: "Coworking space", sourceUrl: COWORKER },
  { name: "InQ Cowork", area: OTHER_AREAS, locality: "Kochi", kind: "Coworking space", sourceUrl: COWORKER },
  { name: "Wolfpack Workspaces", area: OTHER_AREAS, locality: "Kochi", kind: "Coworking space", sourceUrl: COWORKER },
  { name: "Clover Business Center", area: OTHER_AREAS, locality: "Kochi", kind: "Business centre", sourceUrl: COWORKER },
  {
    name: "Awfis",
    operator: "Awfis",
    area: "MG Road",
    locality: "Mezhukkattil Matrix, Chittoor Road",
    kind: "Coworking space",
    website: "https://www.awfis.com/",
    sourceUrl: "https://www.awfis.com/inspiration/?p=10638",
  },
  {
    name: "Incuspaze Oberon Mall",
    operator: "Incuspaze",
    area: "Edappally",
    locality: "Oberon Mall, Edappally",
    kind: "Coworking space",
    website: "https://www.incuspaze.com/kochi/space-details/incuspaze-oberon-mall",
    sourceUrl: "https://www.incuspaze.com/kochi/space-details/incuspaze-oberon-mall",
  },
  {
    name: "Incuspaze Infra Futura",
    operator: "Incuspaze",
    area: "Kakkanad",
    locality: "Infra Futura, Seaport-Airport Road, Kakkanad",
    kind: "Coworking space",
    website: "https://www.incuspaze.com/kochi/space-details/incuspaze-infra-futura",
    sourceUrl: "https://www.incuspaze.com/kochi/space-details/incuspaze-infra-futura",
  },
  {
    name: "Incuspaze Deshabhimani Road",
    operator: "Incuspaze",
    area: "Ernakulam",
    locality: "Deshabhimani Road",
    kind: "Coworking space",
    sourceUrl: COFYND,
  },
  { name: "IndiQube Paradise", operator: "IndiQube", area: "Palarivattom", locality: "Palarivattom", kind: "Coworking space", website: INDIQUBE, sourceUrl: INDIQUBE },
  { name: "IndiQube Square", operator: "IndiQube", area: "Edappally", locality: "Edappally", kind: "Coworking space", website: INDIQUBE, sourceUrl: INDIQUBE },
  { name: "IndiQube Cyber Green", operator: "IndiQube", area: "Kakkanad", locality: "Kakkanad", kind: "Coworking space", website: INDIQUBE, sourceUrl: INDIQUBE },
  { name: "IndiQube Caspian", operator: "IndiQube", area: "Kakkanad", locality: "Kakkanad", kind: "Coworking space", website: INDIQUBE, sourceUrl: INDIQUBE },
  {
    name: "Regus and Spaces",
    operator: "IWG",
    area: OTHER_AREAS,
    locality: "Centres in Kakkanad (Infopark), Marine Drive, MG Road and Kalamassery",
    kind: "Coworking space",
    website: REGUS,
    sourceUrl: REGUS,
    // Several centres: a single-place search would not match the locality text.
    mapsQuery: "Regus, Kochi, Kerala",
  },
];

export const KOCHI_DIRECTORY: readonly DirectoryEntry[] = SEEDS.map(({ mapsQuery, ...seed }) => ({
  ...seed,
  id: slug(seed.name),
  mapsUrl: mapsSearchUrl(mapsQuery ?? `${seed.name}, ${seed.locality}, Kochi, Kerala`),
  checkedOn: DIRECTORY_CHECKED_ON,
}));

/** Areas in the order they first appear, with "Other areas" last. */
export const KOCHI_DIRECTORY_AREAS: readonly string[] = (() => {
  const seen = Array.from(new Set(KOCHI_DIRECTORY.map((entry) => entry.area)));
  return [...seen.filter((area) => area !== OTHER_AREAS), ...(seen.includes(OTHER_AREAS) ? [OTHER_AREAS] : [])];
})();
