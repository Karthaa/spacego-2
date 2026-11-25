"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { useSpaceGoVersion } from "@/context/SpaceGoDataProvider";
import { SpaceGoStore } from "@/lib/data/store";
import { Space, Booking, PropertyActivationRequest } from "@/types";
import { BookingStatusBadge, ActivationStatusBadge, VerificationBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  LayoutDashboard,
  Building2,
  Users,
  CalendarCheck,
  Sparkles,
  TrendingUp,
  BarChart3,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";

export default function AdminOverviewPage() {
  const dataVersion = useSpaceGoVersion();
  const { spaces, bookings, activations } = useMemo<{
    spaces: Space[];
    bookings: Booking[];
    activations: PropertyActivationRequest[];
  }>(() => {
    void dataVersion;
    return {
      spaces: SpaceGoStore.getSpaces(),
      bookings: SpaceGoStore.getBookings(),
      activations: SpaceGoStore.getActivationRequests(),
    };
  }, [dataVersion]);

  const totalGMV = bookings
    .filter((b) => b.status === "approved" || b.status === "completed")
    .reduce((sum, b) => sum + b.total_price, 0);

  const platformNetCommission = Math.round(totalGMV * 0.15);
  const pendingActivations = activations.filter((a) => a.status === "submitted" || a.status === "under_review");

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-rose-700">
            SpaceGo Global Operations
          </span>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
            Executive Operations Console
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time platform ledger, property activation pipeline, and demand intelligence.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/admin/activations">
            <Button variant="teal" size="sm" className="font-bold gap-1.5">
              <Sparkles className="w-4 h-4" />
              <span>Review Activations ({pendingActivations.length})</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold mb-3">
            <TrendingUp className="w-5 h-5" />
          </div>
          <span className="text-2xl font-black text-slate-900 block">{formatCurrency(totalGMV)}</span>
          <span className="text-xs font-semibold text-slate-500">Gross Marketplace Volume</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold mb-3">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <span className="text-2xl font-black text-emerald-700 block">{formatCurrency(platformNetCommission)}</span>
          <span className="text-xs font-semibold text-slate-500">Platform Commission (15%)</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center font-bold mb-3">
            <Building2 className="w-5 h-5" />
          </div>
          <span className="text-2xl font-black text-slate-900 block">{spaces.length}</span>
          <span className="text-xs font-semibold text-slate-500">Listed Workspaces</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold mb-3">
            <Sparkles className="w-5 h-5" />
          </div>
          <span className="text-2xl font-black text-amber-700 block">{pendingActivations.length}</span>
          <span className="text-xs font-semibold text-slate-500">Activation Queue</span>
        </div>
      </div>

      {/* Property Activation Backlog Queue */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-teal-600" />
            <h3 className="text-base font-bold text-slate-900">
              Demand-Backed Activation Pipeline ({activations.length})
            </h3>
          </div>
          <Link href="/admin/activations" className="text-xs font-bold text-teal-700 hover:text-teal-800">
            Manage Pipeline →
          </Link>
        </div>

        <div className="divide-y divide-slate-100">
          {activations.slice(0, 3).map((act) => (
            <div key={act.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-black text-slate-900">{act.id}</span>
                  <ActivationStatusBadge status={act.status} />
                  <span className="text-xs font-semibold text-slate-700">{act.owner_name}</span>
                </div>
                <h4 className="text-xs font-bold text-slate-900 mt-0.5">{act.property_address}, {act.city}</h4>
                <p className="text-[11px] text-slate-500">
                  {act.approx_square_feet.toLocaleString()} sq.ft. • Condition: {act.current_condition.replace("_", " ")}
                </p>
              </div>

              <div className="flex items-center gap-3">
                {act.activation_score && (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-teal-50 text-teal-900 border border-teal-200">
                    Score: {act.activation_score.total}/100
                  </span>
                )}
                <Link href={`/admin/activations`}>
                  <Button variant="outline" size="sm" className="text-xs font-semibold">
                    Review
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Booking Ledger Table */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-base font-bold text-slate-900">Recent Global Bookings</h3>
          <Link href="/admin/bookings" className="text-xs font-bold text-teal-700 hover:text-teal-800">
            View All ({bookings.length})
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-100">
              <tr>
                <th className="p-3">Reference</th>
                <th className="p-3">Workspace</th>
                <th className="p-3">Customer</th>
                <th className="p-3">Date</th>
                <th className="p-3">Total Amount</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {bookings.slice(0, 5).map((b) => (
                <tr key={b.id} className="hover:bg-slate-50/50">
                  <td className="p-3 font-mono font-bold text-slate-900">{b.id}</td>
                  <td className="p-3 font-bold text-slate-900 max-w-[180px] truncate">{b.space_title}</td>
                  <td className="p-3 text-slate-700">{b.user_name}</td>
                  <td className="p-3 text-slate-500">{formatDate(b.start_date)}</td>
                  <td className="p-3 font-bold text-slate-900">{formatCurrency(b.total_price, b.currency)}</td>
                  <td className="p-3">
                    <BookingStatusBadge status={b.status} />
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
