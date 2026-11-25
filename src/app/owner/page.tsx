"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useSpaceGoVersion } from "@/context/SpaceGoDataProvider";
import { SpaceGoStore } from "@/lib/data/store";
import { Booking, Space } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader, StatCard } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  ArrowRight,
  Building2,
  CalendarCheck,
  Check,
  Inbox,
  MapPin,
  Plus,
  Receipt,
  Users,
  X,
} from "lucide-react";

const DURATION_UNIT: Record<Booking["duration_type"], [string, string]> = {
  hourly: ["hour", "hours"],
  daily: ["day", "days"],
  monthly: ["month", "months"],
};

function formatDuration(b: Booking): string {
  const [one, many] = DURATION_UNIT[b.duration_type] ?? [b.duration_type, b.duration_type];
  return `${b.duration_units} ${b.duration_units === 1 ? one : many}`;
}

function SpaceStatusBadge({ status }: { status: Space["status"] }) {
  switch (status) {
    case "published":
      return <Badge variant="success">Published</Badge>;
    case "under_review":
      return <Badge variant="warning">Under review</Badge>;
    case "archived":
      return <Badge variant="neutral">Archived</Badge>;
    case "draft":
    default:
      return <Badge variant="neutral">Draft</Badge>;
  }
}

function spaceRate(space: Space): string | null {
  if (space.pricing.daily) return `${formatCurrency(space.pricing.daily, space.pricing.currency)} / day`;
  if (space.pricing.hourly) return `${formatCurrency(space.pricing.hourly, space.pricing.currency)} / hour`;
  if (space.pricing.monthly) return `${formatCurrency(space.pricing.monthly, space.pricing.currency)} / month`;
  return null;
}

export default function OwnerOverviewPage() {
  const { user } = useAuth();
  const { success, error } = useToast();
  const dataVersion = useSpaceGoVersion();
  const [busyBookingId, setBusyBookingId] = useState<string | null>(null);

  const properties = useMemo<Space[]>(() => {
    void dataVersion;
    return user ? SpaceGoStore.getSpacesByOwner(user.id) : [];
  }, [user, dataVersion]);

  const bookings = useMemo<Booking[]>(() => {
    void dataVersion;
    return user ? SpaceGoStore.getBookingsByOwner(user.id) : [];
  }, [user, dataVersion]);

  const pendingBookings = bookings.filter((b) => b.status === "pending");
  const approvedBookings = bookings.filter((b) => b.status === "approved" || b.status === "completed");
  const totalRevenue = approvedBookings.reduce((sum, b) => sum + b.total_price, 0);
  const publishedCount = properties.filter((s) => s.status === "published").length;

  const handleDecision = async (bookingId: string, status: "approved" | "declined") => {
    if (busyBookingId) return;
    setBusyBookingId(bookingId);
    const result = await SpaceGoStore.updateBookingStatus(bookingId, status);
    setBusyBookingId(null);

    if (!result.ok) {
      error(status === "approved" ? "Could not approve booking" : "Could not decline booking", result.error);
      return;
    }
    if (status === "approved") {
      success("Booking confirmed", `Booking ${bookingId} is now confirmed.`);
    } else {
      success("Request declined", `Request ${bookingId} has been declined.`);
    }
  };

  const handleApprove = (bookingId: string) => void handleDecision(bookingId, "approved");
  const handleDecline = (bookingId: string) => void handleDecision(bookingId, "declined");

  return (
    <div className="space-y-8">
      <PageHeader
        title="Overview"
        description="Your listings and the booking requests waiting for your reply."
        actions={
          <Link href="/owner/spaces/new" className={buttonClasses()}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add a workspace
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Listings"
          value={properties.length}
          hint={`${publishedCount} published`}
          icon={<Building2 />}
        />
        <StatCard
          label="Awaiting your reply"
          value={pendingBookings.length}
          hint="Booking requests"
          icon={<Inbox />}
        />
        <StatCard
          label="Confirmed bookings"
          value={approvedBookings.length}
          hint="Confirmed and completed"
          icon={<CalendarCheck />}
        />
        <StatCard
          label="Confirmed booking value"
          value={formatCurrency(totalRevenue)}
          hint="Total price of confirmed and completed bookings, before fees"
          icon={<Receipt />}
        />
      </div>

      {/* Requests awaiting a reply */}
      <section aria-labelledby="pending-heading" className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 id="pending-heading" className="text-lg font-semibold text-ink">
            Requests awaiting your reply
          </h2>
          <Link
            href="/owner/bookings"
            className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-accent hover:text-accent-hover"
          >
            All bookings
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        {pendingBookings.length === 0 ? (
          <EmptyState
            icon={<Inbox />}
            title="No requests waiting"
            description="New booking requests for your spaces will appear here for you to confirm or decline."
            action={
              <Link href="/owner/bookings" className={buttonClasses({ variant: "outline" })}>
                View all bookings
              </Link>
            }
          />
        ) : (
          <Card padding="none" className="divide-y divide-line">
            {pendingBookings.map((b) => (
              <div key={b.id} className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={b.space_image}
                    alt=""
                    className="h-14 w-14 shrink-0 rounded-md border border-line object-cover"
                  />
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-base font-medium text-ink">{b.space_title}</p>
                    <p className="text-sm text-ink-muted">
                      {b.user_name} · {formatDate(b.start_date)} · {formatDuration(b)} · {b.seats}{" "}
                      {b.seats === 1 ? "seat" : "seats"}
                    </p>
                    <p className="font-mono text-sm text-ink-subtle">{b.id}</p>
                    {b.special_requests && (
                      <p className="max-w-xl text-sm text-ink-muted">
                        <span className="font-medium text-ink">Note:</span> {b.special_requests}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 lg:shrink-0 lg:justify-end">
                  <span className="mr-2 text-base font-semibold text-ink">
                    {formatCurrency(b.total_price, b.currency)}
                  </span>
                  <Button
                    size="sm"
                    onClick={() => handleApprove(b.id)}
                    disabled={busyBookingId !== null}
                    isLoading={busyBookingId === b.id}
                  >
                    {busyBookingId !== b.id && <Check className="h-4 w-4" aria-hidden="true" />}
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDecline(b.id)}
                    disabled={busyBookingId !== null}
                    className="text-danger"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                    Decline
                  </Button>
                </div>
              </div>
            ))}
          </Card>
        )}
      </section>

      {/* Listings preview */}
      <section aria-labelledby="listings-heading" className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 id="listings-heading" className="text-lg font-semibold text-ink">
            Your listings
          </h2>
          {properties.length > 0 && (
            <Link
              href="/owner/properties"
              className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-accent hover:text-accent-hover"
            >
              Manage all ({properties.length})
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          )}
        </div>

        {properties.length === 0 ? (
          <EmptyState
            icon={<Building2 />}
            title="No listings yet"
            description="Add your first workspace so people can find and book it."
            action={
              <Link href="/owner/spaces/new" className={buttonClasses()}>
                Add a workspace
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {properties.slice(0, 3).map((space) => {
              const rate = spaceRate(space);
              return (
                <Card key={space.id} padding="sm" className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="line-clamp-2 text-base font-medium text-ink">{space.title}</h3>
                    <SpaceStatusBadge status={space.status} />
                  </div>
                  <div className="space-y-1 text-sm text-ink-muted">
                    <p className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 shrink-0 text-ink-subtle" aria-hidden="true" />
                      {space.location.city}
                    </p>
                    <p className="flex items-center gap-1.5">
                      <Users className="h-4 w-4 shrink-0 text-ink-subtle" aria-hidden="true" />
                      Up to {space.capacity} people
                    </p>
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-3">
                    <span className="text-sm font-medium text-ink">{rate ?? "No price set"}</span>
                    <Link
                      href={`/spaces/${space.id}`}
                      className="inline-flex min-h-11 items-center text-sm font-medium text-accent hover:text-accent-hover"
                    >
                      View listing
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
