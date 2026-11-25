import React from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

const COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Find a space",
    links: [
      { href: "/spaces?category=coworking", label: "Coworking desks" },
      { href: "/spaces?category=private_office", label: "Private offices" },
      { href: "/spaces?category=meeting_room", label: "Meeting rooms" },
      { href: "/spaces?category=training_room", label: "Training rooms" },
      { href: "/spaces?category=studio", label: "Studios" },
      { href: "/spaces?category=event_space", label: "Event spaces" },
    ],
  },
  {
    title: "For owners",
    links: [
      { href: "/owner/spaces/new", label: "List a ready space" },
      { href: "/activation", label: "Activate an empty property" },
      { href: "/activation/track", label: "Track an activation request" },
      { href: "/owner", label: "Host dashboard" },
    ],
  },
  {
    title: "SpaceGo",
    links: [
      { href: "/#how-it-works", label: "How booking works" },
      { href: "/dashboard", label: "Your bookings" },
      { href: "/auth/register", label: "Create an account" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-auto border-t border-line bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-3 lg:col-span-2">
            <Link href="/" className="inline-flex items-center rounded-md" aria-label="SpaceGo home">
              <Logo size="md" />
            </Link>
            <p className="max-w-sm text-base text-ink-muted">
              Find the right space for focused work, meetings and events, and book it directly with the host.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <nav key={column.title} aria-label={column.title} className="space-y-3">
              <h2 className="text-sm font-semibold text-ink">{column.title}</h2>
              <ul className="space-y-1">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="inline-flex min-h-9 items-center text-sm text-ink-muted transition-colors hover:text-ink pointer-coarse:min-h-11"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-line pt-6 text-sm text-ink-subtle sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} SpaceGo. All rights reserved.</p>
          <p>Prices are set by hosts. Bookings are confirmed by the host unless marked Instant Book.</p>
        </div>
      </div>
    </footer>
  );
}
