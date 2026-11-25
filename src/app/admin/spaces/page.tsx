"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { useSpaceGoVersion } from "@/context/SpaceGoDataProvider";
import { SpaceGoStore } from "@/lib/data/store";
import { Space } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { categoryNoun } from "@/lib/categories";
import { formatCurrency } from "@/lib/utils";
import { Building2, ExternalLink } from "lucide-react";

const VERIFICATION_LABELS: Record<Space["verification_level"], string> = {
  listed: "New listing",
  checked: "Reviewed by SpaceGo",
  ready: "SpaceGo Ready",
  pro: "SpaceGo Pro",
};

const STATUS_BADGES: Record<Space["status"], { label: string; variant: "success" | "warning" | "neutral" }> = {
  published: { label: "Published", variant: "success" },
  draft: { label: "Draft", variant: "neutral" },
  under_review: { label: "In review", variant: "warning" },
  archived: { label: "Archived", variant: "neutral" },
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
              const status = STATUS_BADGES[s.status] ?? { label: s.status, variant: "neutral" as const };
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
                    <Badge variant={status.variant}>{status.label}</Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleStatus(s.id, s.status)}
                    >
                      {s.status === "published" ? "Unpublish" : "Publish"}
                    </Button>
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
    </div>
  );
}
