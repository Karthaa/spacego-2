"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Navbar } from "@/components/navigation/Navbar";
import { Footer } from "@/components/navigation/Footer";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard,
  Users,
  Building2,
  CalendarCheck,
  Sparkles,
  BarChart3,
  Settings,
  ShieldAlert,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, role, switchRole } = useAuth();

  const navigation = [
    { name: "Platform Overview", href: "/admin", icon: LayoutDashboard },
    { name: "User Management", href: "/admin/users", icon: Users },
    { name: "Workspace Listings", href: "/admin/spaces", icon: Building2 },
    { name: "Booking Ledger", href: "/admin/bookings", icon: CalendarCheck },
    { name: "Activation Pipeline", href: "/admin/activations", icon: Sparkles },
    { name: "Demand Intelligence", href: "/admin/demand", icon: BarChart3 },
    { name: "Platform Settings", href: "/admin/settings", icon: Settings },
  ];

  // If not currently acting as admin, provide a quick one-click authorization prompt
  if (role !== "admin") {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            Administrator Access Required
          </h2>
          <p className="text-xs text-slate-600 mt-2 leading-relaxed">
            You are currently logged in as <strong>{user?.full_name} ({role.toUpperCase()})</strong>. This operations console is restricted to authorized platform administrators.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row items-center gap-2 w-full">
            <button
              onClick={() => switchRole("admin")}
              className="w-full py-2.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md cursor-pointer"
            >
              Switch to Admin (Marcus Sterling)
            </button>
            <Link href="/" className="w-full">
              <button className="w-full py-2.5 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold">
                Back to Home
              </button>
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          
          {/* Admin Sidebar */}
          <aside className="md:col-span-3 space-y-4">
            
            {/* Admin Profile Box */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={user?.avatar_url || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80"}
                alt={user?.full_name || "Admin"}
                className="w-12 h-12 rounded-xl object-cover border border-slate-200"
              />
              <div className="overflow-hidden">
                <h3 className="text-sm font-bold text-slate-900 truncate">{user?.full_name || "Marcus Sterling"}</h3>
                <p className="text-[11px] text-slate-500 truncate">{user?.email || "admin@spacego.io"}</p>
                <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200">
                  Global Administrator
                </span>
              </div>
            </div>

            {/* Admin Navigation */}
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

            {/* Quick Stat Pill */}
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

          {/* Admin Content Area */}
          <main className="md:col-span-9">{children}</main>

        </div>
      </div>

      <Footer />
    </div>
  );
}
