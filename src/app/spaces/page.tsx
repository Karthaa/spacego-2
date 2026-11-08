"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Navbar } from "@/components/navigation/Navbar";
import { Footer } from "@/components/navigation/Footer";
import { SpaceCard } from "@/components/common/SpaceCard";
import { DemandRequestModal } from "@/components/common/DemandRequestModal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SpaceCardSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { SpaceGoStore } from "@/lib/data/store";
import { Space, WorkspaceCategory, VerificationLevel } from "@/types";
import {
  Search,
  Filter,
  SlidersHorizontal,
  MapPin,
  Building2,
  Users,
  DollarSign,
  Sparkles,
  ShieldCheck,
  Grid,
  List,
  Map as MapIcon,
  X,
  RotateCcw,
  ChevronDown,
  Navigation,
} from "lucide-react";

export default function SpacesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center text-sm font-semibold text-slate-500">Loading workspaces...</div>}>
      <SpacesContent />
    </Suspense>
  );
}

function SpacesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [spaces, setSpaces] = useState<Space[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter States
  const [query, setQuery] = useState(searchParams.get("location") || "");
  const [category, setCategory] = useState<WorkspaceCategory | "all">(
    (searchParams.get("category") as WorkspaceCategory) || "all"
  );
  const [durationFilter, setDurationFilter] = useState<"all" | "hourly" | "daily" | "monthly">("all");
  const [minPrice, setMinPrice] = useState<number | "">("");
  const [maxPrice, setMaxPrice] = useState<number | "">("");
  const [minSeats, setMinSeats] = useState<number | "">("");
  const [selectedVerification, setSelectedVerification] = useState<VerificationLevel | "all">("all");
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  
  // Sort State
  const [sortBy, setSortBy] = useState<"recommended" | "price_asc" | "price_desc" | "rating" | "capacity">("recommended");

  // View mode
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showMap, setShowMap] = useState(false);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // Demand Request Modal
  const [isDemandModalOpen, setIsDemandModalOpen] = useState(false);

  // Load spaces from store
  useEffect(() => {
    setIsLoading(true);
    const data = SpaceGoStore.getSpaces();
    setSpaces(data);
    setIsLoading(false);
  }, []);

  // Update query when searchParams change
  useEffect(() => {
    const loc = searchParams.get("location");
    if (loc) setQuery(loc);
    const cat = searchParams.get("category") as WorkspaceCategory;
    if (cat) setCategory(cat);
  }, [searchParams]);

  const allAmenitiesList = [
    "Ultra-Fast 500 Mbps Fiber",
    "Herman Miller Aeron Chairs",
    "Specialty Espresso Bar",
    "Soundproof Phone Pods",
    "Dual 4K Monitor Desks",
    "24/7 Biometric Access",
    "4K Dual Display Conference System",
    "Private 4-Person Internal Meeting Room",
    "Dual 4K Laser Projectors & Dropdown Screens",
    "Line-Array Audio PA System",
  ];

  const handleAmenityToggle = (amenity: string) => {
    if (selectedAmenities.includes(amenity)) {
      setSelectedAmenities(selectedAmenities.filter((a) => a !== amenity));
    } else {
      setSelectedAmenities([...selectedAmenities, amenity]);
    }
  };

  const handleResetFilters = () => {
    setQuery("");
    setCategory("all");
    setDurationFilter("all");
    setMinPrice("");
    setMaxPrice("");
    setMinSeats("");
    setSelectedVerification("all");
    setSelectedAmenities([]);
    setSortBy("recommended");
  };

  // Filter & Sort Pipeline
  const filteredSpaces = useMemo(() => {
    return spaces.filter((space) => {
      // 1. Location or Title query
      if (query.trim()) {
        const q = query.toLowerCase().trim();
        const matchesLoc =
          space.location.city.toLowerCase().includes(q) ||
          space.location.address.toLowerCase().includes(q) ||
          space.location.country.toLowerCase().includes(q) ||
          (space.location.landmark && space.location.landmark.toLowerCase().includes(q));
        const matchesTitle = space.title.toLowerCase().includes(q) || space.headline.toLowerCase().includes(q);
        if (!matchesLoc && !matchesTitle) return false;
      }

      // 2. Category
      if (category !== "all" && space.category !== category) return false;

      // 3. Verification level
      if (selectedVerification !== "all" && space.verification_level !== selectedVerification) {
        return false;
      }

      // 4. Seats / Capacity
      if (minSeats !== "" && space.capacity < Number(minSeats)) return false;

      // 5. Pricing
      const basePrice = space.pricing.daily || space.pricing.hourly || space.pricing.monthly || 0;
      if (minPrice !== "" && basePrice < Number(minPrice)) return false;
      if (maxPrice !== "" && basePrice > Number(maxPrice)) return false;

      // 6. Duration
      if (durationFilter === "hourly" && !space.pricing.hourly) return false;
      if (durationFilter === "daily" && !space.pricing.daily) return false;
      if (durationFilter === "monthly" && !space.pricing.monthly) return false;

      // 7. Amenities
      if (selectedAmenities.length > 0) {
        const hasAll = selectedAmenities.every((amenity) =>
          space.amenities.some((a) => a.toLowerCase().includes(amenity.toLowerCase()))
        );
        if (!hasAll) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === "price_asc") {
        const priceA = a.pricing.daily || a.pricing.hourly || a.pricing.monthly || 0;
        const priceB = b.pricing.daily || b.pricing.hourly || b.pricing.monthly || 0;
        return priceA - priceB;
      }
      if (sortBy === "price_desc") {
        const priceA = a.pricing.daily || a.pricing.hourly || a.pricing.monthly || 0;
        const priceB = b.pricing.daily || b.pricing.hourly || b.pricing.monthly || 0;
        return priceB - priceA;
      }
      if (sortBy === "rating") {
        return b.rating - a.rating;
      }
      if (sortBy === "capacity") {
        return b.capacity - a.capacity;
      }
      // Recommended default: pro level first, then rating
      if (a.verification_level === "pro" && b.verification_level !== "pro") return -1;
      if (b.verification_level === "pro" && a.verification_level !== "pro") return 1;
      return b.rating - a.rating;
    });
  }, [
    spaces,
    query,
    category,
    durationFilter,
    minPrice,
    maxPrice,
    minSeats,
    selectedVerification,
    selectedAmenities,
    sortBy,
  ]);

  const activeFilterCount =
    (category !== "all" ? 1 : 0) +
    (durationFilter !== "all" ? 1 : 0) +
    (minPrice !== "" || maxPrice !== "" ? 1 : 0) +
    (minSeats !== "" ? 1 : 0) +
    (selectedVerification !== "all" ? 1 : 0) +
    selectedAmenities.length;

  const quickCategories = [
    { id: "all", label: "All Spaces" },
    { id: "coworking", label: "Coworking" },
    { id: "private_office", label: "Private Office" },
    { id: "meeting_room", label: "Meeting Rooms" },
    { id: "training_room", label: "Training" },
    { id: "studio", label: "Studios" },
    { id: "event_space", label: "Events" },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
      <Navbar />

      {/* Header Bar with Uber-inspired Location Bar & Category Pills */}
      <div className="bg-white border-b border-slate-200/80 sticky top-16 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            
            {/* Location & Keyword Search Input */}
            <div className="w-full md:w-96 relative">
              <Input
                placeholder="Search city, neighborhood, or landmark..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                leftIcon={<Search className="w-4 h-4 text-slate-400" />}
                rightIcon={
                  query ? (
                    <button onClick={() => setQuery("")} className="cursor-pointer">
                      <X className="w-4 h-4 text-slate-400 hover:text-slate-600" />
                    </button>
                  ) : undefined
                }
                className="rounded-full text-xs py-2 bg-slate-50 border-slate-200"
              />
            </div>

            {/* Category Quick Pills (Airbnb/Uber style horizontal scroller) */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-1 no-scrollbar">
              {quickCategories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id as any)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    category === cat.id
                      ? "bg-slate-950 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Map Toggle & Mobile Filter Button */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowMap(!showMap)}
                className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                  showMap
                    ? "bg-teal-50 text-teal-800 border-teal-300 shadow-xs"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
              >
                <MapIcon className="w-3.5 h-3.5 text-teal-600" />
                <span>{showMap ? "Hide Map" : "Show Map"}</span>
              </button>

              <button
                onClick={() => setMobileFilterOpen(!mobileFilterOpen)}
                className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-teal-600" />
                <span>Filters {activeFilterCount > 0 ? `(${activeFilterCount})` : ""}</span>
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Desktop Filter Sidebar (Linear clean refinement) */}
          <aside className="hidden lg:block lg:col-span-1 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-6 sticky top-36">
              
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-teal-600" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-900">Filters</span>
                  {activeFilterCount > 0 && (
                    <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-800 text-[10px] font-bold flex items-center justify-center">
                      {activeFilterCount}
                    </span>
                  )}
                </div>
                {activeFilterCount > 0 && (
                  <button
                    onClick={handleResetFilters}
                    className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1 font-medium cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" /> Reset
                  </button>
                )}
              </div>

              {/* Workspace Category */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Workspace Type
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                >
                  <option value="all">All Categories</option>
                  <option value="coworking">Coworking Desks</option>
                  <option value="private_office">Private Office</option>
                  <option value="meeting_room">Meeting Room</option>
                  <option value="training_room">Training Hall</option>
                  <option value="studio">Production Studio</option>
                  <option value="event_space">Event Space</option>
                </select>
              </div>

              {/* Booking Duration Model */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Rate Duration
                </label>
                <div className="grid grid-cols-3 gap-1">
                  {(["all", "hourly", "daily"] as const).map((dur) => (
                    <button
                      key={dur}
                      onClick={() => setDurationFilter(dur)}
                      className={`text-xs py-1.5 px-2 rounded-lg font-medium capitalize transition-colors cursor-pointer ${
                        durationFilter === dur
                          ? "bg-teal-50 text-teal-900 border border-teal-300 font-bold"
                          : "bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {dur}
                    </button>
                  ))}
                </div>
              </div>

              {/* Capacity Filter */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Minimum Capacity
                </label>
                <Input
                  type="number"
                  min={1}
                  placeholder="e.g. 4 seats"
                  value={minSeats}
                  onChange={(e) => setMinSeats(e.target.value ? Number(e.target.value) : "")}
                  leftIcon={<Users className="w-4 h-4 text-slate-400" />}
                />
              </div>

              {/* Space Passport Tier */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Space Passport™ Standard
                </label>
                <select
                  value={selectedVerification}
                  onChange={(e) => setSelectedVerification(e.target.value as any)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                >
                  <option value="all">Any Verification Tier</option>
                  <option value="pro">SpaceGo Pro (Highest Tier)</option>
                  <option value="ready">SpaceGo Ready (Audit Passed)</option>
                  <option value="checked">Checked (Identity Verified)</option>
                </select>
              </div>

              {/* Amenities Checklist */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Key Amenities
                </label>
                <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                  {allAmenitiesList.map((amenity) => (
                    <label
                      key={amenity}
                      className="flex items-center gap-2 text-xs text-slate-700 hover:text-slate-900 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedAmenities.includes(amenity)}
                        onChange={() => handleAmenityToggle(amenity)}
                        className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 w-3.5 h-3.5"
                      />
                      <span className="truncate">{amenity}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Unlisted Demand Box (Uber/Airbnb demand engine) */}
              <div className="p-4 rounded-xl bg-teal-50/70 border border-teal-200 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-teal-900">
                  <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                  <span>Looking for unlisted space?</span>
                </div>
                <p className="text-[11px] text-teal-800 leading-snug">
                  Tell us where you need desks. We use qualified demand to activate dormant commercial buildings.
                </p>
                <button
                  onClick={() => setIsDemandModalOpen(true)}
                  className="w-full mt-2 py-1.5 px-3 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold shadow-xs cursor-pointer"
                >
                  Request Custom Space
                </button>
              </div>

            </div>
          </aside>

          {/* Results Grid / List Area */}
          <main className="lg:col-span-3 space-y-6">
            
            {/* Interactive Simulated Map Banner (Uber-inspired Location Pin Map) */}
            {showMap && (
              <div className="rounded-3xl border border-slate-200 bg-slate-900 text-white p-6 relative overflow-hidden shadow-lg animate-in fade-in duration-300">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Navigation className="w-4 h-4 text-teal-400" />
                    <span className="text-xs font-bold tracking-wider uppercase text-teal-400">Interactive Location Map</span>
                  </div>
                  <span className="text-xs text-slate-400">{filteredSpaces.length} locations mapped</span>
                </div>

                <div className="h-64 sm:h-72 rounded-2xl bg-slate-800/80 border border-slate-700 relative flex items-center justify-center overflow-hidden">
                  {/* Stylized geometric grid map */}
                  <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px]" />
                  
                  {/* Space pins */}
                  <div className="relative z-10 grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 w-full">
                    {filteredSpaces.slice(0, 6).map((space, idx) => (
                      <div
                        key={space.id}
                        onClick={() => router.push(`/spaces/${space.id}`)}
                        className="p-2.5 rounded-xl bg-slate-900/95 border border-teal-500/40 hover:border-teal-400 hover:scale-105 transition-all shadow-md cursor-pointer"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-teal-400 shrink-0" />
                          <span className="text-xs font-bold text-white truncate">{space.location.city}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">{space.title}</p>
                        <div className="mt-1 text-xs font-black text-teal-300">
                          ${space.pricing.daily || space.pricing.hourly}/
                          {space.pricing.daily ? "day" : "hr"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Controls Bar: Sort & View Toggle */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-3 sm:p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
              
              {/* Result Summary */}
              <div className="text-xs text-slate-600 font-medium">
                Showing <span className="font-bold text-slate-950">{filteredSpaces.length}</span> verified spaces
              </div>

              {/* Sort Dropdown & View Mode */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-slate-400 hidden sm:block">Sort:</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                  >
                    <option value="recommended">Recommended & Verified</option>
                    <option value="price_asc">Price: Low to High</option>
                    <option value="price_desc">Price: High to Low</option>
                    <option value="rating">Highest Rating</option>
                    <option value="capacity">Largest Capacity</option>
                  </select>
                </div>

                {/* View Mode Switcher */}
                <div className="flex items-center border border-slate-200 rounded-xl p-0.5 bg-slate-50">
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`p-1.5 rounded-lg text-slate-600 transition-colors cursor-pointer ${
                      viewMode === "grid" ? "bg-white text-slate-900 shadow-xs" : "hover:text-slate-900"
                    }`}
                    aria-label="Grid View"
                  >
                    <Grid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={`p-1.5 rounded-lg text-slate-600 transition-colors cursor-pointer ${
                      viewMode === "list" ? "bg-white text-slate-900 shadow-xs" : "hover:text-slate-900"
                    }`}
                    aria-label="List View"
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Results Display */}
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <SpaceCardSkeleton key={n} />
                ))}
              </div>
            ) : filteredSpaces.length === 0 ? (
              <div className="space-y-6">
                <EmptyState
                  icon={<Building2 className="w-8 h-8" />}
                  title="No workspaces found"
                  description="We couldn't find workspaces matching your specific filters. Try expanding your search terms or submit an unlisted workspace request."
                  actionLabel="Reset All Filters"
                  onAction={handleResetFilters}
                />

                {/* Demand capture banner */}
                <div className="rounded-2xl border border-teal-200 bg-teal-50/60 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-bold text-teal-950">
                      Need a workspace in this area?
                    </h4>
                    <p className="text-xs text-teal-800 mt-1 max-w-md">
                      SpaceGo operates a Demand-Backed Activation engine. When you request a workspace, we identify dormant properties in that location and work with landlords to activate it.
                    </p>
                  </div>
                  <Button
                    variant="teal"
                    size="sm"
                    onClick={() => setIsDemandModalOpen(true)}
                  >
                    Submit Workspace Request
                  </Button>
                </div>
              </div>
            ) : (
              <div
                className={
                  viewMode === "grid"
                    ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
                    : "space-y-4"
                }
              >
                {filteredSpaces.map((space) => (
                  <SpaceCard key={space.id} space={space} />
                ))}
              </div>
            )}

          </main>
        </div>
      </div>

      {/* Demand Request Modal */}
      <DemandRequestModal
        isOpen={isDemandModalOpen}
        onClose={() => setIsDemandModalOpen(false)}
        defaultLocation={query}
        defaultCategory={category}
      />

      <Footer />
    </div>
  );
}
