"use client";

import React, { useState } from "react";
import { INITIAL_PROFILES } from "@/lib/data/mockData";
import { UserProfile, UserRole } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { formatDate } from "@/lib/utils";
import { Users, Search, ShieldCheck, Mail, Phone, Building2 } from "lucide-react";

export default function AdminUsersPage() {
  const { success } = useToast();
  const [usersList, setUsersList] = useState<UserProfile[]>(INITIAL_PROFILES);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | UserRole>("all");

  const filteredUsers = usersList.filter((u) => {
    if (roleFilter !== "all" && u.role !== roleFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    }
    return true;
  });

  const handleRoleChange = (userId: string, newRole: UserRole) => {
    const updated = usersList.map((u) => (u.id === userId ? { ...u, role: newRole } : u));
    setUsersList(updated);
    success("User Role Updated", `Assigned ${newRole.toUpperCase()} to user.`);
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            User Management & Access Control
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Review registered platform members, manage owner verification, and supervise access privileges.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-64 text-xs"
            leftIcon={<Search className="w-4 h-4" />}
          />
        </div>
      </div>

      {/* Role Filter Tabs */}
      <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl w-fit">
        {(["all", "seeker", "owner", "admin"] as const).map((r) => (
          <button
            key={r}
            onClick={() => setRoleFilter(r)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all cursor-pointer ${
              roleFilter === r ? "bg-white text-slate-950 shadow-xs font-bold" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {r === "all" ? "All Users" : r}
          </button>
        ))}
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-100">
              <tr>
                <th className="p-4">User</th>
                <th className="p-4">Contact</th>
                <th className="p-4">Organization</th>
                <th className="p-4">Role</th>
                <th className="p-4">Member Since</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/50">
                  <td className="p-4 flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={u.avatar_url} alt="" className="w-10 h-10 rounded-xl object-cover border border-slate-200" />
                    <div>
                      <span className="font-bold text-slate-900 block">{u.full_name}</span>
                      <span className="text-slate-400 text-[11px] font-mono">{u.id}</span>
                    </div>
                  </td>
                  <td className="p-4 text-slate-600">
                    <div>{u.email}</div>
                    <div className="text-[11px] text-slate-400">{u.phone || "—"}</div>
                  </td>
                  <td className="p-4 text-slate-700">{u.company_name || "Independent"}</td>
                  <td className="p-4">
                    <Badge variant={u.role === "admin" ? "error" : u.role === "owner" ? "brand" : "neutral"}>
                      {u.role.toUpperCase()}
                    </Badge>
                  </td>
                  <td className="p-4 text-slate-500">{formatDate(u.created_at)}</td>
                  <td className="p-4 text-right">
                    <select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                      className="rounded-lg border border-slate-300 bg-white p-1 text-[11px] font-semibold text-slate-800"
                    >
                      <option value="seeker">Seeker</option>
                      <option value="owner">Owner</option>
                      <option value="admin">Admin</option>
                    </select>
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
