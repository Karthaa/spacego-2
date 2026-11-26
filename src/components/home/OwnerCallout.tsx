import React from "react";
import Link from "next/link";
import { SafeImage } from "@/components/ui/SafeImage";
import { cn } from "@/lib/utils";

const OWNER_IMAGE =
  "https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=2000&q=80";

/** Host call-out: a full-width photo panel with the offer on top of it. */
export function OwnerCallout() {
  // Light pills on photography (always light, in both themes).
  const pill =
    "inline-flex h-12 items-center justify-center rounded-full px-6 text-base font-semibold transition-colors duration-150";

  return (
    <section aria-labelledby="owners-heading" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="relative isolate overflow-hidden rounded-xl bg-black">
        <SafeImage
          fill
          src={OWNER_IMAGE}
          alt=""
          width={2000}
          height={1333}
          sizes="(min-width: 1280px) 80rem, 100vw"
          loading="lazy"
          wrapperClassName="-z-10"
        />
        <div className="absolute inset-0 -z-10 bg-black/55" aria-hidden="true" />

        <div className="max-w-2xl px-6 py-14 sm:px-10 sm:py-20 lg:px-14">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-photo-ink/80">For property owners</p>
          <h2 id="owners-heading" className="mt-3 font-display text-4xl leading-tight text-photo-ink sm:text-5xl">
            Have space that sits empty?
          </h2>
          <p className="mt-4 text-base text-photo-ink/85 sm:text-lg">
            List a ready-to-use workspace and manage requests from your host dashboard. If the space needs work
            first, send it to our activation team and we&apos;ll review what it would take to open it.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/owner/spaces/new" className={cn(pill, "bg-[#ffffff] text-neutral-900 hover:bg-[#ffffff]/90")}>
              List your space
            </Link>
            <Link
              href="/activation"
              className={cn(pill, "border border-[#ffffff]/60 text-photo-ink hover:bg-[#ffffff]/10")}
            >
              Request an activation review
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
