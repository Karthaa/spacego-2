import type { WorkspaceCategory } from "@/types";

export interface CategoryInfo {
  id: WorkspaceCategory;
  label: string;
  description: string;
}

/** Display metadata for workspace categories (single source for all pages). */
export const CATEGORIES: CategoryInfo[] = [
  { id: "coworking", label: "Coworking desks", description: "A desk for a day or a month in a shared space." },
  { id: "private_office", label: "Private offices", description: "A lockable room for you or your team." },
  { id: "meeting_room", label: "Meeting rooms", description: "Rooms for client meetings and workshops." },
  { id: "training_room", label: "Training rooms", description: "Larger rooms for classes and sessions." },
  { id: "studio", label: "Studios", description: "Spaces for recording, photo and video work." },
  { id: "event_space", label: "Event spaces", description: "Venues for launches, talks and gatherings." },
];

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
  };
  return nouns[id] ?? categoryLabel(id);
}
