"use client";

import React, { useState, useEffect } from "react";
import { SpaceGoStore } from "@/lib/data/store";
import { Space, Booking } from "@/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { formatDate } from "@/lib/utils";
import {
  Calendar,
  Lock,
  Plus,
  Trash2,
  Building2,
  Clock,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";

export default function OwnerAvailabilityPage() {
  const { success, error } = useToast();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [selectedSpaceId, setSelectedSpaceId] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  
  // Blocked slots local state
  const [blockedSlots, setBlockedSlots] = useState<{ id: string; date: string; reason: string }[]>([
    { id: "blk-1", date: "2026-11-20", reason: "Scheduled HVAC Filter Replacement" },
    { id: "blk-2", date: "2026-11-24", reason: "Private Corporate Keynote" },
  ]);

  const [newBlockDate, setNewBlockDate] = useState("");
  const [newBlockReason, setNewBlockReason] = useState("");

  useEffect(() => {
    const list = SpaceGoStore.getSpaces();
    setSpaces(list);
    if (list.length > 0) setSelectedSpaceId(list[0].id);
    setBookings(SpaceGoStore.getBookings());
  }, []);

  const handleAddBlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBlockDate) {
      error("Date required", "Please choose a date to block.");
      return;
    }

    const newBlock = {
      id: `blk-${Date.now()}`,
      date: newBlockDate,
      reason: newBlockReason || "Host Reserved Block",
    };

    setBlockedSlots([newBlock, ...blockedSlots]);
    setNewBlockDate("");
    setNewBlockReason("");
    success("Date Blocked", `Blocked ${newBlockDate} on public booking engine.`);
  };

  const handleRemoveBlock = (id: string) => {
    setBlockedSlots(blockedSlots.filter((b) => b.id !== id));
    success("Block Removed", "The date is now available for public bookings.");
  };

  const activeSpace = spaces.find((s) => s.id === selectedSpaceId) || spaces[0];
  const spaceBookings = bookings.filter((b) => b.space_id === selectedSpaceId && b.status === "approved");

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Availability & Calendar Rules
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage open booking windows, block reserved slots, and avoid double booking.
          </p>
        </div>

        {/* Space Picker */}
        {spaces.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Workspace:</span>
            <select
              value={selectedSpaceId}
              onChange={(e) => setSelectedSpaceId(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            >
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left: Confirmed Calendar Bookings */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-teal-600" />
              <h3 className="text-base font-bold text-slate-900">
                Confirmed Occupancy Schedule ({spaceBookings.length})
              </h3>
            </div>
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              Live Synced
            </span>
          </div>

          {spaceBookings.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No confirmed bookings currently scheduled for this workspace.
            </div>
          ) : (
            <div className="space-y-3">
              {spaceBookings.map((b) => (
                <div
                  key={b.id}
                  className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-800">{b.id}</span>
                      <span className="text-xs font-bold text-slate-900">• {b.user_name}</span>
                    </div>
                    <div className="text-xs text-slate-600 mt-1">
                      {formatDate(b.start_date)} ({b.duration_units} {b.duration_type}) • {b.seats} seats
                    </div>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
                    Occupied
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Block Custom Dates Manager */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-600" />
              <h3 className="text-base font-bold text-slate-900">Block Dates & Maintenance</h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Prevent bookings during private events, holidays, or renovation.
            </p>
          </div>

          <form onSubmit={handleAddBlock} className="space-y-3">
            <Input
              label="Select Date to Block *"
              type="date"
              required
              min={new Date().toISOString().split("T")[0]}
              value={newBlockDate}
              onChange={(e) => setNewBlockDate(e.target.value)}
            />

            <Input
              label="Reason / Event Name"
              placeholder="e.g. Maintenance, Private Buyout..."
              value={newBlockReason}
              onChange={(e) => setNewBlockReason(e.target.value)}
            />

            <Button type="submit" variant="teal" size="sm" className="w-full font-bold gap-1">
              <Plus className="w-4 h-4" />
              <span>Block Selected Date</span>
            </Button>
          </form>

          {/* List of currently blocked dates */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
              Currently Blocked ({blockedSlots.length})
            </span>

            {blockedSlots.map((slot) => (
              <div
                key={slot.id}
                className="p-3 rounded-xl border border-amber-200 bg-amber-50/50 flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-bold text-slate-900 block">{formatDate(slot.date)}</span>
                  <span className="text-[11px] text-slate-500">{slot.reason}</span>
                </div>
                <button
                  onClick={() => handleRemoveBlock(slot.id)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 transition-colors"
                  aria-label="Unblock"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

        </div>

      </div>

    </div>
  );
}
