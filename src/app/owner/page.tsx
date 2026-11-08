"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { SpaceGoStore } from "@/lib/data/store";
import { Booking, Space } from "@/types";
import { BookingStatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Building2,
  Inbox,
  CalendarCheck,
  TrendingUp,
  PlusCircle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Clock,
  Sparkles,
} from "lucide-react";

export default function OwnerOverviewPage() {
  const { user } = useAuth();
  const { success } = useToast();

  const [properties, setProperties] = useState<Space[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);

  const loadData = () => {
    const spaces = SpaceGoStore.getSpaces();
    setProperties(spaces);
    const allBookings = SpaceGoStore.getBookings();
    setBookings(allBookings);
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const pendingBookings = bookings.filter((b) => b.status === "pending");
  const approvedBookings = bookings.filter((b) => b.status === "approved" || b.status === "completed");
  const totalRevenue = approvedBookings.reduce((sum, b) => sum + b.total_price, 0);

  const handleApprove = (bookingId: string) => {
    const updated = SpaceGoStore.updateBookingStatus(bookingId, "approved");
    if (updated) {
      loadData();
      success("Booking Request Approved", `Confirmed reservation ${bookingId}. The customer has been issued an access pass.`);
    }
  };

  const handleDecline = (bookingId: string) => {
    const updated = SpaceGoStore.updateBookingStatus(bookingId, "declined");
    if (updated) {
      loadData();
      success("Booking Declined", `Request ${bookingId} has been declined and the slot released.`);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header Bar */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-teal-700">
            Host Management Console
          </span>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
            Property Portfolio Overview
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time occupancy, pending approval queue, and monthly net owner earnings.
          </p>
        </div>

        <Link href="/owner/spaces/new">
          <Button variant="teal" size="md" className="font-bold shadow-sm gap-1.5">
            <PlusCircle className="w-4 h-4" />
            <span>Add New Workspace</span>
          </Button>
        </Link>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold mb-3">
            <Building2 className="w-5 h-5" />
          </div>
          <span className="text-2xl font-black text-slate-900 block">{properties.length}</span>
          <span className="text-xs font-semibold text-slate-500">Active Listings</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold mb-3">
            <Inbox className="w-5 h-5" />
          </div>
          <span className="text-2xl font-black text-slate-900 block">{pendingBookings.length}</span>
          <span className="text-xs font-semibold text-slate-500">Pending Requests</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center font-bold mb-3">
            <CalendarCheck className="w-5 h-5" />
          </div>
          <span className="text-2xl font-black text-slate-900 block">{approvedBookings.length}</span>
          <span className="text-xs font-semibold text-slate-500">Confirmed Bookings</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold mb-3">
            <TrendingUp className="w-5 h-5" />
          </div>
          <span className="text-2xl font-black text-slate-900 block">{formatCurrency(totalRevenue)}</span>
          <span className="text-xs font-semibold text-slate-500">Gross Booking Value</span>
        </div>
      </div>

      {/* Pending Requests Queue (Actionable) */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600" />
            <h3 className="text-base font-bold text-slate-900">
              Pending Booking Requests ({pendingBookings.length})
            </h3>
          </div>
          <Link href="/owner/bookings" className="text-xs font-bold text-teal-700 hover:text-teal-800">
            View All Requests
          </Link>
        </div>

        {pendingBookings.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            No pending requests awaiting approval right now. All caught up!
          </div>
        ) : (
          <div className="space-y-3">
            {pendingBookings.map((b) => (
              <div
                key={b.id}
                className="p-4 rounded-2xl border border-amber-200 bg-amber-50/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={b.space_image} alt="" className="w-14 h-14 rounded-xl object-cover border border-slate-200 shrink-0" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-800">{b.id}</span>
                      <span className="text-xs font-bold text-slate-900">• {b.user_name}</span>
                    </div>
                    <h4 className="text-xs font-semibold text-slate-800 mt-0.5">{b.space_title}</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {formatDate(b.start_date)} • {b.duration_units} {b.duration_type} • {b.seats} seats
                    </p>
                    {b.special_requests && (
                      <p className="text-[11px] text-amber-900 bg-white/80 px-2 py-0.5 rounded mt-1 max-w-md">
                        Note: &ldquo;{b.special_requests}&rdquo;
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-black text-slate-900 mr-2">
                    {formatCurrency(b.total_price, b.currency)}
                  </span>
                  <Button
                    variant="teal"
                    size="sm"
                    onClick={() => handleApprove(b.id)}
                    className="gap-1 font-semibold"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Approve</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDecline(b.id)}
                    className="text-rose-600 border-rose-200 hover:bg-rose-50"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Decline</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Properties List Preview */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-base font-bold text-slate-900">My Properties</h3>
          <Link href="/owner/properties" className="text-xs font-bold text-teal-700 hover:text-teal-800">
            Manage All ({properties.length})
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {properties.slice(0, 3).map((space) => (
            <div key={space.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2">
              <div className="flex justify-between items-start">
                <h4 className="text-xs font-bold text-slate-900 line-clamp-1">{space.title}</h4>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                  {space.status}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">{space.location.city} • Up to {space.capacity} seats</p>
              <div className="flex justify-between items-center pt-2 border-t border-slate-200/60 text-xs">
                <span className="font-bold text-slate-900">
                  {formatCurrency(space.pricing.daily || space.pricing.hourly || 0)}/day
                </span>
                <Link href={`/spaces/${space.id}`} className="text-teal-700 hover:text-teal-800 font-semibold">
                  Preview Space →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
