"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { ProfileAvatar } from "@/components/layout/DashboardShell";
import type { UserProfile } from "@/types";
import { User, Mail, Phone, Building2 } from "lucide-react";

const ROLE_LABEL: Record<UserProfile["role"], string> = {
  seeker: "Member",
  owner: "Host",
  admin: "Administrator",
};

export default function SeekerProfilePage() {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="space-y-6" role="status" aria-label="Loading profile">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-5 w-72" />
        </div>
        <Card className="space-y-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[1, 2, 3, 4].map((n) => (
              <Skeleton key={n} className="h-11" />
            ))}
          </div>
        </Card>
      </div>
    );
  }

  return <ProfileForm key={user.id} user={user} />;
}

function ProfileForm({ user }: { user: UserProfile }) {
  const { updateProfile } = useAuth();
  const { success, error } = useToast();

  const [fullName, setFullName] = useState(user.full_name ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");
  const [companyName, setCompanyName] = useState(user.company_name ?? "");
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const result = await updateProfile({
        full_name: fullName,
        phone,
        company_name: companyName,
      });

      if (result.error) {
        error("Profile Update Failed", result.error);
        return;
      }

      success("Profile updated", "Your profile details have been saved.");
    } finally {
      setIsSaving(false);
    }
  };

  const checkboxClass = "mt-0.5 h-5 w-5 shrink-0 rounded-sm border-line-strong accent-accent";

  return (
    <div className="space-y-6">
      <PageHeader title="Profile" description="Your name and contact details." />

      <form onSubmit={handleSave} className="space-y-6">
        <Card>
          <div className="flex items-center gap-4 border-b border-line pb-5">
            <ProfileAvatar name={user.full_name} url={user.avatar_url} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-ink">{user.full_name}</p>
              <p className="truncate text-sm text-ink-muted">{user.email}</p>
              <p className="text-sm text-ink-subtle">{ROLE_LABEL[user.role]}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 pt-5 sm:grid-cols-2">
            <Input
              label="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              leftIcon={<User />}
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
              label="Company or team"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Optional"
              autoComplete="organization"
              leftIcon={<Building2 />}
            />
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>
              These choices aren&apos;t saved to your account yet and reset when you leave this page.
            </CardDescription>
          </CardHeader>

          <div className="space-y-2">
            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-line p-3 hover:bg-surface-muted">
              <input
                type="checkbox"
                checked={emailNotifications}
                onChange={(e) => setEmailNotifications(e.target.checked)}
                className={checkboxClass}
              />
              <span>
                <span className="block text-base font-medium text-ink">Email updates</span>
                <span className="block text-sm text-ink-muted">
                  Booking confirmations and host replies by email.
                </span>
              </span>
            </label>

            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-line p-3 hover:bg-surface-muted">
              <input
                type="checkbox"
                checked={smsNotifications}
                onChange={(e) => setSmsNotifications(e.target.checked)}
                className={checkboxClass}
              />
              <span>
                <span className="block text-base font-medium text-ink">Text messages</span>
                <span className="block text-sm text-ink-muted">Booking reminders by SMS.</span>
              </span>
            </label>
          </div>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" isLoading={isSaving}>
            Save changes
          </Button>
        </div>
      </form>
    </div>
  );
}
