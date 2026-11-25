"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { useSpaceGoVersion } from "@/context/SpaceGoDataProvider";
import { SpaceGoStore } from "@/lib/data/store";
import { Space } from "@/types";
import { VerificationBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Building2,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Eye,
  Trash2,
  Sparkles,
  MapPin,
} from "lucide-react";

export default function AdminSpacesPage() {
  const { success, error } = useToast();
  const dataVersion = useSpaceGoVersion();
  const spaces = useMemo<Space[]>(() => {
    void dataVersion;
    return SpaceGoStore.getSpaces();
  }, [dataVersion]);

  const handleUpdateLevel = async (id: string, level: Space["verification_level"]) => {
    const result = await SpaceGoStore.updateSpace(id, { verification_level: level });
    if (!result.ok) {
      error("Could not update verification tier", result.error);
      return;
    }
    success("Verification Tier Updated", `Assigned ${level.toUpperCase()} to space.`);
  };

  const handleToggleStatus = async (id: string, currentStatus: Space["status"]) => {
    const next: Space["status"] = currentStatus === "published" ? "draft" : "published";
    const result = await SpaceGoStore.updateSpace(id, { status: next });
    if (!result.ok) {
      error("Could not change status", result.error);
      return;
    }
    success("Status Changed", `Workspace is now ${next}.`);
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Workspace Moderation & Verification
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Supervise active listings, audit Space Passport™ certifications, and manage visibility.
          </p>
        </div>

        <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700">
          Total Workspaces: {spaces.length}
        </span>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-100">
              <tr>
                <th className="p-4">Workspace</th>
                <th className="p-4">Category</th>
                <th className="p-4">Location</th>
                <th className="p-4">Host</th>
                <th className="p-4">Passport Tier</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {spaces.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/50">
                  <td className="p-4 flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.images[0]?.url} alt="" className="w-12 h-12 rounded-xl object-cover border border-slate-200" />
                    <div>
                      <span className="font-bold text-slate-900 block max-w-[180px] truncate">{s.title}</span>
                      <span className="text-slate-400 text-[11px]">{s.capacity} seats • {formatCurrency(s.pricing.daily || s.pricing.hourly || 0)}/day</span>
                    </div>
                  </td>
                  <td className="p-4 uppercase text-[10px] font-bold text-slate-600">{s.category.replace("_", " ")}</td>
                  <td className="p-4 text-slate-600">{s.location.city}, {s.location.country}</td>
                  <td className="p-4 text-slate-800 font-semibold">{s.owner_name}</td>
                  <td className="p-4">
                    <select
                      value={s.verification_level}
                      onChange={(e) => handleUpdateLevel(s.id, e.target.value as Space["verification_level"])}
                      className="rounded-lg border border-slate-300 bg-white p-1 text-[11px] font-bold text-slate-800"
                    >
                      <option value="listed">Listed (Unverified)</option>
                      <option value="checked">Checked</option>
                      <option value="ready">SpaceGo Ready</option>
                      <option value="pro">SpaceGo Pro</option>
                    </select>
                  </td>
                  <td className="p-4">
                    <button
                      onClick={() => handleToggleStatus(s.id, s.status)}
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded cursor-pointer ${
                        s.status === "published" ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {s.status}
                    </button>
                  </td>
                  <td className="p-4 text-right">
                    <Link href={`/spaces/${s.id}`} target="_blank">
                      <Button variant="ghost" size="sm" className="p-1.5">
                        <Eye className="w-4 h-4 text-slate-600" />
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
