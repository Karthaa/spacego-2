"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useSpaceGoVersion } from "@/context/SpaceGoDataProvider";
import { SpaceGoStore, reviewStateOf } from "@/lib/data/store";
import { ListingReviewDecision, Space } from "@/types";
import { ListingStatusBadge } from "@/components/owner/ListingReviewStatus";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Input";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { categoryNoun } from "@/lib/categories";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { Building2, Check, ExternalLink, MapPin } from "lucide-react";

const VERIFICATION_LABELS: Record<Space["verification_level"], string> = {
  listed: "New listing",
  checked: "Reviewed by SpaceGo",
  ready: "SpaceGo Ready",
  pro: "SpaceGo Pro",
};

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

  const handleUpdateLevel = async (id: string, level: Space["verification_level"]) => {
    const result = await SpaceGoStore.updateSpace(id, { verification_level: level });
    if (!result.ok) {
      error("Could not update verification tier", result.error);
      return;
    }
    success("Verification tier updated", `Tier set to ${VERIFICATION_LABELS[level]}.`);
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Spaces"
        description={
          spaces.length === 0
            ? "Moderate listings and assign verification tiers."
            : `${spaces.length} spaces, ${publishedCount} published. Assign verification tiers and control what guests can see.`
        }
      />

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
            <span role="columnheader">Verification tier</span>
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
                    <Select
                      aria-label={`Verification tier for ${s.title}`}
                      value={s.verification_level}
                      onChange={(e) => handleUpdateLevel(s.id, e.target.value as Space["verification_level"])}
                    >
                      <option value="listed">{VERIFICATION_LABELS.listed}</option>
                      <option value="checked">{VERIFICATION_LABELS.checked}</option>
                      <option value="ready">{VERIFICATION_LABELS.ready}</option>
                      <option value="pro">{VERIFICATION_LABELS.pro}</option>
                    </Select>
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
