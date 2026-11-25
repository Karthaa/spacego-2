"use client";

import React, { useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/navigation/Navbar";
import { Footer } from "@/components/navigation/Footer";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ActivationStatusBadge } from "@/components/ui/Badge";
import { SpaceGoStore } from "@/lib/data/store";
import { PropertyActivationRequest, ActivationStatus } from "@/types";
import { formatDate } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useSpaceGoVersion } from "@/context/SpaceGoDataProvider";
import {
  Search,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Building2,
  MapPin,
  Layers,
  ArrowRight,
  FileText,
  DollarSign,
  ChevronRight,
} from "lucide-react";

export default function TrackActivationPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center">Loading tracker...</div>}>
      <TrackActivationContent />
    </Suspense>
  );
}

function TrackActivationContent() {
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const dataVersion = useSpaceGoVersion();
  const refParam = searchParams.get("ref") || "";

  const [searchRef, setSearchRef] = useState(refParam);
  // null = default selection (the ?ref= record, else the newest visible one).
  const [lookupId, setLookupId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  // In remote mode only the owner's own records (via spacego_owner_activations)
  // or, for admins, all records are visible, so lookups are naturally scoped.
  const allRequests = useMemo<PropertyActivationRequest[]>(() => {
    void dataVersion;
    if (SpaceGoStore.isRemoteEnabled() && !user) return [];
    return SpaceGoStore.getActivationRequests();
  }, [dataVersion, user]);

  const selectedRequest = useMemo<PropertyActivationRequest | null>(() => {
    const byId = (id: string) =>
      id ? allRequests.find((r) => r.id.toLowerCase() === id.trim().toLowerCase()) : undefined;
    if (lookupId !== null) return byId(lookupId) ?? null;
    return byId(refParam) ?? allRequests[0] ?? null;
  }, [allRequests, lookupId, refParam]);

  const setSelectedRequest = (req: PropertyActivationRequest) => setLookupId(req.id);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchRef.trim()) return;

    setLookupId(searchRef.trim());
    const found = allRequests.some(
      (r) => r.id.toLowerCase() === searchRef.trim().toLowerCase()
    );
    setErrorMessage(
      found
        ? ""
        : `No activation record found for reference "${searchRef}". Check the ID, and make sure you are signed in with the account that submitted it.`
    );
  };

  const stages: { key: ActivationStatus; label: string; desc: string }[] = [
    { key: "submitted", label: "Submitted", desc: "Data received & queued" },
    { key: "under_review", label: "Under Review", desc: "Permitted use & authority check" },
    { key: "assessment_required", label: "Assessment Required", desc: "Technical survey required" },
    { key: "approved_for_assessment", label: "Approved for Assessment", desc: "Field survey & 100-pt score" },
    { key: "ready_for_launch", label: "Ready for Launch", desc: "Space Passport issued" },
  ];

  const getStageIndex = (status: ActivationStatus) => {
    switch (status) {
      case "submitted":
        return 0;
      case "under_review":
        return 1;
      case "assessment_required":
        return 2;
      case "approved_for_assessment":
        return 3;
      case "ready_for_launch":
        return 4;
      case "rejected":
        return -1;
      default:
        return 0;
    }
  };

  const currentStageIndex = selectedRequest ? getStageIndex(selectedRequest.status) : 0;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />

      {/* Header Bar */}
      <div className="bg-white border-b border-slate-200 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-700">
                <Sparkles className="w-4 h-4" /> Pipeline Transparency
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1">
                Track Property Activation Status
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Monitor your space&apos;s progress through demand cross-referencing, architectural assessment, and Space Passport™ verification.
              </p>
            </div>

            {/* Quick Reference Lookup Form */}
            <form onSubmit={handleSearch} className="flex items-center gap-2 w-full md:w-auto">
              <Input
                placeholder="Enter Reference (e.g. ACT-2026-3420)"
                value={searchRef}
                onChange={(e) => setSearchRef(e.target.value)}
                className="w-full sm:w-72 font-mono uppercase text-xs"
                leftIcon={<Search className="w-4 h-4" />}
              />
              <Button type="submit" variant="teal" size="md">
                Track
              </Button>
            </form>
          </div>
        </div>
      </div>

      {/* Main Tracker Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Quick list of submitted activation properties */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Recent Submissions
                </h3>
                <Link href="/activation" className="text-xs font-semibold text-teal-700 hover:text-teal-800">
                  + New Property
                </Link>
              </div>

              <div className="space-y-2">
                {allRequests.map((req) => (
                  <button
                    key={req.id}
                    onClick={() => {
                      setSelectedRequest(req);
                      setSearchRef(req.id);
                      setErrorMessage("");
                    }}
                    className={`w-full p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      selectedRequest?.id === req.id
                        ? "border-teal-500 bg-teal-50/60 shadow-xs"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-black text-slate-900">{req.id}</span>
                      <ActivationStatusBadge status={req.status} />
                    </div>
                    <p className="text-xs font-bold text-slate-800 mt-1.5 truncate">{req.property_address}</p>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                      <span>{req.city}</span>
                      <span>{req.approx_square_feet.toLocaleString()} sq.ft.</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Detailed Tracking Status */}
          <div className="lg:col-span-8 space-y-6">
            {errorMessage ? (
              <div className="p-8 rounded-2xl border border-rose-200 bg-rose-50/60 text-center space-y-3">
                <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
                <h3 className="text-base font-bold text-rose-950">Record Not Found</h3>
                <p className="text-xs text-rose-800 max-w-md mx-auto">{errorMessage}</p>
              </div>
            ) : selectedRequest ? (
              <div className="space-y-6">
                
                {/* Hero Status Card */}
                <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
                  
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-black text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded border border-teal-200">
                          {selectedRequest.id}
                        </span>
                        <ActivationStatusBadge status={selectedRequest.status} />
                      </div>
                      <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-2">
                        {selectedRequest.property_address}
                      </h2>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>{selectedRequest.city}</span>
                        <span>•</span>
                        <span>{selectedRequest.approx_square_feet.toLocaleString()} sq.ft.</span>
                        <span>•</span>
                        <span>Submitted {formatDate(selectedRequest.created_at)}</span>
                      </div>
                    </div>

                    {selectedRequest.activation_score && (
                      <div className="text-right bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                          Activation Score
                        </span>
                        <span className="text-3xl font-black text-teal-600">
                          {selectedRequest.activation_score.total}
                          <span className="text-sm text-slate-400 font-normal">/100</span>
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Stage-Gate Visual Progress Steps */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-4">
                      Activation Pipeline Stage
                    </h4>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                      {stages.map((stage, idx) => {
                        const isPast = idx < currentStageIndex;
                        const isCurrent = idx === currentStageIndex;

                        return (
                          <div
                            key={stage.key}
                            className={`p-3.5 rounded-2xl border transition-all ${
                              isCurrent
                                ? "border-teal-500 bg-teal-50/80 shadow-xs"
                                : isPast
                                ? "border-emerald-200 bg-emerald-50/40"
                                : "border-slate-200 bg-slate-50/50 opacity-60"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[10px] font-bold uppercase text-slate-400">
                                0{idx + 1}
                              </span>
                              {isPast && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                              {isCurrent && <Clock className="w-4 h-4 text-teal-600 animate-pulse" />}
                            </div>
                            <h5 className="text-xs font-bold text-slate-900 leading-tight">
                              {stage.label}
                            </h5>
                            <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                              {stage.desc}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Admin Notes & Current Action Item */}
                  {selectedRequest.admin_notes && (
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                        <FileText className="w-4 h-4 text-teal-600" />
                        <span>Operations Team Assessment Notes:</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed font-normal">
                        {selectedRequest.admin_notes}
                      </p>
                    </div>
                  )}

                </div>

                {/* 100-Point Score Deep Dive Card */}
                {selectedRequest.activation_score && (
                  <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-5">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div>
                        <h3 className="text-base font-bold text-slate-900">
                          100-Point SpaceGo Activation Matrix
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Weighted commercial, technical, and operational readiness model
                        </p>
                      </div>
                      <span className="text-xs font-bold px-3 py-1 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                        {selectedRequest.activation_score.total >= 75 ? "High Feasibility" : "Moderate Feasibility"}
                      </span>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-xs text-slate-700 mb-1">
                          <span className="font-semibold">Qualified Local Demand (30% weight)</span>
                          <span className="font-bold text-teal-700">{selectedRequest.activation_score.demand_score} / 30</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full bg-teal-600 rounded-full"
                            style={{ width: `${(selectedRequest.activation_score.demand_score / 30) * 100}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs text-slate-700 mb-1">
                          <span className="font-semibold">Conversion Economics & CapEx (25% weight)</span>
                          <span className="font-bold text-teal-700">{selectedRequest.activation_score.economics_score} / 25</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full bg-teal-600 rounded-full"
                            style={{ width: `${(selectedRequest.activation_score.economics_score / 25) * 100}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs text-slate-700 mb-1">
                          <span className="font-semibold">Workspace Readiness & Infrastructure (20% weight)</span>
                          <span className="font-bold text-teal-700">{selectedRequest.activation_score.readiness_score} / 20</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full bg-teal-600 rounded-full"
                            style={{ width: `${(selectedRequest.activation_score.readiness_score / 20) * 100}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs text-slate-700 mb-1">
                          <span className="font-semibold">Transit, Parking & Location (15% weight)</span>
                          <span className="font-bold text-teal-700">{selectedRequest.activation_score.location_score} / 15</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full bg-teal-600 rounded-full"
                            style={{ width: `${(selectedRequest.activation_score.location_score / 15) * 100}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs text-slate-700 mb-1">
                          <span className="font-semibold">Operational Feasibility & Support (10% weight)</span>
                          <span className="font-bold text-teal-700">{selectedRequest.activation_score.operational_score} / 10</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full bg-teal-600 rounded-full"
                            style={{ width: `${(selectedRequest.activation_score.operational_score / 10) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-600 leading-relaxed">
                      <span className="font-bold text-slate-900 block mb-0.5">Analyst Summary:</span>
                      {selectedRequest.activation_score.breakdown_notes}
                    </div>
                  </div>
                )}

                {/* Property Details Snapshot */}
                <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
                  <h3 className="text-base font-bold text-slate-900">Submitted Property Record</h3>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Condition</span>
                      <span className="font-semibold text-slate-900 capitalize">
                        {selectedRequest.current_condition.replace("_", " ")}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Type</span>
                      <span className="font-semibold text-slate-900 capitalize">
                        {selectedRequest.property_type.replace("_", " ")}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Model</span>
                      <span className="font-semibold text-slate-900 capitalize">
                        {selectedRequest.preferred_model.replace("_", " ")}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Budget</span>
                      <span className="font-semibold text-slate-900">
                        ${selectedRequest.expected_budget_usd.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="text-xs font-bold text-slate-700 block mb-1.5">Existing Facilities:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedRequest.existing_facilities.map((fac, idx) => (
                        <span key={idx} className="text-[11px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                          {fac}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

              </div>
            ) : null}
          </div>

        </div>
      </div>

      <Footer />
    </div>
  );
}
