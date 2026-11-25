"use client";

import React from "react";
import {
  LayoutDashboard,
  Users,
  Building2,
  CalendarCheck,
  ClipboardCheck,
  BarChart3,
  Settings,
} from "lucide-react";
import { RoleShell, type RoleShellNavItem } from "@/components/layout/DashboardShell";
import type { UserProfile } from "@/types";

const ADMIN_NAVIGATION: RoleShellNavItem[] = [
  { name: "Overview", href: "/admin", icon: LayoutDashboard },
  { name: "Users", href: "/admin/users", icon: Users },
  { name: "Listings", href: "/admin/spaces", icon: Building2 },
  { name: "Bookings", href: "/admin/bookings", icon: CalendarCheck },
  { name: "Activations", href: "/admin/activations", icon: ClipboardCheck },
  { name: "Demand", href: "/admin/demand", icon: BarChart3 },
  { name: "Settings", href: "/admin/settings", icon: Settings },
];

export function AdminShell({
  profile,
  children,
}: {
  profile: UserProfile;
  children: React.ReactNode;
}) {
  return (
    <RoleShell
      profile={profile}
      navLabel="Administration"
      navigation={ADMIN_NAVIGATION}
      rootHref="/admin"
    >
      {children}
    </RoleShell>
  );
}
