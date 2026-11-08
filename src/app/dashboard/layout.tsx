"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Navbar } from "@/components/navigation/Navbar";
import { Footer } from "@/components/navigation/Footer";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard,
  CalendarCheck,
  Heart,
  HelpCircle,
  Bell,
  User,
  Settings,
  ChevronRight,
  Compass,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function SeekerDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, role } = useAuth();

  const navigation = [
    { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
    { name: "My Bookings", href: "/dashboard/bookings", icon: CalendarCheck },
    { name: "Saved Spaces", href: "/dashboard/saved", icon: Heart },
    { name: "Custom Demands", href: "/dashboard/enquiries", icon: Sparkles },
    { name: "Profile & Settings", href: "/dashboard/profile", icon: Settings },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          
          {/* Dashboard Sidebar */}
          <aside className="md:col-span-3 space-y-4">
            
            {/* User Profile Mini Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={user?.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80"}
                alt={user?.full_name || "User"}
                className="w-12 h-12 rounded-xl object-cover border border-slate-200"
              />
              <div className="overflow-hidden">
                <h3 className="text-sm font-bold text-slate-900 truncate">{user?.full_name || "Alex Vance"}</h3>
                <p className="text-[11px] text-slate-500 truncate">{user?.email || "alex.seeker@spacego.io"}</p>
                <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                  Space Seeker
                </span>
              </div>
            </div>

            {/* Sidebar Navigation */}
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
                    <Icon className={cn("w-4 h-4", isActive ? "text-teal-600" : "text-slate-400")} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>

            {/* Explore shortcut */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-teal-700 to-[#0B132B] text-white shadow-md space-y-2">
              <h4 className="text-xs font-bold">Find New Workspace</h4>
              <p className="text-[11px] text-teal-100 leading-snug">
                Browse on-demand desks, private suites, and meeting rooms.
              </p>
              <Link href="/spaces" className="inline-flex items-center gap-1 text-xs font-bold text-white hover:text-teal-200 pt-1">
                <span>Browse Spaces</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

          </aside>

          {/* Main Dashboard Panel */}
          <main className="md:col-span-9">{children}</main>

        </div>
      </div>

      <Footer />
    </div>
  );
}
