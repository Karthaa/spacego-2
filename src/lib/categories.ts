import type { WorkspaceCategory } from "@/types";

export interface CategoryInfo {
  id: WorkspaceCategory;
  label: string;
  description: string;
}

/** Display metadata for space categories (single source for all pages). */
export const CATEGORIES: CategoryInfo[] = [
  { id: "coworking", label: "Coworking desks", description: "A desk for a day or a month in a shared space." },
  { id: "private_office", label: "Private offices", description: "A lockable room for you or your team." },
  { id: "meeting_room", label: "Meeting rooms", description: "Rooms for client meetings and workshops." },
  { id: "training_room", label: "Training rooms", description: "Larger rooms for classes and sessions." },
  { id: "studio", label: "Studios", description: "Spaces for recording, photo and video work." },
  { id: "event_space", label: "Event spaces", description: "Venues for launches, talks and gatherings." },
  { id: "auditorium", label: "Auditoriums", description: "Halls with fixed seating for talks, events and gatherings." },
  { id: "parking", label: "Parking", description: "Car and bike parking by the hour, day or month." },
];

/** Every category id, in display order (for validation). */
export const CATEGORY_IDS: readonly WorkspaceCategory[] = CATEGORIES.map((c) => c.id);

export function isCategory(value: unknown): value is WorkspaceCategory {
  return typeof value === "string" && (CATEGORY_IDS as readonly string[]).includes(value);
}

export function categoryLabel(id: string): string {
  return CATEGORIES.find((c) => c.id === id)?.label ?? id.replace(/_/g, " ");
}

/** Singular label used on cards ("Meeting room"). */
export function categoryNoun(id: string): string {
  const nouns: Record<string, string> = {
    coworking: "Coworking desk",
    private_office: "Private office",
    meeting_room: "Meeting room",
    training_room: "Training room",
    studio: "Studio",
    event_space: "Event space",
    auditorium: "Auditorium",
    parking: "Parking",
  };
  return nouns[id] ?? categoryLabel(id);
}

/** What capacity counts for a category: vehicles for parking, seats for halls, otherwise people. */
export function capacityUnit(category: string, n: number): string {
  if (category === "parking") return n === 1 ? "vehicle" : "vehicles";
  if (category === "auditorium") return n === 1 ? "seat" : "seats";
  return n === 1 ? "person" : "people";
}

/** Full capacity phrase: "Up to 40 vehicles", "800 seats", "Up to 12 people". */
export function capacityLabel(category: string, n: number): string {
  if (category === "auditorium") return `${n} ${capacityUnit(category, n)}`;
  return `Up to ${n} ${capacityUnit(category, n)}`;
}

/** Label for the capacity field in forms. */
export function capacityFieldLabel(category: string): string {
  if (category === "parking") return "Vehicles it holds";
  if (category === "auditorium") return "Seats";
  return "Maximum people";
}
