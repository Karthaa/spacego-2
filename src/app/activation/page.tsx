"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/navigation/Navbar";
import { Footer } from "@/components/navigation/Footer";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Input, Textarea, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ActivationStatusBadge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/context/AuthContext";
import { SpaceGoStore } from "@/lib/data/store";
import { cn } from "@/lib/utils";
import { PropertyActivationRequest } from "@/types";
import { Layers, Phone, Mail, DollarSign, CheckCircle2 } from "lucide-react";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1400&q=80";

const REVIEW_STEPS = [
  {
    title: "Tell us about the space",
    body: "Share the address, size, current condition, existing facilities and your budget using the form below.",
  },
  {
    title: "The SpaceGo team reviews it",
    body: "A member of the team reads your submission. If they need more detail or a site visit, the status will say so.",
  },
  {
    title: "Follow the status",
    body: "Each status change and any notes from the team appear on the tracking page under your reference.",
  },
  {
    title: "Get ready to list",
    body: "When a request is marked ready for launch, the space can be prepared and listed for bookings.",
  },
];

const MODELS = [
  {
    title: "Self-managed listing",
    body: "Your space is already furnished and usable. You list it, set prices and availability, and handle requests from your host dashboard.",
  },
  {
    title: "Assisted activation",
    body: "Your space needs work before people can use it. The SpaceGo team reviews it and may request an on-site assessment before it is listed.",
  },
  {
    title: "Managed partner",
    body: "You would rather someone else ran the space day to day. Choose this and the team will discuss whether a managed arrangement is possible.",
  },
];

// Values are stored as-is on the request; labels are display only.
const FACILITY_OPTIONS = [
  { value: "Central HVAC", label: "Central air conditioning" },
  { value: "Passenger Elevator", label: "Passenger lift" },
  { value: "Restrooms", label: "Restrooms" },
  { value: "Commercial Fiber Conduit", label: "Fibre internet line" },
  { value: "100% Diesel Generator Backup", label: "Generator backup" },
  { value: "Covered Parking Bays", label: "Covered parking" },
  { value: "Street-Facing Private Entry", label: "Private street entrance" },
  { value: "Fire Sprinkler & Alarm System", label: "Fire sprinklers and alarm" },
];

const SAMPLE_PHOTOS = [
  {
    label: "Furnished office floor",
    url: "https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=800&q=80",
  },
  {
    label: "Industrial space",
    url: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=800&q=80",
  },
  {
    label: "Lounge or reception",
    url: "https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=800&q=80",
  },
  {
    label: "Empty open floor",
    url: "https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=800&q=80",
  },
];

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="p-5 sm:p-8">
      <fieldset>
        <legend className="text-lg font-semibold text-ink">{title}</legend>
        {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
        <div className="mt-5 space-y-5">{children}</div>
      </fieldset>
    </div>
  );
}

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

  const handleFacilityToggle = (fac: string) => {
    if (existingFacilities.includes(fac)) {
      setExistingFacilities(existingFacilities.filter((f) => f !== fac));
    } else {
      setExistingFacilities([...existingFacilities, fac]);
    }
  };

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
      success("Request submitted", `Reference: ${result.data.id}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <Navbar />

      <main id="main" className="flex-1">
        {/* Intro */}
        <section aria-labelledby="activation-heading" className="border-b border-line bg-surface">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-2 lg:items-center lg:px-8">
            <div>
              <p className="text-sm font-medium text-accent">For property owners</p>
              <h1
                id="activation-heading"
                className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl"
              >
                Turn unused space into bookable workspace
              </h1>
              <p className="mt-4 max-w-xl text-base text-ink-muted sm:text-lg">
                Have a vacant floor, a spare office suite or a hall that sits empty? Send us the
                details. The SpaceGo team reviews each submission and updates its status, so you
                can see where your request stands at any time.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="#submit-form" className={buttonClasses({ size: "lg" })}>
                  Submit your property
                </Link>
                <Link
                  href="/activation/track"
                  className={buttonClasses({ variant: "outline", size: "lg" })}
                >
                  Track a request
                </Link>
              </div>
            </div>
            <div className="relative hidden aspect-[4/3] overflow-hidden rounded-lg border border-line lg:block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={HERO_IMAGE}
                alt="An empty, open-plan office floor"
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>
          </div>
        </section>

        {/* How the review works */}
        <section
          aria-labelledby="steps-heading"
          className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8"
        >
          <h2 id="steps-heading" className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            How the review works
          </h2>
          <p className="mt-2 max-w-2xl text-base text-ink-muted">
            There is no automatic approval. People on the SpaceGo team look at every request.
          </p>
          <ol className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {REVIEW_STEPS.map((step, index) => (
              <li key={step.title} className="rounded-lg border border-line bg-surface p-6">
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-base font-semibold text-accent-soft-ink"
                >
                  {index + 1}
                </span>
                <h3 className="mt-4 text-lg font-semibold text-ink">{step.title}</h3>
                <p className="mt-2 text-base text-ink-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Participation models */}
        <section aria-labelledby="models-heading" className="border-y border-line bg-surface">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <h2 id="models-heading" className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              Choose how involved you want to be
            </h2>
            <p className="mt-2 max-w-2xl text-base text-ink-muted">
              You pick a preferred model on the form. It helps the team understand what you are
              looking for; it is not a commitment.
            </p>
            <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
              {MODELS.map((model) => (
                <div key={model.title} className="rounded-lg border border-line bg-canvas p-6">
                  <h3 className="text-lg font-semibold text-ink">{model.title}</h3>
                  <p className="mt-2 text-base text-ink-muted">{model.body}</p>
                </div>
              ))}
            </div>
            <p className="mt-6 text-sm text-ink-muted">
              Space already furnished and ready?{" "}
              <Link
                href="/owner/spaces/new"
                className="rounded-sm font-medium text-accent hover:text-accent-hover"
              >
                List it directly
              </Link>
              .
            </p>
          </div>
        </section>

        {/* Submission form */}
        <section
          id="submit-form"
          aria-labelledby="form-heading"
          className="mx-auto w-full max-w-3xl scroll-mt-20 px-4 py-16 sm:px-6 lg:px-8"
        >
          <h2 id="form-heading" className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Submit your property for review
          </h2>
          <p className="mt-2 text-base text-ink-muted">
            You&apos;ll get a reference number straight away. Use it to follow the review on the
            tracking page.
          </p>

          <form
            onSubmit={handleSubmit}
            className="mt-8 divide-y divide-line rounded-lg border border-line bg-surface"
          >
            {/* Your details */}
            <FormSection
              title="Your details"
              description="The owner, or the person authorised to act for them."
            >
              <Input
                label="Full name"
                required
                autoComplete="name"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
              />
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-4">
                <Input
                  label="Email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  leftIcon={<Mail aria-hidden="true" />}
                />
                <Input
                  label="Phone"
                  type="tel"
                  required
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  leftIcon={<Phone aria-hidden="true" />}
                />
              </div>
            </FormSection>

            {/* Property */}
            <FormSection title="Property">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 sm:gap-4">
                <div className="sm:col-span-2">
                  <Input
                    label="Address"
                    required
                    autoComplete="street-address"
                    value={propertyAddress}
                    onChange={(e) => setPropertyAddress(e.target.value)}
                    placeholder="Street, building and floor"
                  />
                </div>
                <Input
                  label="City"
                  required
                  autoComplete="address-level2"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 sm:gap-4">
                <Select
                  label="Type of property"
                  value={propertyType}
                  onChange={(e) => setPropertyType(e.target.value as PropertyActivationRequest["property_type"])}
                >
                  <option value="vacant_floor">Vacant commercial floor</option>
                  <option value="excess_office">Spare office suite</option>
                  <option value="retail_commercial">Retail or commercial unit</option>
                  <option value="hotel_space">Hotel business space</option>
                  <option value="independent_building">Standalone building</option>
                  <option value="studio_hall">Studio or event hall</option>
                </Select>

                <Input
                  label="Floor area (sq ft)"
                  type="number"
                  min={200}
                  max={100000}
                  required
                  value={approxSqFt}
                  onChange={(e) => setApproxSqFt(e.target.value ? Number(e.target.value) : "")}
                  leftIcon={<Layers aria-hidden="true" />}
                  helperText="An estimate is fine."
                />

                <Select
                  label="Current condition"
                  value={condition}
                  onChange={(e) => setCondition(e.target.value as PropertyActivationRequest["current_condition"])}
                >
                  <option value="fully_furnished">Fully furnished</option>
                  <option value="partially_furnished">Partially furnished</option>
                  <option value="bare_shell">Empty shell</option>
                  <option value="needs_renovation">Needs renovation</option>
                </Select>
              </div>
            </FormSection>

            {/* Facilities */}
            <FormSection
              title="Facilities already in place"
              description="Select everything the building has today."
            >
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {FACILITY_OPTIONS.map((fac) => (
                  <label
                    key={fac.value}
                    className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-line px-3 py-2 text-base text-ink transition-colors hover:bg-surface-muted"
                  >
                    <input
                      type="checkbox"
                      checked={existingFacilities.includes(fac.value)}
                      onChange={() => handleFacilityToggle(fac.value)}
                      className="h-4 w-4 shrink-0 accent-accent"
                    />
                    <span>{fac.label}</span>
                  </label>
                ))}
              </div>
            </FormSection>

            {/* Budget and timeline */}
            <FormSection title="Budget and timeline">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 sm:gap-4">
                <Input
                  label="Fit-out budget (USD)"
                  type="number"
                  min={0}
                  value={expectedBudget}
                  onChange={(e) => setExpectedBudget(e.target.value ? Number(e.target.value) : "")}
                  leftIcon={<DollarSign aria-hidden="true" />}
                  helperText="Enter 0 if you have no budget yet."
                />

                <Select
                  label="Preferred model"
                  value={preferredModel}
                  onChange={(e) => setPreferredModel(e.target.value as PropertyActivationRequest["preferred_model"])}
                >
                  <option value="assisted_activation">Assisted activation</option>
                  <option value="self_managed">Self-managed listing</option>
                  <option value="managed_partner">Managed partner</option>
                </Select>

                <Select
                  label="When do you want to open?"
                  value={targetTimeline}
                  onChange={(e) => setTargetTimeline(e.target.value)}
                >
                  <option value="Immediate (< 30 days)">Within 30 days</option>
                  <option value="Within 60 days">Within 60 days</option>
                  <option value="Within 90 days">Within 90 days</option>
                  <option value="Flexible / Exploring">Flexible or just exploring</option>
                </Select>
              </div>
            </FormSection>

            {/* Reference photo */}
            <FormSection
              title="Closest reference photo"
              description="Pick the example that looks most like your space today. It is attached to your request as a placeholder image."
            >
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {SAMPLE_PHOTOS.map((photo) => {
                  const selected = selectedPhoto === photo.url;
                  return (
                    <button
                      key={photo.url}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setSelectedPhoto(photo.url)}
                      className={cn(
                        "relative overflow-hidden rounded-md border-2 bg-surface text-left transition-colors",
                        selected ? "border-accent" : "border-line hover:border-line-strong"
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo.url} alt="" className="h-24 w-full object-cover" />
                      <span className="flex items-center gap-1.5 px-2.5 py-2 text-sm font-medium text-ink">
                        {selected && (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                        )}
                        <span className="truncate">{photo.label}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </FormSection>

            {/* Notes and submit */}
            <div className="space-y-6 p-5 sm:p-8">
              <Textarea
                label="Anything else we should know? (optional)"
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Access hours, current leases, zoning, what you would like the space to become"
              />

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-ink-muted">
                  By submitting, you confirm you own this property or are authorised to act for its
                  owner.
                </p>
                <Button
                  type="submit"
                  size="lg"
                  className="w-full shrink-0 sm:w-auto"
                  isLoading={isSubmitting}
                >
                  Submit for review
                </Button>
              </div>
            </div>
          </form>
        </section>
      </main>

      {/* Submission confirmation */}
      {submittedRequest && (
        <Modal
          isOpen={Boolean(submittedRequest)}
          onClose={() => setSubmittedRequest(null)}
          title="Request submitted"
          description="Keep this reference so you can follow the review."
          maxWidth="lg"
        >
          <div className="space-y-5">
            <dl className="divide-y divide-line rounded-md border border-line">
              <div className="flex items-center justify-between gap-4 px-4 py-3">
                <dt className="text-sm text-ink-muted">Reference</dt>
                <dd className="font-mono text-base font-semibold text-ink">{submittedRequest.id}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 px-4 py-3">
                <dt className="text-sm text-ink-muted">Status</dt>
                <dd>
                  <ActivationStatusBadge status={submittedRequest.status} />
                </dd>
              </div>
            </dl>

            <p className="text-base text-ink-muted">
              The SpaceGo team will review your submission and update its status. Any questions or
              notes from the team will appear on the tracking page.
            </p>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setSubmittedRequest(null)}>
                Done
              </Button>
              <Link
                href={`/activation/track?ref=${submittedRequest.id}`}
                className={buttonClasses()}
              >
                Track this request
              </Link>
            </div>
          </div>
        </Modal>
      )}

      <Footer />
    </div>
  );
}
