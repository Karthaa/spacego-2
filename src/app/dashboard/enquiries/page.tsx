"use client";

import React, { useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useSpaceGoVersion } from "@/context/SpaceGoDataProvider";
import { SpaceGoStore } from "@/lib/data/store";
import { WorkspaceEnquiry } from "@/types";
import { DemandRequestModal } from "@/components/common/DemandRequestModal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDate } from "@/lib/utils";
import { Sparkles, MapPin, Users, Calendar, DollarSign, Plus } from "lucide-react";

export default function SeekerEnquiriesPage() {
  const { user } = useAuth();
  const dataVersion = useSpaceGoVersion();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Only the signed-in user's own requests (RLS also enforces this remotely).
  const enquiries = useMemo<WorkspaceEnquiry[]>(() => {
    void dataVersion;
    return user ? SpaceGoStore.getEnquiriesByUser(user.id) : [];
  }, [user, dataVersion]);

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-teal-700">
            Demand-Backed Signals
          </span>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
            Custom Workspace Requests
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Track spaces you have requested in unlisted locations. Our property activation team uses this to onboard local supply.
          </p>
        </div>

        <Button
          variant="teal"
          size="sm"
          onClick={() => setIsModalOpen(true)}
          className="font-bold gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>New Custom Request</span>
        </Button>
      </div>

      {enquiries.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="w-8 h-8 text-teal-600" />}
          title="No custom requests submitted"
          description="Looking for an unlisted workspace or specific neighborhood? Submit a demand signal."
          actionLabel="Submit Request"
          onAction={() => setIsModalOpen(true)}
        />
      ) : (
        <div className="space-y-4">
          {enquiries.map((enq) => (
            <div
              key={enq.id}
              className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-slate-500">#{enq.id}</span>
                  <Badge variant={enq.status === "fulfilled" ? "success" : enq.status === "contacted" ? "brand" : "warning"}>
                    {enq.status.toUpperCase()}
                  </Badge>
                </div>
                <span className="text-xs text-slate-400">{formatDate(enq.created_at)}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
                <div className="flex items-center gap-2 text-slate-700 font-semibold">
                  <MapPin className="w-4 h-4 text-teal-600 shrink-0" />
                  <span>Target Area: {enq.location_requested}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700 font-semibold">
                  <Users className="w-4 h-4 text-teal-600 shrink-0" />
                  <span>Capacity: {enq.seats_needed} seats</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700 font-semibold">
                  <DollarSign className="w-4 h-4 text-teal-600 shrink-0" />
                  <span>Budget: {enq.budget_range || "Market Rate"}</span>
                </div>
              </div>

              {enq.notes && (
                <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  {enq.notes}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <DemandRequestModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

    </div>
  );
}
