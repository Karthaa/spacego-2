"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { SpaceGoStore } from "@/lib/data/store";
import { WorkspaceCategory } from "@/types";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import {
  Building2,
  MapPin,
  Users,
  DollarSign,
  Clock,
  Sparkles,
  ArrowRight,
  ChevronLeft,
  Check,
} from "lucide-react";

export default function NewWorkspaceListingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { success, error } = useToast();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<WorkspaceCategory>("coworking");
  const [headline, setHeadline] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("San Francisco");
  const [country, setCountry] = useState("United States");
  const [capacity, setCapacity] = useState(12);
  const [squareFeet, setSquareFeet] = useState(1400);

  // Pricing
  const [hourlyPrice, setHourlyPrice] = useState<number | "">(25);
  const [dailyPrice, setDailyPrice] = useState<number | "">(120);
  const [monthlyPrice, setMonthlyPrice] = useState<number | "">("");

  // Operating Hours
  const [openTime, setOpenTime] = useState("08:00");
  const [closeTime, setCloseTime] = useState("20:00");

  // Instant Book
  const [instantBook, setInstantBook] = useState(true);

  // Amenities
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([
    "High-Speed Fiber WiFi",
    "Ergonomic Chairs",
    "Specialty Coffee Bar",
    "Soundproof Phone Booth",
  ]);

  // Photo
  const [selectedImage, setSelectedImage] = useState(
    "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80"
  );

  const [isSubmitting, setIsSubmitting] = useState(false);

  const availableAmenities = [
    "High-Speed Fiber WiFi",
    "Ergonomic Chairs",
    "Specialty Coffee Bar",
    "Soundproof Phone Booth",
    "Dual 4K Monitors",
    "Conference Video AV",
    "Whiteboard & Sticky Notes",
    "24/7 Keycard Access",
    "Standing Desks",
    "On-site Parking",
  ];

  const handleAmenityToggle = (amenity: string) => {
    if (selectedAmenities.includes(amenity)) {
      setSelectedAmenities(selectedAmenities.filter((a) => a !== amenity));
    } else {
      setSelectedAmenities([...selectedAmenities, amenity]);
    }
  };

  const imagePresets = [
    {
      label: "Open Workstation",
      url: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80",
    },
    {
      label: "Private Office",
      url: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1200&q=80",
    },
    {
      label: "Boardroom Suite",
      url: "https://images.unsplash.com/photo-1517502884422-41eaead166d4?auto=format&fit=crop&w=1200&q=80",
    },
    {
      label: "Podcast Studio",
      url: "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=1200&q=80",
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !address || !city) {
      error("Missing Information", "Please enter workspace title and location address.");
      return;
    }

    if (!user) {
      error("Sign in required", "Sign in with your owner account to create a listing.");
      return;
    }

    if (!hourlyPrice && !dailyPrice && !monthlyPrice) {
      error("Missing Pricing", "Enter at least one hourly, daily or monthly price.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await SpaceGoStore.addSpace({
        title,
        category,
        headline: headline || "Modern flexible workspace tailored for productivity.",
        description: description || "Fully equipped workspace with high-speed internet and ergonomic amenities.",
        location: {
          city,
          address,
          country,
          coordinates: { lat: 37.7749, lng: -122.4194 },
        },
        capacity: Number(capacity) || 1,
        square_feet: Number(squareFeet) || 500,
        pricing: {
          hourly: hourlyPrice ? Number(hourlyPrice) : undefined,
          daily: dailyPrice ? Number(dailyPrice) : undefined,
          monthly: monthlyPrice ? Number(monthlyPrice) : undefined,
          currency: "USD",
        },
        amenities: selectedAmenities,
        operating_hours: {
          open: openTime,
          close: closeTime,
          days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
        },
        house_rules: ["Quiet focus maintained in open areas", "Clear personal items when leaving"],
        images: [
          {
            url: selectedImage,
            caption: "Main space",
            is_cover: true,
          },
        ],
        status: "published",
        instant_book: instantBook,
      }, {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        avatar_url: user.avatar_url,
      });

      if (!result.ok) {
        error("Could not create listing", result.error);
        return;
      }

      success("Workspace Created & Published!", `Listing is now live on SpaceGo: ${result.data.title}`);
      router.push("/owner/properties");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/owner/properties" className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Create New Workspace Listing
            </h1>
            <p className="text-xs text-slate-500">
              Configure property specifications, pricing tiers, amenities, and publish to the marketplace.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-10 shadow-xs">
        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* Section 1: Basic Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-teal-600" />
              1. Title & Workspace Type
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <Input
                  label="Workspace Title *"
                  required
                  placeholder="e.g. The Silicon Atelier Focus Cabin"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Workspace Category *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as WorkspaceCategory)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-semibold text-slate-900 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                >
                  <option value="coworking">Coworking Space</option>
                  <option value="private_office">Private Office Suite</option>
                  <option value="meeting_room">Meeting / Boardroom</option>
                  <option value="training_room">Training Hall</option>
                  <option value="studio">Production Studio</option>
                  <option value="event_space">Event / Demo Hall</option>
                </select>
              </div>
            </div>

            <Input
              label="Headline (Punchy Summary)"
              placeholder="e.g. Ergonomic 10-person private office with dual monitors & natural light"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
            />

            <Textarea
              label="Full Description"
              rows={3}
              placeholder="Detail the layout, acoustic qualities, high-speed fiber specifications, transit access..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Section 2: Location & Dimensions */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-teal-600" />
              2. Location & Capacity
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <Input
                  label="Street Address *"
                  required
                  placeholder="e.g. 100 Innovation Boulevard, 3rd Floor"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>

              <Input
                label="City *"
                required
                placeholder="e.g. San Francisco"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Maximum Seating Capacity (Seats) *"
                type="number"
                min={1}
                max={200}
                required
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
                leftIcon={<Users className="w-4 h-4" />}
              />

              <Input
                label="Floor Area (Square Feet) *"
                type="number"
                min={50}
                required
                value={squareFeet}
                onChange={(e) => setSquareFeet(Number(e.target.value))}
              />
            </div>
          </div>

          {/* Section 3: Pricing Configuration */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-teal-600" />
              3. Pricing & Booking Model
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label="Hourly Rate ($ USD)"
                type="number"
                min={1}
                placeholder="e.g. 25"
                value={hourlyPrice}
                onChange={(e) => setHourlyPrice(e.target.value ? Number(e.target.value) : "")}
                leftIcon={<DollarSign className="w-4 h-4" />}
              />

              <Input
                label="Daily Rate ($ USD)"
                type="number"
                min={1}
                placeholder="e.g. 120"
                value={dailyPrice}
                onChange={(e) => setDailyPrice(e.target.value ? Number(e.target.value) : "")}
                leftIcon={<DollarSign className="w-4 h-4" />}
              />

              <Input
                label="Monthly Rate ($ USD - Optional)"
                type="number"
                min={100}
                placeholder="e.g. 2400"
                value={monthlyPrice}
                onChange={(e) => setMonthlyPrice(e.target.value ? Number(e.target.value) : "")}
                leftIcon={<DollarSign className="w-4 h-4" />}
              />
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900 block">Instant Booking Confirmation</span>
                <span className="text-[11px] text-slate-500">Allow customers to instantly confirm reservations without waiting for manual host review.</span>
              </div>
              <input
                type="checkbox"
                checked={instantBook}
                onChange={(e) => setInstantBook(e.target.checked)}
                className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 w-4 h-4 cursor-pointer"
              />
            </div>
          </div>

          {/* Section 4: Amenities */}
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Select Provided Amenities
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {availableAmenities.map((amenity) => (
                <label
                  key={amenity}
                  className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs text-slate-700 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedAmenities.includes(amenity)}
                    onChange={() => handleAmenityToggle(amenity)}
                    className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                  <span className="truncate">{amenity}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Section 5: Photography Selection */}
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Select Primary Workspace Photography
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {imagePresets.map((img, idx) => (
                <div
                  key={idx}
                  onClick={() => setSelectedImage(img.url)}
                  className={`relative rounded-xl overflow-hidden border-2 cursor-pointer transition-all ${
                    selectedImage === img.url
                      ? "border-teal-600 ring-2 ring-teal-500/30 scale-102"
                      : "border-slate-200 opacity-70 hover:opacity-100"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt={img.label} className="h-28 w-full object-cover" />
                  <div className="p-1.5 bg-white text-[11px] font-semibold text-slate-800 text-center truncate">
                    {img.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Submit Action */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <Link href="/owner/properties">
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
            <Button type="submit" variant="teal" size="lg" className="font-bold shadow-md" isLoading={isSubmitting}>
              <span>Publish Workspace Listing</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>

        </form>
      </div>

    </div>
  );
}
