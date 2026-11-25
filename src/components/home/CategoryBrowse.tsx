import React from "react";
import Link from "next/link";
import { Armchair, Building, Clapperboard, GraduationCap, Mic, Presentation, Users } from "lucide-react";
import { CATEGORIES } from "@/lib/categories";
import type { WorkspaceCategory } from "@/types";

const ICONS: Record<WorkspaceCategory, React.ComponentType<{ className?: string }>> = {
  coworking: Armchair,
  private_office: Building,
  meeting_room: Users,
  training_room: GraduationCap,
  studio: Mic,
  event_space: Presentation,
};

export function CategoryBrowse() {
  return (
    <section aria-labelledby="browse-heading" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <h2 id="browse-heading" className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
        Browse by type of space
      </h2>
      <p className="mt-2 text-base text-ink-muted">Pick what you need and narrow it down by location and size.</p>

      <ul className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CATEGORIES.map((category) => {
          const Icon = ICONS[category.id] ?? Clapperboard;
          return (
            <li key={category.id}>
              <Link
                href={`/spaces?category=${category.id}`}
                className="flex h-full items-start gap-4 rounded-lg border border-line bg-surface p-5 transition-colors hover:border-line-strong hover:bg-surface-muted"
              >
                <span
                  aria-hidden="true"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent-soft-ink"
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-base font-semibold text-ink">{category.label}</span>
                  <span className="mt-0.5 block text-sm text-ink-muted">{category.description}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
