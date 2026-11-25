"use client";

import React, { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  CalendarCheck,
  Heart,
  MessageSquarePlus,
  UserRound,
} from "lucide-react";
import { Navbar } from "@/components/navigation/Navbar";
import { Footer } from "@/components/navigation/Footer";
import type { UserProfile } from "@/types";
import { cn } from "@/lib/utils";

export interface RoleShellNavItem {
  name: string;
  href: string;
  icon: LucideIcon;
}

const ROLE_LABEL: Record<UserProfile["role"], string> = {
  seeker: "Member",
  owner: "Host",
  admin: "Administrator",
};

function initialsOf(name?: string): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0].charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
  return (first + last).toUpperCase();
}

/** Profile photo when one is set, otherwise the user's initials. */
export function ProfileAvatar({
  name,
  url,
  size = "md",
}: {
  name?: string;
  url?: string;
  size?: "md" | "lg";
}) {
  const sizeClass = size === "lg" ? "h-16 w-16 text-xl" : "h-10 w-10 text-sm";
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt="" className={cn("shrink-0 rounded-full object-cover", sizeClass)} />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent-soft-ink",
        sizeClass
      )}
    >
      {initialsOf(name)}
    </span>
  );
}

/**
 * Shared layout for the seeker, host and admin areas: navbar, a sidebar on
 * md+ (a scrollable tab row on mobile), the page content and the footer.
 */
export function RoleShell({
  profile,
  subtitle,
  navLabel,
  navigation,
  rootHref,
  help,
  children,
}: {
  profile: UserProfile;
  /** Second line under the name in the sidebar (defaults to the email). */
  subtitle?: string;
  navLabel: string;
  navigation: RoleShellNavItem[];
  /** The area's overview route; only matched exactly. */
  rootHref: string;
  /** Optional small help block at the bottom of the sidebar. */
  help?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const tabRowRef = useRef<HTMLElement>(null);
  const activeTabRef = useRef<HTMLAnchorElement>(null);

  const isActive = (href: string) =>
    href === rootHref
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);

  // Keep the active tab visible in the mobile tab row (horizontal scroll only,
  // so the page's vertical scroll position is never touched).
  useEffect(() => {
    const row = tabRowRef.current;
    const tab = activeTabRef.current;
    if (!row || !tab) return;
    const start = tab.offsetLeft;
    const end = start + tab.offsetWidth;
    if (start < row.scrollLeft || end > row.scrollLeft + row.clientWidth) {
      row.scrollLeft = Math.max(0, start - 16);
    }
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <Navbar />

      {/* Mobile: horizontally scrollable tab row */}
      <div className="border-b border-line bg-surface md:hidden">
        <nav ref={tabRowRef} aria-label={navLabel} className="relative overflow-x-auto">
          <ul className="flex w-max gap-1 px-4 py-2">
            {navigation.map((item) => {
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    ref={active ? activeTabRef : undefined}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-11 items-center whitespace-nowrap rounded-md px-3 text-sm font-medium transition-colors",
                      active
                        ? "bg-accent-soft text-accent-soft-ink"
                        : "text-ink-muted hover:bg-surface-muted hover:text-ink"
                    )}
                  >
                    {item.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="items-start md:grid md:grid-cols-[14rem_minmax(0,1fr)] md:gap-8 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-10">
          <aside className="hidden space-y-6 md:sticky md:top-24 md:block">
            <div className="flex items-center gap-3 px-1">
              <ProfileAvatar name={profile.full_name} url={profile.avatar_url} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{profile.full_name}</p>
                <p className="truncate text-sm text-ink-muted">{subtitle ?? profile.email}</p>
                <p className="text-xs font-medium text-ink-subtle">{ROLE_LABEL[profile.role]}</p>
              </div>
            </div>

            <nav aria-label={navLabel}>
              <ul className="space-y-0.5">
                {navigation.map((item) => {
                  const active = isActive(item.href);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                          active
                            ? "bg-accent-soft text-accent-soft-ink"
                            : "text-ink-muted hover:bg-surface-muted hover:text-ink"
                        )}
                      >
                        <Icon
                          aria-hidden="true"
                          className={cn("h-4 w-4 shrink-0", active ? "text-accent" : "text-ink-subtle")}
                        />
                        <span>{item.name}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            {help && (
              <div className="rounded-lg border border-line bg-surface p-4 text-sm">{help}</div>
            )}
          </aside>

          <main id="main" className="min-w-0">
            {children}
          </main>
        </div>
      </div>

      <Footer />
    </div>
  );
}

const SEEKER_NAVIGATION: RoleShellNavItem[] = [
  { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { name: "Bookings", href: "/dashboard/bookings", icon: CalendarCheck },
  { name: "Saved spaces", href: "/dashboard/saved", icon: Heart },
  { name: "Space requests", href: "/dashboard/enquiries", icon: MessageSquarePlus },
  { name: "Profile", href: "/dashboard/profile", icon: UserRound },
];

export function DashboardShell({
  profile,
  children,
}: {
  profile: UserProfile;
  children: React.ReactNode;
}) {
  return (
    <RoleShell
      profile={profile}
      navLabel="Your account"
      navigation={SEEKER_NAVIGATION}
      rootHref="/dashboard"
      help={
        <>
          <p className="font-medium text-ink">Looking for a space?</p>
          <p className="mt-1 text-ink-muted">Search desks, offices and meeting rooms by location.</p>
          <Link href="/spaces" className="mt-2 inline-block font-medium text-accent hover:underline">
            Browse spaces
          </Link>
        </>
      }
    >
      {children}
    </RoleShell>
  );
}
