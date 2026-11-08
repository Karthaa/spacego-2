"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { Settings, ShieldCheck, Database, Key, Server, CheckCircle2 } from "lucide-react";

export default function AdminSettingsPage() {
  const { success } = useToast();

  const [platformCommission, setPlatformCommission] = useState(15);
  const [minBookingBufferMinutes, setMinBookingBufferMinutes] = useState(15);
  const [passportRenewalDays, setPassportRenewalDays] = useState(365);
  const [requireHostApprovalByDefault, setRequireHostApprovalByDefault] = useState(true);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    success("Platform Configuration Saved", "Global system parameters updated across all environments.");
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          Platform Governance & System Settings
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Configure marketplace commission waterfalls, Space Passport™ audit cycles, and backend connectivity.
        </p>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
        <form onSubmit={handleSave} className="space-y-6">
          
          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <Settings className="w-4 h-4 text-teal-600" />
              1. Commercial & Booking Rules
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label="Standard Platform Commission (%)"
                type="number"
                min={5}
                max={30}
                value={platformCommission}
                onChange={(e) => setPlatformCommission(Number(e.target.value))}
                helperText="Applied to completed transactions"
              />

              <Input
                label="Buffer Between Reservations (Mins)"
                type="number"
                min={0}
                max={60}
                value={minBookingBufferMinutes}
                onChange={(e) => setMinBookingBufferMinutes(Number(e.target.value))}
                helperText="Turnover & cleaning buffer"
              />

              <Input
                label="Space Passport™ Expiry (Days)"
                type="number"
                min={90}
                max={730}
                value={passportRenewalDays}
                onChange={(e) => setPassportRenewalDays(Number(e.target.value))}
                helperText="Periodic re-inspection cadence"
              />
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900 block">Host Approval Required by Default</span>
                <span className="text-[11px] text-slate-500">New spaces require host sign-off unless explicitly approved for Instant Book.</span>
              </div>
              <input
                type="checkbox"
                checked={requireHostApprovalByDefault}
                onChange={(e) => setRequireHostApprovalByDefault(e.target.checked)}
                className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 w-4 h-4"
              />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <Database className="w-4 h-4 text-teal-600" />
              2. Backend Infrastructure & Storage
            </h3>

            <div className="p-4 rounded-2xl bg-teal-50/60 border border-teal-200 space-y-2 text-xs">
              <div className="flex items-center gap-2 font-bold text-teal-950">
                <CheckCircle2 className="w-4 h-4 text-teal-600" />
                <span>Dual-Mode Storage Architecture Active</span>
              </div>
              <p className="text-teal-900 leading-relaxed">
                The platform is configured with an active resilient datastore. To connect a remote PostgreSQL cluster, supply <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in <code>.env.local</code>. Migration SQL is prepared in <code>supabase/migrations/20261108_init.sql</code>.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <Button type="submit" variant="teal" size="md" className="font-bold">
              Save Global Configuration
            </Button>
          </div>

        </form>
      </div>

    </div>
  );
}
