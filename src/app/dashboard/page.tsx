"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useSpaceGoVersion } from "@/context/SpaceGoDataProvider";
import { SpaceGoStore } from "@/lib/data/store";
import { Booking, Space } from "@/types";
import { BookingStatusBadge } from "@/components/ui/Badge";
import { buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { PageHeader, StatCard } from "@/components/ui/PageHeader";
import { formatCurrency, formatDate } from "@/lib/utils";
import { CalendarCheck, MapPin, ArrowRight, Search } from "lucide-react";

export default function SeekerOverviewPage() {
  const { user } = useAuth();
  const dataVersion = useSpaceGoVersion();

  const bookings = useMemo<Booking[]>(() => {
    void dataVersion;
    return user ? SpaceGoStore.getBookingsBySeeker(user.id) : [];
  }, [user, dataVersion]);

  const savedSpaces = useMemo<Space[]>(() => {
    void dataVersion;
    if (!user) return [];
    const favIds = SpaceGoStore.getUserFavourites(user.id);
    return SpaceGoStore.getPublishedSpaces().filter((s) => favIds.includes(s.id));
  }, [user, dataVersion]);

  const isLoading = useMemo(() => {
    void dataVersion;
    return SpaceGoStore.isLoading() && bookings.length === 0;
  }, [dataVersion, bookings.length]);

  const upcomingBooking = bookings.find((b) => b.status === "approved" || b.status === "pending");
  // Totals are kept per currency; amounts in different currencies are never added together.
  const spendByCurrency = bookings
    .filter((b) => b.status === "approved" || b.status === "completed")
    .reduce<Record<string, number>>((totals, b) => {
      const currency = b.currency || "USD";
      totals[currency] = (totals[currency] ?? 0) + b.total_price;
      return totals;
    }, {});
  const spendEntries = Object.entries(spendByCurrency);
  const totalSpendLabel =
    spendEntries.length === 0
      ? "—"
      : spendEntries.map(([currency, amount]) => formatCurrency(amount, currency)).join(" · ");
  const pendingCount = bookings.filter((b) => b.status === "pending").length;

  const firstName = user?.full_name?.split(" ")[0];

  return (
    <div className="space-y-8">
      <PageHeader
        title={firstName ? `Welcome back, ${firstName}` : "Overview"}
        description="Your bookings, saved spaces and space requests in one place."
        actions={
          <Link href="/spaces" className={buttonClasses({ variant: "primary" })}>
            <Search className="h-4 w-4" aria-hidden="true" />
            Find a space
          </Link>
        }
      />

      {/* Summary numbers, all computed from your own bookings and saved list */}
      <section aria-label="Summary" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isLoading ? (
          [1, 2, 3, 4].map((n) => <Skeleton key={n} className="h-32 rounded-lg" />)
        ) : (
          <>
            <StatCard label="Bookings" value={bookings.length} hint="Every booking request you've made" />
            <StatCard label="Awaiting host" value={pendingCount} hint="Requests the host hasn't answered yet" />
            <StatCard label="Saved spaces" value={savedSpaces.length} hint="Spaces you've marked with the heart" />
            <StatCard
              label="Confirmed spend"
              value={totalSpendLabel}
              hint="Total of confirmed and completed bookings"
            />
          </>
        )}
      </section>

      {/* Next booking */}
      {upcomingBooking && (
        <section aria-labelledby="next-booking-heading">
          <h2 id="next-booking-heading" className="mb-3 text-lg font-semibold text-ink">
            Next booking
          </h2>
          <Card padding="none" className="overflow-hidden">
            <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div className="flex min-w-0 items-start gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={upcomingBooking.space_image}
                  alt=""
                  className="h-20 w-20 shrink-0 rounded-md object-cover"
                />
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-ink">{upcomingBooking.space_title}</h3>
                    <BookingStatusBadge status={upcomingBooking.status} />
                  </div>
                  <p className="flex items-center gap-1.5 text-sm text-ink-muted">
                    <MapPin className="h-4 w-4 shrink-0 text-ink-subtle" aria-hidden="true" />
                    <span className="truncate">{upcomingBooking.space_location}</span>
                  </p>
                  <p className="text-sm text-ink-muted">
                    {formatDate(upcomingBooking.start_date)} · {upcomingBooking.duration_units}{" "}
                    {upcomingBooking.duration_type} · {upcomingBooking.seats}{" "}
                    {upcomingBooking.seats === 1 ? "seat" : "seats"}
                  </p>
                </div>
              </div>

              {upcomingBooking.access_code && (
                <div className="shrink-0 rounded-md border border-line bg-surface-muted px-4 py-3 sm:text-right">
                  <p className="text-sm text-ink-muted">Access code</p>
                  <p className="font-mono text-lg font-semibold text-ink">{upcomingBooking.access_code}</p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3 text-sm sm:px-6">
              <span className="text-ink-muted">
                Reference <span className="font-mono text-ink">{upcomingBooking.id}</span>
              </span>
              <Link
                href="/dashboard/bookings"
                className="inline-flex items-center gap-1 font-medium text-accent hover:underline"
              >
                All bookings
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </Card>
        </section>
      )}

      {/* Recent bookings */}
      <section aria-labelledby="recent-heading">
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 id="recent-heading" className="text-lg font-semibold text-ink">
            Recent bookings
          </h2>
          {bookings.length > 0 && (
            <Link href="/dashboard/bookings" className="text-sm font-medium text-accent hover:underline">
              View all ({bookings.length})
            </Link>
          )}
        </div>

        {isLoading ? (
          <Card padding="none" role="status" aria-label="Loading bookings">
            <ul className="divide-y divide-line">
              {[1, 2, 3].map((n) => (
                <li key={n} className="flex items-center gap-4 px-5 py-4">
                  <Skeleton className="h-12 w-12 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-4 w-1/3" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                </li>
              ))}
            </ul>
          </Card>
        ) : bookings.length === 0 ? (
          <EmptyState
            icon={<CalendarCheck />}
            title="No bookings yet"
            description="When you request a space, it will appear here with its status and access details."
            action={
              <Link href="/spaces" className={buttonClasses({ variant: "outline" })}>
                Find a space
              </Link>
            }
          />
        ) : (
          <Card padding="none">
            <ul className="divide-y divide-line">
              {bookings.slice(0, 4).map((b) => (
                <li
                  key={b.id}
                  className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between md:grid md:grid-cols-[minmax(0,1fr)_8rem_9rem] md:gap-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={b.space_image} alt="" className="h-12 w-12 shrink-0 rounded-md object-cover" />
                    <div className="min-w-0">
                      <p className="truncate text-base font-medium text-ink">{b.space_title}</p>
                      <p className="text-sm text-ink-muted">
                        {formatDate(b.start_date)} · {b.duration_units} {b.duration_type}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-4 md:contents">
                    <span className="text-sm font-medium text-ink md:text-right">
                      {formatCurrency(b.total_price, b.currency)}
                    </span>
                    <span className="md:justify-self-end">
                      <BookingStatusBadge status={b.status} />
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </div>
  );
}
