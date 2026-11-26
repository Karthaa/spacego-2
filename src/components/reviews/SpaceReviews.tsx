"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Star } from "lucide-react";
import type { Space, SpaceReview, SpaceReviewSummary } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { SpaceGoStore } from "@/lib/data/store";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";

function monthYear(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function Stars({ rating, className = "h-4 w-4" }: { rating: number; className?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          aria-hidden="true"
          className={`${className} ${n <= Math.round(rating) ? "fill-current text-ink" : "text-line-strong"}`}
        />
      ))}
    </span>
  );
}

/**
 * Guest reviews. Every review comes from a booking that was confirmed and has
 * ended; the database enforces that, one review per booking.
 */
export function SpaceReviews({ space }: { space: Space }) {
  const { user } = useAuth();
  const { success, error } = useToast();
  const [data, setData] = useState<{ id: string; reviews: SpaceReview[]; summary: SpaceReviewSummary } | null>(null);
  const [failed, setFailed] = useState(false);
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [hideFor, setHideFor] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const result = await SpaceGoStore.getSpaceReviews(space.id);
    if (result.ok) {
      setData({ id: space.id, ...result.data });
      setFailed(false);
    } else {
      setFailed(true);
    }
  }, [space.id]);

  useEffect(() => {
    let cancelled = false;
    SpaceGoStore.getSpaceReviews(space.id).then((result) => {
      if (cancelled) return;
      if (result.ok) setData({ id: space.id, ...result.data });
      else setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [space.id]);

  const isHost = Boolean(user && space.owner_id && user.id === space.owner_id);
  const isAdmin = user?.role === "admin";
  const current = data?.id === space.id ? data : null;

  const submitReply = async (reviewId: string) => {
    setBusy(true);
    const result = await SpaceGoStore.respondToReview(reviewId, text);
    setBusy(false);
    if (!result.ok) {
      error("Could not post your response", result.error);
      return;
    }
    success("Response posted", "Guests can see it under the review.");
    setReplyFor(null);
    setText("");
    load();
  };

  const submitHide = async (reviewId: string) => {
    setBusy(true);
    const result = await SpaceGoStore.moderateReview(reviewId, "hide", text);
    setBusy(false);
    if (!result.ok) {
      error("Could not hide the review", result.error);
      return;
    }
    success("Review hidden", "The guest can still see it, with your reason.");
    setHideFor(null);
    setText("");
    load();
  };

  return (
    <section aria-labelledby="guest-reviews-heading">
      <h2 id="guest-reviews-heading" className="flex flex-wrap items-baseline gap-x-3 text-xl font-semibold text-ink">
        Guest reviews
        {current && current.summary.review_count > 0 && current.summary.average_rating !== null && (
          <span className="flex items-center gap-2 text-base font-medium text-ink">
            <Stars rating={current.summary.average_rating} />
            {current.summary.average_rating.toFixed(1)}
            <span className="font-normal text-ink-muted">
              · {current.summary.review_count} {current.summary.review_count === 1 ? "review" : "reviews"}
            </span>
          </span>
        )}
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        Only guests whose booking was confirmed and has ended can leave a review, one per booking.
      </p>

      {!current && !failed && <div className="mt-4 h-20 rounded-lg skeleton-shimmer" aria-hidden="true" />}
      {failed && <p className="mt-4 text-sm text-ink-muted">Reviews couldn&apos;t be loaded right now.</p>}
      {current && current.reviews.length === 0 && (
        <p className="mt-4 rounded-lg border border-dashed border-line-strong px-4 py-3 text-sm text-ink-muted">
          No reviews yet.
        </p>
      )}

      {current && current.reviews.length > 0 && (
        <ul className="mt-4 divide-y divide-line">
          {current.reviews.map((r) => (
            <li key={r.id} className="py-4 first:pt-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <p className="font-medium text-ink">{r.author_name || "Guest"}</p>
                <Stars rating={r.rating} />
                <p className="text-sm text-ink-subtle">{monthYear(r.created_at)}</p>
              </div>
              <p className="mt-2 whitespace-pre-line text-base text-ink">{r.body}</p>

              {r.host_response && (
                <div className="mt-3 rounded-md border-l-2 border-accent bg-surface-muted px-4 py-3">
                  <p className="text-sm font-medium text-ink">
                    Response from the host
                    {r.host_responded_at && <span className="font-normal text-ink-subtle"> · {monthYear(r.host_responded_at)}</span>}
                  </p>
                  <p className="mt-1 whitespace-pre-line text-sm text-ink-muted">{r.host_response}</p>
                </div>
              )}

              {(isHost || isAdmin) && replyFor !== r.id && hideFor !== r.id && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {isHost && (
                    <Button variant="ghost" size="sm" onClick={() => { setText(r.host_response ?? ""); setHideFor(null); setReplyFor(r.id); }}>
                      {r.host_response ? "Edit response" : "Respond"}
                    </Button>
                  )}
                  {isAdmin && (
                    <Button variant="ghost" size="sm" className="text-danger hover:bg-danger-soft hover:text-danger" onClick={() => { setText(""); setReplyFor(null); setHideFor(r.id); }}>
                      Hide review
                    </Button>
                  )}
                </div>
              )}

              {(replyFor === r.id || hideFor === r.id) && (
                <form
                  className="mt-3 space-y-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (replyFor === r.id) submitReply(r.id);
                    else submitHide(r.id);
                  }}
                >
                  <Textarea
                    label={replyFor === r.id ? "Your public response" : "Why are you hiding this review? (the guest sees this)"}
                    rows={3}
                    required
                    minLength={replyFor === r.id ? 1 : 10}
                    maxLength={2000}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" isLoading={busy} variant={hideFor === r.id ? "danger" : "primary"}>
                      {replyFor === r.id ? "Post response" : "Hide review"}
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => { setReplyFor(null); setHideFor(null); }}>
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
