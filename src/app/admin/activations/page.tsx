"use client";

import React, { useState, useEffect } from "react";
import { SpaceGoStore } from "@/lib/data/store";
import { PropertyActivationRequest, ActivationStatus } from "@/types";
import { ActivationStatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { formatDate } from "@/lib/utils";
import {
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  Layers,
  DollarSign,
  FileText,
  Sliders,
  Check,
} from "lucide-react";

export default function AdminActivationsPage() {
  const { success } = useToast();
  const [requests, setRequests] = useState<PropertyActivationRequest[]>([]);
  const [filterStatus, setFilterStatus] = useState<"all" | ActivationStatus>("all");
  const [selectedRequest, setSelectedRequest] = useState<PropertyActivationRequest | null>(null);

  // Review & Score State
  const [newStatus, setNewStatus] = useState<ActivationStatus>("under_review");
  const [adminNotes, setAdminNotes] = useState("");
  const [demandScore, setDemandScore] = useState(25);
  const [econScore, setEconScore] = useState(20);
  const [readinessScore, setReadinessScore] = useState(15);
  const [locationScore, setLocationScore] = useState(12);
  const [opScore, setOpScore] = useState(8);

  const loadRequests = () => {
    setRequests(SpaceGoStore.getActivationRequests());
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const openReviewModal = (req: PropertyActivationRequest) => {
    setSelectedRequest(req);
    setNewStatus(req.status);
    setAdminNotes(req.admin_notes || "");
    if (req.activation_score) {
      setDemandScore(req.activation_score.demand_score);
      setEconScore(req.activation_score.economics_score);
      setReadinessScore(req.activation_score.readiness_score);
      setLocationScore(req.activation_score.location_score);
      setOpScore(req.activation_score.operational_score);
    }
  };

  const handleSaveReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;

    const total = demandScore + econScore + readinessScore + locationScore + opScore;

    const updated = SpaceGoStore.updateActivationStatus(
      selectedRequest.id,
      newStatus,
      adminNotes,
      {
        total,
        demand_score: demandScore,
        economics_score: econScore,
        readiness_score: readinessScore,
        location_score: locationScore,
        operational_score: opScore,
        breakdown_notes: `Analyst assessment: Score ${total}/100. Status: ${newStatus.replace("_", " ")}.`,
      }
    );

    if (updated) {
      loadRequests();
      setSelectedRequest(null);
      success("Activation Request Updated", `Updated ${updated.id} to ${newStatus.toUpperCase()}`);
    }
  };

  const filtered = requests.filter((r) => {
    if (filterStatus === "all") return true;
    return r.status === filterStatus;
  });

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-teal-700">
            Demand-Backed Workspace Pipeline
          </span>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
            Property Activation Assessments
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Evaluate owner submissions against local demand signals, apply 100-point scoring, and manage stage gates.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-2xl">
          {(["all", "submitted", "under_review", "approved_for_assessment", "ready_for_launch", "rejected"] as const).map(
            (tab) => (
              <button
                key={tab}
                onClick={() => setFilterStatus(tab)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all cursor-pointer ${
                  filterStatus === tab
                    ? "bg-white text-slate-950 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {tab.replace("_", " ")}
              </button>
            )
          )}
        </div>
      </div>

      {/* Requests List */}
      <div className="space-y-4">
        {filtered.map((req) => (
          <div
            key={req.id}
            className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs hover:border-slate-300 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-6"
          >
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs font-black text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                  {req.id}
                </span>
                <ActivationStatusBadge status={req.status} />
                <span className="text-xs font-bold text-slate-800">• Owner: {req.owner_name} ({req.email})</span>
              </div>

              <h3 className="text-base font-bold text-slate-900">{req.property_address}, {req.city}</h3>
              
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="capitalize">{req.property_type.replace("_", " ")}</span>
                <span>•</span>
                <span>{req.approx_square_feet.toLocaleString()} sq.ft.</span>
                <span>•</span>
                <span className="capitalize">Condition: {req.current_condition.replace("_", " ")}</span>
                <span>•</span>
                <span>Budget: ${req.expected_budget_usd.toLocaleString()}</span>
              </div>

              {req.admin_notes && (
                <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 max-w-xl">
                  <span className="font-semibold text-slate-900">Notes: </span>
                  {req.admin_notes}
                </p>
              )}
            </div>

            <div className="flex items-center gap-4 self-end lg:self-center">
              {req.activation_score && (
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Score</span>
                  <span className="text-xl font-black text-teal-600">
                    {req.activation_score.total}/100
                  </span>
                </div>
              )}

              <Button
                variant="teal"
                size="sm"
                onClick={() => openReviewModal(req)}
                className="gap-1 font-semibold"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Score & Update</span>
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Scoring & Review Modal */}
      {selectedRequest && (
        <Modal
          isOpen={Boolean(selectedRequest)}
          onClose={() => setSelectedRequest(null)}
          title={`Review & Score: ${selectedRequest.property_address}`}
          description={`Reference: ${selectedRequest.id} • ${selectedRequest.city}`}
          maxWidth="2xl"
        >
          <form onSubmit={handleSaveReview} className="space-y-5">
            
            {/* Status Selector */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Pipeline Stage Gate Status
              </label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as any)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
              >
                <option value="submitted">Submitted (In Queue)</option>
                <option value="under_review">Under Review</option>
                <option value="assessment_required">Assessment Required</option>
                <option value="approved_for_assessment">Approved for Assessment (Passed Initial Gate)</option>
                <option value="ready_for_launch">Ready for Launch (Passport Certified)</option>
                <option value="rejected">Rejected (Does Not Meet Criteria)</option>
              </select>
            </div>

            {/* 100-Point Matrix Sliders */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  100-Point Activation Scoring Matrix
                </span>
                <span className="text-sm font-black text-teal-700">
                  Total: {demandScore + econScore + readinessScore + locationScore + opScore} / 100
                </span>
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-700 mb-1">
                  <span>Qualified Local Demand (Max 30):</span>
                  <span className="font-bold text-teal-700">{demandScore} / 30</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={30}
                  value={demandScore}
                  onChange={(e) => setDemandScore(Number(e.target.value))}
                  className="w-full accent-teal-600"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-700 mb-1">
                  <span>Conversion Economics & Payback (Max 25):</span>
                  <span className="font-bold text-teal-700">{econScore} / 25</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={25}
                  value={econScore}
                  onChange={(e) => setEconScore(Number(e.target.value))}
                  className="w-full accent-teal-600"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-700 mb-1">
                  <span>Workspace Physical Readiness (Max 20):</span>
                  <span className="font-bold text-teal-700">{readinessScore} / 20</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={20}
                  value={readinessScore}
                  onChange={(e) => setReadinessScore(Number(e.target.value))}
                  className="w-full accent-teal-600"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-700 mb-1">
                  <span>Location, Transit & Access (Max 15):</span>
                  <span className="font-bold text-teal-700">{locationScore} / 15</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={15}
                  value={locationScore}
                  onChange={(e) => setLocationScore(Number(e.target.value))}
                  className="w-full accent-teal-600"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-700 mb-1">
                  <span>Operational Feasibility & Care (Max 10):</span>
                  <span className="font-bold text-teal-700">{opScore} / 10</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={10}
                  value={opScore}
                  onChange={(e) => setOpScore(Number(e.target.value))}
                  className="w-full accent-teal-600"
                />
              </div>
            </div>

            {/* Assessment Notes */}
            <Textarea
              label="Auditor Assessment Notes (Visible to Owner)"
              rows={3}
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Detail on-site survey findings, contractor quotation progress, power tests..."
            />

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setSelectedRequest(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="teal" className="font-bold">
                Save Assessment & Notify Owner
              </Button>
            </div>
          </form>
        </Modal>
      )}

    </div>
  );
}
