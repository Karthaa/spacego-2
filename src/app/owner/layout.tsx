"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Navbar } from "@/components/navigation/Navbar";
import { Footer } from "@/components/navigation/Footer";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard,
  Building2,
  PlusCircle,
  Inbox,
  Calendar,
  Sparkles,
  TrendingUp,
  Settings,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user } = useAuth();

  const navigation = [
    { name: "Overview", href: "/owner", icon: LayoutDashboard },
    { name: "My Properties", href: "/owner/properties", icon: Building2 },
    { name: "Add a Workspace", href: "/owner/spaces/new", icon: PlusCircle },
    { name: "Booking Requests", href: "/owner/bookings", icon: Inbox },
    { name: "Availability & Calendar", href: "/owner/availability", icon: Calendar },
    { name: "Property Activation", href: "/owner/activation", icon: Sparkles },
    { name: "Performance & Economics", href: "/owner/performance", icon: TrendingUp },
    { name: "Settings", href: "/owner/settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          
          {/* Owner Sidebar */}
          <aside className="md:col-span-3 space-y-4">
            
            {/* Owner Profile Badge */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={user?.avatar_url || "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=120&q=80"}
                alt={user?.full_name || "Owner"}
                className="w-12 h-12 rounded-xl object-cover border border-slate-200"
              />
              <div className="overflow-hidden">
                <h3 className="text-sm font-bold text-slate-900 truncate">{user?.full_name || "Elena Rostova"}</h3>
                <p className="text-[11px] text-slate-500 truncate">{user?.company_name || "Metropolis Property Holdings"}</p>
                <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                  Property Host
                </span>
              </div>
            </div>

            {/* Navigation Links */}
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

            {/* Quick Action: Activation CTA */}
            <div className="p-4 rounded-2xl bg-[#0B132B] text-white shadow-md space-y-2">
              <div className="flex items-center gap-1.5 text-teal-400 text-xs font-bold">
                <Sparkles className="w-4 h-4" />
                <span>Demand Activation</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-snug">
                Have unlisted floors? Check if your location has verified local demand.
              </p>
              <Link href="/activation" className="inline-flex items-center gap-1 text-xs font-bold text-teal-300 hover:text-teal-200 pt-1">
                <span>Submit Property</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

          </aside>

          {/* Main Owner Content */}
          <main className="md:col-span-9">{children}</main>

        </div>
      </div>

      <Footer />
    </div>
  );
}
