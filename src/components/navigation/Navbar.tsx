"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  Menu,
  X,
  Sparkles,
  ArrowRight,
  LogOut,
  Bell,
  LayoutDashboard,
  ShieldCheck,
  ChevronDown,
  Plus,
  Compass,
  Check,
  Briefcase,
  Layers,
  Settings,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { SpaceGoStore } from "@/lib/data/store";
import { NotificationItem, UserRole } from "@/types";
import { cn } from "@/lib/utils";

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, role, switchRole, logout, isAuthenticated } = useAuth();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [roleSwitcherOpen, setRoleSwitcherOpen] = useState(false);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      setNotifications(SpaceGoStore.getUserNotifications(user.id));
    }
  }, [user]);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
        setRoleSwitcherOpen(false);
        setNotifDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const getDashboardLink = () => {
    if (role === "admin") return "/admin";
    if (role === "owner") return "/owner";
    return "/dashboard";
  };

  const roleLabelMap: Record<UserRole, { title: string; subtitle: string; color: string }> = {
    seeker: { title: "Seeker", subtitle: "Alex Vance (Customer)", color: "text-teal-600 bg-teal-50 border-teal-200" },
    owner: { title: "Property Owner", subtitle: "Elena Rostova (Host)", color: "text-sky-600 bg-sky-50 border-sky-200" },
    admin: { title: "Platform Admin", subtitle: "Marcus Sterling (Ops)", color: "text-indigo-600 bg-indigo-50 border-indigo-200" },
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/95 backdrop-blur-md transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-18">
          
          {/* Brand Logo - Linear/Airbnb Minimalist Confidence */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#0B132B] via-[#1C2541] to-[#3A506B] flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform duration-200">
              <Building2 className="w-4.5 h-4.5 text-teal-400" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-black tracking-tight text-slate-950">
                  Space<span className="text-teal-600">Go</span>
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
              </div>
              <span className="text-[10px] font-semibold tracking-wider uppercase text-slate-400 -mt-1 hidden sm:block">
                Workspace Marketplace & PropTech
              </span>
            </div>
          </Link>

          {/* Center Navigation Links - Airbnb Clean Style */}
          <nav className="hidden md:flex items-center gap-1">
            <Link
              href="/spaces"
              className={cn(
                "px-3.5 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all",
                pathname.startsWith("/spaces")
                  ? "bg-slate-100 text-slate-950 shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              )}
            >
              Explore Spaces
            </Link>
            <Link
              href="/activation"
              className={cn(
                "px-3.5 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all flex items-center gap-1.5",
                pathname === "/activation"
                  ? "bg-teal-50 text-teal-900 border border-teal-200/60 shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              )}
            >
              <Sparkles className="w-3.5 h-3.5 text-teal-600" />
              <span>Activate Property</span>
            </Link>
            <Link
              href="/activation/track"
              className={cn(
                "px-3.5 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all",
                pathname === "/activation/track"
                  ? "bg-slate-100 text-slate-950 shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              )}
            >
              Track Status
            </Link>
            <Link
              href="/#how-it-works"
              className="px-3.5 py-2 rounded-xl text-xs font-semibold tracking-wide text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all"
            >
              How It Works
            </Link>
          </nav>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2 sm:gap-3" ref={dropdownRef}>
            
            {/* Quick Demo Persona Switcher (Linear-Style Switcher) */}
            <div className="relative">
              <button
                onClick={() => {
                  setRoleSwitcherOpen(!roleSwitcherOpen);
                  setProfileDropdownOpen(false);
                  setNotifDropdownOpen(false);
                }}
                className="hidden lg:flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full border border-slate-200 bg-slate-50/80 hover:bg-slate-100/80 text-slate-700 transition-all cursor-pointer"
                title="Switch persona to experience Seeker, Owner, or Admin"
              >
                <span className="w-2 h-2 rounded-full bg-teal-500" />
                <span className="text-slate-400 font-normal">Role:</span>
                <span className="font-semibold text-slate-900 capitalize">{role}</span>
                <ChevronDown className="w-3 h-3 text-slate-400 ml-0.5" />
              </button>

              {roleSwitcherOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl z-50 animate-in fade-in zoom-in-95">
                  <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                    Switch Active Persona
                  </div>
                  
                  <div className="mt-1 space-y-1">
                    <button
                      onClick={() => {
                        switchRole("seeker");
                        setRoleSwitcherOpen(false);
                        router.push("/dashboard");
                      }}
                      className={cn(
                        "w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-colors cursor-pointer",
                        role === "seeker" ? "bg-teal-50/80 border border-teal-200/60" : "hover:bg-slate-50"
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-xs">
                          S
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900">Space Seeker</div>
                          <div className="text-[10px] text-slate-500">Alex Vance (Customer)</div>
                        </div>
                      </div>
                      {role === "seeker" && <Check className="w-4 h-4 text-teal-600" />}
                    </button>

                    <button
                      onClick={() => {
                        switchRole("owner");
                        setRoleSwitcherOpen(false);
                        router.push("/owner");
                      }}
                      className={cn(
                        "w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-colors cursor-pointer",
                        role === "owner" ? "bg-sky-50/80 border border-sky-200/60" : "hover:bg-slate-50"
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-xs">
                          O
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900">Property Owner</div>
                          <div className="text-[10px] text-slate-500">Elena Rostova (Host)</div>
                        </div>
                      </div>
                      {role === "owner" && <Check className="w-4 h-4 text-sky-600" />}
                    </button>

                    <button
                      onClick={() => {
                        switchRole("admin");
                        setRoleSwitcherOpen(false);
                        router.push("/admin");
                      }}
                      className={cn(
                        "w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-colors cursor-pointer",
                        role === "admin" ? "bg-indigo-50/80 border border-indigo-200/60" : "hover:bg-slate-50"
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                          A
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900">Administrator</div>
                          <div className="text-[10px] text-slate-500">Marcus Sterling (Ops)</div>
                        </div>
                      </div>
                      {role === "admin" && <Check className="w-4 h-4 text-indigo-600" />}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* List Your Space (Airbnb-Style Quick Host Action) */}
            <Link
              href={role === "owner" ? "/owner/spaces/new" : "/owner"}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-slate-700 hover:text-slate-950 hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200"
            >
              <Plus className="w-3.5 h-3.5 text-teal-600" />
              <span>List Your Space</span>
            </Link>

            {/* Notification Bell */}
            {isAuthenticated && (
              <div className="relative">
                <button
                  onClick={() => {
                    setNotifDropdownOpen(!notifDropdownOpen);
                    setProfileDropdownOpen(false);
                    setRoleSwitcherOpen(false);
                  }}
                  className="relative p-2 rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                  aria-label="Notifications"
                >
                  <Bell className="w-4.5 h-4.5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white animate-pulse" />
                  )}
                </button>

                {notifDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl z-50 animate-in fade-in zoom-in-95">
                    <div className="flex items-center justify-between px-2 py-1.5 border-b border-slate-100">
                      <span className="text-xs font-bold text-slate-900">Notifications</span>
                      {unreadCount > 0 && (
                        <span className="text-[10px] text-teal-700 font-semibold px-2 py-0.5 rounded-full bg-teal-50 border border-teal-200">
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    <div className="mt-2 divide-y divide-slate-100 max-h-72 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-400">No notifications yet.</div>
                      ) : (
                        notifications.slice(0, 5).map((n) => (
                          <div
                            key={n.id}
                            onClick={() => {
                              SpaceGoStore.markNotificationRead(n.id);
                              setNotifDropdownOpen(false);
                              if (n.link) router.push(n.link);
                            }}
                            className={cn(
                              "p-2.5 text-xs hover:bg-slate-50 rounded-xl cursor-pointer transition-colors",
                              !n.read && "bg-teal-50/40"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <p className="font-semibold text-slate-900">{n.title}</p>
                              {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-teal-600" />}
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Profile Menu or Log In */}
            {isAuthenticated ? (
              <div className="relative">
                <button
                  onClick={() => {
                    setProfileDropdownOpen(!profileDropdownOpen);
                    setRoleSwitcherOpen(false);
                    setNotifDropdownOpen(false);
                  }}
                  className="flex items-center gap-2 p-1 pl-1.5 pr-2 rounded-full border border-slate-200/80 hover:border-slate-300 hover:shadow-xs transition-all bg-white cursor-pointer"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={user?.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80"}
                    alt={user?.full_name || "Profile"}
                    className="w-7 h-7 rounded-full object-cover shrink-0 ring-1 ring-slate-200"
                  />
                  <span className="text-xs font-semibold text-slate-800 hidden sm:inline max-w-[100px] truncate">
                    {user?.full_name.split(" ")[0]}
                  </span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>

                {profileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-60 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl z-50 animate-in fade-in zoom-in-95">
                    <div className="p-3 border-b border-slate-100">
                      <p className="text-xs font-bold text-slate-900 truncate">{user?.full_name}</p>
                      <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
                      <div className="mt-2 flex items-center gap-1.5">
                        <span className={cn("text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border", roleLabelMap[role].color)}>
                          {role}
                        </span>
                      </div>
                    </div>

                    <div className="py-1">
                      <Link
                        href={getDashboardLink()}
                        onClick={() => setProfileDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                      >
                        <LayoutDashboard className="w-4 h-4 text-teal-600" />
                        <span>Go to {role === "admin" ? "Admin" : role === "owner" ? "Host" : "Seeker"} Portal</span>
                      </Link>

                      {role === "seeker" && (
                        <Link
                          href="/dashboard/bookings"
                          onClick={() => setProfileDropdownOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                        >
                          <Compass className="w-4 h-4 text-slate-400" />
                          <span>My Bookings</span>
                        </Link>
                      )}

                      {role === "owner" && (
                        <Link
                          href="/owner/properties"
                          onClick={() => setProfileDropdownOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                        >
                          <Building2 className="w-4 h-4 text-slate-400" />
                          <span>My Listings</span>
                        </Link>
                      )}

                      <Link
                        href={role === "admin" ? "/admin/settings" : role === "owner" ? "/owner/settings" : "/dashboard/profile"}
                        onClick={() => setProfileDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                      >
                        <Settings className="w-4 h-4 text-slate-400" />
                        <span>Account Settings</span>
                      </Link>
                    </div>

                    <div className="pt-1 border-t border-slate-100">
                      <button
                        onClick={() => {
                          logout();
                          setProfileDropdownOpen(false);
                          router.push("/");
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-xl transition-colors text-left cursor-pointer"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Sign out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/auth/login">
                  <Button variant="ghost" size="sm" className="font-semibold text-xs">
                    Log in
                  </Button>
                </Link>
                <Link href="/auth/register">
                  <Button variant="primary" size="sm" className="font-semibold text-xs rounded-full px-4">
                    Get Started
                  </Button>
                </Link>
              </div>
            )}

            {/* Mobile Menu Toggle Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-slate-700 hover:text-slate-900 hover:bg-slate-100 md:hidden cursor-pointer"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white/98 backdrop-blur-md p-4 space-y-4 animate-in slide-in-from-top-2">
          <nav className="flex flex-col space-y-1">
            <Link
              href="/spaces"
              className="px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-800 hover:bg-slate-100"
            >
              Explore Spaces
            </Link>
            <Link
              href="/activation"
              className="px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-800 hover:bg-slate-100 flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-teal-600" />
              <span>Activate Your Property</span>
            </Link>
            <Link
              href="/activation/track"
              className="px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-800 hover:bg-slate-100"
            >
              Track Activation Status
            </Link>
            <Link
              href={getDashboardLink()}
              className="px-3.5 py-2.5 rounded-xl text-sm font-semibold text-teal-900 bg-teal-50 flex items-center justify-between mt-2"
            >
              <span>Go to {role.toUpperCase()} Portal</span>
              <ArrowRight className="w-4 h-4 text-teal-600" />
            </Link>
          </nav>

          <div className="pt-3 border-t border-slate-100">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Switch Test Persona</p>
            <div className="grid grid-cols-3 gap-2">
              <Button
                size="sm"
                variant={role === "seeker" ? "teal" : "outline"}
                onClick={() => switchRole("seeker")}
                className="text-xs"
              >
                Seeker
              </Button>
              <Button
                size="sm"
                variant={role === "owner" ? "teal" : "outline"}
                onClick={() => switchRole("owner")}
                className="text-xs"
              >
                Owner
              </Button>
              <Button
                size="sm"
                variant={role === "admin" ? "teal" : "outline"}
                onClick={() => switchRole("admin")}
                className="text-xs"
              >
                Admin
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
