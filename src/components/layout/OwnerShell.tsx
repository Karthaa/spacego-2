"use client";

import React from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Building2,
  PlusCircle,
  Inbox,
  Calendar,
  ClipboardCheck,
  TrendingUp,
  Settings,
} from "lucide-react";
import { RoleShell, type RoleShellNavItem } from "@/components/layout/DashboardShell";
import type { UserProfile } from "@/types";

const OWNER_NAVIGATION: RoleShellNavItem[] = [
  { name: "Overview", href: "/owner", icon: LayoutDashboard },
  { name: "Properties", href: "/owner/properties", icon: Building2 },
  { name: "Add a space", href: "/owner/spaces/new", icon: PlusCircle },
  { name: "Booking requests", href: "/owner/bookings", icon: Inbox },
  { name: "Availability", href: "/owner/availability", icon: Calendar },
  { name: "Property activation", href: "/owner/activation", icon: ClipboardCheck },
  { name: "Performance", href: "/owner/performance", icon: TrendingUp },
  { name: "Settings", href: "/owner/settings", icon: Settings },
];

export function OwnerShell({
  profile,
  children,
}: {
  profile: UserProfile;
  children: React.ReactNode;
}) {
  return (
    <RoleShell
      profile={profile}
      subtitle={profile.company_name || profile.email}
      navLabel="Host"
      navigation={OWNER_NAVIGATION}
      rootHref="/owner"
      help={
        <>
          <p className="font-medium text-ink">Have space that isn&apos;t listed?</p>
          <p className="mt-1 text-ink-muted">
            Submit a floor or building and we&apos;ll review it for activation.
          </p>
          <Link href="/activation" className="mt-2 inline-block font-medium text-accent hover:underline">
            Submit a property
          </Link>
        </>
      }
    >
      {children}
    </RoleShell>
  );
}
