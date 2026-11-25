"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { WorkspaceCategory } from "@/types";
import { SpaceGoStore } from "@/lib/data/store";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/context/AuthContext";
import { Sparkles, MapPin, Users, Calendar, DollarSign } from "lucide-react";

interface DemandRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultLocation?: string;
  defaultCategory?: WorkspaceCategory | "all";
}

export function DemandRequestModal({
  isOpen,
  onClose,
  defaultLocation = "",
  defaultCategory = "all",
}: DemandRequestModalProps) {
  const { success, error } = useToast();
  const { user } = useAuth();
  const [name, setName] = useState(user?.full_name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState(defaultLocation);
  const [category, setCategory] = useState<WorkspaceCategory | "all">(defaultCategory);
  const [seats, setSeats] = useState(4);
  const [startDate, setStartDate] = useState("");
  const [budget, setBudget] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !location.trim()) {
      error("Missing information", "Please enter your name, email and target location.");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await SpaceGoStore.createEnquiry({
        user_name: name.trim(),
        email: email.trim(),
        company,
        location_requested: location.trim(),
        category_requested: category,
        seats_needed: Number(seats) || 1,
        preferred_start: startDate || new Date().toISOString().split("T")[0],
        budget_range: budget || "Market rate",
        notes,
      });

      if (!result.ok) {
        error("Request not submitted", result.error);
        return;
      }

      // Also record into demand search signals (best effort).
      void SpaceGoStore.logSearchQuery({
        location: location.trim(),
        category: category !== "all" ? category : undefined,
        seats: Number(seats),
        resultCount: 0,
      });

      success(
        "Workspace Request Submitted!",
        "Our property activation team evaluates active local demand to onboard matching spaces in this zone."
      );

      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Request an Unlisted Workspace"
      description="Can't find what you need? We use qualified demand signals to activate underutilized spaces directly in your preferred location."
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Your Name *"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Doe"
          />
          <Input
            label="Work Email *"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jane@company.com"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Company / Team"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="e.g. Acme Studio"
          />
          <Input
            label="Target City or Area *"
            required
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Austin Downtown, or Kochi"
            leftIcon={<MapPin className="w-4 h-4" />}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
              Workspace Type
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as WorkspaceCategory | "all")}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            >
              <option value="all">Any Suitable Space</option>
              <option value="coworking">Coworking Desks</option>
              <option value="private_office">Private Office</option>
              <option value="meeting_room">Meeting Room</option>
              <option value="training_room">Training Hall</option>
              <option value="studio">Production Studio</option>
              <option value="event_space">Event / Demo Hall</option>
            </select>
          </div>

          <Input
            label="Seats Needed"
            type="number"
            min={1}
            max={200}
            value={seats}
            onChange={(e) => setSeats(Number(e.target.value))}
            leftIcon={<Users className="w-4 h-4" />}
          />

          <Input
            label="Target Start"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            leftIcon={<Calendar className="w-4 h-4" />}
          />
        </div>

        <Input
          label="Estimated Budget"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          placeholder="e.g. $1,200/month or $50/day"
          leftIcon={<DollarSign className="w-4 h-4" />}
        />

        <Textarea
          label="Specific Requirements"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Need soundproof booths, 24/7 keycard access, generator backup..."
        />

        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="teal" isLoading={isSubmitting}>
            Submit Demand Signal
          </Button>
        </div>
      </form>
    </Modal>
  );
}
