"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import type { UserProfile } from "@/types";
import { Building2, Info, Mail, Phone, User } from "lucide-react";

export default function OwnerSettingsPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Your host account details." />

      {user ? (
        <OwnerProfileForm key={user.id} user={user} />
      ) : (
        <Card>
          <div className="space-y-4" role="status" aria-label="Loading account details">
            <Skeleton className="h-6 w-1/3" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[1, 2, 3, 4].map((n) => (
                <Skeleton key={n} className="h-11" />
              ))}
            </div>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Payouts and cancellation policy</CardTitle>
        </CardHeader>
        <div className="flex gap-3 rounded-md bg-surface-muted p-4 text-sm text-ink-muted">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink-subtle" aria-hidden="true" />
          <p>
            You can&apos;t add payout details or choose a cancellation policy in SpaceGo yet. Nothing is collected or
            paid out through this page.
          </p>
        </div>
      </Card>
    </div>
  );
}

function OwnerProfileForm({ user }: { user: UserProfile }) {
  const { updateProfile } = useAuth();
  const { success, error } = useToast();

  const [fullName, setFullName] = useState(user.full_name ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");
  const [companyName, setCompanyName] = useState(user.company_name ?? "");
  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    if (!fullName.trim()) {
      setNameError("Enter your full name.");
      return;
    }
    setNameError(undefined);

    setIsSaving(true);
    try {
      const result = await updateProfile({
        full_name: fullName,
        phone,
        company_name: companyName,
      });

      if (result.error) {
        error("Could not save your details", result.error);
        return;
      }

      success("Account updated", "Your host details have been saved.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account</CardTitle>
        <CardDescription>Guests see your name on your listings. Your email is used for booking updates.</CardDescription>
      </CardHeader>

      <form onSubmit={handleSave} noValidate className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Full name"
            required
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value);
              if (nameError && e.target.value.trim()) setNameError(undefined);
            }}
            autoComplete="name"
            leftIcon={<User />}
            error={nameError}
          />

          <Input
            label="Email address"
            disabled
            value={user.email}
            helperText="Email can't be changed here."
            leftIcon={<Mail />}
          />

          <Input
            label="Phone number"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 555 000 0000"
            autoComplete="tel"
            leftIcon={<Phone />}
          />

          <Input
            label="Company"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Optional"
            autoComplete="organization"
            leftIcon={<Building2 />}
          />
        </div>

        <div className="flex justify-end">
          <Button type="submit" isLoading={isSaving}>
            Save changes
          </Button>
        </div>
      </form>
    </Card>
  );
}
