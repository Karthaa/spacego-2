"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { useSpaceGoVersion } from "@/context/SpaceGoDataProvider";
import { SpaceGoStore } from "@/lib/data/store";
import { Space, Booking, PropertyActivationRequest } from "@/types";
import { BookingStatusBadge, ActivationStatusBadge } from "@/components/ui/Badge";
import { buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader, StatCard } from "@/components/ui/PageHeader";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ArrowRight, Building2, CalendarCheck, Receipt, Sparkles } from "lucide-react";

export default function AdminOverviewPage() {
  const dataVersion = useSpaceGoVersion();
  const { spaces, bookings, activations } = useMemo<{
    spaces: Space[];
    bookings: Booking[];
    activations: PropertyActivationRequest[];
  }>(() => {
    void dataVersion;
    return {
      spaces: SpaceGoStore.getSpaces(),
      bookings: SpaceGoStore.getBookings(),
      activations: SpaceGoStore.getActivationRequests(),
    };
  }, [dataVersion]);

  const confirmedBookings = bookings.filter((b) => b.status === "approved" || b.status === "completed");
  const confirmedValue = confirmedBookings.reduce((sum, b) => sum + b.total_price, 0);

  // Booking totals already include the 10% service fee (fee = base × 10%),
  // so the fee share of a total is total × 10/110.
  const estimatedServiceFees = Math.round((confirmedValue * 10) / 110);
  const pendingActivations = activations.filter((a) => a.status === "submitted" || a.status === "under_review");

  return (
    <div className="space-y-8">
      <PageHeader
        title="Overview"
        description="Bookings, listings and activation requests across SpaceGo."
        actions={
          <Link href="/admin/activations" className={buttonClasses({ variant: "primary", size: "sm" })}>
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Review activations ({pendingActivations.length})
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Confirmed booking value"
          value={formatCurrency(confirmedValue)}
          hint={`${confirmedBookings.length} confirmed or completed bookings, fees included`}
          icon={<CalendarCheck />}
        />
        <StatCard
          label="Service fees in those bookings"
          value={formatCurrency(estimatedServiceFees)}
          hint="Approximate: total × 10/110 (10% fee is included in totals)"
          icon={<Receipt />}
        />
        <StatCard
          label="Spaces"
          value={spaces.length}
          hint={`${spaces.filter((s) => s.status === "published").length} published`}
          icon={<Building2 />}
        />
        <StatCard
          label="Activation requests waiting"
          value={pendingActivations.length}
          hint="Submitted or under review"
          icon={<Sparkles />}
        />
      </div>

      <Card padding="none">
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-lg font-semibold text-ink">Activation requests</h2>
            <p className="text-sm text-ink-muted">{activations.length} in total, newest first</p>
          </div>
          <Link
            href="/admin/activations"
            className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:text-accent-hover"
          >
            View all
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        {activations.length === 0 ? (
          <div className="p-5 sm:p-6">
            <EmptyState
              icon={<Sparkles />}
              title="No activation requests yet"
              description="When an owner submits a property for activation, it will appear here for review."
            />
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {activations.slice(0, 3).map((act) => (
              <li
                key={act.id}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <ActivationStatusBadge status={act.status} />
                    <span className="font-mono text-xs text-ink-subtle">{act.id}</span>
                  </div>
                  <p className="truncate text-base font-medium text-ink">
                    {act.property_address}, {act.city}
                  </p>
                  <p className="text-sm text-ink-muted">
                    {act.owner_name} · {act.approx_square_feet.toLocaleString()} sq ft ·{" "}
                    {act.current_condition.replace(/_/g, " ")}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  {act.activation_score && (
                    <span className="text-sm text-ink-muted">
                      Score <span className="font-semibold text-ink">{act.activation_score.total}</span>/100
                    </span>
                  )}
                  <Link href="/admin/activations" className={buttonClasses({ variant: "outline", size: "sm" })}>
                    Review
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card padding="none">
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-lg font-semibold text-ink">Recent bookings</h2>
            <p className="text-sm text-ink-muted">Latest 5 of {bookings.length}</p>
          </div>
          <Link
            href="/admin/bookings"
            className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:text-accent-hover"
          >
            All bookings
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        {bookings.length === 0 ? (
          <div className="p-5 sm:p-6">
            <EmptyState
              icon={<CalendarCheck />}
              title="No bookings yet"
              description="Bookings made by guests will show up here."
            />
          </div>
        ) : (
          <div role="table" aria-label="Recent bookings">
            <div
              role="row"
              className="hidden border-b border-line bg-surface-muted px-6 py-2.5 text-sm font-medium text-ink-muted md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_9rem] md:gap-4"
            >
              <span role="columnheader">Space</span>
              <span role="columnheader">Guest</span>
              <span role="columnheader">Date</span>
              <span role="columnheader" className="text-right">Total</span>
              <span role="columnheader">Status</span>
            </div>
            <div role="rowgroup" className="divide-y divide-line">
              {bookings.slice(0, 5).map((b) => (
                <div
                  key={b.id}
                  role="row"
                  className="flex flex-col gap-1.5 px-5 py-4 sm:px-6 md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_9rem] md:items-center md:gap-4 md:py-3"
                >
                  <div role="cell" className="min-w-0">
                    <p className="truncate text-base font-medium text-ink">{b.space_title}</p>
                    <p className="font-mono text-xs text-ink-subtle">{b.id}</p>
                  </div>
                  <div role="cell" className="min-w-0 truncate text-sm text-ink-muted">
                    {b.user_name}
                  </div>
                  <div role="cell" className="text-sm text-ink-muted">
                    {formatDate(b.start_date)}
                  </div>
                  <div role="cell" className="text-sm font-medium text-ink md:text-right">
                    {formatCurrency(b.total_price, b.currency)}
                  </div>
                  <div role="cell">
                    <BookingStatusBadge status={b.status} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
