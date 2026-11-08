"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { Building2, CreditCard, ShieldCheck, Mail, Phone, Lock } from "lucide-react";

export default function OwnerSettingsPage() {
  const { user } = useAuth();
  const { success } = useToast();

  const [companyName, setCompanyName] = useState(user?.company_name || "Metropolis Property Holdings");
  const [bankAccount, setBankAccount] = useState("•••• •••• •••• 4912");
  const [routingNumber, setRoutingNumber] = useState("121000358");
  const [cancellationPolicy, setCancellationPolicy] = useState("flexible");

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    success("Settings Updated", "Host payout information and cancellation policies have been saved.");
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          Host & Payout Settings
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Manage your verified host identity, automated booking payouts, and guest policies.
        </p>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs">
        <form onSubmit={handleSave} className="space-y-6">
          
          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-teal-600" />
              1. Operating Entity & Tax Info
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Legal Operating Entity"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />

              <Input
                label="Host Email"
                disabled
                value={user?.email || "elena.owner@spacego.io"}
                helperText="Primary notification inbox"
              />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-teal-600" />
              2. Bank Account Payout Details (Direct Remittance)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Bank Account Number"
                value={bankAccount}
                onChange={(e) => setBankAccount(e.target.value)}
                helperText="Encrypted and tokenized"
              />

              <Input
                label="Routing / Swift Code"
                value={routingNumber}
                onChange={(e) => setRoutingNumber(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-slate-100">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-600" />
              3. Guest Cancellation Policy
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { id: "flexible", label: "Flexible", desc: "Full refund up to 24 hrs prior to booking" },
                { id: "moderate", label: "Moderate", desc: "Full refund up to 5 days prior; 50% thereafter" },
                { id: "strict", label: "Strict", desc: "50% refund up to 7 days prior" },
              ].map((p) => (
                <label
                  key={p.id}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    cancellationPolicy === p.id
                      ? "border-teal-500 bg-teal-50/60 shadow-xs"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="cancellation"
                    value={p.id}
                    checked={cancellationPolicy === p.id}
                    onChange={(e) => setCancellationPolicy(e.target.value)}
                    className="sr-only"
                  />
                  <span className="text-xs font-bold text-slate-900 block">{p.label}</span>
                  <span className="text-[11px] text-slate-500 mt-1 block leading-snug">{p.desc}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <Button type="submit" variant="teal" size="md" className="font-bold">
              Save Host Settings
            </Button>
          </div>

        </form>
      </div>

    </div>
  );
}
