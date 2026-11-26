"use client";

import React from "react";
import Link from "next/link";
import { Heart, LocateFixed, Search, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Bottom tab bar for phones and small tablets (hidden from lg up).
 * Rendered by the Navbar on the home page and the search list only; screens
 * with their own bottom controls (map toggle, booking box) do not show it.
 * The spacer keeps page content (and the footer) clear of the fixed bar.
 */
export function MobileTabBar({
  pathname,
  accountHref,
  accountLabel,
}: {
  pathname: string;
  accountHref: string;
  accountLabel: string;
}) {
  const tabs = [
    { href: "/spaces", label: "Explore", icon: Search, active: pathname === "/" || pathname.startsWith("/spaces") },
    { href: "/discover", label: "Near me", icon: LocateFixed, active: pathname.startsWith("/discover") },
    { href: "/dashboard/saved", label: "Saved", icon: Heart, active: pathname.startsWith("/dashboard/saved") },
    { href: accountHref, label: accountLabel, icon: UserRound, active: pathname.startsWith("/auth") },
  ];

  return (
    <>
      <nav
        aria-label="Quick links"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line/80 bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl backdrop-saturate-150 lg:hidden"
      >
        <ul className="mx-auto grid max-w-md grid-cols-4">
          {tabs.map(({ href, label, icon: Icon, active }) => (
            <li key={label}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors",
                  active ? "text-accent" : "text-ink-muted hover:text-ink"
                )}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {/* In-flow spacer at the end of the page so the last content is not hidden. */}
      <div aria-hidden="true" className="order-last h-[calc(3.5rem+env(safe-area-inset-bottom))] lg:hidden" />
    </>
  );
}
