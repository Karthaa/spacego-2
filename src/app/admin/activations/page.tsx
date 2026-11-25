"use client";

import React, { useMemo, useState } from "react";
import { useSpaceGoVersion } from "@/context/SpaceGoDataProvider";
import { SpaceGoStore } from "@/lib/data/store";
import { PropertyActivationRequest, ActivationStatus } from "@/types";
import { ActivationStatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { Select, Textarea } from "@/components/ui/Input";
import { FilterTabs, PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Sparkles } from "lucide-react";

const STAGE_LABELS: Record<ActivationStatus, string> = {
  submitted: "Submitted",
  under_review: "Under review",
  assessment_required: "Assessment required",
  approved_for_assessment: "Approved for assessment",
  ready_for_launch: "Ready for launch",
  rejected: "Declined",
};

const FILTERS = [
  "all",
  "submitted",
  "under_review",
  "assessment_required",
  "approved_for_assessment",
  "ready_for_launch",
  "rejected",
] as const;

function humanize(value: string): string {
  const text = value.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function ScoreSlider({
  id,
  label,
  max,
  value,
  onChange,
}: {
  id: string;
  label: string;
  max: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
        </label>
        <span className="shrink-0 text-sm tabular-nums text-ink-muted">
          <span className="font-semibold text-ink">{value}</span> / {max}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-6 w-full cursor-pointer accent-accent"
      />
    </div>
  );
}

export default function AdminActivationsPage() {
  const { success, error } = useToast();
  const dataVersion = useSpaceGoVersion();
  const requests = useMemo<PropertyActivationRequest[]>(() => {
    void dataVersion;
    return SpaceGoStore.getActivationRequests();
  }, [dataVersion]);
  const [isSaving, setIsSaving] = useState(false);
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

  const handleSaveReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest || isSaving) return;

    const total = demandScore + econScore + readinessScore + locationScore + opScore;

    setIsSaving(true);
    const result = await SpaceGoStore.updateActivationStatus(
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

    setIsSaving(false);

    if (!result.ok) {
      error("Could not update activation request", result.error);
      return;
    }
    setSelectedRequest(null);
    success("Activation request updated", `${result.data.id} is now ${STAGE_LABELS[newStatus].toLowerCase()}.`);
  };

  const filtered = requests.filter((r) => {
    if (filterStatus === "all") return true;
    return r.status === filterStatus;
  });

  const filterOptions = FILTERS.map((value) => ({
    value,
    label: value === "all" ? "All" : STAGE_LABELS[value],
    count: value === "all" ? requests.length : requests.filter((r) => r.status === value).length,
  }));

  const runningTotal = demandScore + econScore + readinessScore + locationScore + opScore;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activations"
        description="Property owners asking SpaceGo to help turn unused space into bookable workspace. Score each request out of 100 and move it through the review stages."
      />

      <FilterTabs label="Filter activation requests by stage" value={filterStatus} options={filterOptions} onChange={setFilterStatus} />

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Sparkles />}
          title={filterStatus === "all" ? "No activation requests yet" : `Nothing in "${STAGE_LABELS[filterStatus]}"`}
          description={
            filterStatus === "all"
              ? "When an owner submits a property for activation, it will appear here for review."
              : "No requests are at this stage right now."
          }
          actionLabel={filterStatus === "all" ? undefined : "Show all requests"}
          onAction={filterStatus === "all" ? undefined : () => setFilterStatus("all")}
        />
      ) : (
        <Card padding="none">
          <ul className="divide-y divide-line">
            {filtered.map((req) => (
              <li
                key={req.id}
                className="flex flex-col gap-4 px-5 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:gap-8"
              >
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <ActivationStatusBadge status={req.status} />
                    <span className="font-mono text-xs text-ink-subtle">{req.id}</span>
                    <span className="text-sm text-ink-subtle">· {formatDate(req.created_at)}</span>
                  </div>

                  <h2 className="text-base font-semibold text-ink">
                    {req.property_address}, {req.city}
                  </h2>

                  <p className="text-sm text-ink-muted">
                    {req.owner_name} · {req.email}
                  </p>

                  <p className="text-sm text-ink-muted">
                    {humanize(req.property_type)} · {req.approx_square_feet.toLocaleString()} sq ft ·{" "}
                    {humanize(req.current_condition)} · Budget {formatCurrency(req.expected_budget_usd)}
                  </p>

                  {req.admin_notes && (
                    <p className="mt-2 max-w-2xl rounded-md bg-surface-muted px-3.5 py-2.5 text-sm text-ink-muted">
                      <span className="font-medium text-ink">Notes: </span>
                      {req.admin_notes}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center justify-between gap-4 lg:justify-end">
                  {req.activation_score ? (
                    <p className="text-sm text-ink-muted">
                      Score{" "}
                      <span className="text-lg font-semibold tabular-nums text-ink">{req.activation_score.total}</span>
                      /100
                    </p>
                  ) : (
                    <p className="text-sm text-ink-subtle">Not scored yet</p>
                  )}

                  <Button variant="outline" size="sm" onClick={() => openReviewModal(req)}>
                    Review
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Scoring & Review Modal */}
      {selectedRequest && (
        <Modal
          isOpen={Boolean(selectedRequest)}
          onClose={() => setSelectedRequest(null)}
          title={`Review ${selectedRequest.property_address}`}
          description={`${selectedRequest.id} · ${selectedRequest.city} · ${selectedRequest.owner_name}`}
          maxWidth="2xl"
        >
          <form onSubmit={handleSaveReview} className="space-y-6">
            <Select
              label="Stage"
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as ActivationStatus)}
            >
              <option value="submitted">{STAGE_LABELS.submitted}</option>
              <option value="under_review">{STAGE_LABELS.under_review}</option>
              <option value="assessment_required">{STAGE_LABELS.assessment_required}</option>
              <option value="approved_for_assessment">{STAGE_LABELS.approved_for_assessment}</option>
              <option value="ready_for_launch">{STAGE_LABELS.ready_for_launch}</option>
              <option value="rejected">{STAGE_LABELS.rejected}</option>
            </Select>

            <fieldset className="space-y-4 rounded-md border border-line p-4">
              <legend className="px-1 text-sm font-medium text-ink">Activation score</legend>
              <div className="flex items-baseline justify-between border-b border-line pb-3">
                <span className="text-sm text-ink-muted">Total</span>
                <span className="text-lg font-semibold tabular-nums text-ink">{runningTotal} / 100</span>
              </div>

              <ScoreSlider id="score-demand" label="Local demand" max={30} value={demandScore} onChange={setDemandScore} />
              <ScoreSlider id="score-economics" label="Conversion cost and payback" max={25} value={econScore} onChange={setEconScore} />
              <ScoreSlider id="score-readiness" label="Physical readiness" max={20} value={readinessScore} onChange={setReadinessScore} />
              <ScoreSlider id="score-location" label="Location and access" max={15} value={locationScore} onChange={setLocationScore} />
              <ScoreSlider id="score-operations" label="Day-to-day operations" max={10} value={opScore} onChange={setOpScore} />
            </fieldset>

            <Textarea
              label="Notes for the owner"
              helperText="The owner can see these notes."
              rows={3}
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Site visit findings, quotes received, what's needed next..."
            />

            <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setSelectedRequest(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" isLoading={isSaving}>
                Save review
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
