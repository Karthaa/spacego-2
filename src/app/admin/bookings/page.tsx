"use client";

import React, { useMemo, useState } from "react";
import { useSpaceGoVersion } from "@/context/SpaceGoDataProvider";
import { SpaceGoStore } from "@/lib/data/store";
import { Booking, BookingStatus } from "@/types";
import { BookingStatusBadge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterTabs, PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency, formatDate } from "@/lib/utils";
import { CalendarCheck } from "lucide-react";

const STATUS_LABELS: Record<BookingStatus, string> = {
  pending: "Awaiting host",
  approved: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  declined: "Declined",
};

const DURATION_UNITS: Record<Booking["duration_type"], [string, string]> = {
  hourly: ["hour", "hours"],
  daily: ["day", "days"],
  monthly: ["month", "months"],
};

const GRID_COLS =
  "md:grid-cols-[minmax(0,1.8fr)_minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,1fr)_11rem]";

export default function AdminBookingsPage() {
  const { success, error } = useToast();
  const dataVersion = useSpaceGoVersion();
  const bookings = useMemo<Booking[]>(() => {
    void dataVersion;
    return SpaceGoStore.getBookings();
  }, [dataVersion]);
  const [filterStatus, setFilterStatus] = useState<"all" | BookingStatus>("all");
  const [busyBookingId, setBusyBookingId] = useState<string | null>(null);

  const handleStatusOverride = async (id: string, newStatus: BookingStatus) => {
    if (busyBookingId) return;
    setBusyBookingId(id);
    const result = await SpaceGoStore.updateBookingStatus(id, newStatus);
    setBusyBookingId(null);

    if (!result.ok) {
      error("Could not change booking status", result.error);
      return;
    }
    success("Booking status changed", `${id} is now ${STATUS_LABELS[newStatus].toLowerCase()}.`);
  };

  const filtered = bookings.filter((b) => {
    if (filterStatus === "all") return true;
    return b.status === filterStatus;
  });

  const filterOptions = (["all", "pending", "approved", "completed", "cancelled", "declined"] as const).map(
    (value) => ({
      value,
      label: value === "all" ? "All" : STATUS_LABELS[value],
      count: value === "all" ? bookings.length : bookings.filter((b) => b.status === value).length,
    })
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bookings"
        description="Every booking on SpaceGo. Changing a status here overrides the host's decision."
      />

      <FilterTabs label="Filter bookings by status" value={filterStatus} options={filterOptions} onChange={setFilterStatus} />

      {filtered.length === 0 ? (
        <EmptyState
          icon={<CalendarCheck />}
          title={filterStatus === "all" ? "No bookings yet" : `No ${STATUS_LABELS[filterStatus].toLowerCase()} bookings`}
          description={
            filterStatus === "all"
              ? "Bookings made by guests will appear here."
              : "Try another status filter to see more bookings."
          }
          actionLabel={filterStatus === "all" ? undefined : "Show all bookings"}
          onAction={filterStatus === "all" ? undefined : () => setFilterStatus("all")}
        />
      ) : (
        <Card padding="none" role="table" aria-label="Bookings">
          <div
            role="row"
            className={`hidden border-b border-line bg-surface-muted px-6 py-2.5 text-sm font-medium text-ink-muted md:grid md:gap-4 ${GRID_COLS}`}
          >
            <span role="columnheader">Space</span>
            <span role="columnheader">Guest</span>
            <span role="columnheader">Dates</span>
            <span role="columnheader" className="text-right">Total</span>
            <span role="columnheader">Status</span>
            <span role="columnheader">Change status</span>
          </div>

          <div role="rowgroup" className="divide-y divide-line">
            {filtered.map((b) => {
              const [unit, units] = DURATION_UNITS[b.duration_type] ?? [b.duration_type, b.duration_type];
              return (
                <div
                  key={b.id}
                  role="row"
                  className={`grid grid-cols-1 gap-3 px-5 py-4 sm:px-6 md:items-center md:gap-4 ${GRID_COLS}`}
                >
                  <div role="cell" className="min-w-0">
                    <p className="truncate text-base font-medium text-ink">{b.space_title}</p>
                    <p className="font-mono text-xs text-ink-subtle">{b.id}</p>
                  </div>

                  <div role="cell" className="min-w-0">
                    <p className="truncate text-sm text-ink">{b.user_name}</p>
                    <p className="truncate text-sm text-ink-subtle">{b.user_email}</p>
                  </div>

                  <div role="cell" className="text-sm">
                    <p className="text-ink">{formatDate(b.start_date)}</p>
                    <p className="text-ink-subtle">
                      {b.duration_units} {b.duration_units === 1 ? unit : units} · {b.seats}{" "}
                      {b.seats === 1 ? "seat" : "seats"}
                    </p>
                  </div>

                  <div role="cell" className="flex items-center justify-between gap-3 md:block md:text-right">
                    <span className="text-sm text-ink-muted md:hidden">Total</span>
                    <span className="text-sm font-medium text-ink">{formatCurrency(b.total_price, b.currency)}</span>
                  </div>

                  <div role="cell">
                    <BookingStatusBadge status={b.status} />
                  </div>

                  <div role="cell">
                    <Select
                      aria-label={`Change status for booking ${b.id}`}
                      value={b.status}
                      disabled={busyBookingId !== null}
                      onChange={(e) => handleStatusOverride(b.id, e.target.value as BookingStatus)}
                    >
                      <option value="pending">{STATUS_LABELS.pending}</option>
                      <option value="approved">{STATUS_LABELS.approved}</option>
                      <option value="completed">{STATUS_LABELS.completed}</option>
                      <option value="cancelled">{STATUS_LABELS.cancelled}</option>
                      <option value="declined">{STATUS_LABELS.declined}</option>
                    </Select>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
