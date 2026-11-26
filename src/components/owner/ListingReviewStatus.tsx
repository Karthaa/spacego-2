import React from "react";
import { AlertTriangle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { reviewStateOf } from "@/lib/data/store";
import type { Space } from "@/types";

/** One badge that combines publish status with SpaceGo's review decision. */
export function ListingStatusBadge({ space }: { space: Pick<Space, "status" | "review"> }) {
  if (space.status === "archived") return <Badge variant="neutral">Archived</Badge>;
  switch (reviewStateOf(space)) {
    case "approved":
      return space.status === "published" ? (
        <Badge variant="success">Live</Badge>
      ) : (
        <Badge variant="neutral">Approved, hidden</Badge>
      );
    case "pending":
      return <Badge variant="warning">In review</Badge>;
    case "changes_requested":
      return <Badge variant="warning">Changes requested</Badge>;
    case "rejected":
      return <Badge variant="error">Not approved</Badge>;
    case "suspended":
      return <Badge variant="error">Suspended</Badge>;
    default:
      return <Badge variant="neutral">Draft</Badge>;
  }
}

/** The reason SpaceGo gave, or what happens next, for the owner. */
export function ListingReviewNote({ space }: { space: Pick<Space, "status" | "review"> }) {
  const state = reviewStateOf(space);
  const reason = space.review?.reason?.trim();
  if (state === "pending") {
    return (
      <p className="flex items-start gap-1.5 text-sm text-ink-muted">
        <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        SpaceGo is reviewing this listing. It goes live when it&apos;s approved.
      </p>
    );
  }
  if ((state === "changes_requested" || state === "rejected" || state === "suspended") && reason) {
    const lead =
      state === "changes_requested" ? "What to change:" : state === "rejected" ? "Why it wasn't approved:" : "Why it was taken offline:";
    return (
      <p className="flex items-start gap-1.5 rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          <span className="font-semibold">{lead}</span> {reason}
        </span>
      </p>
    );
  }
  if (state === "draft") {
    return <p className="text-sm text-ink-muted">Not submitted yet. Submit it for review to go live.</p>;
  }
  return null;
}
