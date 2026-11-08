"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/navigation/Navbar";
import { Footer } from "@/components/navigation/Footer";
import { VerificationBadge, BookingStatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/context/AuthContext";
import { SpaceGoStore } from "@/lib/data/store";
import { Space, Booking } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import confetti from "canvas-confetti";
import {
  MapPin,
  Users,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Calendar,
  Wifi,
  Sparkles,
  Heart,
  Share2,
  ChevronRight,
  Info,
  Building2,
  Lock,
  Layers,
  Zap,
  Check,
  ArrowRight,
  ChevronLeft,
  X,
} from "lucide-react";

export default function SpaceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const unwrappedParams = use(params);
  const spaceId = unwrappedParams.id;
  const router = useRouter();
  const { user } = useAuth();
  const { success, error } = useToast();

  const [space, setSpace] = useState<Space | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);

  // Booking Form State
  const [bookingDate, setBookingDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  });
  const [durationType, setDurationType] = useState<"hourly" | "daily" | "monthly">("daily");
  const [durationUnits, setDurationUnits] = useState(1);
  const [seats, setSeats] = useState(1);
  const [specialRequests, setSpecialRequests] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Booking Confirmation Modal
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null);

  useEffect(() => {
    const found = SpaceGoStore.getSpaceById(spaceId);
    if (found) {
      setSpace(found);
      if (user) {
        const favs = SpaceGoStore.getUserFavourites(user.id);
        setIsFavorited(favs.includes(found.id));
      }
    }
  }, [spaceId, user]);

  if (!space) {
    return (
      <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <Building2 className="w-12 h-12 text-slate-300 mb-3" />
          <h2 className="text-xl font-bold text-slate-900">Workspace Not Found</h2>
          <p className="text-xs text-slate-500 mt-1 max-w-sm">
            The workspace you are looking for does not exist or may have been unlisted.
          </p>
          <Link href="/spaces" className="mt-4">
            <Button variant="teal">Browse All Workspaces</Button>
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  // Calculate pricing
  const calculateTotal = () => {
    let unitRate = 0;
    if (durationType === "hourly") unitRate = space.pricing.hourly || 20;
    else if (durationType === "daily") unitRate = space.pricing.daily || 100;
    else if (durationType === "monthly") unitRate = space.pricing.monthly || 1200;

    const baseCost = unitRate * durationUnits * (durationType === "daily" || durationType === "hourly" ? seats : 1);
    const serviceFee = Math.round(baseCost * 0.1);
    return {
      unitRate,
      baseCost,
      serviceFee,
      total: baseCost + serviceFee,
    };
  };

  const pricingSummary = calculateTotal();

  const handleFavoriteToggle = () => {
    if (user) {
      const next = SpaceGoStore.toggleFavourite(user.id, space.id);
      setIsFavorited(next);
      if (next) success("Saved to Favourites", "You can access this anytime from your dashboard.");
    } else {
      setIsFavorited(!isFavorited);
    }
  };

  const handleBookingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingDate) {
      error("Missing Date", "Please select a booking date.");
      return;
    }

    setIsSubmitting(true);

    try {
      const startIso = new Date(`${bookingDate}T09:00:00Z`).toISOString();
      const endIso = new Date(
        new Date(startIso).getTime() + (durationType === "hourly" ? durationUnits * 3600 * 1000 : durationUnits * 24 * 3600 * 1000)
      ).toISOString();

      const bookingUser = user
        ? { id: user.id, name: user.full_name, email: user.email }
        : { id: "guest-user", name: "Guest Seeker", email: "guest@example.com" };

      const result = SpaceGoStore.createBooking({
        space,
        user: bookingUser,
        start_date: startIso,
        end_date: endIso,
        duration_type: durationType,
        duration_units: durationUnits,
        seats,
        total_price: pricingSummary.total,
        special_requests: specialRequests,
      });

      if (!result.success) {
        error("Booking Conflict Detected", result.error || "Slot is currently unavailable.");
        setIsSubmitting(false);
        return;
      }

      // Success
      setConfirmedBooking(result.booking || null);
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
      });
      success(
        "Booking Request Submitted!",
        result.booking?.status === "approved"
          ? "Confirmed instantly! Your electronic pass is ready."
          : `Sent to host ${space.owner_name} for approval.`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
      <Navbar />

      {/* Breadcrumb Navigation */}
      <div className="bg-white border-b border-slate-200/80 py-3">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-2 text-xs text-slate-500">
          <Link href="/" className="hover:text-slate-900 transition-colors">
            Home
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <Link href="/spaces" className="hover:text-slate-900 transition-colors">
            Workspaces
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-900 font-semibold truncate max-w-[200px] sm:max-w-md">
            {space.title}
          </span>
        </div>
      </div>

      {/* Main Detail Header (Airbnb Layout) */}
      <div className="bg-white border-b border-slate-200/80 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <VerificationBadge level={space.verification_level} />
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 uppercase tracking-wider">
                  {space.category.replace("_", " ")}
                </span>
                <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  ★ {space.rating} ({space.review_count} reviews)
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
                {space.title}
              </h1>
              <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-600">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                <span>{space.location.address}, {space.location.city}, {space.location.country}</span>
                {space.location.landmark && (
                  <span className="text-slate-400 hidden sm:inline">• Near {space.location.landmark}</span>
                )}
              </div>
            </div>

            {/* Favorite & Share Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleFavoriteToggle}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <Heart className={`w-4 h-4 ${isFavorited ? "fill-rose-500 text-rose-500" : "text-slate-500"}`} />
                <span>{isFavorited ? "Saved" : "Save"}</span>
              </button>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(window.location.href);
                  success("Link Copied", "Workspace link copied to clipboard.");
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <Share2 className="w-4 h-4 text-slate-500" />
                <span>Share</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Image Gallery Bento Grid (Airbnb 5-Photo Hero) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 h-80 sm:h-[420px] rounded-3xl overflow-hidden shadow-xs border border-slate-200">
          
          {/* Main Cover Image */}
          <div
            className="md:col-span-2 h-full relative cursor-pointer group bg-slate-100 overflow-hidden"
            onClick={() => {
              setActiveImageIndex(0);
              setIsGalleryOpen(true);
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={space.images[0]?.url}
              alt={space.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-slate-950/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold">
              Click to enlarge photo
            </div>
          </div>

          {/* Right Secondary Images */}
          <div className="hidden md:grid md:col-span-2 grid-cols-2 gap-3 h-full">
            {space.images.slice(1, 5).map((img, idx) => (
              <div
                key={idx}
                className="relative h-[202px] cursor-pointer group bg-slate-100 overflow-hidden"
                onClick={() => {
                  setActiveImageIndex(idx + 1);
                  setIsGalleryOpen(true);
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={img.caption || `Photo ${idx + 2}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-slate-950/20 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* Content & Booking Panel Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Details & Space Passport */}
          <div className="lg:col-span-7 space-y-8">
            
            {/* Quick Specs Bar */}
            <div className="grid grid-cols-3 gap-3 p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs text-center">
              <div>
                <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">Capacity</span>
                <span className="text-base font-black text-slate-950 mt-0.5 inline-flex items-center gap-1">
                  <Users className="w-4 h-4 text-teal-600" /> Up to {space.capacity}
                </span>
              </div>
              <div>
                <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">Floor Area</span>
                <span className="text-base font-black text-slate-950 mt-0.5 inline-flex items-center gap-1">
                  <Layers className="w-4 h-4 text-teal-600" /> {space.square_feet.toLocaleString()} sq.ft.
                </span>
              </div>
              <div>
                <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">Confirmation</span>
                <span className="text-base font-black text-slate-950 mt-0.5 inline-flex items-center gap-1">
                  <Sparkles className="w-4 h-4 text-teal-600" /> {space.instant_book ? "Instant Book" : "Host Approval"}
                </span>
              </div>
            </div>

            {/* Description */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-3">
              <h2 className="text-base font-bold text-slate-950">About This Workspace</h2>
              <p className="text-sm text-slate-600 leading-relaxed font-normal">
                {space.description}
              </p>
            </div>

            {/* Space Passport™ Verification Breakdown */}
            <div className="bg-gradient-to-br from-teal-50/60 via-white to-slate-50 rounded-2xl border border-teal-200/90 p-6 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-teal-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-950">
                      SpaceGo Space Passport™ Audit Record
                    </h3>
                    <p className="text-[11px] text-teal-800">
                      Inspected on {formatDate(space.passport.inspected_at)} • Official Safety Certification
                    </p>
                  </div>
                </div>
                <VerificationBadge level={space.verification_level} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-teal-100/80">
                  <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-bold text-slate-950">Authority & Permitted Use</span>
                    <p className="text-[11px] text-slate-500">Commercial zoning and legal operating authority verified.</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-teal-100/80">
                  <Wifi className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-bold text-slate-950">Tested Connectivity</span>
                    <p className="text-[11px] text-slate-500">
                      Field-measured: <span className="font-bold text-teal-700">{space.passport.connectivity_tested_mbps} Mbps</span> redundant fiber.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-teal-100/80">
                  <Zap className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-bold text-slate-950">Power Redundancy</span>
                    <p className="text-[11px] text-slate-500">
                      {space.passport.power_backup_tested ? "UPS & Standby generator backup tested." : "Standard utility grid."}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-teal-100/80">
                  <Lock className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-bold text-slate-950">Fire & Life Safety</span>
                    <p className="text-[11px] text-slate-500">
                      {space.passport.fire_safety_inspected ? "Emergency exits, extinguishers & alarms inspected." : "Checks pending."}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-teal-100/40 text-[11px] text-teal-950 font-medium">
                Audited by: {space.passport.inspected_by} • Next renewal scheduled for {formatDate(space.passport.renewal_date)}
              </div>
            </div>

            {/* Amenities & Equipment */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-4">
              <h2 className="text-base font-bold text-slate-950">Amenities & Facilities</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {space.amenities.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2.5 text-xs font-medium text-slate-700">
                    <div className="w-5 h-5 rounded-md bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Operating Hours & House Rules */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-4">
              <h2 className="text-base font-bold text-slate-950">Operating Hours & House Rules</h2>
              
              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <Clock className="w-5 h-5 text-teal-600 shrink-0" />
                <div>
                  <span className="font-bold text-slate-950">
                    {space.operating_hours.open} – {space.operating_hours.close}
                  </span>
                  <span className="text-slate-500 ml-2">
                    Open {space.operating_hours.days.join(", ")}
                  </span>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Rules & Guidelines</span>
                <ul className="space-y-1.5 text-xs text-slate-600">
                  {space.house_rules.map((rule, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-teal-600 font-bold">•</span>
                      <span>{rule}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Host Profile Card */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={space.owner_avatar}
                alt={space.owner_name}
                className="w-12 h-12 rounded-xl object-cover border border-slate-200"
              />
              <div className="flex-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Hosted by</span>
                <h3 className="text-sm font-bold text-slate-950">{space.owner_name}</h3>
                <p className="text-xs text-slate-500">SpaceGo Partner Host • Fast response rate (under 1 hour)</p>
              </div>
            </div>

          </div>

          {/* Right Column: Interactive Booking Panel (Airbnb / Uber friction-free) */}
          <div className="lg:col-span-5 sticky top-24">
            <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xl space-y-6">
              
              {/* Pricing Header */}
              <div className="flex items-baseline justify-between border-b border-slate-100 pb-4">
                <div>
                  <span className="text-2xl font-black text-slate-950">
                    {formatCurrency(pricingSummary.unitRate, space.pricing.currency)}
                  </span>
                  <span className="text-xs font-medium text-slate-500 ml-1">
                    / {durationType}
                  </span>
                </div>
                <div className="text-xs font-semibold text-teal-800 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200">
                  {space.instant_book ? "⚡ Instant Reservation" : "⏳ Host Approval Required"}
                </div>
              </div>

              <form onSubmit={handleBookingSubmit} className="space-y-4">
                
                {/* Duration Type Tabs */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Duration Model
                  </label>
                  <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl">
                    {(["hourly", "daily", "monthly"] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => {
                          setDurationType(type);
                          setDurationUnits(1);
                        }}
                        className={`text-xs py-2 rounded-lg font-semibold capitalize transition-all cursor-pointer ${
                          durationType === type
                            ? "bg-white text-slate-950 shadow-xs"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Booking Date */}
                <div>
                  <Input
                    label="Date *"
                    type="date"
                    required
                    value={bookingDate}
                    min={new Date().toISOString().split("T")[0]}
                    onChange={(e) => setBookingDate(e.target.value)}
                    leftIcon={<Calendar className="w-4 h-4 text-slate-400" />}
                  />
                </div>

                {/* Units & Capacity */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                      {durationType === "hourly" ? "Hours" : durationType === "daily" ? "Days" : "Months"}
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={durationType === "hourly" ? 12 : 30}
                      value={durationUnits}
                      onChange={(e) => setDurationUnits(Math.max(1, Number(e.target.value)))}
                      leftIcon={<Clock className="w-4 h-4 text-slate-400" />}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                      Guests / Seats
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={space.capacity}
                      value={seats}
                      onChange={(e) => setSeats(Math.max(1, Number(e.target.value)))}
                      leftIcon={<Users className="w-4 h-4 text-slate-400" />}
                    />
                  </div>
                </div>

                {/* Special Requests */}
                <div>
                  <Textarea
                    label="Special Notes or Requirements"
                    rows={2}
                    placeholder="e.g. Quiet focus desk, dual monitors, client guest passes..."
                    value={specialRequests}
                    onChange={(e) => setSpecialRequests(e.target.value)}
                  />
                </div>

                {/* Price Breakdown Calculation */}
                <div className="pt-3 border-t border-slate-100 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>
                      {formatCurrency(pricingSummary.unitRate, space.pricing.currency)} × {durationUnits}{" "}
                      {durationType === "hourly" ? "hrs" : durationType === "daily" ? "days" : "mo"}
                      {durationType !== "monthly" && ` × ${seats} seats`}
                    </span>
                    <span className="font-semibold text-slate-950">
                      {formatCurrency(pricingSummary.baseCost, space.pricing.currency)}
                    </span>
                  </div>

                  <div className="flex justify-between text-slate-600">
                    <span className="flex items-center gap-1">
                      Platform service & security fee (10%)
                      <Info className="w-3 h-3 text-slate-400" />
                    </span>
                    <span className="font-semibold text-slate-950">
                      {formatCurrency(pricingSummary.serviceFee, space.pricing.currency)}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline">
                    <span className="text-sm font-bold text-slate-950">Total Price</span>
                    <span className="text-xl font-black text-slate-950">
                      {formatCurrency(pricingSummary.total, space.pricing.currency)}
                    </span>
                  </div>
                </div>

                {/* Submit Booking Request Button */}
                <Button
                  type="submit"
                  variant="teal"
                  size="lg"
                  className="w-full font-bold shadow-md shadow-teal-700/20 rounded-full"
                  isLoading={isSubmitting}
                >
                  <span>{space.instant_book ? "Confirm & Book Now" : "Request to Book"}</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>

                <p className="text-[11px] text-center text-slate-400">
                  {space.instant_book
                    ? "Instant confirmation. Double-booking conflict check passed."
                    : "You will not be billed until the host confirms availability."}
                </p>
              </form>

            </div>
          </div>

        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmedBooking && (
        <Modal
          isOpen={Boolean(confirmedBooking)}
          onClose={() => setConfirmedBooking(null)}
          title="Booking Request Confirmed!"
          description="Your workspace reservation is registered in the SpaceGo network."
          maxWidth="md"
        >
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-teal-50 border border-teal-200 text-teal-950 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs uppercase font-bold text-teal-700">Reference Code</span>
                <span className="text-sm font-black font-mono tracking-wider">{confirmedBooking.id}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs uppercase font-bold text-teal-700">Status</span>
                <BookingStatusBadge status={confirmedBooking.status} />
              </div>
              {confirmedBooking.access_code && (
                <div className="flex justify-between items-center pt-2 border-t border-teal-200/60">
                  <span className="text-xs uppercase font-bold text-teal-700">Electronic Access Pass</span>
                  <span className="text-xs font-mono font-bold bg-white px-2 py-0.5 rounded border border-teal-300">
                    {confirmedBooking.access_code}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-2 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Workspace:</span>
                <span className="font-semibold text-slate-900">{confirmedBooking.space_title}</span>
              </div>
              <div className="flex justify-between">
                <span>Scheduled Date:</span>
                <span className="font-semibold text-slate-900">{formatDate(confirmedBooking.start_date)}</span>
              </div>
              <div className="flex justify-between">
                <span>Total Amount:</span>
                <span className="font-semibold text-slate-900">
                  {formatCurrency(confirmedBooking.total_price, confirmedBooking.currency)}
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmedBooking(null)}
              >
                Close
              </Button>
              <Link href="/dashboard/bookings">
                <Button variant="teal" size="sm">
                  View in My Bookings
                </Button>
              </Link>
            </div>
          </div>
        </Modal>
      )}

      {/* Gallery Lightbox Modal */}
      <Modal
        isOpen={isGalleryOpen}
        onClose={() => setIsGalleryOpen(false)}
        maxWidth="4xl"
      >
        <div className="space-y-4">
          <div className="relative h-96 sm:h-[480px] bg-slate-950 rounded-2xl overflow-hidden flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={space.images[activeImageIndex]?.url}
              alt={space.images[activeImageIndex]?.caption || "Gallery"}
              className="max-h-full max-w-full object-contain"
            />
          </div>
          <div className="text-xs text-slate-500 text-center font-medium">
            {space.images[activeImageIndex]?.caption || `Photo ${activeImageIndex + 1} of ${space.images.length}`}
          </div>
          <div className="flex items-center justify-center gap-2 overflow-x-auto py-2">
            {space.images.map((img, idx) => (
              <button
                key={idx}
                onClick={() => setActiveImageIndex(idx)}
                className={`relative w-16 h-16 rounded-xl overflow-hidden border-2 transition-all shrink-0 cursor-pointer ${
                  activeImageIndex === idx ? "border-teal-500 scale-105" : "border-transparent opacity-60 hover:opacity-100"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      </Modal>

      <Footer />
    </div>
  );
}
