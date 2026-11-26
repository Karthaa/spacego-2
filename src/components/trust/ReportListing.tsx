"use client";

import React, { useState } from "react";
import { Flag } from "lucide-react";
import type { ReportReason, Space } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { SpaceGoStore } from "@/lib/data/store";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: "not_real", label: "The space doesn't exist or isn't available" },
  { value: "wrong_info", label: "Photos, price or details are wrong" },
  { value: "unsafe", label: "It's unsafe" },
  { value: "scam", label: "It looks like a scam" },
  { value: "offensive", label: "Offensive content" },
  { value: "other", label: "Something else" },
];

export function reportReasonLabel(reason: ReportReason): string {
  return REPORT_REASONS.find((r) => r.value === reason)?.label ?? reason;
}

/** "Report this listing": signed-in guests tell SpaceGo something is wrong. */
export function ReportListing({ space, onSignInRequired }: { space: Space; onSignInRequired: () => void }) {
  const { user } = useAuth();
  const { success, error } = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  if (user && space.owner_id && user.id === space.owner_id) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) {
      setFormError("Choose what's wrong.");
      return;
    }
    if (reason === "other" && details.trim().length < 10) {
      setFormError("Tell us what's wrong in at least 10 characters.");
      return;
    }
    setBusy(true);
    const result = await SpaceGoStore.reportListing(space.id, reason, details);
    setBusy(false);
    if (!result.ok) {
      error("Could not send your report", result.error);
      return;
    }
    setOpen(false);
    setReason(null);
    setDetails("");
    success("Report sent", "Thanks. The SpaceGo team will look into it.");
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="text-ink-muted"
        onClick={() => {
          if (!user) {
            onSignInRequired();
            return;
          }
          setFormError("");
          setOpen(true);
        }}
      >
        <Flag className="h-4 w-4" aria-hidden="true" />
        Report this listing
      </Button>

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Report this listing"
        description="Only the SpaceGo team sees your report. The host isn't told who sent it."
        maxWidth="md"
      >
        <form className="space-y-5" onSubmit={submit} noValidate>
          <fieldset>
            <legend className="text-sm font-medium text-ink">What&apos;s wrong?</legend>
            <div className="mt-2 space-y-2">
              {REPORT_REASONS.map((r) => (
                <label
                  key={r.value}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm transition-colors",
                    "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring",
                    reason === r.value ? "border-accent bg-accent-soft text-ink" : "border-line-strong bg-surface text-ink hover:bg-surface-muted"
                  )}
                >
                  <input
                    type="radio"
                    name={`report-reason-${space.id}`}
                    value={r.value}
                    checked={reason === r.value}
                    onChange={() => {
                      setReason(r.value);
                      setFormError("");
                    }}
                    className="h-4 w-4 shrink-0 accent-accent"
                  />
                  {r.label}
                </label>
              ))}
            </div>
          </fieldset>

          <Textarea
            label={reason === "other" ? "Details" : "Details (optional)"}
            rows={3}
            maxLength={2000}
            placeholder="What did you notice?"
            value={details}
            onChange={(e) => {
              setDetails(e.target.value);
              setFormError("");
            }}
          />

          {formError && (
            <p role="alert" className="text-sm font-medium text-danger">
              {formError}
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={busy}>
              Send report
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
