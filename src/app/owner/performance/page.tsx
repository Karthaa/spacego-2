"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useSpaceGoVersion } from "@/context/SpaceGoDataProvider";
import { SpaceGoStore } from "@/lib/data/store";
import { Booking, Space } from "@/types";
import { buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader, StatCard } from "@/components/ui/PageHeader";
import { formatCurrency } from "@/lib/utils";
import { BarChart3, CalendarCheck, CheckCircle2, Inbox, XCircle } from "lucide-react";

/** Bookings that count towards booking value: confirmed or already completed. */
function isConfirmed(b: Booking): boolean {
  return b.status === "approved" || b.status === "completed";
}

/** Sums booking totals per currency so mixed currencies are never added together. */
function valueByCurrency(bookings: Booking[]): string {
  const totals = new Map<string, number>();
  for (const b of bookings) {
    const currency = b.currency || "USD";
    totals.set(currency, (totals.get(currency) ?? 0) + b.total_price);
  }
  if (totals.size === 0) return formatCurrency(0);
  return Array.from(totals.entries())
    .map(([currency, amount]) => formatCurrency(amount, currency))
    .join(" + ");
}

interface SpaceRow {
  space: Space;
  total: number;
  pending: number;
  confirmed: number;
  value: string;
}

export default function OwnerPerformancePage() {
  const { user } = useAuth();
  const dataVersion = useSpaceGoVersion();

  const spaces = useMemo<Space[]>(() => {
    void dataVersion;
    return user ? SpaceGoStore.getSpacesByOwner(user.id) : [];
  }, [user, dataVersion]);

  const bookings = useMemo<Booking[]>(() => {
    void dataVersion;
    return user ? SpaceGoStore.getBookingsByOwner(user.id) : [];
  }, [user, dataVersion]);

  const pendingCount = bookings.filter((b) => b.status === "pending").length;
  const approvedCount = bookings.filter((b) => b.status === "approved").length;
  const completedCount = bookings.filter((b) => b.status === "completed").length;
  const closedCount = bookings.filter((b) => b.status === "declined" || b.status === "cancelled").length;
  const confirmedValue = valueByCurrency(bookings.filter(isConfirmed));

  const rows: SpaceRow[] = spaces.map((space) => {
    const forSpace = bookings.filter((b) => b.space_id === space.id);
    const confirmed = forSpace.filter(isConfirmed);
    return {
      space,
      total: forSpace.length,
      pending: forSpace.filter((b) => b.status === "pending").length,
      confirmed: confirmed.length,
      value: valueByCurrency(confirmed),
    };
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Performance"
        description="Booking counts and booking value for your listings, calculated from your bookings on SpaceGo."
      />

      {bookings.length === 0 ? (
        <EmptyState
          icon={<BarChart3 />}
          title="No bookings yet"
          description="Once people book your spaces, you'll see counts and booking value here."
          action={
            <Link
              href={spaces.length === 0 ? "/owner/spaces/new" : "/owner/properties"}
              className={buttonClasses({ variant: "outline" })}
            >
              {spaces.length === 0 ? "Add a workspace" : "Review your listings"}
            </Link>
          }
        />
      ) : (
        <>
          <section aria-labelledby="status-heading" className="space-y-4">
            <h2 id="status-heading" className="text-lg font-semibold text-ink">
              Bookings by status
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Awaiting your reply" value={pendingCount} icon={<Inbox />} />
              <StatCard label="Confirmed" value={approvedCount} icon={<CalendarCheck />} />
              <StatCard label="Completed" value={completedCount} icon={<CheckCircle2 />} />
              <StatCard label="Declined or cancelled" value={closedCount} icon={<XCircle />} />
            </div>
          </section>

          <Card>
            <p className="text-sm font-medium text-ink-muted">Confirmed booking value</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-ink">{confirmedValue}</p>
            <p className="mt-1 text-sm text-ink-subtle">
              Total price of confirmed and completed bookings, before any fees. This is not a payout amount.
            </p>
          </Card>
        </>
      )}

      {rows.length > 0 && (
        <section aria-labelledby="by-listing-heading" className="space-y-4">
          <h2 id="by-listing-heading" className="text-lg font-semibold text-ink">
            By listing
          </h2>

          {/* Wide screens: table */}
          <Card padding="none" className="hidden overflow-hidden md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-surface-muted text-ink-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Listing</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">All bookings</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Awaiting reply</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Confirmed or completed</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Confirmed value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((row) => (
                  <tr key={row.space.id}>
                    <td className="px-4 py-3">
                      <Link
                        href={`/spaces/${row.space.id}`}
                        className="font-medium text-ink hover:text-accent"
                      >
                        {row.space.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right text-ink">{row.total}</td>
                    <td className="px-4 py-3 text-right text-ink">{row.pending}</td>
                    <td className="px-4 py-3 text-right text-ink">{row.confirmed}</td>
                    <td className="px-4 py-3 text-right font-medium whitespace-nowrap text-ink">{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Small screens: stacked */}
          <ul className="space-y-3 md:hidden">
            {rows.map((row) => (
              <li key={row.space.id}>
                <Card padding="sm" className="space-y-3">
                  <Link href={`/spaces/${row.space.id}`} className="block text-base font-medium text-ink hover:text-accent">
                    {row.space.title}
                  </Link>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div>
                      <dt className="text-ink-muted">All bookings</dt>
                      <dd className="text-ink">{row.total}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-muted">Awaiting reply</dt>
                      <dd className="text-ink">{row.pending}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-muted">Confirmed or completed</dt>
                      <dd className="text-ink">{row.confirmed}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-muted">Confirmed value</dt>
                      <dd className="font-medium text-ink">{row.value}</dd>
                    </div>
                  </dl>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-sm text-ink-subtle">
        SpaceGo doesn&apos;t track occupancy, fees or payouts yet, so they aren&apos;t shown here.
      </p>
    </div>
  );
}
