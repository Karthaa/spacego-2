"use client";

import React, { useState, useMemo, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Check,
  Clock,
  Grid2x2,
  Heart,
  Info,
  MapPin,
  Share2,
  Users,
  Zap,
} from "lucide-react";
import { Navbar } from "@/components/navigation/Navbar";
import { Footer } from "@/components/navigation/Footer";
import { VerificationBadge, BookingStatusBadge } from "@/components/ui/Badge";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { SafeImage } from "@/components/ui/SafeImage";
import { SpaceLocationSection } from "@/components/discover/SpaceLocationSection";
import { SpaceReviews } from "@/components/reviews/SpaceReviews";
import { ReportListing } from "@/components/trust/ReportListing";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/context/AuthContext";
import { SpaceGoStore } from "@/lib/data/store";
import { useSpaceGoVersion } from "@/context/SpaceGoDataProvider";
import { categoryNoun } from "@/lib/categories";
import { Booking, Space } from "@/types";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

type DurationType = "hourly" | "daily" | "monthly";

const DURATION_LABEL: Record<DurationType, { option: string; unit: string; units: string; max: number }> = {
  hourly: { option: "By the hour", unit: "hour", units: "hours", max: 12 },
  daily: { option: "By the day", unit: "day", units: "days", max: 30 },
  monthly: { option: "By the month", unit: "month", units: "months", max: 36 },
};

function availableDurations(space: Space): DurationType[] {
  return (["hourly", "daily", "monthly"] as const).filter((d) => Boolean(space.pricing[d]));
}

export default function SpaceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: spaceId } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const { success, error } = useToast();
  const dataVersion = useSpaceGoVersion();

  // Derived from the store snapshot; re-read whenever the store changes.
  const space = useMemo(() => {
    void dataVersion;
    return SpaceGoStore.getSpaceById(spaceId);
  }, [spaceId, dataVersion]);

  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
  const [isSavingFavourite, setIsSavingFavourite] = useState(false);

  const isFavorited = useMemo(() => {
    void dataVersion;
    if (!user || !space) return false;
    return SpaceGoStore.getUserFavourites(user.id).includes(space.id);
  }, [user, space, dataVersion]);

  if (!space) {
    return (
      <div className="flex min-h-screen flex-col bg-canvas">
        <Navbar />
        <main id="main" className="mx-auto flex w-full max-w-3xl flex-1 items-center px-4 py-16">
          {/* Same look as <EmptyState>, but the title is this page's h1. */}
          <div className="flex w-full flex-col items-center justify-center rounded-lg border border-dashed border-line-strong bg-surface px-6 py-12 text-center sm:px-12">
            <span
              aria-hidden="true"
              className="mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-surface-muted text-ink-subtle"
            >
              <Building2 className="h-6 w-6" />
            </span>
            <h1 className="text-lg font-semibold text-ink">This space isn&apos;t available</h1>
            <p className="mt-1.5 max-w-md text-base text-ink-muted">
              It may have been unpublished by the host, or the link may be wrong.
            </p>
            <div className="mt-6">
              <Link href="/spaces" className={buttonClasses()}>
                Browse spaces
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const images = space.images.length > 0 ? space.images : [];
  // The street address is public only when the host chose to show it; the
  // database also strips it from public reads otherwise.
  const streetAddress = space.location.address_visibility === "exact" ? space.location.address : "";
  const place = [streetAddress, space.location.city, space.location.country].filter(Boolean).join(", ");

  const handleFavoriteToggle = async () => {
    if (!user) {
      error("Sign in to save spaces", "Create an account or log in to keep a list of favourites.");
      router.push(`/auth/login?redirect=${encodeURIComponent(`/spaces/${space.id}`)}`);
      return;
    }
    if (isSavingFavourite) return;
    setIsSavingFavourite(true);
    const result = await SpaceGoStore.toggleFavourite(user.id, space.id);
    setIsSavingFavourite(false);

    if (!result.ok) {
      error("Could not update favourites", result.error);
      return;
    }
    success(result.data ? "Saved to your favourites" : "Removed from your favourites");
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard?.writeText(window.location.href);
      success("Link copied");
    } catch {
      error("Could not copy the link", "Copy it from your browser's address bar instead.");
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <Navbar />

      <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <Link
          href="/spaces"
          className="inline-flex min-h-11 items-center gap-2 rounded-sm text-sm font-medium text-ink-muted transition-colors duration-150 hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          All spaces
        </Link>

        {/* Title */}
        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{space.title}</h1>
            {/* No ratings: there is no reviews feature yet (stored values are demo data). */}
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-base text-ink-muted">
              {place && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" aria-hidden="true" />
                  {place}
                </span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" onClick={() => void handleShare()}>
              <Share2 className="h-4 w-4" aria-hidden="true" />
              Share
            </Button>
            <Button
              variant="outline"
              onClick={() => void handleFavoriteToggle()}
              disabled={isSavingFavourite}
              aria-pressed={isFavorited}
            >
              <Heart className={cn("h-4 w-4", isFavorited && "fill-rose-500 text-rose-500")} aria-hidden="true" />
              {isFavorited ? "Saved" : "Save"}
            </Button>
          </div>
        </div>

        {/* Gallery */}
        <Gallery images={images} title={space.title} onOpen={setGalleryIndex} />

        <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_24rem]">
          <div className="min-w-0 space-y-10">
            {/* Summary */}
            <section className="border-b border-line pb-8">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-lg font-semibold text-ink">{categoryNoun(space.category)}</span>
                {space.owner_name && <span className="text-lg text-ink-muted">hosted by {space.owner_name}</span>}
              </div>
              <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-base text-ink-muted">
                <li className="flex items-center gap-2">
                  <Users className="h-5 w-5" aria-hidden="true" />
                  Up to {space.capacity} {space.capacity === 1 ? "person" : "people"}
                </li>
                {space.square_feet > 0 && (
                  <li className="flex items-center gap-2">
                    <Grid2x2 className="h-5 w-5" aria-hidden="true" />
                    {space.square_feet.toLocaleString()} sq ft
                  </li>
                )}
                <li className="flex items-center gap-2">
                  {space.instant_book ? (
                    <>
                      <Zap className="h-5 w-5" aria-hidden="true" />
                      Instant Book
                    </>
                  ) : (
                    <>
                      <Clock className="h-5 w-5" aria-hidden="true" />
                      Host confirms each request
                    </>
                  )}
                </li>
              </ul>
              <div className="mt-4">
                <VerificationBadge level={space.verification_level} />
              </div>
            </section>

            {(space.headline || space.description) && (
              <section aria-labelledby="about-heading">
                <h2 id="about-heading" className="text-xl font-semibold text-ink">About this space</h2>
                {space.headline && <p className="mt-3 text-base font-medium text-ink">{space.headline}</p>}
                {space.description && (
                  <p className="mt-2 whitespace-pre-line text-base leading-relaxed text-ink-muted">{space.description}</p>
                )}
              </section>
            )}

            {space.amenities.length > 0 && (
              <section aria-labelledby="amenities-heading">
                <h2 id="amenities-heading" className="text-xl font-semibold text-ink">What this space offers</h2>
                <p className="mt-1 text-sm text-ink-muted">As listed by the host.</p>
                <ul className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                  {space.amenities.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-base text-ink">
                      <Check className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <ReviewDetails space={space} />

            <SpaceLocationSection space={space} />

            <SpaceReviews space={space} />

            <section aria-labelledby="hours-heading">
              <h2 id="hours-heading" className="text-xl font-semibold text-ink">Opening hours and rules</h2>
              {space.operating_hours.open && space.operating_hours.close ? (
                <p className="mt-3 flex items-center gap-2 text-base text-ink">
                  <Clock className="h-5 w-5 text-ink-subtle" aria-hidden="true" />
                  {space.operating_hours.open}&ndash;{space.operating_hours.close}
                  {space.operating_hours.days.length > 0 && (
                    <span className="text-ink-muted">&middot; {space.operating_hours.days.join(", ")}</span>
                  )}
                </p>
              ) : (
                <p className="mt-3 text-base text-ink-muted">Ask the host about opening hours in your booking request.</p>
              )}
              {space.house_rules.length > 0 && (
                <ul className="mt-4 list-disc space-y-1.5 pl-5 text-base text-ink-muted marker:text-ink-subtle">
                  {space.house_rules.map((rule) => (
                    <li key={rule}>{rule}</li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="host-heading" className="flex items-center gap-4 rounded-lg border border-line bg-surface p-5">
              {space.owner_avatar ? (
                <SafeImage
                  src={space.owner_avatar}
                  alt=""
                  width={48}
                  height={48}
                  wrapperClassName="h-12 w-12 shrink-0 rounded-full"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-lg font-semibold text-accent-soft-ink"
                >
                  {(space.owner_name || "H").charAt(0).toUpperCase()}
                </span>
              )}
              <div>
                <h2 id="host-heading" className="text-base font-semibold text-ink">
                  Hosted by {space.owner_name || "a SpaceGo host"}
                </h2>
                <p className="text-sm text-ink-muted">You can add questions for the host to your booking request.</p>
              </div>
            </section>

            <div className="-mt-4">
              <ReportListing
                space={space}
                onSignInRequired={() => router.push(`/auth/login?redirect=${encodeURIComponent(`/spaces/${space.id}`)}`)}
              />
            </div>
          </div>

          <div>
            <BookingPanel space={space} onSignInRequired={() => router.push(`/auth/login?redirect=${encodeURIComponent(`/spaces/${space.id}`)}`)} />
          </div>
        </div>
      </main>

      {/* Gallery lightbox */}
      <Modal isOpen={galleryIndex !== null} onClose={() => setGalleryIndex(null)} title={space.title} maxWidth="4xl">
        {galleryIndex !== null && images[galleryIndex] && (
          <div className="space-y-4">
            <div className="relative h-[60vh] overflow-hidden rounded-md bg-surface-muted">
              <SafeImage
                fill
                src={images[galleryIndex].url}
                alt={images[galleryIndex].caption || `Photo ${galleryIndex + 1}`}
                sizes="(min-width: 896px) 54rem, 100vw"
                loading="eager"
                className="object-contain"
              />
            </div>
            <p className="text-center text-sm text-ink-muted">
              {images[galleryIndex].caption || `Photo ${galleryIndex + 1}`} &middot; {galleryIndex + 1} of {images.length}
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {images.map((img, idx) => (
                <button
                  key={`${img.url}-${idx}`}
                  type="button"
                  onClick={() => setGalleryIndex(idx)}
                  aria-label={`Show photo ${idx + 1}`}
                  aria-current={galleryIndex === idx}
                  className={cn(
                    "relative h-16 w-20 shrink-0 overflow-hidden rounded-sm border-2 transition-[opacity,border-color] duration-150",
                    galleryIndex === idx
                      ? "border-accent"
                      : "border-transparent opacity-70 hover:opacity-100 focus-visible:opacity-100"
                  )}
                >
                  <SafeImage fill src={img.url} alt="" sizes="80px" />
                </button>
              ))}
            </div>
          </div>
        )}
      </Modal>

      <Footer />
    </div>
  );
}

function Gallery({
  images,
  title,
  onOpen,
}: {
  images: Space["images"];
  title: string;
  onOpen: (index: number) => void;
}) {
  if (images.length === 0) {
    return (
      <div className="mt-6 flex aspect-[16/9] items-center justify-center rounded-lg bg-surface-muted text-ink-subtle sm:aspect-[21/9]">
        <Building2 className="h-10 w-10" aria-hidden="true" />
        <span className="sr-only">No photos yet</span>
      </div>
    );
  }

  // Mosaic on md+: a large lead photo plus 4 tiles (2x2), or 1-2 tiles in a
  // 3-column layout when there are fewer photos. Fixed height keeps rows even.
  const rest = images.length >= 5 ? images.slice(1, 5) : images.slice(1, 3);
  const cols = rest.length >= 4 ? "md:grid-cols-4" : rest.length > 0 ? "md:grid-cols-3" : "";
  // Hover dims the photo slightly; focus gets an inset ring (the grid clips outer outlines).
  const tile =
    "relative min-h-0 overflow-hidden bg-surface-muted transition-opacity duration-150 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

  return (
    <div className="relative mt-6">
      <div className={cn("grid gap-2 overflow-hidden rounded-lg md:h-[28rem] md:grid-rows-2", cols)}>
        <button
          type="button"
          onClick={() => onOpen(0)}
          className={cn(
            tile,
            "block aspect-[4/3] md:aspect-auto md:h-full md:row-span-2",
            rest.length > 0 && "md:col-span-2"
          )}
          aria-label={`Open photo 1 of ${images.length}: ${images[0].caption || title}`}
        >
          {/* The lead photo is above the fold: load it straight away. */}
          <SafeImage
            fill
            src={images[0].url}
            alt=""
            sizes={rest.length > 0 ? "(min-width: 768px) 50vw, 100vw" : "100vw"}
            loading="eager"
            fetchPriority="high"
          />
        </button>
        {rest.map((img, idx) => (
          <button
            key={`${img.url}-${idx}`}
            type="button"
            onClick={() => onOpen(idx + 1)}
            className={cn(tile, "hidden md:block", rest.length === 1 && "md:row-span-2")}
            aria-label={`Open photo ${idx + 2} of ${images.length}${img.caption ? `: ${img.caption}` : ""}`}
          >
            <SafeImage fill src={img.url} alt="" sizes="25vw" />
          </button>
        ))}
      </div>
      {images.length > 1 && (
        <Button variant="outline" size="sm" className="absolute bottom-3 right-3" onClick={() => onOpen(0)}>
          Show all {images.length} photos
        </Button>
      )}
    </div>
  );
}

/** Only shows facts an admin recorded during a SpaceGo review. */
function ReviewDetails({ space }: { space: Space }) {
  const p = space.passport;
  const facts = [
    p.connectivity_tested_mbps > 0 && `Internet speed measured at ${p.connectivity_tested_mbps} Mbps`,
    p.power_backup_tested && "Backup power available",
    p.fire_safety_inspected && "Fire safety equipment checked",
    p.permitted_use_confirmed && "Use as a workspace confirmed with the owner",
    p.identity_verified && "Host identity checked",
    p.property_authority_verified && "Host's right to list this space confirmed",
  ].filter(Boolean) as string[];

  if (facts.length === 0) return null;

  return (
    <section aria-labelledby="review-heading">
      <h2 id="review-heading" className="text-xl font-semibold text-ink">What SpaceGo checked</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Recorded by the SpaceGo team{p.inspected_at ? ` on ${formatDate(p.inspected_at)}` : ""}. Conditions can change; confirm anything important with the host.
      </p>
      <ul className="mt-4 space-y-2">
        {facts.map((fact) => (
          <li key={fact} className="flex items-start gap-3 text-base text-ink">
            <Check className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
            {fact}
          </li>
        ))}
      </ul>
    </section>
  );
}

function BookingPanel({ space, onSignInRequired }: { space: Space; onSignInRequired: () => void }) {
  const { user } = useAuth();
  const { success, error } = useToast();
  const durations = availableDurations(space);

  const [bookingDate, setBookingDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  });
  const [durationType, setDurationType] = useState<DurationType>(
    durations.includes("daily") ? "daily" : durations[0] ?? "daily"
  );
  const [durationUnits, setDurationUnits] = useState(1);
  const [seats, setSeats] = useState(1);
  const [specialRequests, setSpecialRequests] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null);

  const unitRate = space.pricing[durationType] ?? 0;
  const perSeat = durationType !== "monthly";
  const baseCost = unitRate * durationUnits * (perSeat ? seats : 1);
  const serviceFee = Math.round(baseCost * 0.1);
  const total = baseCost + serviceFee;
  const currency = space.pricing.currency;
  const label = DURATION_LABEL[durationType];

  if (durations.length === 0) {
    return (
      <aside className="rounded-lg border border-line bg-surface p-6 lg:sticky lg:top-24">
        <p className="text-base text-ink">This host hasn&apos;t set prices yet.</p>
        <p className="mt-1 text-sm text-ink-muted">Check back later or browse other spaces.</p>
      </aside>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingDate) {
      error("Choose a date", "Select the day your booking starts.");
      return;
    }
    if (!user) {
      error("Sign in to book", "Log in or create an account to send a booking request.");
      onSignInRequired();
      return;
    }

    setIsSubmitting(true);
    try {
      const startIso = new Date(`${bookingDate}T09:00:00Z`).toISOString();
      // Must match the server's duration rule: hourly = N hours, daily = N
      // days, monthly = N x 30 days (spacego_create_booking).
      const unitMs =
        durationType === "hourly" ? 3600 * 1000 : durationType === "daily" ? 24 * 3600 * 1000 : 30 * 24 * 3600 * 1000;
      const endIso = new Date(new Date(startIso).getTime() + durationUnits * unitMs).toISOString();

      const result = await SpaceGoStore.createBooking({
        space,
        user: { id: user.id, name: user.full_name, email: user.email },
        start_date: startIso,
        end_date: endIso,
        duration_type: durationType,
        duration_units: durationUnits,
        seats,
        total_price: total,
        special_requests: specialRequests,
      });

      if (!result.ok) {
        error("Booking not completed", result.error);
        return;
      }

      // Show what the server actually recorded.
      setConfirmedBooking(result.data);
      success(
        result.data.status === "approved" ? "Booking confirmed" : "Request sent",
        result.data.status === "approved"
          ? "Your access code is ready in your bookings."
          : `We'll let you know when ${space.owner_name || "the host"} responds.`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <aside aria-labelledby="booking-heading" className="rounded-lg border border-line bg-surface p-6 shadow-sm lg:sticky lg:top-24">
        <h2 id="booking-heading" className="sr-only">Book this space</h2>
        <p className="text-ink">
          <span className="text-2xl font-semibold">{formatCurrency(unitRate, currency)}</span>
          <span className="text-base text-ink-muted"> / {label.unit}{perSeat ? " per person" : ""}</span>
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {durations.length > 1 && (
            <Select
              label="Booking length"
              value={durationType}
              onChange={(e) => {
                setDurationType(e.target.value as DurationType);
                setDurationUnits(1);
              }}
            >
              {durations.map((d) => (
                <option key={d} value={d}>{DURATION_LABEL[d].option}</option>
              ))}
            </Select>
          )}

          <Input
            label="Start date"
            type="date"
            required
            value={bookingDate}
            min={new Date().toISOString().split("T")[0]}
            onChange={(e) => setBookingDate(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label={label.units.charAt(0).toUpperCase() + label.units.slice(1)}
              type="number"
              inputMode="numeric"
              min={1}
              max={label.max}
              value={durationUnits}
              onChange={(e) => setDurationUnits(Math.min(label.max, Math.max(1, Number(e.target.value) || 1)))}
            />
            <Input
              label="People"
              type="number"
              inputMode="numeric"
              min={1}
              max={space.capacity || undefined}
              value={seats}
              onChange={(e) => setSeats(Math.max(1, Number(e.target.value) || 1))}
              error={space.capacity && seats > space.capacity ? `Up to ${space.capacity}` : undefined}
            />
          </div>

          <Textarea
            label="Message to the host (optional)"
            rows={3}
            placeholder="Anything the host should know"
            value={specialRequests}
            onChange={(e) => setSpecialRequests(e.target.value)}
          />

          <dl className="space-y-2 border-t border-line pt-4 text-base">
            <div className="flex justify-between gap-4 text-ink-muted">
              <dt>
                {formatCurrency(unitRate, currency)} &times; {durationUnits} {durationUnits === 1 ? label.unit : label.units}
                {perSeat && <> &times; {seats} {seats === 1 ? "person" : "people"}</>}
              </dt>
              <dd className="text-ink">{formatCurrency(baseCost, currency)}</dd>
            </div>
            <div className="flex justify-between gap-4 text-ink-muted">
              <dt className="flex items-center gap-1">
                Service fee (10%)
              </dt>
              <dd className="text-ink">{formatCurrency(serviceFee, currency)}</dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-line pt-2 font-semibold text-ink">
              <dt>Estimated total</dt>
              <dd>{formatCurrency(total, currency)}</dd>
            </div>
          </dl>

          <Button type="submit" size="lg" className="w-full" isLoading={isSubmitting}>
            {space.instant_book ? "Book now" : "Request to book"}
          </Button>

          <p className="flex items-start gap-2 text-sm text-ink-muted">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {space.instant_book
              ? "Instant Book: confirmed as soon as SpaceGo checks the dates are free. No payment is taken on SpaceGo."
              : "The host reviews your request before it's confirmed. The final price is calculated by SpaceGo when you book. No payment is taken on SpaceGo."}
          </p>
        </form>
      </aside>

      <Modal
        isOpen={Boolean(confirmedBooking)}
        onClose={() => setConfirmedBooking(null)}
        title={confirmedBooking?.status === "approved" ? "Booking confirmed" : "Request sent"}
        description={
          confirmedBooking?.status === "approved"
            ? "Your booking is confirmed."
            : "The host will review your request. You'll get a notification when they respond."
        }
        maxWidth="md"
      >
        {confirmedBooking && (
          <div className="space-y-5">
            <dl className="space-y-3 text-base">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-ink-muted">Reference</dt>
                <dd className="font-mono text-ink">{confirmedBooking.id}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-ink-muted">Status</dt>
                <dd><BookingStatusBadge status={confirmedBooking.status} /></dd>
              </div>
              {confirmedBooking.access_code && (
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-ink-muted">Access code</dt>
                  <dd className="font-mono font-semibold text-ink">{confirmedBooking.access_code}</dd>
                </div>
              )}
              <div className="flex items-center justify-between gap-4">
                <dt className="text-ink-muted">Starts</dt>
                <dd className="text-ink">{formatDate(confirmedBooking.start_date)}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-ink-muted">Total</dt>
                <dd className="font-semibold text-ink">
                  {formatCurrency(confirmedBooking.total_price, confirmedBooking.currency)}
                </dd>
              </div>
            </dl>
            <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setConfirmedBooking(null)}>
                Close
              </Button>
              <Link href="/dashboard/bookings" className={buttonClasses()}>
                View my bookings
              </Link>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
