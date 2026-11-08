"use client";

import React, { useState, useEffect } from "react";
import { SpaceGoStore } from "@/lib/data/store";
import { Booking, BookingStatus } from "@/types";
import { BookingStatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Inbox,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  Calendar,
  Users,
  Search,
} from "lucide-react";

export default function OwnerBookingsPage() {
  const { success } = useToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filterTab, setFilterTab] = useState<"all" | BookingStatus>("all");

  const loadBookings = () => {
    const list = SpaceGoStore.getBookings();
    setBookings(list);
  };

  useEffect(() => {
    loadBookings();
  }, []);

  const handleApprove = (id: string) => {
    const updated = SpaceGoStore.updateBookingStatus(id, "approved");
    if (updated) {
      loadBookings();
      success("Booking Approved", `Reservation ${id} has been confirmed.`);
    }
  };

  const handleDecline = (id: string) => {
    const updated = SpaceGoStore.updateBookingStatus(id, "declined");
    if (updated) {
      loadBookings();
      success("Booking Declined", `Request ${id} has been declined.`);
    }
  };

  const filtered = bookings.filter((b) => {
    if (filterTab === "all") return true;
    return b.status === filterTab;
  });

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Booking Requests & Ledger
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Review seeker reservation requests, approve slots, and manage visitor schedules.
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-2xl">
          {(["all", "pending", "approved", "completed", "cancelled"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilterTab(tab)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all cursor-pointer ${
                filterTab === tab
                  ? "bg-white text-slate-950 shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Inbox className="w-8 h-8" />}
          title="No booking requests found"
          description="There are currently no reservations under this filter tab."
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((b) => (
            <div
              key={b.id}
              className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs hover:border-slate-300 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-5"
            >
              <div className="flex items-start sm:items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={b.space_image}
                  alt=""
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border border-slate-200 shrink-0"
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-black text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                      {b.id}
                    </span>
                    <BookingStatusBadge status={b.status} />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">{b.space_title}</h3>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-semibold text-slate-800">Seeker: {b.user_name}</span>
                    <span>({b.user_email})</span>
                  </div>
                  <div className="text-xs text-slate-600">
                    {formatDate(b.start_date)} • {b.duration_units} {b.duration_type} • {b.seats} seats
                  </div>
                  {b.special_requests && (
                    <p className="text-[11px] text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 max-w-lg mt-1">
                      Note: &ldquo;{b.special_requests}&rdquo;
                    </p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 self-end lg:self-center">
                <div className="text-right mr-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Value</span>
                  <span className="text-base font-black text-slate-900">
                    {formatCurrency(b.total_price, b.currency)}
                  </span>
                </div>

                {b.status === "pending" && (
                  <>
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
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
