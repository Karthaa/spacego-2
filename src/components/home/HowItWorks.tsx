import React from "react";
import { SectionHeader } from "@/components/home/SectionHeader";

const STEPS = [
  {
    title: "Search and compare",
    body: "Filter by area, type of space, size and price. Each listing shows its amenities, opening hours and house rules.",
  },
  {
    title: "Send a booking request",
    body: "Choose a date and duration and send your request. Spaces marked Instant Book are confirmed straight away.",
  },
  {
    title: "The host confirms",
    body: "The host approves or declines your request. Once confirmed, the address and your access details appear in your bookings.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-heading"
      className="mx-auto max-w-7xl scroll-mt-20 px-4 pt-16 sm:px-6 sm:pt-24 lg:px-8"
    >
      <SectionHeader id="how-heading" eyebrow="How it works" title="Booking, without the back-and-forth" />
      <ol className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-10">
        {STEPS.map((step, index) => (
          <li key={step.title} className="border-t border-line-strong pt-5">
            <span aria-hidden="true" className="font-mono text-sm tabular-nums text-ink-subtle">
              {String(index + 1).padStart(2, "0")}
            </span>
            <h3 className="mt-3 text-lg font-semibold tracking-tight text-ink">{step.title}</h3>
            <p className="mt-2 text-base text-ink-muted">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
