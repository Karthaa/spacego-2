"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  Menu,
  X,
  Compass,
  Sparkles,
  ArrowRight,
  User,
  LogOut,
  Bell,
  LayoutDashboard,
  ShieldCheck,
  ChevronDown,
  PlusCircle,
  ExternalLink,
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

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/90 backdrop-blur-md transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-[#0B132B] to-[#1C2541] flex items-center justify-center text-white shadow-md shadow-slate-900/10 group-hover:scale-105 transition-transform">
              <Building2 className="w-5 h-5 text-teal-400" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl sm:text-2xl font-black tracking-tight text-slate-950 flex items-center">
                Space<span className="text-teal-600">Go</span>
                <span className="ml-1 w-1.5 h-1.5 rounded-full bg-teal-500 inline-block animate-pulse" />
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 -mt-1 hidden sm:block">
                Workspace & PropTech
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-2">
            <Link
              href="/spaces"
              className={cn(
                "px-3.5 py-2 rounded-xl text-sm font-medium transition-colors",
                pathname.startsWith("/spaces")
                  ? "bg-slate-100 text-slate-950 font-semibold"
                  : "text-slate-600 hover:text-slate-950 hover:bg-slate-50"
              )}
            >
              Explore Spaces
            </Link>
            <Link
              href="/activation"
              className={cn(
                "px-3.5 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-1.5",
                pathname === "/activation"
                  ? "bg-teal-50 text-teal-900 font-semibold"
                  : "text-slate-600 hover:text-slate-950 hover:bg-slate-50"
              )}
            >
              <Sparkles className="w-3.5 h-3.5 text-teal-600" />
              Activate Property
            </Link>
            <Link
              href="/activation/track"
              className={cn(
                "px-3.5 py-2 rounded-xl text-sm font-medium transition-colors",
                pathname === "/activation/track"
                  ? "bg-slate-100 text-slate-950 font-semibold"
                  : "text-slate-600 hover:text-slate-950 hover:bg-slate-50"
              )}
            >
              Track Status
            </Link>
            <Link
              href="/#how-it-works"
              className="px-3.5 py-2 rounded-xl text-sm font-medium text-slate-600 hover:text-slate-950 hover:bg-slate-50 transition-colors"
            >
              How It Works
            </Link>
          </nav>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2 sm:gap-3" ref={dropdownRef}>
            
            {/* Quick Persona/Role Switcher for Evaluation */}
            <div className="relative">
              <button
                onClick={() => {
                  setRoleSwitcherOpen(!roleSwitcherOpen);
                  setProfileDropdownOpen(false);
                  setNotifDropdownOpen(false);
                }}
                className="hidden lg:flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors"
                title="Switch demo persona to test all 3 platform viewpoints"
              >
                <span className="w-2 h-2 rounded-full bg-teal-500" />
                <span>Role:</span>
                <span className="capitalize font-bold text-teal-800">{role}</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {roleSwitcherOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl z-50 animate-in fade-in zoom-in-95">
                  <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Switch Test Persona
                  </div>
                  <button
                    onClick={() => {
                      switchRole("seeker");
                      setRoleSwitcherOpen(false);
                      router.push("/dashboard");
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors text-left",
                      role === "seeker" ? "bg-teal-50 text-teal-900 font-bold" : "hover:bg-slate-100 text-slate-700"
                    )}
                  >
                    <div>
                      <div className="font-semibold">Space Seeker</div>
                      <div className="text-[10px] text-slate-400">Alex Vance (Customer)</div>
                    </div>
                    {role === "seeker" && <span className="text-teal-600 font-bold text-xs">Active</span>}
                  </button>

                  <button
                    onClick={() => {
                      switchRole("owner");
                      setRoleSwitcherOpen(false);
                      router.push("/owner");
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors text-left",
                      role === "owner" ? "bg-teal-50 text-teal-900 font-bold" : "hover:bg-slate-100 text-slate-700"
                    )}
                  >
                    <div>
                      <div className="font-semibold">Property Owner</div>
                      <div className="text-[10px] text-slate-400">Elena Rostova (Host)</div>
                    </div>
                    {role === "owner" && <span className="text-teal-600 font-bold text-xs">Active</span>}
                  </button>

                  <button
                    onClick={() => {
                      switchRole("admin");
                      setRoleSwitcherOpen(false);
                      router.push("/admin");
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors text-left",
                      role === "admin" ? "bg-teal-50 text-teal-900 font-bold" : "hover:bg-slate-100 text-slate-700"
                    )}
                  >
                    <div>
                      <div className="font-semibold">Administrator</div>
                      <div className="text-[10px] text-slate-400">Marcus Sterling (Ops)</div>
                    </div>
                    {role === "admin" && <span className="text-teal-600 font-bold text-xs">Active</span>}
                  </button>
                </div>
              )}
            </div>

            {/* List Your Space CTA for Desktop */}
            <Link href={role === "owner" ? "/owner/spaces/new" : "/owner"} className="hidden sm:block">
              <Button variant="outline" size="sm" className="font-semibold gap-1.5 border-slate-300">
                <PlusCircle className="w-4 h-4 text-teal-600" />
                List Your Space
              </Button>
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
                  className="relative p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                  aria-label="Notifications"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                  )}
                </button>

                {notifDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl z-50 animate-in fade-in zoom-in-95">
                    <div className="flex items-center justify-between px-2 py-1.5 border-b border-slate-100">
                      <span className="text-xs font-bold text-slate-900">Notifications</span>
                      {unreadCount > 0 && <span className="text-[10px] text-teal-600 font-semibold">{unreadCount} new</span>}
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
                              !n.read && "bg-teal-50/50"
                            )}
                          >
                            <p className="font-semibold text-slate-900">{n.title}</p>
                            <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-2">{n.message}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Profile Dropdown or Login */}
            {isAuthenticated ? (
              <div className="relative">
                <button
                  onClick={() => {
                    setProfileDropdownOpen(!profileDropdownOpen);
                    setRoleSwitcherOpen(false);
                    setNotifDropdownOpen(false);
                  }}
                  className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={user?.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80"}
                    alt={user?.full_name || "Profile"}
                    className="w-8 h-8 rounded-full object-cover border border-slate-200"
                  />
                  <span className="text-xs font-semibold text-slate-800 hidden md:block max-w-[120px] truncate">
                    {user?.full_name.split(" ")[0]}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden md:block" />
                </button>

                {profileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-60 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl z-50 animate-in fade-in zoom-in-95">
                    <div className="p-3 border-b border-slate-100">
                      <p className="text-xs font-bold text-slate-900 truncate">{user?.full_name}</p>
                      <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <Badge size="sm" variant={role === "admin" ? "error" : role === "owner" ? "brand" : "neutral"}>
                          {role.toUpperCase()}
                        </Badge>
                      </div>
                    </div>

                    <div className="py-1">
                      <Link
                        href={getDashboardLink()}
                        onClick={() => setProfileDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                      >
                        <LayoutDashboard className="w-4 h-4 text-teal-600" />
                        <span>Go to {role === "admin" ? "Admin" : role === "owner" ? "Owner" : "Customer"} Portal</span>
                      </Link>

                      {role === "seeker" && (
                        <Link
                          href="/dashboard/bookings"
                          onClick={() => setProfileDropdownOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                        >
                          <Compass className="w-4 h-4 text-slate-500" />
                          <span>My Bookings</span>
                        </Link>
                      )}

                      {role === "owner" && (
                        <Link
                          href="/owner/properties"
                          onClick={() => setProfileDropdownOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                        >
                          <Building2 className="w-4 h-4 text-slate-500" />
                          <span>Manage Properties</span>
                        </Link>
                      )}
                    </div>

                    <div className="pt-1 border-t border-slate-100">
                      <button
                        onClick={() => {
                          logout();
                          setProfileDropdownOpen(false);
                          router.push("/");
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-xl transition-colors text-left"
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
                  <Button variant="ghost" size="sm">
                    Log in
                  </Button>
                </Link>
                <Link href="/auth/register">
                  <Button variant="primary" size="sm">
                    Get Started
                  </Button>
                </Link>
              </div>
            )}

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-slate-600 hover:text-slate-900 md:hidden"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white p-4 space-y-3 animate-in slide-in-from-top-2">
          <nav className="flex flex-col space-y-1">
            <Link
              href="/spaces"
              className="px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-800 hover:bg-slate-100"
            >
              Explore Spaces
            </Link>
            <Link
              href="/activation"
              className="px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-800 hover:bg-slate-100 flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-teal-600" />
              Activate Your Property
            </Link>
            <Link
              href="/activation/track"
              className="px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-800 hover:bg-slate-100"
            >
              Track Activation Status
            </Link>
            <Link
              href={getDashboardLink()}
              className="px-3.5 py-2.5 rounded-xl text-sm font-medium text-teal-900 bg-teal-50 flex items-center justify-between"
            >
              <span>{role.toUpperCase()} Dashboard</span>
              <ArrowRight className="w-4 h-4 text-teal-600" />
            </Link>
          </nav>

          <div className="pt-2 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-500 mb-2">Switch Demo Persona</p>
            <div className="grid grid-cols-3 gap-1.5">
              <Button
                size="sm"
                variant={role === "seeker" ? "teal" : "outline"}
                onClick={() => switchRole("seeker")}
                className="text-xs py-1"
              >
                Seeker
              </Button>
              <Button
                size="sm"
                variant={role === "owner" ? "teal" : "outline"}
                onClick={() => switchRole("owner")}
                className="text-xs py-1"
              >
                Owner
              </Button>
              <Button
                size="sm"
                variant={role === "admin" ? "teal" : "outline"}
                onClick={() => switchRole("admin")}
                className="text-xs py-1"
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
