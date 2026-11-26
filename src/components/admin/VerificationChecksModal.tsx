"use client";

import React, { useState } from "react";
import { Space, SpacePassport } from "@/types";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";

type BooleanCheck = "identity_verified" | "property_authority_verified" | "permitted_use_confirmed" | "power_backup_tested" | "fire_safety_inspected";

const CHECKS: { key: BooleanCheck; label: string; help: string }[] = [
  { key: "identity_verified", label: "Host identity checked", help: "You saw ID or a business registration for the host." },
  {
    key: "property_authority_verified",
    label: "Host's right to list confirmed",
    help: "You saw proof of ownership, a lease, or written permission from the owner.",
  },
  {
    key: "permitted_use_confirmed",
    label: "Use as a workspace confirmed",
    help: "The owner or building confirmed the space may be used this way.",
  },
  { key: "power_backup_tested", label: "Backup power tested", help: "Tested on site, not taken from the host's description." },
  { key: "fire_safety_inspected", label: "Fire safety equipment checked", help: "Seen on site during a visit." },
];

export const TIER_LABELS: Record<Space["verification_level"], string> = {
  listed: "New listing",
  checked: "Reviewed by SpaceGo",
  ready: "SpaceGo Ready",
  pro: "SpaceGo Pro",
};

/** Number of checks recorded on a listing. */
export function recordedChecks(passport: SpacePassport): number {
  return CHECKS.filter((c) => passport[c.key]).length + (passport.connectivity_tested_mbps > 0 ? 1 : 0);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Admin: record what SpaceGo actually checked, and the tier that follows from
 * it. The database refuses a tier without at least one dated check.
 */
export function VerificationChecksModal({
  space,
  inspector,
  onClose,
  onSave,
}: {
  space: Space;
  inspector: string;
  onClose: () => void;
  onSave: (updates: Pick<Space, "passport" | "verification_level">) => Promise<boolean>;
}) {
  const p = space.passport;
  const [checks, setChecks] = useState<Record<BooleanCheck, boolean>>(() => ({
    identity_verified: p.identity_verified,
    property_authority_verified: p.property_authority_verified,
    permitted_use_confirmed: p.permitted_use_confirmed,
    power_backup_tested: p.power_backup_tested,
    fire_safety_inspected: p.fire_safety_inspected,
  }));
  const [mbps, setMbps] = useState(p.connectivity_tested_mbps > 0 ? String(p.connectivity_tested_mbps) : "");
  const [checkedOn, setCheckedOn] = useState(p.inspected_at ? p.inspected_at.slice(0, 10) : today());
  const [notes, setNotes] = useState(p.notes ?? "");
  const [tier, setTier] = useState<Space["verification_level"]>(space.verification_level);
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const speed = Number(mbps);
  const speedValid = mbps === "" || (Number.isFinite(speed) && speed >= 0 && speed <= 100000);
  const count = Object.values(checks).filter(Boolean).length + (speedValid && speed > 0 ? 1 : 0);
  const effectiveTier: Space["verification_level"] = count === 0 ? "listed" : tier;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!speedValid) {
      setFormError("Enter the measured speed in Mbps, or leave it empty.");
      return;
    }
    if (count > 0 && !/^\d{4}-\d{2}-\d{2}$/.test(checkedOn)) {
      setFormError("Enter the date the checks were done.");
      return;
    }
    if (count > 0 && checkedOn > today()) {
      setFormError("The date of the checks can't be in the future.");
      return;
    }
    if (count > 0 && !confirmed) {
      setFormError("Confirm that these checks actually happened.");
      return;
    }
    setSaving(true);
    const ok = await onSave({
      verification_level: effectiveTier,
      passport: {
        ...p,
        ...checks,
        connectivity_tested_mbps: speedValid && speed > 0 ? speed : 0,
        inspected_at: count > 0 ? checkedOn : "",
        inspected_by: count > 0 ? inspector : "",
        notes: notes.trim(),
      },
    });
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="What SpaceGo checked"
      description={`${space.title}. Guests see each check you record here, with its date. Only tick what actually happened.`}
      maxWidth="lg"
    >
      <form className="space-y-5" onSubmit={submit} noValidate>
        <fieldset className="space-y-2">
          <legend className="sr-only">Checks</legend>
          {CHECKS.map((c) => (
            <label key={c.key} className="flex cursor-pointer items-start gap-3 rounded-md border border-line p-3 hover:bg-surface-muted">
              <input
                type="checkbox"
                checked={checks[c.key]}
                onChange={(e) => setChecks((prev) => ({ ...prev, [c.key]: e.target.checked }))}
                className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-accent"
              />
              <span>
                <span className="block text-base font-medium text-ink">{c.label}</span>
                <span className="block text-sm text-ink-muted">{c.help}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Internet speed measured (Mbps)"
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            placeholder="Not measured"
            value={mbps}
            onChange={(e) => setMbps(e.target.value)}
            error={speedValid ? undefined : "Enter a number of Mbps."}
          />
          <Input
            label="Date of the checks"
            type="date"
            max={today()}
            value={checkedOn}
            onChange={(e) => {
              setCheckedOn(e.target.value);
              setFormError("");
            }}
          />
        </div>

        <Select
          label="Badge"
          value={effectiveTier}
          disabled={count === 0}
          onChange={(e) => setTier(e.target.value as Space["verification_level"])}
          helperText={count === 0 ? "A badge needs at least one recorded check." : "Shown on the listing next to its title."}
        >
          {(Object.keys(TIER_LABELS) as Space["verification_level"][]).map((level) => (
            <option key={level} value={level}>
              {TIER_LABELS[level]}
            </option>
          ))}
        </Select>

        <Textarea
          label="Internal note (admins only)"
          rows={2}
          placeholder="What you looked at, who you spoke to"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        {count > 0 && (
          <label className="flex cursor-pointer items-start gap-3 rounded-md bg-surface-muted p-3">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => {
                setConfirmed(e.target.checked);
                setFormError("");
              }}
              className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-accent"
            />
            <span className="text-sm text-ink">
              I confirm these {count === 1 ? "check" : `${count} checks`} actually happened on this date.
            </span>
          </label>
        )}

        {formError && (
          <p role="alert" className="text-sm font-medium text-danger">
            {formError}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={saving}>
            Save checks
          </Button>
        </div>
      </form>
    </Modal>
  );
}
