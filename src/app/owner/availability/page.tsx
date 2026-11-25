"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useSpaceGoVersion } from "@/context/SpaceGoDataProvider";
import { SpaceGoStore } from "@/lib/data/store";
import { Space, Booking } from "@/types";
import { buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatDate } from "@/lib/utils";
import { Building2, CalendarCheck, Info } from "lucide-react";

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

export default function OwnerAvailabilityPage() {
  const { user } = useAuth();
  const dataVersion = useSpaceGoVersion();
  const [pickedSpaceId, setSelectedSpaceId] = useState("");

  const spaces = useMemo<Space[]>(() => {
    void dataVersion;
    return user ? SpaceGoStore.getSpacesByOwner(user.id) : [];
  }, [user, dataVersion]);

  const bookings = useMemo<Booking[]>(() => {
    void dataVersion;
    return user ? SpaceGoStore.getBookingsByOwner(user.id) : [];
  }, [user, dataVersion]);

  const selectedSpaceId = pickedSpaceId || spaces[0]?.id || "";
  const activeSpace = spaces.find((s) => s.id === selectedSpaceId) || spaces[0];
  const spaceBookings = bookings
    .filter((b) => b.space_id === selectedSpaceId && b.status === "approved")
    .sort((a, b) => a.start_date.localeCompare(b.start_date));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Availability"
        description="See when each of your spaces is already booked."
      />

      <div className="flex gap-3 rounded-lg border border-line bg-surface-muted p-4 text-sm text-ink-muted">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink-subtle" aria-hidden="true" />
        <p>
          <span className="font-medium text-ink">Blocking dates isn&apos;t available yet.</span> For now, decline
          requests for dates you can&apos;t host, or unpublish a listing from{" "}
          <Link href="/owner/properties" className="font-medium text-accent hover:text-accent-hover">
            My listings
          </Link>{" "}
          to stop new requests.
        </p>
      </div>

      {spaces.length === 0 ? (
        <EmptyState
          icon={<Building2 />}
          title="No listings yet"
          description="Add a workspace to start taking bookings. Confirmed bookings will show here."
          action={
            <Link href="/owner/spaces/new" className={buttonClasses()}>
              Add a workspace
            </Link>
          }
        />
      ) : (
        <section aria-labelledby="schedule-heading" className="space-y-4">
          <div className="max-w-md">
            <Select
              label="Workspace"
              value={selectedSpaceId}
              onChange={(e) => setSelectedSpaceId(e.target.value)}
            >
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </Select>
          </div>

          <h2 id="schedule-heading" className="text-lg font-semibold text-ink">
            Confirmed bookings{activeSpace ? ` for ${activeSpace.title}` : ""}{" "}
            <span className="font-normal text-ink-subtle">({spaceBookings.length})</span>
          </h2>

          {spaceBookings.length === 0 ? (
            <EmptyState
              icon={<CalendarCheck />}
              title="No confirmed bookings"
              description="This space has no confirmed bookings right now. Requests waiting for your reply are on the Bookings page."
              action={
                <Link href="/owner/bookings" className={buttonClasses({ variant: "outline" })}>
                  Go to bookings
                </Link>
              }
            />
          ) : (
            <>
              {/* Wide screens: table */}
              <Card padding="none" className="hidden overflow-hidden sm:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-line bg-surface-muted text-ink-muted">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-medium">Starts</th>
                      <th scope="col" className="px-4 py-3 font-medium">Length</th>
                      <th scope="col" className="px-4 py-3 font-medium">Guest</th>
                      <th scope="col" className="px-4 py-3 font-medium">Reference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {spaceBookings.map((b) => (
                      <tr key={b.id}>
                        <td className="px-4 py-3 font-medium whitespace-nowrap text-ink">{formatDate(b.start_date)}</td>
                        <td className="px-4 py-3 text-ink-muted">
                          {formatDuration(b)} · {seatsLabel(b.seats)}
                        </td>
                        <td className="px-4 py-3 text-ink">{b.user_name}</td>
                        <td className="px-4 py-3 font-mono text-ink-muted">{b.id}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>

              {/* Small screens: stacked */}
              <Card padding="none" className="divide-y divide-line sm:hidden">
                {spaceBookings.map((b) => (
                  <div key={b.id} className="space-y-1 p-4 text-sm">
                    <p className="text-base font-medium text-ink">{formatDate(b.start_date)}</p>
                    <p className="text-ink-muted">
                      {formatDuration(b)} · {seatsLabel(b.seats)} · {b.user_name}
                    </p>
                    <p className="font-mono text-ink-subtle">{b.id}</p>
                  </div>
                ))}
              </Card>
            </>
          )}
        </section>
      )}
    </div>
  );
}
