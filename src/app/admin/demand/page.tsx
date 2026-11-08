"use client";

import React, { useState, useEffect } from "react";
import { SpaceGoStore } from "@/lib/data/store";
import { DemandSearch, WorkspaceEnquiry } from "@/types";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { formatDate } from "@/lib/utils";
import {
  BarChart3,
  MapPin,
  TrendingUp,
  Search,
  Users,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Mail,
  Building2,
} from "lucide-react";

export default function AdminDemandPage() {
  const { success } = useToast();
  const [searches, setSearches] = useState<DemandSearch[]>([]);
  const [enquiries, setEnquiries] = useState<WorkspaceEnquiry[]>([]);

  const loadData = () => {
    setSearches(SpaceGoStore.getDemandSearches());
    setEnquiries(SpaceGoStore.getEnquiries());
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUpdateEnquiry = (id: string, status: "new" | "contacted" | "fulfilled") => {
    SpaceGoStore.updateEnquiryStatus(id, status);
    loadData();
    success("Status Updated", `Enquiry set to ${status}.`);
  };

  // Group searches by location to compute demand density
  const locationCounts: Record<string, { total: number; zeroResults: number }> = {};
  searches.forEach((s) => {
    const loc = s.location_query.split(",")[0].trim() || "Unknown";
    if (!locationCounts[loc]) locationCounts[loc] = { total: 0, zeroResults: 0 };
    locationCounts[loc].total += 1;
    if (!s.has_results) locationCounts[loc].zeroResults += 1;
  });

  const sortedLocations = Object.entries(locationCounts).sort((a, b) => b[1].total - a[1].total);

  // Group searches by category
  const categoryCounts: Record<string, number> = {};
  searches.forEach((s) => {
    const cat = s.category || "Any";
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  });

  const unfulfilledQueries = searches.filter((s) => !s.has_results);

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-teal-700">
            Platform Intelligence
          </span>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
            Real Demand Signals & Unmet Needs
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Actual customer intent recorded from marketplace search queries, zero-result locations, and custom requests.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold bg-teal-50 text-teal-800 px-3 py-1.5 rounded-xl border border-teal-200">
            Total Queries Logged: {searches.length}
          </span>
        </div>
      </div>

      {/* Analytics Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-500 mb-2">
            <MapPin className="w-4 h-4 text-teal-600" />
            <span>Top Searched Micro-Markets</span>
          </div>
          <div className="space-y-2 pt-1">
            {sortedLocations.slice(0, 4).map(([loc, data]) => (
              <div key={loc} className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800">{loc}</span>
                <span className="text-slate-500 font-semibold">{data.total} queries</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-500 mb-2">
            <Building2 className="w-4 h-4 text-teal-600" />
            <span>Requested Space Categories</span>
          </div>
          <div className="space-y-2 pt-1">
            {Object.entries(categoryCounts).slice(0, 4).map(([cat, count]) => (
              <div key={cat} className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800 capitalize">{cat.replace("_", " ")}</span>
                <span className="text-slate-500 font-semibold">{count} searches</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-500 mb-2">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <span>Unfulfilled Demand Index</span>
          </div>
          <div className="space-y-1">
            <span className="text-2xl font-black text-amber-600">{unfulfilledQueries.length}</span>
            <p className="text-[11px] text-slate-500 leading-snug">
              Queries with zero matching spaces. Ideal targets for SpaceGo owner recruitment and activation campaigns!
            </p>
          </div>
        </div>
      </div>

      {/* Unfulfilled Demand Signals Table */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="text-base font-bold text-slate-900">
            Unmet Demand Signals (Zero-Result Searches)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Identify areas where customer demand exists but supply is currently missing.
          </p>
        </div>

        <div className="divide-y divide-slate-100">
          {unfulfilledQueries.map((item) => (
            <div key={item.id} className="py-3 flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-slate-900">{item.location_query}</span>
                <span className="text-slate-500 ml-2">Category: {item.category || "Any"}</span>
                {item.seats && <span className="text-slate-500 ml-2">• {item.seats} seats</span>}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-slate-400">{formatDate(item.created_at)}</span>
                <span className="font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded text-[11px] border border-rose-200">
                  0 Available Spaces
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Custom Enquiries Management */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="text-base font-bold text-slate-900">
            Direct Customer Space Requests ({enquiries.length})
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Custom requests submitted by seekers seeking spaces in emerging zones.
          </p>
        </div>

        <div className="divide-y divide-slate-100">
          {enquiries.map((enq) => (
            <div key={enq.id} className="py-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-slate-500">#{enq.id}</span>
                  <span className="font-bold text-slate-900 text-xs">{enq.user_name}</span>
                  {enq.company && <span className="text-slate-500 text-xs">({enq.company})</span>}
                  <Badge variant={enq.status === "fulfilled" ? "success" : enq.status === "contacted" ? "brand" : "warning"}>
                    {enq.status.toUpperCase()}
                  </Badge>
                </div>
                <span className="text-xs text-slate-400">{formatDate(enq.created_at)}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <span className="text-slate-700">Target: <strong>{enq.location_requested}</strong></span>
                <span className="text-slate-700">Category: <strong>{enq.category_requested}</strong></span>
                <span className="text-slate-700">Seats: <strong>{enq.seats_needed}</strong> • Budget: <strong>{enq.budget_range}</strong></span>
              </div>

              {enq.notes && (
                <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  {enq.notes}
                </p>
              )}

              {/* Status Update Buttons */}
              <div className="flex items-center justify-end gap-2 pt-1">
                <span className="text-xs text-slate-400">Action:</span>
                <button
                  onClick={() => handleUpdateEnquiry(enq.id, "contacted")}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Mark Contacted
                </button>
                <button
                  onClick={() => handleUpdateEnquiry(enq.id, "fulfilled")}
                  className="px-2.5 py-1 rounded-lg bg-teal-50 border border-teal-200 text-xs font-bold text-teal-800 hover:bg-teal-100"
                >
                  Mark Fulfilled
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
