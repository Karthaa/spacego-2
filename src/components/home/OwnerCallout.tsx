import React from "react";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/Button";
import { SafeImage } from "@/components/ui/SafeImage";

const OWNER_IMAGE =
  "https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=1400&q=80";

export function OwnerCallout() {
  return (
    <section aria-labelledby="owners-heading" className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
      <div className="grid overflow-hidden rounded-lg border border-line bg-surface lg:grid-cols-2">
        <div className="flex flex-col justify-center p-6 sm:p-10">
          <p className="text-sm font-medium text-accent">For property owners</p>
          <h2 id="owners-heading" className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Have space that sits empty?
          </h2>
          <p className="mt-3 text-base text-ink-muted">
            List a ready-to-use workspace and manage booking requests from your host dashboard.
            If the space needs work first, send it to our activation team and we&apos;ll review what it would take to open it.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link href="/owner/spaces/new" className={buttonClasses({ variant: "primary", size: "lg" })}>
              List your space
            </Link>
            <Link href="/activation" className={buttonClasses({ variant: "outline", size: "lg" })}>
              Request an activation review
            </Link>
          </div>
        </div>
        <div className="relative min-h-56 lg:min-h-full">
          <SafeImage
            fill
            src={OWNER_IMAGE}
            alt="An empty, bright office floor"
            width={1400}
            height={933}
            sizes="(min-width: 1024px) 40rem, 100vw"
            loading="lazy"
          />
        </div>
      </div>
    </section>
  );
}
