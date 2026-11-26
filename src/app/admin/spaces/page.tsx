"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSpaceGoVersion } from "@/context/SpaceGoDataProvider";
import { useAuth } from "@/context/AuthContext";
import { SpaceGoStore, reviewStateOf } from "@/lib/data/store";
import { ListingReport, ListingReviewDecision, Space } from "@/types";
import { ListingStatusBadge } from "@/components/owner/ListingReviewStatus";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Input";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { categoryNoun } from "@/lib/categories";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { Building2, Check, ExternalLink, Flag, MapPin, ShieldCheck } from "lucide-react";
import { reportReasonLabel } from "@/components/trust/ReportListing";
import { TIER_LABELS, VerificationChecksModal, recordedChecks } from "@/components/admin/VerificationChecksModal";

const DECISIONS: Record<Exclude<ListingReviewDecision, "approve">, { title: string; action: string; help: string }> = {
  request_changes: {
    title: "Ask the host for changes",
    action: "Send request",
    help: "The listing stays hidden. The host sees your note and can resubmit.",
  },
  reject: {
    title: "Don't approve this listing",
    action: "Reject listing",
    help: "The listing stays hidden and can't be resubmitted. The host sees your reason.",
  },
  suspend: {
    title: "Take this listing offline",
    action: "Suspend listing",
    help: "The listing is hidden from guests at once. The host sees your reason.",
  },
};

const GRID_COLS =
  "md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.4fr)_minmax(0,1.5fr)_minmax(0,1.2fr)_2.75rem]";

function priceLabel(space: Space): string {
  const { pricing } = space;
  if (pricing.daily) return `${formatCurrency(pricing.daily, pricing.currency)}/day`;
  if (pricing.hourly) return `${formatCurrency(pricing.hourly, pricing.currency)}/hour`;
  if (pricing.monthly) return `${formatCurrency(pricing.monthly, pricing.currency)}/month`;
  return "No price set";
}

export default function AdminSpacesPage() {
  const { success, error } = useToast();
  const dataVersion = useSpaceGoVersion();
  const spaces = useMemo<Space[]>(() => {
    void dataVersion;
    return SpaceGoStore.getSpaces();
  }, [dataVersion]);

  const { user } = useAuth();
  const [checksFor, setChecksFor] = useState<Space | null>(null);

  const saveChecks = async (id: string, updates: Pick<Space, "passport" | "verification_level">) => {
    const result = await SpaceGoStore.updateSpace(id, updates);
    if (!result.ok) {
      error("Could not save the checks", result.error);
      return false;
    }
    const n = recordedChecks(updates.passport);
    success(
      "Checks saved",
      n === 0 ? "No checks recorded; the listing shows no badge." : `${n} ${n === 1 ? "check" : "checks"} recorded. Badge: ${TIER_LABELS[updates.verification_level]}.`
    );
    return true;
  };

  const handleToggleStatus = async (id: string, currentStatus: Space["status"]) => {
    const next: Space["status"] = currentStatus === "published" ? "draft" : "published";
    const result = await SpaceGoStore.updateSpace(id, { status: next });
    if (!result.ok) {
      error("Could not change status", result.error);
      return;
    }
    success(next === "published" ? "Space published" : "Space unpublished", `The space is now ${next}.`);
  };

  const [decision, setDecision] = useState<{ space: Space; kind: Exclude<ListingReviewDecision, "approve"> } | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const queue = useMemo(
    () =>
      spaces
        .filter((s) => reviewStateOf(s) === "pending")
        .sort((a, b) => (a.review?.submitted_at ?? "").localeCompare(b.review?.submitted_at ?? "")),
    [spaces]
  );

  const decide = async (space: Space, kind: ListingReviewDecision, note = "") => {
    setBusy(space.id);
    const result = await SpaceGoStore.reviewListing(space.id, kind, note);
    setBusy(null);
    if (!result.ok) {
      error("Could not save the decision", result.error);
      return false;
    }
    const messages: Record<ListingReviewDecision, string> = {
      approve: "Approved and live. The host has been notified.",
      request_changes: "Changes requested. The host has been notified.",
      reject: "Listing rejected. The host has been notified.",
      suspend: "Listing suspended. The host has been notified.",
    };
    success(space.title, messages[kind]);
    return true;
  };

  const publishedCount = spaces.filter((s) => s.status === "published").length;

  const [reports, setReports] = useState<ListingReport[]>([]);
  const [reportsVersion, setReportsVersion] = useState(0);
  const [closing, setClosing] = useState<{ report: ListingReport; status: "resolved" | "dismissed" } | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    let cancelled = false;
    SpaceGoStore.getOpenReports().then((result) => {
      if (!cancelled && result.ok) setReports(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [dataVersion, reportsVersion]);

  const closeReport = async () => {
    if (!closing) return;
    setBusy(closing.report.id);
    const result = await SpaceGoStore.resolveReport(closing.report.id, closing.status, note);
    setBusy(null);
    if (!result.ok) {
      error("Could not close the report", result.error);
      return;
    }
    success(closing.status === "resolved" ? "Report resolved" : "Report dismissed", "It's been logged in the listing's history.");
    setClosing(null);
    setReportsVersion((v) => v + 1);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Spaces"
        description={
          spaces.length === 0
            ? "Review listings and record what SpaceGo checked."
            : `${spaces.length} spaces, ${publishedCount} published. Record what SpaceGo checked and control what guests can see.`
        }
      />

      <section aria-labelledby="reports-heading" className="space-y-3">
        <h2 id="reports-heading" className="text-lg font-semibold text-ink">
          Reported listings <span className="text-ink-muted tabular-nums">({reports.length})</span>
        </h2>
        {reports.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line-strong bg-surface px-5 py-4 text-sm text-ink-muted">
            No open reports. Guests can report a listing from its page.
          </p>
        ) : (
          <ul className="space-y-3">
            {reports.map((r) => {
              const listing = spaces.find((s) => s.id === r.space_id);
              return (
                <li key={r.id}>
                  <Card padding="sm" className="flex flex-col gap-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 gap-3">
                      <Flag className="mt-1 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
                      <div className="min-w-0 space-y-1">
                        <p className="text-base font-medium text-ink">{listing?.title ?? r.space_id}</p>
                        <p className="text-sm text-ink">{reportReasonLabel(r.reason)}</p>
                        {r.details && <p className="whitespace-pre-line text-sm text-ink-muted">{r.details}</p>}
                        <p className="text-sm text-ink-subtle">Reported {formatDateTime(r.created_at)}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
                      <Link href={`/spaces/${r.space_id}`} target="_blank" className={buttonClasses({ variant: "ghost", size: "sm" })}>
                        Open
                        <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      </Link>
                      {listing?.status === "published" && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busy !== null}
                          onClick={() => {
                            setReason(`Reported: ${reportReasonLabel(r.reason).toLowerCase()}.`);
                            setDecision({ space: listing, kind: "suspend" });
                          }}
                        >
                          Suspend listing
                        </Button>
                      )}
                      <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => { setNote(""); setClosing({ report: r, status: "dismissed" }); }}>
                        Dismiss
                      </Button>
                      <Button size="sm" disabled={busy !== null} onClick={() => { setNote(""); setClosing({ report: r, status: "resolved" }); }}>
                        Resolve
                      </Button>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="queue-heading" className="space-y-3">
        <h2 id="queue-heading" className="text-lg font-semibold text-ink">
          Waiting for review <span className="text-ink-muted tabular-nums">({queue.length})</span>
        </h2>
        {queue.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line-strong bg-surface px-5 py-4 text-sm text-ink-muted">
            Nothing to review. New and edited listings appear here when hosts submit them.
          </p>
        ) : (
          <ul className="space-y-3">
            {queue.map((s) => (
              <li key={s.id}>
                <Card padding="sm" className="flex flex-col gap-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex min-w-0 gap-4">
                    {s.images[0]?.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.images[0].url} alt="" className="h-20 w-20 shrink-0 rounded-md border border-line object-cover" />
                    ) : (
                      <div aria-hidden="true" className="flex h-20 w-20 shrink-0 items-center justify-center rounded-md bg-surface-muted text-ink-subtle">
                        <Building2 className="h-6 w-6" />
                      </div>
                    )}
                    <div className="min-w-0 space-y-1">
                      <p className="text-base font-medium text-ink">{s.title}</p>
                      <p className="text-sm text-ink-muted">
                        {categoryNoun(s.category)} · {s.capacity} seats · {priceLabel(s)} · {s.images.length}{" "}
                        {s.images.length === 1 ? "photo" : "photos"}
                      </p>
                      <p className="flex items-center gap-1 text-sm text-ink-muted">
                        <MapPin className="h-4 w-4 shrink-0 text-ink-subtle" aria-hidden="true" />
                        {[s.location.address, s.location.city, s.location.country].filter(Boolean).join(", ")}
                      </p>
                      <p className="text-sm text-ink-subtle">
                        {s.owner_name || "Unknown host"}
                        {s.review?.submitted_at ? <> · submitted {formatDateTime(s.review.submitted_at)}</> : null}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
                    <Link href={`/spaces/${s.id}`} target="_blank" className={buttonClasses({ variant: "ghost", size: "sm" })}>
                      Open
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    </Link>
                    <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => { setReason(""); setDecision({ space: s, kind: "reject" }); }}>
                      Reject
                    </Button>
                    <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => { setReason(""); setDecision({ space: s, kind: "request_changes" }); }}>
                      Request changes
                    </Button>
                    <Button size="sm" disabled={busy !== null} isLoading={busy === s.id} onClick={() => decide(s, "approve")}>
                      <Check className="h-4 w-4" aria-hidden="true" />
                      Approve
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <h2 className="sr-only">All spaces</h2>
      {spaces.length === 0 ? (
        <EmptyState
          icon={<Building2 />}
          title="No spaces yet"
          description="Spaces listed by owners will appear here for moderation."
        />
      ) : (
        <Card padding="none" role="table" aria-label="Spaces">
          <div
            role="row"
            className={`hidden border-b border-line bg-surface-muted px-6 py-2.5 text-sm font-medium text-ink-muted md:grid md:gap-4 ${GRID_COLS}`}
          >
            <span role="columnheader">Space</span>
            <span role="columnheader">Host and location</span>
            <span role="columnheader">SpaceGo checks</span>
            <span role="columnheader">Visibility</span>
            <span role="columnheader">
              <span className="sr-only">Open listing</span>
            </span>
          </div>

          <div role="rowgroup" className="divide-y divide-line">
            {spaces.map((s) => {
              const cover = s.images[0]?.url;
              return (
                <div
                  key={s.id}
                  role="row"
                  className={`grid grid-cols-1 gap-3 px-5 py-4 sm:px-6 md:items-center md:gap-4 ${GRID_COLS}`}
                >
                  <div role="cell" className="flex min-w-0 items-center gap-3">
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={cover}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded-md border border-line object-cover"
                      />
                    ) : (
                      <div
                        aria-hidden="true"
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-surface-muted text-ink-subtle"
                      >
                        <Building2 className="h-5 w-5" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-base font-medium text-ink">{s.title}</p>
                      <p className="truncate text-sm text-ink-subtle">
                        {categoryNoun(s.category)} · {s.capacity} seats · {priceLabel(s)}
                      </p>
                    </div>
                  </div>

                  <div role="cell" className="min-w-0 text-sm">
                    <p className="truncate text-ink">{s.owner_name}</p>
                    <p className="truncate text-ink-subtle">
                      {s.location.city}, {s.location.country}
                    </p>
                  </div>

                  <div role="cell">
<div className="flex items-center justify-between gap-3 md:block md:space-y-1.5">
                      <p className="text-sm text-ink">
                        {TIER_LABELS[s.verification_level]}
                        <span className="block text-ink-subtle">
                          {recordedChecks(s.passport) === 0
                            ? "No checks recorded"
                            : `${recordedChecks(s.passport)} ${recordedChecks(s.passport) === 1 ? "check" : "checks"}${s.passport.inspected_at ? `, ${s.passport.inspected_at.slice(0, 10)}` : ""}`}
                        </span>
                      </p>
                      <Button variant="outline" size="sm" onClick={() => setChecksFor(s)} aria-label={`Record checks for ${s.title}`}>
                        <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                        Record checks
                      </Button>
                    </div>
                  </div>

                  <div role="cell" className="flex items-center justify-between gap-3 md:justify-start">
                    <ListingStatusBadge space={s} />
                    {s.status === "published" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy !== null}
                        onClick={() => {
                          setReason("");
                          setDecision({ space: s, kind: "suspend" });
                        }}
                      >
                        Suspend
                      </Button>
                    ) : reviewStateOf(s) === "approved" && s.status !== "archived" ? (
                      <Button variant="outline" size="sm" onClick={() => handleToggleStatus(s.id, s.status)}>
                        Publish
                      </Button>
                    ) : null}
                  </div>

                  <div role="cell" className="hidden md:block">
                    <Link
                      href={`/spaces/${s.id}`}
                      target="_blank"
                      aria-label={`Open ${s.title} in a new tab`}
                      className={buttonClasses({ variant: "ghost", size: "icon" })}
                    >
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </div>
                  <div role="cell" className="md:hidden">
                    <Link
                      href={`/spaces/${s.id}`}
                      target="_blank"
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent-hover"
                    >
                      Open listing
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Modal
        isOpen={closing !== null}
        onClose={() => setClosing(null)}
        title={closing?.status === "resolved" ? "Resolve this report" : "Dismiss this report"}
        description={
          closing
            ? `${spaces.find((x) => x.id === closing.report.space_id)?.title ?? closing.report.space_id}: ${reportReasonLabel(closing.report.reason)}. The note is kept in the listing's history; the reporter isn't notified.`
            : undefined
        }
        maxWidth="md"
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void closeReport();
          }}
        >
          <Textarea
            label="What did you do?"
            required
            minLength={5}
            maxLength={1000}
            rows={3}
            placeholder={closing?.status === "resolved" ? "e.g. Asked the host to replace the photos" : "e.g. Checked the listing; nothing wrong"}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setClosing(null)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={busy === closing?.report.id} disabled={note.trim().length < 5}>
              {closing?.status === "resolved" ? "Resolve report" : "Dismiss report"}
            </Button>
          </div>
        </form>
      </Modal>

      {checksFor && (
        <VerificationChecksModal
          key={checksFor.id}
          space={checksFor}
          inspector={user?.full_name || user?.email || "SpaceGo admin"}
          onClose={() => setChecksFor(null)}
          onSave={(updates) => saveChecks(checksFor.id, updates)}
        />
      )}

      <Modal
        isOpen={decision !== null}
        onClose={() => setDecision(null)}
        title={decision ? DECISIONS[decision.kind].title : ""}
        description={decision ? `${decision.space.title}. ${DECISIONS[decision.kind].help}` : undefined}
        maxWidth="md"
      >
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!decision) return;
            const ok = await decide(decision.space, decision.kind, reason);
            if (ok) setDecision(null);
          }}
        >
          <Textarea
            label="Reason for the host"
            required
            minLength={10}
            maxLength={1000}
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Be specific, e.g. The photos show a different building from the address."
            helperText="At least 10 characters. The host sees this exactly as written."
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDecision(null)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant={decision?.kind === "request_changes" ? "primary" : "danger"}
              disabled={reason.trim().length < 10}
              isLoading={busy !== null}
            >
              {decision ? DECISIONS[decision.kind].action : ""}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
