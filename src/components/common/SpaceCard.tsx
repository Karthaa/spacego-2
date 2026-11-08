"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Space } from "@/types";
import { VerificationBadge } from "@/components/ui/Badge";
import { formatCurrency } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { SpaceGoStore } from "@/lib/data/store";
import {
  MapPin,
  Users,
  Heart,
  Star,
  Zap,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Check,
} from "lucide-react";

interface SpaceCardProps {
  space: Space;
  isFavorited?: boolean;
  onFavoriteToggle?: (spaceId: string) => void;
}

export function SpaceCard({ space, isFavorited = false, onFavoriteToggle }: SpaceCardProps) {
  const { user } = useAuth();
  const [favorited, setFavorited] = useState(isFavorited);
  const [imageIndex, setImageIndex] = useState(0);

  const images = space.images && space.images.length > 0
    ? space.images
    : [{ url: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80", caption: "Workspace" }];

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (user) {
      const nextState = SpaceGoStore.toggleFavourite(user.id, space.id);
      setFavorited(nextState);
      if (onFavoriteToggle) onFavoriteToggle(space.id);
    } else {
      setFavorited(!favorited);
    }
  };

  const handlePrevImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setImageIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  };

  const handleNextImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setImageIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  };

  // Display price format
  const displayPrice = () => {
    if (space.pricing.daily) {
      return { amount: space.pricing.daily, unit: "/ day" };
    }
    if (space.pricing.hourly) {
      return { amount: space.pricing.hourly, unit: "/ hr" };
    }
    if (space.pricing.monthly) {
      return { amount: space.pricing.monthly, unit: "/ mo" };
    }
    return { amount: 0, unit: "" };
  };

  const priceInfo = displayPrice();

  const categoryLabel: Record<string, string> = {
    coworking: "Coworking Desk",
    private_office: "Private Suite",
    meeting_room: "Meeting Room",
    training_room: "Training Hall",
    studio: "Production Studio",
    event_space: "Event Venue",
  };

  return (
    <div className="group relative rounded-2xl bg-white border border-slate-200/90 overflow-hidden hover:shadow-xl hover:border-slate-300 transition-all duration-300 flex flex-col">
      {/* Visual Image Container with Airbnb-style photo carousel */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
        <Link href={`/spaces/${space.id}`} className="block w-full h-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={images[imageIndex]?.url || images[0]?.url}
            alt={space.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        </Link>

        {/* Gradient shadow for contrast */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/40 via-transparent to-black/10 pointer-events-none" />

        {/* Carousel arrows (visible on group hover if > 1 image) */}
        {images.length > 1 && (
          <>
            <button
              onClick={handlePrevImage}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/90 text-slate-800 shadow-md opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-white hover:scale-110 active:scale-95 cursor-pointer"
              aria-label="Previous image"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNextImage}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/90 text-slate-800 shadow-md opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-white hover:scale-110 active:scale-95 cursor-pointer"
              aria-label="Next image"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Pagination dots */}
            <div className="absolute bottom-2.5 left-0 right-0 flex items-center justify-center gap-1 pointer-events-none">
              {images.map((_, idx) => (
                <span
                  key={idx}
                  className={`h-1.5 rounded-full transition-all ${
                    idx === imageIndex ? "w-4 bg-white" : "w-1.5 bg-white/60"
                  }`}
                />
              ))}
            </div>
          </>
        )}

        {/* Top Badges */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
          <div className="pointer-events-auto">
            <VerificationBadge level={space.verification_level} />
          </div>

          <button
            onClick={handleFavoriteClick}
            className="pointer-events-auto w-8 h-8 rounded-full bg-white/85 backdrop-blur-md flex items-center justify-center text-slate-700 hover:text-rose-600 hover:bg-white shadow-sm transition-all hover:scale-110 active:scale-90 cursor-pointer"
            aria-label={favorited ? "Remove from saved" : "Save space"}
          >
            <Heart
              className={`w-4 h-4 transition-colors ${
                favorited ? "fill-rose-500 text-rose-500" : "text-slate-600"
              }`}
            />
          </button>
        </div>

        {/* Category Pill */}
        <div className="absolute bottom-3 left-3 pointer-events-none">
          <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-md bg-slate-900/85 backdrop-blur-md text-white">
            {categoryLabel[space.category] || space.category}
          </span>
        </div>
      </div>

      {/* Card Body - Airbnb clean layout */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          {/* Row 1: Title & Rating */}
          <div className="flex items-start justify-between gap-2">
            <Link href={`/spaces/${space.id}`} className="group-hover:text-teal-700 transition-colors flex-1">
              <h3 className="font-bold text-sm text-slate-950 line-clamp-1">
                {space.title}
              </h3>
            </Link>
            <div className="flex items-center gap-1 text-xs font-bold text-slate-900 shrink-0">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span>{space.rating.toFixed(1)}</span>
              <span className="text-slate-400 font-normal">({space.review_count})</span>
            </div>
          </div>

          {/* Row 2: Location */}
          <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{space.location.city}, {space.location.country}</span>
            <span className="text-slate-300">·</span>
            <span className="shrink-0">{space.capacity} {space.capacity === 1 ? "seat" : "seats"}</span>
          </div>

          {/* Row 3: Headline or Key Amenity */}
          <p className="text-xs text-slate-500 mt-1.5 line-clamp-1 leading-relaxed">
            {space.headline}
          </p>

          {/* Space Passport Highlight */}
          <div className="mt-3 flex items-center gap-2 text-[11px] text-teal-800 bg-teal-50/70 border border-teal-100 rounded-lg px-2.5 py-1">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-600 shrink-0" />
            <span className="font-medium truncate">
              {space.passport.connectivity_tested_mbps} Mbps Fiber · Verified Host
            </span>
          </div>
        </div>

        {/* Row 4: Pricing & Instant Book */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-baseline gap-1">
            <span className="text-base font-black text-slate-950">
              {formatCurrency(priceInfo.amount, space.pricing.currency)}
            </span>
            <span className="text-xs text-slate-500 font-medium">{priceInfo.unit}</span>
          </div>

          {space.instant_book ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <Zap className="w-3 h-3 text-emerald-600 fill-emerald-600" /> Instant Book
            </span>
          ) : (
            <span className="text-[11px] font-medium text-slate-400">
              Host Approval
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
