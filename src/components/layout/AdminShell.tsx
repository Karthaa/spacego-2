"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Navbar } from "@/components/navigation/Navbar";
import { Footer } from "@/components/navigation/Footer";
import type { UserProfile } from "@/types";
import {
  LayoutDashboard,
  Users,
  Building2,
  CalendarCheck,
  Sparkles,
  BarChart3,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function AdminShell({
  profile,
  children,
}: {
  profile: UserProfile;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const navigation = [
    { name: "Platform Overview", href: "/admin", icon: LayoutDashboard },
    { name: "User Management", href: "/admin/users", icon: Users },
    { name: "Workspace Listings", href: "/admin/spaces", icon: Building2 },
    { name: "Booking Ledger", href: "/admin/bookings", icon: CalendarCheck },
    { name: "Activation Pipeline", href: "/admin/activations", icon: Sparkles },
    { name: "Demand Intelligence", href: "/admin/demand", icon: BarChart3 },
    { name: "Platform Settings", href: "/admin/settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          <aside className="md:col-span-3 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={
                  profile.avatar_url ||
                  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80"
                }
                alt={profile.full_name}
                className="w-12 h-12 rounded-xl object-cover border border-slate-200"
              />
              <div className="overflow-hidden">
                <h3 className="text-sm font-bold text-slate-900 truncate">
                  {profile.full_name}
                </h3>
                <p className="text-[11px] text-slate-500 truncate">
                  {profile.email}
                </p>
                <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200">
                  Global Administrator
                </span>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-2 shadow-xs space-y-1">
              {navigation.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors",
                      isActive
                        ? "bg-teal-50 text-teal-900 font-bold border border-teal-200"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                    )}
                  >
                    <Icon
                      className={cn(
                        "w-4 h-4",
                        isActive ? "text-teal-600" : "text-slate-400"
                      )}
                    />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 text-white shadow-md space-y-2">
              <div className="flex items-center gap-1.5 text-teal-400 text-xs font-bold">
                <ShieldCheck className="w-4 h-4" />
                <span>SpaceGo Operations</span>
              </div>

              <p className="text-[11px] text-slate-300 leading-snug">
                Audit trail and Demand-Backed property pipeline live.
              </p>
            </div>
          </aside>

          <main className="md:col-span-9">{children}</main>
        </div>
      </div>

      <Footer />
    </div>
  );
}
