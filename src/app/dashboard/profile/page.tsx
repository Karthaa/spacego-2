"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import type { UserProfile } from "@/types";
import { User, Mail, Phone, Building2 } from "lucide-react";

export default function SeekerProfilePage() {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-xs text-center">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-teal-600" />
        <p className="text-sm font-medium text-slate-500">Loading profile…</p>
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

      success(
        "Profile Updated",
        "Your profile details and preferences have been saved."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Profile & Account Settings
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Manage your personal information, corporate affiliation, and
          communication preferences.
        </p>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs">
        <form onSubmit={handleSave} className="space-y-6">
          <div className="flex items-center gap-4 border-b border-slate-100 pb-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={
                user.avatar_url ||
                "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=160&q=80"
              }
              alt="Profile"
              className="w-16 h-16 rounded-2xl object-cover border border-slate-200 shadow-xs"
            />
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {user.full_name}
              </h3>
              <p className="text-xs text-slate-500">{user.email}</p>
              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-2 py-0.5 rounded mt-1 inline-block">
                Role: {user.role.toUpperCase()}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Full Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              leftIcon={<User className="w-4 h-4" />}
            />

            <Input
              label="Email Address"
              disabled
              value={user.email}
              helperText="Email cannot be changed directly."
              leftIcon={<Mail className="w-4 h-4" />}
            />

            <Input
              label="Phone Number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (555) 000-0000"
              leftIcon={<Phone className="w-4 h-4" />}
            />

            <Input
              label="Company / Team"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Acme Tech Labs"
              leftIcon={<Building2 className="w-4 h-4" />}
            />
          </div>

          {/* Preferences */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Notification Preferences
            </h4>

            <div className="space-y-2">
              <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                <div>
                  <span className="text-xs font-bold text-slate-900 block">
                    Email Booking Confirmation & Passes
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Receive digital QR pass and host approval notices via email.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={emailNotifications}
                  onChange={(e) => setEmailNotifications(e.target.checked)}
                  className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 w-4 h-4"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                <div>
                  <span className="text-xs font-bold text-slate-900 block">
                    SMS Alerts & Access Reminders
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Instant check-in pass reminder sent 1 hour before scheduled
                    start.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={smsNotifications}
                  onChange={(e) => setSmsNotifications(e.target.checked)}
                  className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 w-4 h-4"
                />
              </label>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <Button
              type="submit"
              variant="teal"
              size="md"
              className="font-bold"
              isLoading={isSaving}
            >
              Save Profile Changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
