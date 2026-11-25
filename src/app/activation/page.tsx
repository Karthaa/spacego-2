"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/navigation/Navbar";
import { Footer } from "@/components/navigation/Footer";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/context/AuthContext";
import { SpaceGoStore } from "@/lib/data/store";
import { PropertyActivationRequest } from "@/types";
import confetti from "canvas-confetti";
import {
  Sparkles,
  Building2,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Upload,
  Layers,
  MapPin,
  DollarSign,
  Clock,
  Phone,
  Mail,
  User,
  Zap,
  Info,
  Sliders,
} from "lucide-react";

export default function PropertyActivationPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { success, error } = useToast();

  // Form State
  const [ownerName, setOwnerName] = useState(user?.full_name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [propertyAddress, setPropertyAddress] = useState("");
  const [city, setCity] = useState("");
  const [propertyType, setPropertyType] = useState<PropertyActivationRequest["property_type"]>("vacant_floor");
  const [approxSqFt, setApproxSqFt] = useState<number | "">(2500);
  const [condition, setCondition] = useState<PropertyActivationRequest["current_condition"]>("partially_furnished");
  const [existingFacilities, setExistingFacilities] = useState<string[]>([
    "Central HVAC",
    "Passenger Elevator",
    "Restrooms",
  ]);
  const [expectedBudget, setExpectedBudget] = useState<number | "">(45000);
  const [preferredModel, setPreferredModel] = useState<PropertyActivationRequest["preferred_model"]>("assisted_activation");
  const [targetTimeline, setTargetTimeline] = useState("Within 60 days");
  const [notes, setNotes] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState(
    "https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=800&q=80"
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedRequest, setSubmittedRequest] = useState<PropertyActivationRequest | null>(null);

  const facilitiesOptions = [
    "Central HVAC",
    "Passenger Elevator",
    "Restrooms",
    "Commercial Fiber Conduit",
    "100% Diesel Generator Backup",
    "Covered Parking Bays",
    "Street-Facing Private Entry",
    "Fire Sprinkler & Alarm System",
  ];

  const handleFacilityToggle = (fac: string) => {
    if (existingFacilities.includes(fac)) {
      setExistingFacilities(existingFacilities.filter((f) => f !== fac));
    } else {
      setExistingFacilities([...existingFacilities, fac]);
    }
  };

  const samplePhotos = [
    {
      label: "Modern Floor",
      url: "https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=800&q=80",
    },
    {
      label: "Industrial Shell",
      url: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=800&q=80",
    },
    {
      label: "Commercial Lounge",
      url: "https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=800&q=80",
    },
    {
      label: "Bare Open Space",
      url: "https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=800&q=80",
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerName || !email || !propertyAddress || !city) {
      error("Missing Required Fields", "Please provide owner contact and property location.");
      return;
    }

    if (SpaceGoStore.isRemoteEnabled() && !user) {
      error("Sign in required", "Sign in with an owner account to submit a property for activation.");
      router.push(`/auth/login?redirect=${encodeURIComponent("/activation")}`);
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await SpaceGoStore.createActivationRequest({
        owner_id: user?.id,
        owner_name: ownerName,
        email,
        phone,
        property_address: propertyAddress,
        city,
        property_type: propertyType,
        approx_square_feet: Number(approxSqFt) || 1000,
        current_condition: condition,
        existing_facilities: existingFacilities,
        expected_budget_usd: Number(expectedBudget) || 0,
        preferred_model: preferredModel,
        target_timeline: targetTimeline,
        additional_notes: notes,
        photos: [selectedPhoto],
      });

      if (!result.ok) {
        error("Activation request not submitted", result.error);
        return;
      }

      setSubmittedRequest(result.data);
      confetti({
        particleCount: 90,
        spread: 70,
        origin: { y: 0.6 },
      });
      success("Activation Request Registered!", `Reference Code: ${result.data.id}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />

      {/* Hero Header */}
      <section className="bg-gradient-to-b from-[#0B132B] to-[#1C2541] text-white py-16 sm:py-24 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-500/20 border border-teal-500/40 text-teal-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            Demand-Backed Workspace Activation Program
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight max-w-3xl mx-auto leading-tight">
            Turn Underutilised Space Into High-Yield Workspace.
          </h1>
          <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto font-normal leading-relaxed">
            Don’t leave square footage dormant. SpaceGo assesses real local customer demand, models conversion economics, coordinates setup, and launches your property onto our flexible-workspace network.
          </p>
          <div className="pt-4 flex items-center justify-center gap-4">
            <Link href="#submit-form">
              <Button variant="teal" size="lg" className="shadow-lg">
                <span>Submit Your Property</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/activation/track">
              <Button variant="outline" size="lg" className="border-slate-500 text-white hover:bg-white/10">
                Track Existing Request
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* The 6-Step Workflow Presentation */}
      <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-bold uppercase tracking-wider text-teal-700">
            The Activation Sequence
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1">
            From Dormant Floor to Bookable Workplace
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Our disciplined stage-gate methodology protects capital and ensures every activated site meets rigorous commercial and safety thresholds.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-xs">
              01
            </div>
            <h4 className="text-xs font-bold text-slate-900">Submit Property</h4>
            <p className="text-[11px] text-slate-500 leading-snug">
              Provide square footage, layout condition, facilities, and owner authority.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-xs">
              02
            </div>
            <h4 className="text-xs font-bold text-slate-900">Demand Signal Match</h4>
            <p className="text-[11px] text-slate-500 leading-snug">
              Cross-referenced against actual search queries and enterprise team needs in your postal code.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-xs">
              03
            </div>
            <h4 className="text-xs font-bold text-slate-900">100-Pt Scoring</h4>
            <p className="text-[11px] text-slate-500 leading-snug">
              Explainable score balancing demand, fit-out CapEx payback, and operational viability.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-xs">
              04
            </div>
            <h4 className="text-xs font-bold text-slate-900">Setup Coordination</h4>
            <p className="text-[11px] text-slate-500 leading-snug">
              Approved vendor quotations for acoustic partitioning, redundant fiber, and furniture.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-xs">
              05
            </div>
            <h4 className="text-xs font-bold text-slate-900">Space Passport Audit</h4>
            <p className="text-[11px] text-slate-500 leading-snug">
              Hard legal and safety gate: fire exit checks, backup power testing, and photo log.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-xs">
              06
            </div>
            <h4 className="text-xs font-bold text-slate-900">Launch & Bookings</h4>
            <p className="text-[11px] text-slate-500 leading-snug">
              Published on marketplace with calendar sync, QR check-in, and net revenue settlements.
            </p>
          </div>
        </div>
      </section>

      {/* Three Operating Models Breakdown */}
      <section className="py-12 bg-white border-y border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Three Flexible Participation Models
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Choose how hands-on you want to be — without being locked into high-overhead leases.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-teal-700">Self-Managed</span>
              <h4 className="text-base font-bold text-slate-900">Already Ready Workspace</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                For properties that are already furnished. You configure prices, availability, and handle day-to-day hosting. SpaceGo provides marketplace distribution and booking tools.
              </p>
              <div className="text-xs font-semibold text-slate-800 pt-2 border-t border-slate-200">
                Fee: 12-15% platform booking fee
              </div>
            </div>

            <div className="p-6 rounded-2xl border-2 border-teal-500 bg-teal-50/30 space-y-3 relative shadow-md">
              <span className="absolute -top-3 right-4 bg-teal-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                Most Popular
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-teal-800">Assisted Activation</span>
              <h4 className="text-base font-bold text-slate-900">Guided Property Conversion</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                We assess your empty floor, define layout configurations based on local demand, source vetted fit-out vendor quotes, and perform the Space Passport™ verification before launch.
              </p>
              <div className="text-xs font-semibold text-teal-900 pt-2 border-t border-teal-200">
                Fee: Scoped activation advisory + standard booking fee
              </div>
            </div>

            <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Managed Partner</span>
              <h4 className="text-base font-bold text-slate-900">Turnkey Managed Operations</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Contracted local operator oversees on-site reception, maintenance, cleaning, and customer experience. Ideal for institutional owners seeking hands-off flexible yields.
              </p>
              <div className="text-xs font-semibold text-slate-800 pt-2 border-t border-slate-200">
                Fee: Contracted revenue share / management fee
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Property Submission Form */}
      <section id="submit-form" className="py-16 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-10 shadow-xl space-y-8">
          
          <div className="border-b border-slate-100 pb-5">
            <span className="text-xs font-bold uppercase tracking-wider text-teal-700">
              Direct Owner Intake
            </span>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
              Submit Your Property for Activation
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              All submissions are evaluated against local demand data. You will receive an instant tracking reference code and preliminary 100-Point Feasibility Score.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Step 1: Owner Contact Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <User className="w-4 h-4 text-teal-600" />
                1. Owner & Authority Details
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Input
                  label="Owner / Authority Name *"
                  required
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="e.g. Elena Rostova"
                />
                <Input
                  label="Official Email *"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="elena@example.com"
                  leftIcon={<Mail className="w-4 h-4" />}
                />
                <Input
                  label="Contact Phone *"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  leftIcon={<Phone className="w-4 h-4" />}
                />
              </div>
            </div>

            {/* Step 2: Property Location & Specifications */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <MapPin className="w-4 h-4 text-teal-600" />
                2. Property Location & Physical Specs
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <Input
                    label="Property Address *"
                    required
                    value={propertyAddress}
                    onChange={(e) => setPropertyAddress(e.target.value)}
                    placeholder="e.g. 550 Montgomery St, 5th Floor"
                  />
                </div>
                <div>
                  <Input
                    label="City *"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. San Francisco"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Property Type
                  </label>
                  <select
                    value={propertyType}
                    onChange={(e) => setPropertyType(e.target.value as PropertyActivationRequest["property_type"])}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-semibold text-slate-900 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                  >
                    <option value="vacant_floor">Vacant Commercial Floor</option>
                    <option value="excess_office">Excess Office Suite</option>
                    <option value="retail_commercial">Street Retail / Commercial</option>
                    <option value="hotel_space">Hotel Business Centre</option>
                    <option value="independent_building">Standalone Commercial Building</option>
                    <option value="studio_hall">Studio / Event Hall</option>
                  </select>
                </div>

                <Input
                  label="Approx Floor Area (Sq.Ft.) *"
                  type="number"
                  min={200}
                  max={100000}
                  required
                  value={approxSqFt}
                  onChange={(e) => setApproxSqFt(e.target.value ? Number(e.target.value) : "")}
                  leftIcon={<Layers className="w-4 h-4" />}
                />

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Current Condition
                  </label>
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value as PropertyActivationRequest["current_condition"])}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-semibold text-slate-900 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                  >
                    <option value="fully_furnished">Fully Furnished & Wired</option>
                    <option value="partially_furnished">Partially Furnished</option>
                    <option value="bare_shell">Warm Bare Shell</option>
                    <option value="needs_renovation">Needs Architectural Refurbishment</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Step 3: Existing Facilities Checklist */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Existing Facilities & Infrastructure
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {facilitiesOptions.map((fac) => (
                  <label
                    key={fac}
                    className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 text-xs text-slate-700 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={existingFacilities.includes(fac)}
                      onChange={() => handleFacilityToggle(fac)}
                      className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    />
                    <span className="truncate">{fac}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Step 4: Budget & Participation Model */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-teal-600" />
                3. Investment Budget & Preferred Model
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Input
                  label="Expected Fit-out Budget (USD)"
                  type="number"
                  min={0}
                  value={expectedBudget}
                  onChange={(e) => setExpectedBudget(e.target.value ? Number(e.target.value) : "")}
                  leftIcon={<DollarSign className="w-4 h-4" />}
                  helperText="Enter 0 if seeking co-invested model"
                />

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Preferred Model
                  </label>
                  <select
                    value={preferredModel}
                    onChange={(e) => setPreferredModel(e.target.value as PropertyActivationRequest["preferred_model"])}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-semibold text-slate-900 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                  >
                    <option value="assisted_activation">Assisted Activation (Recommended)</option>
                    <option value="self_managed">Self-Managed Listing</option>
                    <option value="managed_partner">Managed Turnkey Operator</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Target Timeline
                  </label>
                  <select
                    value={targetTimeline}
                    onChange={(e) => setTargetTimeline(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-semibold text-slate-900 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                  >
                    <option value="Immediate (< 30 days)">Immediate (&lt; 30 days)</option>
                    <option value="Within 60 days">Within 60 days</option>
                    <option value="Within 90 days">Within 90 days</option>
                    <option value="Flexible / Exploring">Flexible / Exploring</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Step 5: Representative Photography */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Select Representative Site Photo
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {samplePhotos.map((photo, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedPhoto(photo.url)}
                    className={`relative rounded-xl overflow-hidden border-2 cursor-pointer transition-all ${
                      selectedPhoto === photo.url
                        ? "border-teal-600 ring-2 ring-teal-500/30 scale-102"
                        : "border-slate-200 opacity-70 hover:opacity-100"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.url} alt={photo.label} className="h-24 w-full object-cover" />
                    <div className="p-1.5 bg-white text-[11px] font-semibold text-slate-800 text-center truncate">
                      {photo.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Additional Notes */}
            <div className="pt-2">
              <Textarea
                label="Additional Context or Constraints"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Share any special zoning details, building access hours, current leases, or conversion goals..."
              />
            </div>

            {/* Submit Button */}
            <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-slate-500 text-center sm:text-left">
                By submitting, you confirm ownership authority or legal mandate to evaluate this property.
              </div>
              <Button
                type="submit"
                variant="teal"
                size="lg"
                className="w-full sm:w-auto font-bold shadow-md shadow-teal-700/20"
                isLoading={isSubmitting}
              >
                <span>Submit Property for Evaluation</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>

          </form>

        </div>
      </section>

      {/* Submission Success Confirmation Modal */}
      {submittedRequest && (
        <Modal
          isOpen={Boolean(submittedRequest)}
          onClose={() => setSubmittedRequest(null)}
          title="Property Activation Request Registered!"
          description="Your property is now logged into SpaceGo's Demand-Backed Activation pipeline."
          maxWidth="lg"
        >
          <div className="space-y-5">
            {/* Reference Header */}
            <div className="p-4 rounded-2xl bg-teal-50 border border-teal-200 text-teal-950 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs uppercase font-bold text-teal-700">Tracking Reference</span>
                <span className="text-base font-black font-mono tracking-wider">{submittedRequest.id}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs uppercase font-bold text-teal-700">Initial Pipeline Status</span>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-900 border border-teal-300">
                  {submittedRequest.status.replace("_", " ").toUpperCase()}
                </span>
              </div>
            </div>

            {/* Preliminary 100-Point Score Card */}
            {submittedRequest.activation_score && (
              <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      Preliminary Activation Score
                    </h4>
                    <p className="text-[11px] text-slate-500">Based on initial floor specs & local market signals</p>
                  </div>
                  <div className="text-2xl font-black text-teal-600">
                    {submittedRequest.activation_score.total}/100
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 pt-2 border-t border-slate-100">
                  <div>• Demand Score: {submittedRequest.activation_score.demand_score}/30</div>
                  <div>• Economics Score: {submittedRequest.activation_score.economics_score}/25</div>
                  <div>• Physical Readiness: {submittedRequest.activation_score.readiness_score}/20</div>
                  <div>• Transit & Location: {submittedRequest.activation_score.location_score}/15</div>
                </div>

                <p className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-100 leading-relaxed">
                  {submittedRequest.activation_score.breakdown_notes}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="pt-2 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSubmittedRequest(null)}
              >
                Done
              </Button>
              <Link href={`/activation/track?ref=${submittedRequest.id}`}>
                <Button variant="teal" size="sm">
                  Go to Live Tracking Dashboard
                </Button>
              </Link>
            </div>
          </div>
        </Modal>
      )}

      <Footer />
    </div>
  );
}
