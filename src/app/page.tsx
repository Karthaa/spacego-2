"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/navigation/Navbar";
import { Footer } from "@/components/navigation/Footer";
import { SpaceCard } from "@/components/common/SpaceCard";
import { Button } from "@/components/ui/Button";
import { SpaceGoStore } from "@/lib/data/store";
import { WorkspaceCategory } from "@/types";
import {
  Search,
  MapPin,
  Calendar,
  Users,
  Building2,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  Zap,
  Lock,
  ChevronDown,
  Layers,
  BarChart3,
  Coffee,
  HelpCircle,
  FileCheck,
} from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const spaces = SpaceGoStore.getSpaces();
  const featuredSpaces = spaces.slice(0, 4);

  // Search Bar State
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState<WorkspaceCategory | "all">("all");
  const [date, setDate] = useState("");
  const [seats, setSeats] = useState("");

  // Journey Tab State
  const [activeJourney, setActiveJourney] = useState<"seeker" | "owner">("seeker");

  // FAQ Accordion State
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (location) params.set("location", location);
    if (category !== "all") params.set("category", category);
    if (date) params.set("date", date);
    if (seats) params.set("seats", seats);

    // Record in demand analytics
    SpaceGoStore.logSearchQuery({
      location: location || "All Locations",
      category: category !== "all" ? category : undefined,
      seats: seats ? Number(seats) : undefined,
      resultCount: spaces.length,
    });

    router.push(`/spaces?${params.toString()}`);
  };

  const categoriesList = [
    {
      id: "coworking",
      name: "Coworking Desks",
      desc: "Quiet ergonomic workstations with redundant 500 Mbps fiber & artisan coffee.",
      count: "From $12/hr",
      icon: <Users className="w-6 h-6 text-teal-600" />,
      bg: "bg-teal-50/70 border-teal-200/60",
    },
    {
      id: "private_office",
      name: "Private Offices",
      desc: "Turnkey lockable suites for teams of 4 to 20 with dedicated meeting rooms.",
      count: "From $320/day",
      icon: <Building2 className="w-6 h-6 text-sky-600" />,
      bg: "bg-sky-50/70 border-sky-200/60",
    },
    {
      id: "meeting_room",
      name: "Meeting & Boardrooms",
      desc: "Client-ready rooms with 4K videoconferencing, beamforming mics & privacy glass.",
      count: "From $65/hr",
      icon: <Layers className="w-6 h-6 text-indigo-600" />,
      bg: "bg-indigo-50/70 border-indigo-200/60",
    },
    {
      id: "training_room",
      name: "Training & Workshops",
      desc: "Reconfigurable lecture spaces with dual projectors, audio PA & break-out terraces.",
      count: "From $45/hr",
      icon: <TrendingUp className="w-6 h-6 text-emerald-600" />,
      bg: "bg-emerald-50/70 border-emerald-200/60",
    },
    {
      id: "studio",
      name: "Production Studios",
      desc: "Sound-isolated multi-camera setups with broadcast mics and cinema lighting.",
      count: "From $65/hr",
      icon: <Zap className="w-6 h-6 text-amber-600" />,
      bg: "bg-amber-50/70 border-amber-200/60",
    },
    {
      id: "event_space",
      name: "Events & Demo Halls",
      desc: "Panoramic venues for investor demo days, hackathons, and corporate mixers.",
      count: "From $180/hr",
      icon: <Sparkles className="w-6 h-6 text-purple-600" />,
      bg: "bg-purple-50/70 border-purple-200/60",
    },
  ];

  const faqs = [
    {
      q: "What makes SpaceGo different from generic coworking directories?",
      a: "SpaceGo is not merely a directory of pre-existing coworking listings. Our unique advantage is Demand-Backed Space Activation: we evaluate underutilized commercial properties against real local demand, verify physical and legal standards through our Space Passport™ framework, and help property owners convert dormant assets into high-yield, flexible workspaces.",
    },
    {
      q: "How does the Space Passport™ verification work?",
      a: "Every verified space undergoes documented on-site tests: internet download/upload and latency verification, emergency power backup testing, fire exit compliance, and legal property authority checks. We publish the actual check date and inspection evidence so customers know exactly what has been validated.",
    },
    {
      q: "How do bookings and host approvals operate?",
      a: "When a customer submits a booking, inventory is checked server-side to prevent conflicting reservations. For spaces marked Instant Book, your pass is issued immediately. For host-approval listings, the property owner reviews the request, and once approved, an electronic access code and check-in instructions are delivered to your dashboard.",
    },
    {
      q: "I own an empty commercial floor or office. How can SpaceGo help me?",
      a: "You can submit an activation request via our Property Activation Service. We calculate a transparent 100-Point SpaceGo Activation Score covering local customer demand, fit-out conversion economics, and readiness. We then provide vendor coordination, fit-out guidance, and launch your space onto our demand network.",
    },
    {
      q: "Can businesses book multi-seat spaces for distributed teams?",
      a: "Yes. SpaceGo accommodates individual freelancers, agile project squads needing weekly office suites, and corporate enterprises booking boardrooms or multi-desk arrangements across global tech hubs.",
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />

      {/* Hero Section */}
      <section className="relative pt-12 pb-20 md:pt-20 md:pb-32 overflow-hidden bg-gradient-to-b from-white via-slate-50/50 to-slate-100/50 border-b border-slate-200/70">
        
        {/* Subtle decorative mesh background */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-tr from-teal-100/30 via-sky-100/20 to-transparent blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          
          {/* Badge */}
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-teal-200 bg-teal-50/80 text-teal-900 text-xs font-semibold shadow-xs">
              <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
              <span>Demand-Backed Workspace Marketplace & PropTech</span>
            </div>
          </div>

          {/* Main Headline */}
          <div className="text-center mt-6 max-w-4xl mx-auto space-y-4">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-[#0B132B] tracking-tight leading-[1.12]">
              Find the right space. <br className="hidden sm:inline" />
              <span className="bg-gradient-to-r from-teal-700 via-teal-600 to-sky-700 bg-clip-text text-transparent">
                Make every space work.
              </span>
            </h1>
            <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto font-normal leading-relaxed">
              Discover flexible workspaces or unlock the commercial potential of underutilised properties with one connected platform.
            </p>
          </div>

          {/* Quick Dual CTA Buttons */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/spaces">
              <Button variant="primary" size="lg" className="shadow-md">
                <span>Explore Workspaces</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/activation">
              <Button variant="outline" size="lg" className="font-semibold bg-white border-slate-300">
                <Sparkles className="w-4 h-4 text-teal-600" />
                <span>Activate Your Property</span>
              </Button>
            </Link>
          </div>

          {/* Search Bar Interface */}
          <div className="mt-12 max-w-4xl mx-auto">
            <form
              onSubmit={handleSearch}
              className="glassmorphism p-3 sm:p-4 rounded-3xl shadow-xl border border-slate-200/90 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center"
            >
              {/* Location Input */}
              <div className="lg:col-span-4 p-2.5 rounded-2xl bg-white border border-slate-200/80 hover:border-teal-500 transition-colors">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Where
                </label>
                <div className="flex items-center gap-2 mt-0.5">
                  <MapPin className="w-4 h-4 text-teal-600 shrink-0" />
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="San Francisco, London, Berlin..."
                    className="w-full text-xs font-semibold text-slate-900 placeholder:text-slate-400 bg-transparent focus:outline-none"
                  />
                </div>
              </div>

              {/* Category Dropdown */}
              <div className="lg:col-span-3 p-2.5 rounded-2xl bg-white border border-slate-200/80 hover:border-teal-500 transition-colors">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Space Type
                </label>
                <div className="flex items-center gap-2 mt-0.5">
                  <Building2 className="w-4 h-4 text-teal-600 shrink-0" />
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full text-xs font-semibold text-slate-900 bg-transparent focus:outline-none cursor-pointer"
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
              </div>

              {/* Date Input */}
              <div className="lg:col-span-2 p-2.5 rounded-2xl bg-white border border-slate-200/80 hover:border-teal-500 transition-colors">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Date
                </label>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Calendar className="w-4 h-4 text-teal-600 shrink-0" />
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full text-xs font-semibold text-slate-900 bg-transparent focus:outline-none"
                  />
                </div>
              </div>

              {/* Capacity / People */}
              <div className="lg:col-span-2 p-2.5 rounded-2xl bg-white border border-slate-200/80 hover:border-teal-500 transition-colors">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Capacity
                </label>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Users className="w-4 h-4 text-teal-600 shrink-0" />
                  <input
                    type="number"
                    min={1}
                    max={150}
                    value={seats}
                    onChange={(e) => setSeats(e.target.value)}
                    placeholder="People"
                    className="w-full text-xs font-semibold text-slate-900 placeholder:text-slate-400 bg-transparent focus:outline-none"
                  />
                </div>
              </div>

              {/* Search Submit Button */}
              <div className="lg:col-span-1 flex items-center justify-center">
                <button
                  type="submit"
                  className="w-full h-12 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white flex items-center justify-center shadow-md shadow-teal-700/20 transition-transform active:scale-95"
                  aria-label="Search"
                >
                  <Search className="w-5 h-5" />
                </button>
              </div>
            </form>
          </div>

          {/* Popular Cities pills */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500">
            <span className="font-semibold text-slate-700">Popular hubs:</span>
            {["San Francisco", "New York", "London", "Berlin", "Bengaluru", "Singapore"].map((city) => (
              <button
                key={city}
                onClick={() => {
                  setLocation(city);
                  router.push(`/spaces?location=${encodeURIComponent(city)}`);
                }}
                className="px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-600 hover:border-teal-400 hover:text-teal-700 transition-colors font-medium cursor-pointer"
              >
                {city}
              </button>
            ))}
          </div>

        </div>
      </section>

      {/* Featured Workspaces Section */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-teal-700">
              <ShieldCheck className="w-4 h-4" /> Space Passport Verified
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1">
              Featured Premium Workspaces
            </h2>
            <p className="text-sm text-slate-500 mt-1 max-w-xl">
              Fully inspected spaces with verified fiber connectivity, ergonomic setups, and active host commitments.
            </p>
          </div>
          <Link href="/spaces" className="inline-flex items-center gap-1 text-sm font-bold text-teal-700 hover:text-teal-800 group">
            <span>Browse All Spaces ({spaces.length})</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {featuredSpaces.map((space) => (
            <SpaceCard key={space.id} space={space} />
          ))}
        </div>
      </section>

      {/* Explore By Workspace Type */}
      <section className="py-20 bg-white border-y border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Spaces Designed for Every Task
            </h2>
            <p className="text-sm text-slate-500 mt-2">
              Make discovery about your specific job to be done — whether focus coding, client pitches, sprint bootcamps, or podcast production.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {categoriesList.map((cat) => (
              <Link
                key={cat.id}
                href={`/spaces?category=${cat.id}`}
                className={`p-6 rounded-2xl border transition-all duration-300 hover:shadow-lg hover:-translate-y-1 group ${cat.bg}`}
              >
                <div className="w-12 h-12 rounded-xl bg-white border border-slate-200/60 shadow-xs flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  {cat.icon}
                </div>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900">{cat.name}</h3>
                  <span className="text-xs font-semibold text-slate-500">{cat.count}</span>
                </div>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  {cat.desc}
                </p>
                <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center text-xs font-bold text-slate-800 group-hover:text-teal-700">
                  <span>Explore category</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How SpaceGo Works (Customer Journey vs Owner Journey) */}
      <section id="how-it-works" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="text-xs font-bold uppercase tracking-wider text-teal-700">
            End-to-End Orchestration
          </span>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight mt-1">
            How SpaceGo Works
          </h2>
          <p className="text-sm text-slate-500 mt-2">
            One connected platform that orchestrates seamless discovery for customers and intelligent activation for property owners.
          </p>

          {/* Journey Toggle */}
          <div className="mt-6 inline-flex p-1 rounded-2xl bg-slate-200/80 border border-slate-300/80">
            <button
              onClick={() => setActiveJourney("seeker")}
              className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeJourney === "seeker"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              For Workspace Seekers
            </button>
            <button
              onClick={() => setActiveJourney("owner")}
              className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeJourney === "owner"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              For Property Owners
            </button>
          </div>
        </div>

        {activeJourney === "seeker" ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="p-6 rounded-2xl border border-slate-200 bg-white relative">
              <span className="text-4xl font-black text-slate-200 absolute top-4 right-4">01</span>
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold mb-4">
                <Search className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Define & Discover</h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Filter by job purpose, exact seating capacity, high-speed fiber specifications, and real-time calendar availability.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-slate-200 bg-white relative">
              <span className="text-4xl font-black text-slate-200 absolute top-4 right-4">02</span>
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold mb-4">
                <FileCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Inspect Space Passport</h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Review verified internet speed tests, acoustic noise ratings, emergency power backup status, and facility photos.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-slate-200 bg-white relative">
              <span className="text-4xl font-black text-slate-200 absolute top-4 right-4">03</span>
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold mb-4">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Book & Secure</h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Instant reservation lock prevents double bookings. Transparent pricing with no hidden fees and clear cancellation rules.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-slate-200 bg-white relative">
              <span className="text-4xl font-black text-slate-200 absolute top-4 right-4">04</span>
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold mb-4">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Check In Seamlessly</h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Receive electronic QR passes, WiFi credentials, host check-in instructions, and dedicated customer support.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="p-6 rounded-2xl border border-slate-200 bg-white relative">
              <span className="text-4xl font-black text-slate-200 absolute top-4 right-4">01</span>
              <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold mb-4">
                <Building2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Submit Property Data</h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Share your square footage, current floor condition, photos, and ownership authority for instant feasibility review.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-slate-200 bg-white relative">
              <span className="text-4xl font-black text-slate-200 absolute top-4 right-4">02</span>
              <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold mb-4">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Demand & Economics</h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Receive an explainable 100-Point Activation Score based on verified local search volume, conversion CapEx, and payback projections.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-slate-200 bg-white relative">
              <span className="text-4xl font-black text-slate-200 absolute top-4 right-4">03</span>
              <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold mb-4">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Verify & Stage-Gate</h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Coordinate approved vendor fit-outs, fire and internet checks, and earn your official Space Passport™ certification.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-slate-200 bg-white relative">
              <span className="text-4xl font-black text-slate-200 absolute top-4 right-4">04</span>
              <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold mb-4">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Earn & Monitor</h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Automated booking calendars, host payout settlements, occupancy tracking, and owner contribution dashboards.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Property Activation Hero Feature */}
      <section className="py-20 bg-[#0B132B] text-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 border border-teal-500/30 text-teal-300 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                The SpaceGo Strategic Wedge
              </div>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">
                Demand-Backed Space Activation
              </h2>
              <p className="text-base text-slate-300 leading-relaxed font-normal">
                Don’t spend capital on conversion based on blind guesswork. SpaceGo links qualified local search demand to property suitability, conversion economics, and readiness testing before recommending capital expenditure.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h4 className="text-sm font-bold text-teal-400">100-Point Matrix</h4>
                  <p className="text-xs text-slate-300 mt-1">
                    Evaluates local demand (30%), conversion economics (25%), readiness (20%), location access (15%), and operations (10%).
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h4 className="text-sm font-bold text-teal-400">Hard Legal & Safety Gate</h4>
                  <p className="text-xs text-slate-300 mt-1">
                    Commercial scores never override safety. Every property requires confirmed ownership authority and permitted commercial use.
                  </p>
                </div>
              </div>

              <div className="pt-4 flex flex-wrap items-center gap-4">
                <Link href="/activation">
                  <Button variant="teal" size="lg">
                    <span>Submit Property for Activation</span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
                <Link href="/activation/track">
                  <Button variant="ghost" size="lg" className="text-slate-300 hover:text-white hover:bg-white/10">
                    Track Existing Request
                  </Button>
                </Link>
              </div>
            </div>

            {/* Visual Activation Matrix Card */}
            <div className="lg:col-span-5">
              <div className="rounded-3xl border border-slate-700 bg-slate-900/90 p-6 shadow-2xl backdrop-blur-md space-y-5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Sample Assessment</span>
                    <h4 className="text-base font-bold text-white">Mission Street Tech Loft</h4>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-teal-400">86/100</span>
                    <div className="text-[10px] font-semibold text-emerald-400">Ready for Assessment</div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs text-slate-300 mb-1">
                      <span>Qualified Local Demand (30%)</span>
                      <span className="font-bold text-teal-300">27 / 30</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full bg-teal-400 rounded-full" style={{ width: "90%" }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-slate-300 mb-1">
                      <span>Conversion Economics & CapEx (25%)</span>
                      <span className="font-bold text-teal-300">22 / 25</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full bg-teal-400 rounded-full" style={{ width: "88%" }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-slate-300 mb-1">
                      <span>Workspace Physical Readiness (20%)</span>
                      <span className="font-bold text-teal-300">17 / 20</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full bg-teal-400 rounded-full" style={{ width: "85%" }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-slate-300 mb-1">
                      <span>Location Transit & Access (15%)</span>
                      <span className="font-bold text-teal-300">12 / 15</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full bg-teal-400 rounded-full" style={{ width: "80%" }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-slate-300 mb-1">
                      <span>Operational Feasibility (10%)</span>
                      <span className="font-bold text-teal-300">8 / 10</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full bg-teal-400 rounded-full" style={{ width: "80%" }} />
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <span>Payback Estimate: 4.8 months</span>
                  <span className="text-teal-400 font-semibold">Assisted Model</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Space Passport Section (Trust, Quality & Service Accountability) */}
      <section id="passport" className="py-20 bg-slate-100/60 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-teal-700">
              <ShieldCheck className="w-4 h-4" /> Evidence-Backed Standards
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1">
              The SpaceGo Space Passport™
            </h2>
            <p className="text-sm text-slate-600 mt-2">
              A distributed network only works if customers know what has actually been checked, on what date, and who is responsible.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Identity & Property Authority</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Legal ownership or sanctioned operating authority is documented. No listing implies statutory approval that has not been confirmed.
              </p>
              <div className="pt-2 text-xs font-semibold text-teal-700 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Lease & Title Audit
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Connectivity & Power Tests</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                We test actual download, upload, and latency under load. Backup generators and UPS batteries are field-tested with logged date stamps.
              </p>
              <div className="pt-2 text-xs font-semibold text-teal-700 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> 300+ Mbps Redundant Fiber
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Physical Facilities & Life Safety</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Acoustic baseline checks, ergonomic seating, fire extinguisher inspection, clean restrooms, and emergency exit routes verified.
              </p>
              <div className="pt-2 text-xs font-semibold text-teal-700 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Annual Renewal Cadence
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Frequently Asked Questions */}
      <section id="faq" className="py-20 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-teal-700">
            <HelpCircle className="w-4 h-4" /> Got Questions?
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1">
            Frequently Asked Questions
          </h2>
          <p className="text-sm text-slate-500 mt-2">
            Clear, transparent answers for customers, property owners, and workspace operators.
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs transition-colors"
            >
              <button
                onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                className="w-full flex items-center justify-between p-5 text-left font-bold text-sm sm:text-base text-slate-900 hover:text-teal-700 transition-colors"
              >
                <span>{faq.q}</span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ml-4 ${
                    expandedFaq === index ? "rotate-180 text-teal-600" : ""
                  }`}
                />
              </button>
              {expandedFaq === index && (
                <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className="py-16 bg-gradient-to-r from-teal-700 via-teal-800 to-[#0B132B] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
            Ready to find your workspace or unlock an underutilized property?
          </h2>
          <p className="text-sm sm:text-base text-teal-100 max-w-xl mx-auto">
            Join hundreds of remote professionals, startups, and progressive landlords across our global network.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <Link href="/spaces">
              <Button size="lg" className="bg-white text-slate-950 hover:bg-slate-100 font-bold shadow-lg">
                Explore Workspaces
              </Button>
            </Link>
            <Link href="/activation">
              <Button size="lg" variant="outline" className="border-teal-300 text-white hover:bg-teal-700/50">
                Activate Your Space
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
