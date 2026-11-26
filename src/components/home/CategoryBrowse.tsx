import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CATEGORIES } from "@/lib/categories";
import type { WorkspaceCategory } from "@/types";
import { SafeImage } from "@/components/ui/SafeImage";
import { SectionHeader } from "@/components/home/SectionHeader";

const unsplash = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&q=80`;

/** One interior photo per type of space (decorative; the label carries the meaning). */
const PHOTOS: Record<WorkspaceCategory, string> = {
  coworking: unsplash("photo-1504384308090-c894fdcc538d"),
  private_office: unsplash("photo-1497215728101-856f4ea42174"),
  meeting_room: unsplash("photo-1517502884422-41eaead166d4"),
  training_room: unsplash("photo-1517048676732-d65bc937f952"),
  studio: unsplash("photo-1598488035139-bdbb2231ce04"),
  event_space: unsplash("photo-1511578314322-379afb476865"),
  auditorium: unsplash("photo-1540575467063-178a50c2df87"),
  parking: unsplash("photo-1506521781263-d8422e82f27a"),
};

export function CategoryBrowse() {
  return (
    <section aria-labelledby="browse-heading" className="mx-auto max-w-7xl px-4 pt-16 sm:px-6 sm:pt-20 lg:px-8">
      <SectionHeader
        id="browse-heading"
        title="Browse by type of space"
        description="From a desk for the afternoon to a hall for an event, or a place to park."
        action={{ href: "/spaces", label: "All spaces" }}
      />

      {/* Phones: one swipeable row. From sm: a grid. */}
      <ul className="-mx-4 mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 sm:pb-0">
        {CATEGORIES.map((category) => (
          <li key={category.id} className="w-40 shrink-0 snap-start sm:w-auto">
            <Link href={`/spaces?category=${category.id}`} className="group block rounded-lg">
              <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-surface-muted sm:aspect-[4/3]">
                <SafeImage
                  fill
                  src={PHOTOS[category.id]}
                  alt=""
                  width={800}
                  height={1000}
                  sizes="(min-width: 1280px) 19rem, (min-width: 640px) 25vw, 10rem"
                  loading="lazy"
                  className="object-cover transition-transform duration-300 ease-standard group-hover:scale-[1.03]"
                />
              </div>
              <p className="mt-3 flex items-center gap-1 text-sm font-semibold text-ink">
                {category.label}
                <ArrowRight
                  className="h-3.5 w-3.5 -translate-x-1 opacity-0 transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100"
                  aria-hidden="true"
                />
              </p>
              <p className="mt-0.5 line-clamp-2 text-sm text-ink-muted">{category.description}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
