"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useSpaceGoVersion } from "@/context/SpaceGoDataProvider";
import { SpaceGoStore, reviewStateOf } from "@/lib/data/store";
import { ListingReviewNote, ListingStatusBadge } from "@/components/owner/ListingReviewStatus";
import { Space } from "@/types";
import { VerificationBadge } from "@/components/ui/Badge";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { capacityLabel, categoryNoun } from "@/lib/categories";
import { formatCurrency } from "@/lib/utils";
import { Building2, Eye, MapPin, Pencil, Plus, Send, Trash2, Users } from "lucide-react";

function spaceRate(space: Space): string | null {
  if (space.pricing.daily) return `${formatCurrency(space.pricing.daily, space.pricing.currency)} / day`;
  if (space.pricing.hourly) return `${formatCurrency(space.pricing.hourly, space.pricing.currency)} / hour`;
  if (space.pricing.monthly) return `${formatCurrency(space.pricing.monthly, space.pricing.currency)} / month`;
  return null;
}

export default function OwnerPropertiesPage() {
  const { user } = useAuth();
  const { success, error } = useToast();
  const dataVersion = useSpaceGoVersion();
  const [busySpaceId, setBusySpaceId] = useState<string | null>(null);

  const spaces = useMemo<Space[]>(() => {
    void dataVersion;
    return user ? SpaceGoStore.getSpacesByOwner(user.id) : [];
  }, [user, dataVersion]);

  const handleToggleStatus = async (id: string, currentStatus: Space["status"]) => {
    if (busySpaceId) return;
    const nextStatus: Space["status"] = currentStatus === "published" ? "draft" : "published";
    setBusySpaceId(id);
    const result = await SpaceGoStore.updateSpace(id, { status: nextStatus });
    setBusySpaceId(null);

    if (!result.ok) {
      error("Could not update listing", result.error);
      return;
    }
    success(
      nextStatus === "published" ? "Listing published" : "Listing moved to drafts",
      nextStatus === "published"
        ? "People can now find and book this space."
        : "The listing is hidden from search until you publish it again."
    );
  };

  const handleSubmitForReview = async (id: string) => {
    if (busySpaceId) return;
    setBusySpaceId(id);
    const result = await SpaceGoStore.submitForReview(id);
    setBusySpaceId(null);
    if (!result.ok) {
      error("Could not submit for review", result.error);
      return;
    }
    success("Submitted for review", "You'll get a notification when SpaceGo approves it or asks for changes.");
  };

  const handleDelete = async (id: string) => {
    if (busySpaceId) return;
    if (!confirm("Remove this listing? People will no longer be able to find or book it.")) return;

    setBusySpaceId(id);
    const result = await SpaceGoStore.deleteSpace(id);
    setBusySpaceId(null);

    if (!result.ok) {
      error("Could not remove listing", result.error);
      return;
    }
    success(
      result.data === "archived" ? "Listing archived" : "Listing removed",
      result.data === "archived"
        ? "The listing is archived and no longer visible to guests."
        : "The listing has been deleted."
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="My listings"
        description="Submit, preview and manage the workspaces you list on SpaceGo. New listings go live after SpaceGo approves them."
        actions={
          <Link href="/owner/spaces/new" className={buttonClasses()}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add a workspace
          </Link>
        }
      />

      {spaces.length === 0 ? (
        <EmptyState
          icon={<Building2 />}
          title="No listings yet"
          description="Add your first workspace so people can find and book it."
          action={
            <Link href="/owner/spaces/new" className={buttonClasses()}>
              Add a workspace
            </Link>
          }
        />
      ) : (
        <ul className="space-y-4">
          {spaces.map((space) => {
            const rate = spaceRate(space);
            const isBusy = busySpaceId === space.id;
            return (
              <li key={space.id}>
                <Card padding="sm" className="flex flex-col gap-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex min-w-0 gap-4">
                    {space.images[0]?.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={space.images[0].url}
                        alt=""
                        className="h-20 w-20 shrink-0 rounded-md border border-line object-cover sm:h-24 sm:w-24"
                      />
                    ) : (
                      <div
                        aria-hidden="true"
                        className="flex h-20 w-20 shrink-0 items-center justify-center rounded-md bg-surface-muted text-ink-subtle sm:h-24 sm:w-24"
                      >
                        <Building2 className="h-6 w-6" />
                      </div>
                    )}
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <ListingStatusBadge space={space} />
                        <VerificationBadge level={space.verification_level} />
                      </div>
                      <h2 className="text-base font-medium text-ink">{space.title}</h2>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-muted">
                        <span>{categoryNoun(space.category)}</span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-4 w-4 shrink-0 text-ink-subtle" aria-hidden="true" />
                          {[space.location.address, space.location.city].filter(Boolean).join(", ")}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-4 w-4 shrink-0 text-ink-subtle" aria-hidden="true" />
                          {capacityLabel(space.category, space.capacity)}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-ink">{rate ?? "No price set"}</p>
                      <ListingReviewNote space={space} />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 lg:shrink-0 lg:justify-end">
                    <Link
                      href={`/spaces/${space.id}`}
                      className={buttonClasses({ variant: "outline", size: "sm" })}
                    >
                      <Eye className="h-4 w-4" aria-hidden="true" />
                      Preview
                    </Link>
                    <Link
                      href={`/owner/spaces/${space.id}/edit`}
                      className={buttonClasses({ variant: "outline", size: "sm" })}
                      aria-label={`Edit ${space.title}`}
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                      Edit
                    </Link>
                    {reviewStateOf(space) === "approved" && space.status !== "archived" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleStatus(space.id, space.status)}
                        disabled={busySpaceId !== null}
                        isLoading={isBusy}
                      >
                        {space.status === "published" ? "Unpublish" : "Publish"}
                      </Button>
                    )}
                    {(reviewStateOf(space) === "draft" || reviewStateOf(space) === "changes_requested") &&
                      space.status !== "archived" && (
                        <Button
                          size="sm"
                          onClick={() => handleSubmitForReview(space.id)}
                          disabled={busySpaceId !== null}
                          isLoading={isBusy}
                        >
                          <Send className="h-4 w-4" aria-hidden="true" />
                          {reviewStateOf(space) === "changes_requested" ? "Resubmit" : "Submit for review"}
                        </Button>
                      )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(space.id)}
                      disabled={busySpaceId !== null}
                      className="hover:text-danger"
                      aria-label={`Remove ${space.title}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
