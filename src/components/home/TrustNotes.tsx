import React from "react";
import { BadgeCheck, CalendarCheck, LockKeyhole, Receipt } from "lucide-react";
import { SectionHeader } from "@/components/home/SectionHeader";

/** Plain statements about how the product works today; no unverifiable claims. */
const NOTES = [
  {
    icon: CalendarCheck,
    title: "Hosts confirm every request",
    body: "Unless a space offers Instant Book, nothing is booked until the host approves it.",
  },
  {
    icon: Receipt,
    title: "The full price up front",
    body: "You see the host's rate and the 10% service fee before you send a request.",
  },
  {
    icon: LockKeyhole,
    title: "Exact address after confirmation",
    body: "Listings show the approximate area. The host shares the address once your booking is confirmed.",
  },
  {
    icon: BadgeCheck,
    title: "Badges you can check",
    body: "A SpaceGo badge appears only when our team has recorded a dated check, listed on the space's page.",
  },
];

export function TrustNotes() {
  return (
    <section aria-labelledby="trust-heading" className="mt-16 border-y border-line bg-surface sm:mt-24">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <SectionHeader id="trust-heading" eyebrow="Booking with confidence" title="What you can count on" />
        <ul className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {NOTES.map(({ icon: Icon, title, body }) => (
            <li key={title}>
              <span
                aria-hidden="true"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent-soft-ink"
              >
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-base font-semibold text-ink">{title}</h3>
              <p className="mt-1.5 text-base text-ink-muted">{body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
