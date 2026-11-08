"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { SpaceGoStore } from "@/lib/data/store";
import { Booking, Space } from "@/types";
import { BookingStatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  CalendarCheck,
  Heart,
  Clock,
  Sparkles,
  MapPin,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Search,
} from "lucide-react";

export default function SeekerOverviewPage() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [savedSpaces, setSavedSpaces] = useState<Space[]>([]);

  useEffect(() => {
    if (user) {
      const userBookings = SpaceGoStore.getBookingsBySeeker(user.id);
      setBookings(userBookings);

      const favIds = SpaceGoStore.getUserFavourites(user.id);
      const allSpaces = SpaceGoStore.getSpaces();
      setSavedSpaces(allSpaces.filter((s) => favIds.includes(s.id)));
    }
  }, [user]);

  const upcomingBooking = bookings.find((b) => b.status === "approved" || b.status === "pending");
  const totalSpend = bookings
    .filter((b) => b.status === "approved" || b.status === "completed")
    .reduce((sum, b) => sum + b.total_price, 0);

  return (
    <div className="space-y-6">
      
      {/* Welcome Header */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-teal-700">
            Space Seeker Dashboard
          </span>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
            Welcome back, {user?.full_name.split(" ")[0]}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage your flexible reservations, digital entry passes, and workspace requests.
          </p>
        </div>

        <Link href="/spaces">
          <Button variant="teal" size="md" className="font-bold shadow-sm">
            <Search className="w-4 h-4" />
            <span>Find a Workspace</span>
          </Button>
        </Link>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold mb-3">
            <CalendarCheck className="w-5 h-5" />
          </div>
          <span className="text-2xl font-black text-slate-900 block">{bookings.length}</span>
          <span className="text-xs font-semibold text-slate-500">Total Bookings</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold mb-3">
            <Clock className="w-5 h-5" />
          </div>
          <span className="text-2xl font-black text-slate-900 block">
            {bookings.filter((b) => b.status === "pending").length}
          </span>
          <span className="text-xs font-semibold text-slate-500">Awaiting Host</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center font-bold mb-3">
            <Heart className="w-5 h-5" />
          </div>
          <span className="text-2xl font-black text-slate-900 block">{savedSpaces.length}</span>
          <span className="text-xs font-semibold text-slate-500">Saved Spaces</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold mb-3">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <span className="text-2xl font-black text-slate-900 block">{formatCurrency(totalSpend)}</span>
          <span className="text-xs font-semibold text-slate-500">Confirmed Spend</span>
        </div>
      </div>

      {/* Active / Next Upcoming Booking Hero Card */}
      {upcomingBooking ? (
        <div className="bg-gradient-to-br from-teal-50/60 via-white to-slate-50 rounded-3xl border border-teal-200 p-6 sm:p-8 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-900 uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-teal-600" />
              <span>Next Upcoming Reservation</span>
            </div>
            <BookingStatusBadge status={upcomingBooking.status} />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
            <div className="flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={upcomingBooking.space_image}
                alt={upcomingBooking.space_title}
                className="w-20 h-20 rounded-2xl object-cover border border-slate-200 shadow-xs"
              />
              <div>
                <h3 className="text-lg font-bold text-slate-950">{upcomingBooking.space_title}</h3>
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{upcomingBooking.space_location}</span>
                  <span>•</span>
                  <span>{formatDate(upcomingBooking.start_date)}</span>
                </div>
                <div className="text-xs font-semibold text-teal-800 mt-1">
                  {upcomingBooking.duration_units} {upcomingBooking.duration_type} • {upcomingBooking.seats} seats reserved
                </div>
              </div>
            </div>

            {/* Access Pass Code Box */}
            {upcomingBooking.access_code && (
              <div className="bg-white p-3.5 rounded-2xl border border-teal-200 text-center shadow-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Digital Entry Pass</span>
                <span className="font-mono text-sm font-black text-teal-900 tracking-wider">
                  {upcomingBooking.access_code}
                </span>
                <span className="text-[10px] text-emerald-600 block mt-0.5">Active for Entry</span>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-teal-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Ref: <code className="font-bold text-slate-800">{upcomingBooking.id}</code></span>
            <Link href="/dashboard/bookings" className="font-bold text-teal-700 hover:text-teal-800 inline-flex items-center gap-1">
              <span>View All Booking Details</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      ) : null}

      {/* Recent Bookings Ledger */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-base font-bold text-slate-900">Recent Booking Activity</h3>
          <Link href="/dashboard/bookings" className="text-xs font-bold text-teal-700 hover:text-teal-800">
            View All ({bookings.length})
          </Link>
        </div>

        <div className="divide-y divide-slate-100">
          {bookings.slice(0, 4).map((b) => (
            <div key={b.id} className="py-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.space_image} alt="" className="w-12 h-12 rounded-xl object-cover border border-slate-200" />
                <div>
                  <h4 className="text-xs font-bold text-slate-900">{b.space_title}</h4>
                  <p className="text-[11px] text-slate-500">{formatDate(b.start_date)} • {b.duration_units} {b.duration_type}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <span className="text-xs font-black text-slate-900">
                  {formatCurrency(b.total_price, b.currency)}
                </span>
                <BookingStatusBadge status={b.status} />
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
