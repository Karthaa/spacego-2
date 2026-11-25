"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { SpaceGoStore } from "@/lib/data/store";
import { WorkspaceCategory } from "@/types";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { ArrowLeft, Check, Info } from "lucide-react";

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
  const [country] = useState("United States");
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
      label: "Open workspace",
      url: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80",
    },
    {
      label: "Private office",
      url: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1200&q=80",
    },
    {
      label: "Boardroom",
      url: "https://images.unsplash.com/photo-1517502884422-41eaead166d4?auto=format&fit=crop&w=1200&q=80",
    },
    {
      label: "Studio",
      url: "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=1200&q=80",
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !address || !city) {
      error("Missing information", "Enter a title, street address and city for the workspace.");
      return;
    }

    if (!user) {
      error("Sign in required", "Sign in with your owner account to create a listing.");
      return;
    }

    if (!hourlyPrice && !dailyPrice && !monthlyPrice) {
      error("Missing price", "Enter at least one hourly, daily or monthly price.");
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

      success("Listing published", `${result.data.title} is now live on SpaceGo.`);
      router.push("/owner/properties");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/owner/properties"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-ink-muted hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          My listings
        </Link>
        <PageHeader
          className="mt-1"
          title="Add a workspace"
          description="Describe your space, set prices and choose a photo. The listing is published as soon as you submit."
        />
      </div>

      <div className="flex gap-3 rounded-lg border border-line bg-surface-muted p-4 text-sm text-ink-muted">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink-subtle" aria-hidden="true" />
        <p>
          New listings appear as <span className="font-medium text-ink">New listing</span>, without a review badge.
          Review levels such as &ldquo;Reviewed by SpaceGo&rdquo; are set by the SpaceGo team, not when you publish.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basics */}
        <Card>
          <CardHeader>
            <CardTitle>About the space</CardTitle>
            <CardDescription>The title and description guests see on your listing.</CardDescription>
          </CardHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <Input
                  label="Title"
                  required
                  placeholder="e.g. Quiet corner office near the station"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <Select
                label="Type of space"
                value={category}
                onChange={(e) => setCategory(e.target.value as WorkspaceCategory)}
              >
                <option value="coworking">Coworking desk</option>
                <option value="private_office">Private office</option>
                <option value="meeting_room">Meeting room</option>
                <option value="training_room">Training room</option>
                <option value="studio">Studio</option>
                <option value="event_space">Event space</option>
              </Select>
            </div>

            <Input
              label="Headline (optional)"
              placeholder="e.g. 10-person private office with natural light"
              helperText="One short sentence shown under the title."
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
            />

            <Textarea
              label="Description (optional)"
              rows={4}
              placeholder="Layout, noise level, internet, nearby transport…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </Card>

        {/* Location & size */}
        <Card>
          <CardHeader>
            <CardTitle>Location and size</CardTitle>
          </CardHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <Input
                  label="Street address"
                  required
                  placeholder="e.g. 100 Market Street, 3rd floor"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
              <Input
                label="City"
                required
                placeholder="e.g. San Francisco"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Maximum people"
                type="number"
                inputMode="numeric"
                min={1}
                max={200}
                required
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
              />
              <Input
                label="Floor area (sq ft)"
                type="number"
                inputMode="numeric"
                min={50}
                required
                value={squareFeet}
                onChange={(e) => setSquareFeet(Number(e.target.value))}
              />
            </div>
          </div>
        </Card>

        {/* Pricing & booking */}
        <Card>
          <CardHeader>
            <CardTitle>Prices and booking</CardTitle>
            <CardDescription>Prices are in US dollars. Enter at least one.</CardDescription>
          </CardHeader>
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Input
                label="Per hour"
                type="number"
                inputMode="decimal"
                min={1}
                placeholder="e.g. 25"
                value={hourlyPrice}
                onChange={(e) => setHourlyPrice(e.target.value ? Number(e.target.value) : "")}
                leftIcon={<span className="text-base">$</span>}
              />
              <Input
                label="Per day"
                type="number"
                inputMode="decimal"
                min={1}
                placeholder="e.g. 120"
                value={dailyPrice}
                onChange={(e) => setDailyPrice(e.target.value ? Number(e.target.value) : "")}
                leftIcon={<span className="text-base">$</span>}
              />
              <Input
                label="Per month"
                type="number"
                inputMode="decimal"
                min={100}
                placeholder="e.g. 2400"
                value={monthlyPrice}
                onChange={(e) => setMonthlyPrice(e.target.value ? Number(e.target.value) : "")}
                leftIcon={<span className="text-base">$</span>}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Opens"
                type="time"
                value={openTime}
                onChange={(e) => setOpenTime(e.target.value)}
                helperText="Monday to Friday"
              />
              <Input
                label="Closes"
                type="time"
                value={closeTime}
                onChange={(e) => setCloseTime(e.target.value)}
              />
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-line p-4 hover:bg-surface-muted">
              <input
                type="checkbox"
                checked={instantBook}
                onChange={(e) => setInstantBook(e.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-accent"
              />
              <span>
                <span className="block text-base font-medium text-ink">Instant booking</span>
                <span className="block text-sm text-ink-muted">
                  Bookings are confirmed straight away. Turn this off to approve each request yourself.
                </span>
              </span>
            </label>
          </div>
        </Card>

        {/* Amenities */}
        <Card>
          <fieldset>
            <legend className="text-lg font-semibold text-ink">Amenities</legend>
            <p className="mt-1 text-sm text-ink-muted">Only select what guests can actually use.</p>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {availableAmenities.map((amenity) => (
                <label
                  key={amenity}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-line px-3 py-2 text-sm text-ink hover:bg-surface-muted"
                >
                  <input
                    type="checkbox"
                    checked={selectedAmenities.includes(amenity)}
                    onChange={() => handleAmenityToggle(amenity)}
                    className="h-4 w-4 shrink-0 cursor-pointer accent-accent"
                  />
                  <span>{amenity}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </Card>

        {/* Photo */}
        <Card>
          <fieldset>
            <legend className="text-lg font-semibold text-ink">Cover photo</legend>
            <p className="mt-1 text-sm text-ink-muted">Choose the photo that best matches your space.</p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {imagePresets.map((img) => {
                const selected = selectedImage === img.url;
                return (
                  <button
                    key={img.url}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setSelectedImage(img.url)}
                    className={cn(
                      "overflow-hidden rounded-md border text-left transition-colors",
                      selected ? "border-accent ring-2 ring-accent" : "border-line hover:border-line-strong"
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt="" className="h-28 w-full object-cover" />
                    <span className="flex items-center justify-between gap-2 bg-surface px-3 py-2 text-sm font-medium text-ink">
                      {img.label}
                      {selected && <Check className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        </Card>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link href="/owner/properties" className={buttonClasses({ variant: "outline" })}>
            Cancel
          </Link>
          <Button type="submit" isLoading={isSubmitting}>
            Publish listing
          </Button>
        </div>
      </form>
    </div>
  );
}
