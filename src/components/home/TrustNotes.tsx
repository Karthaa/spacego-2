import React from "react";
import { CalendarCheck, Receipt, UserCheck } from "lucide-react";

/** Plain statements about how the product works today; no unverifiable claims. */
const NOTES = [
  {
    icon: UserCheck,
    title: "Hosts confirm every request",
    body: "Unless a space offers Instant Book, nothing is booked until the host approves it.",
  },
  {
    icon: Receipt,
    title: "Prices set by the host",
    body: "You see the rate and a 10% service fee before you send a request.",
  },
  {
    icon: CalendarCheck,
    title: "Everything in one place",
    body: "Requests, confirmations and access codes live in your bookings dashboard.",
  },
];

export function TrustNotes() {
  return (
    <section aria-labelledby="trust-heading" className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
      <h2 id="trust-heading" className="sr-only">What to expect</h2>
      <ul className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {NOTES.map(({ icon: Icon, title, body }) => (
          <li key={title} className="flex gap-4">
            <Icon className="mt-0.5 h-6 w-6 shrink-0 text-accent" aria-hidden="true" />
            <div>
              <h3 className="text-base font-semibold text-ink">{title}</h3>
              <p className="mt-1 text-base text-ink-muted">{body}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
