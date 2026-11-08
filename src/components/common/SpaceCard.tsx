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
  Wifi,
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
} from "lucide-react";

interface SpaceCardProps {
  space: Space;
  isFavorited?: boolean;
  onFavoriteToggle?: (spaceId: string) => void;
}

export function SpaceCard({ space, isFavorited = false, onFavoriteToggle }: SpaceCardProps) {
  const { user } = useAuth();
  const [favorited, setFavorited] = useState(isFavorited);

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

  const coverImage =
    space.images.find((img) => img.is_cover)?.url ||
    space.images[0]?.url ||
    "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80";

  // Display price format
  const displayPrice = () => {
    if (space.pricing.daily) {
      return { amount: space.pricing.daily, unit: "/ day" };
    }
    if (space.pricing.hourly) {
      return { amount: space.pricing.hourly, unit: "/ hour" };
    }
    if (space.pricing.monthly) {
      return { amount: space.pricing.monthly, unit: "/ month" };
    }
    return { amount: 0, unit: "" };
  };

  const priceInfo = displayPrice();

  const categoryLabel: Record<string, string> = {
    coworking: "Coworking Space",
    private_office: "Private Office",
    meeting_room: "Meeting Room",
    training_room: "Training Hall",
    studio: "Production Studio",
    event_space: "Event Space",
  };

  return (
    <div className="group relative rounded-2xl border border-slate-200/90 bg-white overflow-hidden shadow-xs hover:shadow-xl hover:border-slate-300 transition-all duration-300 flex flex-col">
      {/* Image Container */}
      <Link href={`/spaces/${space.id}`} className="relative block h-56 w-full overflow-hidden bg-slate-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={coverImage}
          alt={space.title}
          className="h-full w-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />

        {/* Top Badges */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
          <div className="pointer-events-auto">
            <VerificationBadge level={space.verification_level} />
          </div>

          {/* Favorite Heart Button */}
          <button
            onClick={handleFavoriteClick}
            className="pointer-events-auto w-8 h-8 rounded-full bg-white/90 backdrop-blur-xs flex items-center justify-center text-slate-700 hover:text-rose-600 hover:bg-white shadow-xs transition-colors"
            aria-label={favorited ? "Remove from saved spaces" : "Save space"}
          >
            <Heart
              className={`w-4 h-4 transition-colors ${
                favorited ? "fill-rose-500 text-rose-500" : "text-slate-600"
              }`}
            />
          </button>
        </div>

        {/* Category Pill on Image Bottom */}
        <div className="absolute bottom-3 left-3 flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-md bg-slate-900/80 backdrop-blur-sm text-white">
            {categoryLabel[space.category] || space.category}
          </span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-white/90 backdrop-blur-sm text-slate-800 flex items-center gap-1">
            <Users className="w-3 h-3 text-slate-500" />
            Up to {space.capacity} seats
          </span>
        </div>
      </Link>

      {/* Card Content */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          {/* Location & Rating */}
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
            <div className="flex items-center gap-1 truncate max-w-[70%]">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="font-medium text-slate-700 truncate">{space.location.city}, {space.location.country}</span>
            </div>
            <div className="flex items-center gap-1 text-slate-900 font-semibold shrink-0">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span>{space.rating.toFixed(2)}</span>
              <span className="text-slate-400 font-normal">({space.review_count})</span>
            </div>
          </div>

          {/* Title */}
          <Link href={`/spaces/${space.id}`} className="block group-hover:text-teal-700 transition-colors">
            <h3 className="text-base font-bold text-slate-900 line-clamp-1 leading-snug">
              {space.title}
            </h3>
          </Link>

          {/* Headline */}
          <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
            {space.headline}
          </p>

          {/* Key Amenities */}
          <div className="mt-3.5 flex flex-wrap gap-1.5">
            {space.amenities.slice(0, 3).map((amenity, idx) => (
              <span
                key={idx}
                className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md truncate max-w-[160px]"
              >
                {amenity}
              </span>
            ))}
            {space.amenities.length > 3 && (
              <span className="text-[11px] font-medium text-slate-400 px-1 py-0.5">
                +{space.amenities.length - 3} more
              </span>
            )}
          </div>
        </div>

        {/* Pricing & CTA */}
        <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">
              From
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-black text-slate-950">
                {formatCurrency(priceInfo.amount, space.pricing.currency)}
              </span>
              <span className="text-xs font-medium text-slate-500">{priceInfo.unit}</span>
            </div>
          </div>

          <Link
            href={`/spaces/${space.id}`}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 transition-colors"
          >
            <span>View Space</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
