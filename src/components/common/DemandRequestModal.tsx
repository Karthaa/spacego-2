"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input, Textarea, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { WorkspaceCategory } from "@/types";
import { CATEGORIES, categoryNoun } from "@/lib/categories";
import { SpaceGoStore } from "@/lib/data/store";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/context/AuthContext";
import { MapPin, Users, Calendar, DollarSign } from "lucide-react";

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
        "Request sent",
        "The SpaceGo team will see your request when looking for new spaces in this area."
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
      title="Request a workspace"
      description="Can't find a suitable space? Tell us what you need and where. The SpaceGo team uses these requests when deciding which spaces to bring onto SpaceGo."
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-4">
          <Input
            label="Your name"
            required
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            label="Email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-4">
          <Input
            label="Company or team (optional)"
            autoComplete="organization"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
          <Input
            label="City or area"
            required
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Kochi or Austin downtown"
            leftIcon={<MapPin aria-hidden="true" />}
          />
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 sm:gap-4">
          <Select
            label="Type of space"
            value={category}
            onChange={(e) => setCategory(e.target.value as WorkspaceCategory | "all")}
          >
            <option value="all">Any type</option>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {categoryNoun(c.id)}
              </option>
            ))}
          </Select>

          <Input
            label={category === "parking" ? "Vehicles" : "Seats"}
            type="number"
            min={1}
            max={category === "auditorium" ? 10000 : 200}
            value={seats}
            onChange={(e) => setSeats(Number(e.target.value))}
            leftIcon={<Users aria-hidden="true" />}
          />

          <Input
            label="Start date (optional)"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            leftIcon={<Calendar aria-hidden="true" />}
          />
        </div>

        <Input
          label="Budget (optional)"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          placeholder="e.g. $1,200 per month or $50 per day"
          leftIcon={<DollarSign aria-hidden="true" />}
        />

        <Textarea
          label="Requirements (optional)"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Quiet phone booths, after-hours access, parking"
        />

        <div className="flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            Send request
          </Button>
        </div>
      </form>
    </Modal>
  );
}
