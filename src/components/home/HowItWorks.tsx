import React from "react";

const STEPS = [
  {
    title: "Search and compare",
    body: "Filter by location, type of space, size and price. Each listing shows its amenities, opening hours and house rules.",
  },
  {
    title: "Send a booking request",
    body: "Choose a date and duration and send your request. Spaces marked Instant Book are confirmed straight away.",
  },
  {
    title: "The host confirms",
    body: "The host approves or declines your request. Once confirmed, your access code appears in your bookings.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="how-heading" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-16 sm:px-6 lg:px-8">
      <h2 id="how-heading" className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
        How booking works
      </h2>
      <ol className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
        {STEPS.map((step, index) => (
          <li key={step.title} className="rounded-lg border border-line bg-surface p-6">
            <span
              aria-hidden="true"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-base font-semibold text-accent-soft-ink"
            >
              {index + 1}
            </span>
            <h3 className="mt-4 text-lg font-semibold text-ink">{step.title}</h3>
            <p className="mt-2 text-base text-ink-muted">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
