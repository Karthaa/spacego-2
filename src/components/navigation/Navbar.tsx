"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Menu,
  X,
  LogOut,
  Bell,
  LayoutDashboard,
  ChevronDown,
  Settings,
  CalendarDays,
  Building2,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { buttonClasses } from "@/components/ui/Button";
import { SpaceGoStore } from "@/lib/data/store";
import { useSpaceGoVersion } from "@/context/SpaceGoDataProvider";
import { NotificationItem, UserRole } from "@/types";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./ThemeToggle";

const ROLE_LABEL: Record<UserRole, string> = {
  seeker: "Member",
  owner: "Host",
  admin: "Administrator",
};

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 rounded-md" aria-label="SpaceGo home">
      <span
        aria-hidden="true"
        className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-accent-ink"
      >
        <Building2 className="h-4.5 w-4.5" />
      </span>
      <span className="text-lg font-semibold tracking-tight text-ink">SpaceGo</span>
    </Link>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, role, signOut, isAuthenticated } = useAuth();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const dataVersion = useSpaceGoVersion();

  const dropdownRef = useRef<HTMLDivElement>(null);

  const notifications = useMemo<NotificationItem[]>(() => {
    // Re-read the store snapshot whenever it changes (hydration, new
    // server-created notifications, read-state updates).
    void dataVersion;
    if (!user) return [];
    return SpaceGoStore.getUserNotifications(user.id);
  }, [user, dataVersion]);

  // Close menus on outside click or Escape.
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
        setNotifDropdownOpen(false);
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setProfileDropdownOpen(false);
        setNotifDropdownOpen(false);
        setMobileMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const dashboardHref = role === "admin" ? "/admin" : role === "owner" ? "/owner" : "/dashboard";
  const settingsHref =
    role === "admin" ? "/admin/settings" : role === "owner" ? "/owner/settings" : "/dashboard/profile";

  const listSpaceHref =
    role === "owner"
      ? "/owner/spaces/new"
      : isAuthenticated
        ? "/activation"
        : "/auth/register";

  const handleSignOut = async () => {
    setProfileDropdownOpen(false);
    setMobileMenuOpen(false);
    await signOut();
    router.push("/");
    router.refresh();
  };

  const navLinks = [
    { href: "/spaces", label: "Find a space", active: pathname.startsWith("/spaces") },
    { href: "/#how-it-works", label: "How it works", active: false },
    { href: "/activation", label: "For property owners", active: pathname.startsWith("/activation") },
  ];

  const menuItemClass =
    "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-ink hover:bg-surface-muted";

  return (
    <header className="sticky top-0 z-40 w-full border-b border-line bg-surface">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <Logo />

          <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={link.active ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center whitespace-nowrap rounded-md px-3 text-sm font-medium transition-colors",
                  link.active ? "text-ink" : "text-ink-muted hover:bg-surface-muted hover:text-ink"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1" ref={dropdownRef}>
            <Link
              href={listSpaceHref}
              className="hidden h-11 items-center rounded-md px-3 text-sm font-medium text-ink hover:bg-surface-muted lg:flex"
            >
              List your space
            </Link>

            <ThemeToggle />

            {isAuthenticated && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setNotifDropdownOpen(!notifDropdownOpen);
                    setProfileDropdownOpen(false);
                  }}
                  aria-expanded={notifDropdownOpen}
                  aria-haspopup="true"
                  className="relative flex h-11 w-11 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
                  aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
                >
                  <Bell className="h-5 w-5" aria-hidden="true" />
                  {unreadCount > 0 && (
                    <span
                      aria-hidden="true"
                      className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-danger-solid ring-2 ring-surface"
                    />
                  )}
                </button>

                {notifDropdownOpen && (
                  <div className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-line bg-surface p-2 shadow-md">
                    <div className="flex items-center justify-between px-3 py-2">
                      <span className="text-sm font-semibold text-ink">Notifications</span>
                      {unreadCount > 0 && (
                        <span className="text-sm text-ink-muted">{unreadCount} unread</span>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <p className="px-3 py-6 text-center text-sm text-ink-muted">
                          You have no notifications yet.
                        </p>
                      ) : (
                        <ul className="space-y-0.5">
                          {notifications.slice(0, 6).map((n) => (
                            <li key={n.id}>
                              <button
                                type="button"
                                onClick={() => {
                                  if (!n.read) {
                                    void SpaceGoStore.markNotificationRead(n.id).then((result) => {
                                      if (!result.ok) {
                                        console.error("SpaceGo: could not mark notification read:", result.error);
                                      }
                                    });
                                  }
                                  setNotifDropdownOpen(false);
                                  if (n.link) router.push(n.link);
                                }}
                                className={cn(
                                  "w-full rounded-md px-3 py-2.5 text-left transition-colors hover:bg-surface-muted",
                                  !n.read && "bg-accent-soft"
                                )}
                              >
                                <span className="flex items-center justify-between gap-2">
                                  <span className="text-sm font-semibold text-ink">{n.title}</span>
                                  {!n.read && (
                                    <span className="h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />
                                  )}
                                </span>
                                <span className="mt-0.5 line-clamp-2 block text-sm text-ink-muted">
                                  {n.message}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {isAuthenticated ? (
              <div className="relative hidden md:block">
                <button
                  type="button"
                  onClick={() => {
                    setProfileDropdownOpen(!profileDropdownOpen);
                    setNotifDropdownOpen(false);
                  }}
                  aria-expanded={profileDropdownOpen}
                  aria-haspopup="true"
                  className="flex h-11 items-center gap-2 rounded-md px-2 transition-colors hover:bg-surface-muted"
                >
                  <Avatar name={user?.full_name} url={user?.avatar_url} />
                  <span className="max-w-[8rem] truncate text-sm font-medium text-ink">
                    {user?.full_name?.split(" ")[0]}
                  </span>
                  <ChevronDown className="h-4 w-4 text-ink-subtle" aria-hidden="true" />
                </button>

                {profileDropdownOpen && (
                  <div className="absolute right-0 z-50 mt-2 w-64 rounded-lg border border-line bg-surface p-2 shadow-md">
                    <div className="border-b border-line px-3 pb-3 pt-2">
                      <p className="truncate text-sm font-semibold text-ink">{user?.full_name}</p>
                      <p className="truncate text-sm text-ink-muted">{user?.email}</p>
                      <p className="mt-1 text-xs font-medium text-ink-subtle">{ROLE_LABEL[role]}</p>
                    </div>
                    <div className="py-1">
                      <Link href={dashboardHref} onClick={() => setProfileDropdownOpen(false)} className={menuItemClass}>
                        <LayoutDashboard className="h-4 w-4 text-ink-subtle" aria-hidden="true" />
                        Dashboard
                      </Link>
                      {role === "seeker" && (
                        <Link href="/dashboard/bookings" onClick={() => setProfileDropdownOpen(false)} className={menuItemClass}>
                          <CalendarDays className="h-4 w-4 text-ink-subtle" aria-hidden="true" />
                          My bookings
                        </Link>
                      )}
                      {role === "owner" && (
                        <Link href="/owner/properties" onClick={() => setProfileDropdownOpen(false)} className={menuItemClass}>
                          <Building2 className="h-4 w-4 text-ink-subtle" aria-hidden="true" />
                          My listings
                        </Link>
                      )}
                      <Link href={settingsHref} onClick={() => setProfileDropdownOpen(false)} className={menuItemClass}>
                        <Settings className="h-4 w-4 text-ink-subtle" aria-hidden="true" />
                        Account settings
                      </Link>
                    </div>
                    <div className="border-t border-line pt-1">
                      <button
                        type="button"
                        onClick={() => void handleSignOut()}
                        className={cn(menuItemClass, "w-full text-left text-danger hover:bg-danger-soft")}
                      >
                        <LogOut className="h-4 w-4" aria-hidden="true" />
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="hidden items-center gap-1 md:flex">
                <Link href="/auth/login" className={buttonClasses({ variant: "ghost", size: "md" })}>
                  Log in
                </Link>
                <Link href="/auth/register" className={buttonClasses({ variant: "primary", size: "md" })}>
                  Sign up
                </Link>
              </div>
            )}

            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex h-11 w-11 items-center justify-center rounded-md text-ink hover:bg-surface-muted lg:hidden"
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-menu"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
            </button>
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <div id="mobile-menu" className="border-t border-line bg-surface lg:hidden">
          <nav aria-label="Mobile" className="mx-auto max-w-7xl space-y-1 px-4 py-3 sm:px-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                aria-current={link.active ? "page" : undefined}
                className="flex min-h-12 items-center rounded-md px-3 text-base font-medium text-ink hover:bg-surface-muted"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href={listSpaceHref}
              onClick={() => setMobileMenuOpen(false)}
              className="flex min-h-12 items-center rounded-md px-3 text-base font-medium text-ink hover:bg-surface-muted"
            >
              List your space
            </Link>

            <div className="mt-2 border-t border-line pt-3">
              {isAuthenticated ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-3 px-3 pb-2">
                    <Avatar name={user?.full_name} url={user?.avatar_url} />
                    <div className="min-w-0">
                      <p className="truncate text-base font-medium text-ink">{user?.full_name}</p>
                      <p className="text-sm text-ink-muted">{ROLE_LABEL[role]}</p>
                    </div>
                  </div>
                  <Link href={dashboardHref} onClick={() => setMobileMenuOpen(false)} className={cn(menuItemClass, "min-h-12 text-base")}>
                    Dashboard
                  </Link>
                  <Link href={settingsHref} onClick={() => setMobileMenuOpen(false)} className={cn(menuItemClass, "min-h-12 text-base")}>
                    Account settings
                  </Link>
                  <button
                    type="button"
                    onClick={() => void handleSignOut()}
                    className={cn(menuItemClass, "min-h-12 w-full text-left text-base text-danger hover:bg-danger-soft")}
                  >
                    Sign out
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href="/auth/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className={buttonClasses({ variant: "outline", size: "lg", className: "w-full" })}
                  >
                    Log in
                  </Link>
                  <Link
                    href="/auth/register"
                    onClick={() => setMobileMenuOpen(false)}
                    className={buttonClasses({ variant: "primary", size: "lg", className: "w-full" })}
                  >
                    Sign up
                  </Link>
                </div>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

function Avatar({ name, url }: { name?: string; url?: string }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent-soft-ink"
    >
      {(name || "?").charAt(0).toUpperCase()}
    </span>
  );
}
