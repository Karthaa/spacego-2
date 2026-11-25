"use client";

import React, { useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/navigation/Navbar";
import { Footer } from "@/components/navigation/Footer";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ActivationStatusBadge } from "@/components/ui/Badge";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SpaceGoStore } from "@/lib/data/store";
import { PropertyActivationRequest, ActivationStatus } from "@/types";
import { cn, formatDate } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useSpaceGoVersion } from "@/context/SpaceGoDataProvider";
import { Search, CheckCircle2, AlertTriangle, MapPin, FileText, Plus } from "lucide-react";

const STAGES: { key: ActivationStatus; label: string; desc: string }[] = [
  { key: "submitted", label: "Submitted", desc: "Your details have been received." },
  { key: "under_review", label: "Under review", desc: "The SpaceGo team is reading your submission." },
  { key: "assessment_required", label: "Assessment required", desc: "The team needs more information or a site visit." },
  { key: "approved_for_assessment", label: "Approved for assessment", desc: "An on-site assessment has been approved." },
  { key: "ready_for_launch", label: "Ready for launch", desc: "The space can be prepared for listing." },
];

const PROPERTY_TYPE_LABEL: Record<PropertyActivationRequest["property_type"], string> = {
  vacant_floor: "Vacant commercial floor",
  excess_office: "Spare office suite",
  retail_commercial: "Retail or commercial unit",
  hotel_space: "Hotel business space",
  independent_building: "Standalone building",
  studio_hall: "Studio or event hall",
};

const CONDITION_LABEL: Record<PropertyActivationRequest["current_condition"], string> = {
  fully_furnished: "Fully furnished",
  partially_furnished: "Partially furnished",
  bare_shell: "Empty shell",
  needs_renovation: "Needs renovation",
};

const MODEL_LABEL: Record<PropertyActivationRequest["preferred_model"], string> = {
  self_managed: "Self-managed listing",
  assisted_activation: "Assisted activation",
  managed_partner: "Managed partner",
};

export default function TrackActivationPage() {
  return (
    <Suspense
      fallback={
        <main id="main" className="flex min-h-screen items-center justify-center bg-canvas text-base text-ink-muted">
          <h1 className="sr-only">Track an activation request</h1>
          <p role="status">Loading…</p>
        </main>
      }
    >
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

  // Scores are recorded by the review team; nothing has been reviewed while a
  // request is still at "submitted", so they are only shown after that.
  const reviewScore =
    selectedRequest && selectedRequest.status !== "submitted"
      ? selectedRequest.activation_score
      : undefined;

  const scoreRows = reviewScore
    ? [
        { label: "Local demand", value: reviewScore.demand_score, max: 30 },
        { label: "Costs and economics", value: reviewScore.economics_score, max: 25 },
        { label: "Readiness and facilities", value: reviewScore.readiness_score, max: 20 },
        { label: "Location and access", value: reviewScore.location_score, max: 15 },
        { label: "Day-to-day operations", value: reviewScore.operational_score, max: 10 },
      ]
    : [];

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <Navbar />

      <main id="main" className="flex-1">
        {/* Header */}
        <div className="border-b border-line bg-surface">
          <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-8">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                Track an activation request
              </h1>
              <p className="mt-1 max-w-2xl text-base text-ink-muted">
                See the current status of a property you submitted and any notes from the SpaceGo
                team.
              </p>
            </div>

            <form
              onSubmit={handleSearch}
              role="search"
              aria-label="Find a request by reference"
              className="flex w-full items-end gap-2 lg:w-auto"
            >
              <div className="min-w-0 flex-1 lg:w-72">
                <Input
                  label="Reference"
                  placeholder="e.g. ACT-2026-3420"
                  value={searchRef}
                  onChange={(e) => setSearchRef(e.target.value)}
                  className="font-mono uppercase"
                  leftIcon={<Search aria-hidden="true" />}
                />
              </div>
              <Button type="submit">Find</Button>
            </form>
          </div>
        </div>

        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {allRequests.length === 0 && !errorMessage ? (
            <section aria-labelledby="requests-heading">
              {/* Keeps the outline h1 > h2 > h3 (EmptyState's title is an h3). */}
              <h2 id="requests-heading" className="sr-only">Requests</h2>
              <EmptyState
                icon={<FileText />}
                title="No activation requests to show"
                description={
                  user
                    ? "Requests you submit will appear here with their current status."
                    : "Sign in with the account you used to submit a property to see its requests."
                }
                action={
                  user ? (
                    <Link href="/activation" className={buttonClasses({ variant: "outline" })}>
                      Submit a property
                    </Link>
                  ) : (
                    <Link
                      href={`/auth/login?redirect=${encodeURIComponent("/activation/track")}`}
                      className={buttonClasses({ variant: "outline" })}
                    >
                      Sign in
                    </Link>
                  )
                }
              />
            </section>
          ) : (
            <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
              {/* Request list */}
              <section aria-labelledby="requests-heading" className="lg:col-span-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 id="requests-heading" className="text-lg font-semibold text-ink">
                    Requests
                  </h2>
                  <Link
                    href="/activation"
                    className={buttonClasses({ variant: "ghost", size: "sm" })}
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    New request
                  </Link>
                </div>

                <ul className="mt-3 space-y-2">
                  {allRequests.map((req) => {
                    const active = selectedRequest?.id === req.id;
                    return (
                      <li key={req.id}>
                        <button
                          type="button"
                          aria-current={active ? "true" : undefined}
                          onClick={() => {
                            setSelectedRequest(req);
                            setSearchRef(req.id);
                            setErrorMessage("");
                          }}
                          className={cn(
                            "w-full rounded-md border p-4 text-left transition-colors",
                            active
                              ? "border-accent bg-accent-soft"
                              : "border-line bg-surface hover:border-line-strong"
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-sm font-semibold text-ink">{req.id}</span>
                            <ActivationStatusBadge status={req.status} />
                          </div>
                          <p className="mt-2 truncate text-base font-medium text-ink">
                            {req.property_address}
                          </p>
                          <p className="mt-0.5 text-sm text-ink-muted">
                            {req.city} · {req.approx_square_feet.toLocaleString()} sq ft
                          </p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>

              {/* Detail */}
              <div className="space-y-6 lg:col-span-8">
                {errorMessage ? (
                  <div
                    role="alert"
                    className="flex items-start gap-3 rounded-lg border border-line bg-surface p-6"
                  >
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" aria-hidden="true" />
                    <div>
                      <h2 className="text-lg font-semibold text-ink">No request found</h2>
                      <p className="mt-1 text-base text-ink-muted">{errorMessage}</p>
                    </div>
                  </div>
                ) : selectedRequest ? (
                  <>
                    {/* Status */}
                    <Card>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-ink-muted">
                          {selectedRequest.id}
                        </span>
                        <ActivationStatusBadge status={selectedRequest.status} />
                      </div>
                      <h2 className="mt-2 text-xl font-semibold tracking-tight text-ink sm:text-2xl">
                        {selectedRequest.property_address}
                      </h2>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-muted">
                        <MapPin className="h-4 w-4 text-ink-subtle" aria-hidden="true" />
                        <span>{selectedRequest.city}</span>
                        <span aria-hidden="true">·</span>
                        <span>{selectedRequest.approx_square_feet.toLocaleString()} sq ft</span>
                        <span aria-hidden="true">·</span>
                        <span>Submitted {formatDate(selectedRequest.created_at)}</span>
                      </p>

                      <div className="mt-6 border-t border-line pt-6">
                        <h3 className="text-base font-semibold text-ink">Progress</h3>
                        {selectedRequest.status === "rejected" ? (
                          <p className="mt-2 rounded-md bg-danger-soft p-3 text-sm text-danger">
                            This request was declined. Any notes from the SpaceGo team are shown
                            below.
                          </p>
                        ) : (
                          <ol className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-5">
                            {STAGES.map((stage, idx) => {
                              const isPast = idx < currentStageIndex;
                              const isCurrent = idx === currentStageIndex;
                              return (
                                <li
                                  key={stage.key}
                                  aria-current={isCurrent ? "step" : undefined}
                                  className={cn(
                                    "rounded-md border p-3",
                                    isCurrent ? "border-accent bg-accent-soft" : "border-line"
                                  )}
                                >
                                  {isPast ? (
                                    <CheckCircle2 className="h-5 w-5 text-success" aria-hidden="true" />
                                  ) : (
                                    <span
                                      aria-hidden="true"
                                      className={cn(
                                        "flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold",
                                        isCurrent
                                          ? "bg-accent text-accent-ink"
                                          : "bg-surface-muted text-ink-muted"
                                      )}
                                    >
                                      {idx + 1}
                                    </span>
                                  )}
                                  <p
                                    className={cn(
                                      "mt-2 text-sm font-semibold",
                                      isPast || isCurrent ? "text-ink" : "text-ink-muted"
                                    )}
                                  >
                                    <span className="sr-only">
                                      {isPast ? "Completed: " : isCurrent ? "Current: " : "Not yet reached: "}
                                    </span>
                                    {stage.label}
                                  </p>
                                  <p className="mt-0.5 text-sm text-ink-muted">{stage.desc}</p>
                                </li>
                              );
                            })}
                          </ol>
                        )}
                      </div>

                      {selectedRequest.admin_notes && (
                        <div className="mt-6 rounded-md bg-surface-muted p-4">
                          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                            <FileText className="h-4 w-4 text-ink-subtle" aria-hidden="true" />
                            Notes from the SpaceGo team
                          </h3>
                          <p className="mt-1.5 text-base text-ink-muted">
                            {selectedRequest.admin_notes}
                          </p>
                        </div>
                      )}
                    </Card>

                    {/* Review scores */}
                    {reviewScore && (
                      <Card>
                        <CardHeader className="flex flex-wrap items-start justify-between gap-3 space-y-0">
                          <div className="space-y-1">
                            <CardTitle>Review scores</CardTitle>
                            <CardDescription>
                              Recorded by the SpaceGo team during review. They may change as the
                              review continues.
                            </CardDescription>
                          </div>
                          <p className="text-2xl font-semibold tracking-tight text-ink">
                            {reviewScore.total}
                            <span className="text-base font-normal text-ink-muted"> of 100</span>
                          </p>
                        </CardHeader>

                        <dl className="space-y-4">
                          {scoreRows.map((row) => (
                            // dl > div > (dt, dd, dd) keeps the list valid; the
                            // second dd is the purely visual bar.
                            <div key={row.label} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm">
                              <dt className="text-ink">{row.label}</dt>
                              <dd className="font-medium text-ink">
                                {row.value} of {row.max}
                              </dd>
                              <dd
                                aria-hidden="true"
                                className="col-span-2 h-2 w-full overflow-hidden rounded-full bg-surface-muted"
                              >
                                <div
                                  className="h-full rounded-full bg-accent"
                                  style={{ width: `${Math.min(100, (row.value / row.max) * 100)}%` }}
                                />
                              </dd>
                            </div>
                          ))}
                        </dl>

                        {reviewScore.breakdown_notes && (
                          <p className="mt-6 border-t border-line pt-4 text-base text-ink-muted">
                            {reviewScore.breakdown_notes}
                          </p>
                        )}
                      </Card>
                    )}

                    {/* Submitted details */}
                    <Card>
                      <CardHeader>
                        <CardTitle>What you submitted</CardTitle>
                      </CardHeader>

                      <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                        <div>
                          <dt className="text-sm text-ink-muted">Type of property</dt>
                          <dd className="mt-0.5 text-base text-ink">
                            {PROPERTY_TYPE_LABEL[selectedRequest.property_type] ??
                              selectedRequest.property_type.replace("_", " ")}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-sm text-ink-muted">Current condition</dt>
                          <dd className="mt-0.5 text-base text-ink">
                            {CONDITION_LABEL[selectedRequest.current_condition] ??
                              selectedRequest.current_condition.replace("_", " ")}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-sm text-ink-muted">Preferred model</dt>
                          <dd className="mt-0.5 text-base text-ink">
                            {MODEL_LABEL[selectedRequest.preferred_model] ??
                              selectedRequest.preferred_model.replace("_", " ")}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-sm text-ink-muted">Fit-out budget</dt>
                          <dd className="mt-0.5 text-base text-ink">
                            ${selectedRequest.expected_budget_usd.toLocaleString()}
                          </dd>
                        </div>
                      </dl>

                      {selectedRequest.existing_facilities.length > 0 && (
                        <div className="mt-6 border-t border-line pt-4">
                          <h3 className="text-sm text-ink-muted">Facilities in place</h3>
                          <ul className="mt-2 flex flex-wrap gap-2">
                            {selectedRequest.existing_facilities.map((fac, idx) => (
                              <li
                                key={idx}
                                className="rounded-sm bg-surface-muted px-2.5 py-1 text-sm text-ink"
                              >
                                {fac}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </Card>
                  </>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
