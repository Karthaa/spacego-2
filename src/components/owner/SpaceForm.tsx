"use client";

import React, { useId, useMemo, useState } from "react";
import Link from "next/link";
import { z } from "zod";
import { Space, SpaceImage, SpaceLocation, SpacePricing, WorkspaceCategory } from "@/types";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import dynamic from "next/dynamic";
import { isValidLatLng, type LatLng } from "@/lib/geo";

const LocationPicker = dynamic(() => import("./LocationPicker"), {
  ssr: false,
  loading: () => <div className="h-96 rounded-lg skeleton-shimmer" aria-hidden="true" />,
});

/** The listing fields the form produces; the same shape `SpaceGoStore.addSpace` receives. */
export interface SpaceFormValues {
  title: string;
  category: WorkspaceCategory;
  headline: string;
  description: string;
  location: SpaceLocation;
  capacity: number;
  square_feet: number;
  pricing: SpacePricing;
  amenities: string[];
  operating_hours: Space["operating_hours"];
  house_rules: string[];
  images: SpaceImage[];
  status: Space["status"];
  instant_book: boolean;
}

export interface SpaceFormProps {
  initial?: Space;
  mode: "create" | "edit";
  onSubmit: (values: SpaceFormValues) => Promise<{ ok: boolean; error?: string }>;
  submitLabel: string;
}

const DEFAULT_HEADLINE = "Modern flexible workspace tailored for productivity.";
const DEFAULT_DESCRIPTION = "Fully equipped workspace with high-speed internet and ergonomic amenities.";
// Older listings were saved with this placeholder point whatever their city.
// Treat it as "not set" unless the listing really is in San Francisco.
const LEGACY_PLACEHOLDER = { lat: 37.7749, lng: -122.4194 };

function initialPin(space?: Space): LatLng | null {
  const c = space?.location.coordinates;
  if (!c || !isValidLatLng(c.lat, c.lng)) return null;
  const isPlaceholder = c.lat === LEGACY_PLACEHOLDER.lat && c.lng === LEGACY_PLACEHOLDER.lng;
  if (isPlaceholder && !/san francisco/i.test(space?.location.city ?? "")) return null;
  return { lat: c.lat, lng: c.lng };
}
const DEFAULT_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const DEFAULT_HOUSE_RULES = ["Quiet focus maintained in open areas", "Clear personal items when leaving"];

const DEFAULT_AMENITIES = [
  "High-Speed Fiber WiFi",
  "Ergonomic Chairs",
  "Specialty Coffee Bar",
  "Soundproof Phone Booth",
];

const AVAILABLE_AMENITIES = [
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

const IMAGE_PRESETS = [
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

const optionalPrice = z
  .number({ error: "Enter a number." })
  .min(0, "Prices can't be negative.")
  .optional();

const spaceFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Enter a title for the listing.")
    .max(200, "Keep the title to 200 characters or fewer."),
  address: z.string().trim().min(1, "Enter the street address."),
  city: z.string().trim().min(1, "Enter the city."),
  country: z.string().trim().min(1, "Enter the country."),
  capacity: z
    .number({ error: "Enter how many people the space holds." })
    .int("Use a whole number of people.")
    .min(1, "The space must hold at least 1 person.")
    .max(1_000_000, "Enter 1,000,000 people or fewer."),
  squareFeet: z
    .number({ error: "Enter the floor area." })
    .int("Use a whole number of square feet.")
    .min(1, "Floor area must be at least 1 sq ft."),
  pricing: z
    .object({ hourly: optionalPrice, daily: optionalPrice, monthly: optionalPrice })
    .refine(
      (p) => [p.hourly, p.daily, p.monthly].some((v) => v !== undefined && v > 0),
      "Enter at least one hourly, daily or monthly price."
    ),
  openTime: z.string().min(1, "Enter an opening time."),
  closeTime: z.string().min(1, "Enter a closing time."),
});

type FieldKey =
  | "title"
  | "address"
  | "city"
  | "country"
  | "coordinates"
  | "capacity"
  | "squareFeet"
  | "pricing.hourly"
  | "pricing.daily"
  | "pricing.monthly"
  | "pricing"
  | "openTime"
  | "closeTime";

/** Order used to move focus to the first invalid field. */
const FIELD_ORDER: FieldKey[] = [
  "title",
  "address",
  "city",
  "country",
  "coordinates",
  "capacity",
  "squareFeet",
  "pricing.hourly",
  "pricing.daily",
  "pricing.monthly",
  "pricing",
  "openTime",
  "closeTime",
];

type FieldErrors = Partial<Record<FieldKey, string>>;

function numberOrUndefined(raw: string): number | undefined {
  const trimmed = raw.trim();
  return trimmed === "" ? undefined : Number(trimmed);
}

function priceToString(value: number | undefined): string {
  return value ? String(value) : "";
}

export function SpaceForm({ initial, mode, onSubmit, submitLabel }: SpaceFormProps) {
  const baseId = useId();
  const fieldId = (key: FieldKey) => `${baseId}-${key === "pricing" ? "pricing-hourly" : key.replace(".", "-")}`;

  const [title, setTitle] = useState(initial?.title ?? "");
  const [category, setCategory] = useState<WorkspaceCategory>(initial?.category ?? "coworking");
  const [headline, setHeadline] = useState(initial?.headline ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [address, setAddress] = useState(initial?.location.address ?? "");
  const [city, setCity] = useState(initial?.location.city ?? "");
  const [country, setCountry] = useState(initial?.location.country ?? "India");
  const [pin, setPin] = useState<LatLng | null>(() => initialPin(initial));
  const [capacity, setCapacity] = useState(initial ? String(initial.capacity) : "12");
  const [squareFeet, setSquareFeet] = useState(initial ? String(initial.square_feet) : "1400");

  // Pricing
  const currency = initial?.pricing.currency ?? "INR";
  const [hourlyPrice, setHourlyPrice] = useState(initial ? priceToString(initial.pricing.hourly) : "");
  const [dailyPrice, setDailyPrice] = useState(initial ? priceToString(initial.pricing.daily) : "");
  const [monthlyPrice, setMonthlyPrice] = useState(initial ? priceToString(initial.pricing.monthly) : "");

  // Operating hours
  const [openTime, setOpenTime] = useState(initial?.operating_hours.open ?? "08:00");
  const [closeTime, setCloseTime] = useState(initial?.operating_hours.close ?? "20:00");

  const [instantBook, setInstantBook] = useState(initial?.instant_book ?? true);

  const [selectedAmenities, setSelectedAmenities] = useState<string[]>(initial?.amenities ?? DEFAULT_AMENITIES);

  const initialCoverUrl = initial ? (initial.images.find((img) => img.is_cover) ?? initial.images[0])?.url : undefined;
  const [selectedImage, setSelectedImage] = useState(initialCoverUrl ?? IMAGE_PRESETS[0].url);

  const [hasTriedSubmit, setHasTriedSubmit] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Keep any amenities or photo the listing already has, even if they're not in the standard lists.
  const amenityOptions = useMemo(() => {
    const extra = (initial?.amenities ?? []).filter((a) => !AVAILABLE_AMENITIES.includes(a));
    return [...AVAILABLE_AMENITIES, ...extra];
  }, [initial]);

  const imageOptions = useMemo(() => {
    if (!initialCoverUrl || IMAGE_PRESETS.some((p) => p.url === initialCoverUrl)) return IMAGE_PRESETS;
    return [{ label: "Current photo", url: initialCoverUrl }, ...IMAGE_PRESETS];
  }, [initialCoverUrl]);

  const validate = () => {
    const parsed = spaceFormSchema.safeParse({
      title,
      address,
      city,
      country,
      capacity: numberOrUndefined(capacity),
      squareFeet: numberOrUndefined(squareFeet),
      pricing: {
        hourly: numberOrUndefined(hourlyPrice),
        daily: numberOrUndefined(dailyPrice),
        monthly: numberOrUndefined(monthlyPrice),
      },
      openTime,
      closeTime,
    });

    const errors: FieldErrors = {};
    if (!pin) errors.coordinates = "Place the pin on your building so guests can find the space.";
    if (parsed.success && !pin) return { data: null, errors };
    if (parsed.success) return { data: parsed.data, errors: {} as FieldErrors };

    for (const issue of parsed.error.issues) {
      const key = issue.path.map(String).join(".") as FieldKey;
      if (!errors[key]) errors[key] = issue.message;
    }
    return { data: null, errors };
  };

  // Show errors live once the owner has tried to submit, so fixing a field clears its message.
  const errors: FieldErrors = hasTriedSubmit ? validate().errors : {};
  const hasErrors = Object.keys(errors).length > 0;

  const handleAmenityToggle = (amenity: string) => {
    setSelectedAmenities((current) =>
      current.includes(amenity) ? current.filter((a) => a !== amenity) : [...current, amenity]
    );
  };

  const buildImages = (): SpaceImage[] => {
    const cover: SpaceImage = { url: selectedImage, caption: "Main space", is_cover: true };
    if (!initial) return [cover];
    if (selectedImage === initialCoverUrl) return initial.images;
    return [
      cover,
      ...initial.images.filter((img) => img.url !== selectedImage).map((img) => ({ ...img, is_cover: false })),
    ];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setHasTriedSubmit(true);

    const { data, errors: nextErrors } = validate();
    if (!data) {
      const first = FIELD_ORDER.find((key) => nextErrors[key]);
      const el = first ? document.getElementById(fieldId(first)) : null;
      el?.focus();
      if (first === "coordinates") el?.scrollIntoView({ block: "center" });
      return;
    }
    if (!pin) return;

    const values: SpaceFormValues = {
      title: data.title,
      category,
      headline: headline.trim() || DEFAULT_HEADLINE,
      description: description.trim() || DEFAULT_DESCRIPTION,
      location: {
        ...initial?.location,
        city: data.city,
        address: data.address,
        country: data.country,
        coordinates: pin,
      },
      capacity: data.capacity,
      square_feet: data.squareFeet,
      pricing: {
        ...initial?.pricing,
        hourly: data.pricing.hourly ? data.pricing.hourly : undefined,
        daily: data.pricing.daily ? data.pricing.daily : undefined,
        monthly: data.pricing.monthly ? data.pricing.monthly : undefined,
        currency,
      },
      amenities: selectedAmenities,
      operating_hours: {
        open: data.openTime,
        close: data.closeTime,
        days: initial?.operating_hours.days ?? DEFAULT_DAYS,
      },
      house_rules: initial?.house_rules ?? DEFAULT_HOUSE_RULES,
      images: buildImages(),
      // New listings start as drafts; SpaceGo reviews them before they go live.
      status: mode === "edit" && initial ? initial.status : "draft",
      instant_book: instantBook,
    };

    setIsSubmitting(true);
    try {
      await onSubmit(values);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isUsd = currency === "USD";
  const priceLabel = (label: string) => (isUsd ? label : `${label} (${currency})`);
  const priceIcon = isUsd ? <span className="text-base">$</span> : undefined;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
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
                id={fieldId("title")}
                label="Title"
                required
                maxLength={200}
                placeholder="e.g. Quiet corner office near the station"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                error={errors.title}
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
          <Input
            id={fieldId("address")}
            label="Street address"
            required
            autoComplete="street-address"
            placeholder="e.g. 2nd floor, Carnival Infopark, Kakkanad"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            error={errors.address}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              id={fieldId("city")}
              label="City"
              required
              autoComplete="address-level2"
              placeholder="e.g. Kochi"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              error={errors.city}
            />
            <Input
              id={fieldId("country")}
              label="Country"
              required
              autoComplete="country-name"
              placeholder="e.g. India"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              error={errors.country}
            />
          </div>

          <div tabIndex={-1} id={fieldId("coordinates")} className="rounded-lg outline-none">
            <LocationPicker
              value={pin}
              onChange={setPin}
              errorId={`${fieldId("coordinates")}-msg`}
              error={errors.coordinates}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              id={fieldId("capacity")}
              label="Maximum people"
              type="number"
              inputMode="numeric"
              min={1}
              max={1_000_000}
              step={1}
              required
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              error={errors.capacity}
            />
            <Input
              id={fieldId("squareFeet")}
              label="Floor area (sq ft)"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              required
              value={squareFeet}
              onChange={(e) => setSquareFeet(e.target.value)}
              error={errors.squareFeet}
            />
          </div>
        </div>
      </Card>

      {/* Pricing & booking */}
      <Card>
        <CardHeader>
          <CardTitle>Prices and booking</CardTitle>
          <CardDescription>
            Prices are in {isUsd ? "US dollars" : currency}. Enter at least one.
          </CardDescription>
        </CardHeader>
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input
              id={fieldId("pricing.hourly")}
              label={priceLabel("Per hour")}
              type="number"
              inputMode="decimal"
              min={0}
              placeholder="e.g. 25"
              value={hourlyPrice}
              onChange={(e) => setHourlyPrice(e.target.value)}
              leftIcon={priceIcon}
              error={errors["pricing.hourly"] ?? errors.pricing}
            />
            <Input
              id={fieldId("pricing.daily")}
              label={priceLabel("Per day")}
              type="number"
              inputMode="decimal"
              min={0}
              placeholder="e.g. 120"
              value={dailyPrice}
              onChange={(e) => setDailyPrice(e.target.value)}
              leftIcon={priceIcon}
              error={errors["pricing.daily"]}
            />
            <Input
              id={fieldId("pricing.monthly")}
              label={priceLabel("Per month")}
              type="number"
              inputMode="decimal"
              min={0}
              placeholder="e.g. 2400"
              value={monthlyPrice}
              onChange={(e) => setMonthlyPrice(e.target.value)}
              leftIcon={priceIcon}
              error={errors["pricing.monthly"]}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              id={fieldId("openTime")}
              label="Opens"
              type="time"
              required
              value={openTime}
              onChange={(e) => setOpenTime(e.target.value)}
              helperText="Monday to Friday"
              error={errors.openTime}
            />
            <Input
              id={fieldId("closeTime")}
              label="Closes"
              type="time"
              required
              value={closeTime}
              onChange={(e) => setCloseTime(e.target.value)}
              error={errors.closeTime}
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
            {amenityOptions.map((amenity) => (
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
            {imageOptions.map((img) => {
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        {hasErrors && (
          <p role="alert" className="text-sm font-medium text-danger sm:mr-auto">
            Fix the highlighted fields before saving.
          </p>
        )}
        <div className="flex flex-col-reverse gap-3 sm:flex-row">
          <Link href="/owner/properties" className={buttonClasses({ variant: "outline" })}>
            Cancel
          </Link>
          <Button type="submit" isLoading={isSubmitting}>
            {submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}
