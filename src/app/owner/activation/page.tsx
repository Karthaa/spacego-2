"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useSpaceGoVersion } from "@/context/SpaceGoDataProvider";
import { SpaceGoStore } from "@/lib/data/store";
import { PropertyActivationRequest } from "@/types";
import { ActivationStatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDate } from "@/lib/utils";
import {
  Sparkles,
  MapPin,
  Layers,
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  Plus,
} from "lucide-react";

export default function OwnerActivationProjectsPage() {
  const { user } = useAuth();
  const dataVersion = useSpaceGoVersion();

  // Remote mode loads this from spacego_owner_activations, which already
  // limits rows to auth.uid(); filtering by owner keeps admins/demo correct.
  const requests = useMemo<PropertyActivationRequest[]>(() => {
    void dataVersion;
    return user ? SpaceGoStore.getActivationRequestsByOwner(user.id) : [];
  }, [user, dataVersion]);

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-teal-700">
            Demand-Backed Workspace Activation
          </span>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
            My Property Activation Projects
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Track underutilized floors submitted for architectural layout planning, 100-point scoring, and market onboarding.
          </p>
        </div>

        <Link href="/activation">
          <Button variant="teal" size="sm" className="font-bold gap-1.5">
            <Plus className="w-4 h-4" />
            <span>Submit New Property</span>
          </Button>
        </Link>
      </div>

      {requests.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="w-8 h-8 text-teal-600" />}
          title="No properties in activation pipeline"
          description="Have vacant floors or underutilized commercial space? Submit your property for demand-backed activation."
          actionLabel="Submit Property"
          onAction={() => (window.location.href = "/activation")}
        />
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <div
              key={req.id}
              className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs hover:border-slate-300 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-5"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-black text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                    {req.id}
                  </span>
                  <ActivationStatusBadge status={req.status} />
                  <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded capitalize">
                    {req.property_type.replace("_", " ")}
                  </span>
                </div>

                <h3 className="text-base font-bold text-slate-900">{req.property_address}</h3>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" /> {req.city}
                  </span>
                  <span>•</span>
                  <span>{req.approx_square_feet.toLocaleString()} sq.ft.</span>
                  <span>•</span>
                  <span>Submitted {formatDate(req.created_at)}</span>
                </div>

                {req.activation_score && (
                  <div className="pt-1 flex items-center gap-3 text-xs text-teal-800 font-semibold">
                    <span>Activation Score: <strong className="text-teal-900">{req.activation_score.total}/100</strong></span>
                    <span>•</span>
                    <span className="text-slate-500 font-normal">Model: {req.preferred_model.replace("_", " ")}</span>
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div className="flex items-center gap-2 self-end lg:self-center">
                <Link href={`/activation/track?ref=${req.id}`}>
                  <Button variant="outline" size="sm" className="gap-1 font-semibold">
                    <span>Track Pipeline & Matrix</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
