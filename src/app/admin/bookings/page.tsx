"use client";

import React, { useState, useEffect } from "react";
import { SpaceGoStore } from "@/lib/data/store";
import { Booking, BookingStatus } from "@/types";
import { BookingStatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency, formatDate } from "@/lib/utils";
import { CalendarCheck, Search, Filter } from "lucide-react";

export default function AdminBookingsPage() {
  const { success } = useToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filterStatus, setFilterStatus] = useState<"all" | BookingStatus>("all");

  const loadData = () => {
    setBookings(SpaceGoStore.getBookings());
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleStatusOverride = (id: string, newStatus: BookingStatus) => {
    SpaceGoStore.updateBookingStatus(id, newStatus);
    loadData();
    success("Booking Status Overridden", `Updated ${id} to ${newStatus.toUpperCase()}`);
  };

  const filtered = bookings.filter((b) => {
    if (filterStatus === "all") return true;
    return b.status === filterStatus;
  });

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Global Booking Ledger
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Complete transaction history across all seekers, workspaces, and hosts.
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-2xl">
          {(["all", "approved", "pending", "completed", "cancelled", "declined"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilterStatus(tab)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all cursor-pointer ${
                filterStatus === tab
                  ? "bg-white text-slate-950 shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-100">
              <tr>
                <th className="p-4">Reference</th>
                <th className="p-4">Workspace</th>
                <th className="p-4">Seeker</th>
                <th className="p-4">Schedule</th>
                <th className="p-4">Value</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Status Override</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filtered.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50/50">
                  <td className="p-4 font-mono font-bold text-slate-900">{b.id}</td>
                  <td className="p-4 font-bold text-slate-900 max-w-[180px] truncate">{b.space_title}</td>
                  <td className="p-4 text-slate-700">
                    <div>{b.user_name}</div>
                    <div className="text-[10px] text-slate-400">{b.user_email}</div>
                  </td>
                  <td className="p-4 text-slate-600">
                    <div>{formatDate(b.start_date)}</div>
                    <div className="text-[10px] text-slate-400">{b.duration_units} {b.duration_type} • {b.seats} seats</div>
                  </td>
                  <td className="p-4 font-bold text-slate-900">
                    {formatCurrency(b.total_price, b.currency)}
                  </td>
                  <td className="p-4">
                    <BookingStatusBadge status={b.status} />
                  </td>
                  <td className="p-4 text-right">
                    <select
                      value={b.status}
                      onChange={(e) => handleStatusOverride(b.id, e.target.value as BookingStatus)}
                      className="rounded-lg border border-slate-300 bg-white p-1 text-[11px] font-semibold text-slate-800"
                    >
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                      <option value="declined">Declined</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
