"use client";

import React, { useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useSpaceGoVersion } from "@/context/SpaceGoDataProvider";
import { SpaceGoStore } from "@/lib/data/store";
import { Booking, BookingStatus } from "@/types";
import { BookingStatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterTabs, PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Check, Inbox, X } from "lucide-react";

type FilterValue = "all" | BookingStatus;

const FILTERS: { value: FilterValue; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Awaiting reply" },
  { value: "approved", label: "Confirmed" },
  { value: "completed", label: "Completed" },
  { value: "declined", label: "Declined" },
  { value: "cancelled", label: "Cancelled" },
];

const DURATION_UNIT: Record<Booking["duration_type"], [string, string]> = {
  hourly: ["hour", "hours"],
  daily: ["day", "days"],
  monthly: ["month", "months"],
};

function formatDuration(b: Booking): string {
  const [one, many] = DURATION_UNIT[b.duration_type] ?? [b.duration_type, b.duration_type];
  return `${b.duration_units} ${b.duration_units === 1 ? one : many}`;
}

function seatsLabel(seats: number): string {
  return `${seats} ${seats === 1 ? "seat" : "seats"}`;
}

export default function OwnerBookingsPage() {
  const { user } = useAuth();
  const { success, error } = useToast();
  const dataVersion = useSpaceGoVersion();
  const [filterTab, setFilterTab] = useState<FilterValue>("all");
  const [busyBookingId, setBusyBookingId] = useState<string | null>(null);

  const bookings = useMemo<Booking[]>(() => {
    void dataVersion;
    return user ? SpaceGoStore.getBookingsByOwner(user.id) : [];
  }, [user, dataVersion]);

  const handleDecision = async (id: string, status: "approved" | "declined") => {
    if (busyBookingId) return;
    setBusyBookingId(id);
    const result = await SpaceGoStore.updateBookingStatus(id, status);
    setBusyBookingId(null);

    if (!result.ok) {
      error(status === "approved" ? "Could not approve booking" : "Could not decline booking", result.error);
      return;
    }
    success(
      status === "approved" ? "Booking confirmed" : "Request declined",
      status === "approved" ? `Booking ${id} is now confirmed.` : `Request ${id} has been declined.`
    );
  };

  const handleApprove = (id: string) => void handleDecision(id, "approved");
  const handleDecline = (id: string) => void handleDecision(id, "declined");

  const filtered = bookings.filter((b) => {
    if (filterTab === "all") return true;
    return b.status === filterTab;
  });

  const filterOptions = FILTERS.map((f) => ({
    ...f,
    count: f.value === "all" ? bookings.length : bookings.filter((b) => b.status === f.value).length,
  }));

  const renderActions = (b: Booking) =>
    b.status === "pending" ? (
      <div className="flex flex-wrap gap-2">
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
    ) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bookings"
        description="Confirm or decline requests for your spaces and keep track of past bookings."
      />

      <FilterTabs label="Filter bookings by status" value={filterTab} options={filterOptions} onChange={setFilterTab} />

      {filtered.length === 0 ? (
        bookings.length === 0 ? (
          <EmptyState
            icon={<Inbox />}
            title="No bookings yet"
            description="When someone requests or books one of your spaces, it will appear here."
          />
        ) : (
          <EmptyState
            icon={<Inbox />}
            title="No bookings with this status"
            description="Try another filter to see the rest of your bookings."
            actionLabel="Show all bookings"
            onAction={() => setFilterTab("all")}
          />
        )
      ) : (
        <>
          {/* Wide screens: table */}
          <Card padding="none" className="hidden overflow-hidden lg:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-surface-muted text-ink-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Booking</th>
                  <th scope="col" className="px-4 py-3 font-medium">Guest</th>
                  <th scope="col" className="px-4 py-3 font-medium">Dates</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Total</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((b) => (
                  <tr key={b.id} className="align-top">
                    <td className="px-4 py-4">
                      <div className="flex gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={b.space_image}
                          alt=""
                          className="h-12 w-12 shrink-0 rounded-md border border-line object-cover"
                        />
                        <div className="min-w-0">
                          <p className="text-base font-medium text-ink">{b.space_title}</p>
                          <p className="font-mono text-sm text-ink-subtle">{b.id}</p>
                          {b.special_requests && (
                            <p className="mt-1 max-w-xs text-sm text-ink-muted">
                              <span className="font-medium text-ink">Note:</span> {b.special_requests}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-ink">{b.user_name}</p>
                      <p className="break-all text-ink-muted">{b.user_email}</p>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <p className="text-ink">{formatDate(b.start_date)}</p>
                      <p className="text-ink-muted">
                        {formatDuration(b)} · {seatsLabel(b.seats)}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-right font-medium whitespace-nowrap text-ink">
                      {formatCurrency(b.total_price, b.currency)}
                    </td>
                    <td className="px-4 py-4">
                      <BookingStatusBadge status={b.status} />
                    </td>
                    <td className="px-4 py-4">{renderActions(b)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Small screens: stacked cards */}
          <ul className="space-y-3 lg:hidden">
            {filtered.map((b) => (
              <li key={b.id}>
                <Card padding="sm" className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={b.space_image}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded-md border border-line object-cover"
                      />
                      <div className="min-w-0">
                        <p className="text-base font-medium text-ink">{b.space_title}</p>
                        <p className="font-mono text-sm text-ink-subtle">{b.id}</p>
                      </div>
                    </div>
                    <BookingStatusBadge status={b.status} />
                  </div>

                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div className="col-span-2">
                      <dt className="text-ink-muted">Guest</dt>
                      <dd className="text-ink">
                        {b.user_name} <span className="break-all text-ink-muted">({b.user_email})</span>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-ink-muted">Starts</dt>
                      <dd className="text-ink">{formatDate(b.start_date)}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-muted">Length</dt>
                      <dd className="text-ink">
                        {formatDuration(b)} · {seatsLabel(b.seats)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-ink-muted">Total</dt>
                      <dd className="font-medium text-ink">{formatCurrency(b.total_price, b.currency)}</dd>
                    </div>
                  </dl>

                  {b.special_requests && (
                    <p className="text-sm text-ink-muted">
                      <span className="font-medium text-ink">Note:</span> {b.special_requests}
                    </p>
                  )}

                  {renderActions(b)}
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
