"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useSpaceGoVersion } from "@/context/SpaceGoDataProvider";
import { SpaceGoStore } from "@/lib/data/store";
import { Booking, BookingStatus, SpaceAddress } from "@/types";
import { BookingStatusBadge } from "@/components/ui/Badge";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { PageHeader, FilterTabs } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency, formatDate } from "@/lib/utils";
import { CalendarCheck, MapPin, KeyRound, ExternalLink, Info, Navigation } from "lucide-react";

type FilterTab = "all" | BookingStatus;

const TABS: { value: FilterTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "approved", label: "Confirmed" },
  { value: "pending", label: "Awaiting host" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export default function SeekerBookingsPage() {
  const { user } = useAuth();
  const { success, error } = useToast();

  const dataVersion = useSpaceGoVersion();
  const bookings = useMemo<Booking[]>(() => {
    void dataVersion;
    return user ? SpaceGoStore.getBookingsBySeeker(user.id) : [];
  }, [user, dataVersion]);
  const isLoading = useMemo(() => {
    void dataVersion;
    return SpaceGoStore.isLoading() && bookings.length === 0;
  }, [dataVersion, bookings.length]);
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isPassModalOpen, setIsPassModalOpen] = useState(false);
  const [addressBooking, setAddressBooking] = useState<Booking | null>(null);
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const filteredBookings = bookings.filter((b) => {
    if (filterTab === "all") return true;
    return b.status === filterTab;
  });

  const tabOptions = TABS.map((tab) => ({
    ...tab,
    count: tab.value === "all" ? bookings.length : bookings.filter((b) => b.status === tab.value).length,
  }));
  const activeTabLabel = TABS.find((t) => t.value === filterTab)?.label.toLowerCase() ?? "";

  const handleCancelBooking = async (bookingId: string) => {
    if (isCancelling) return;
    setIsCancelling(true);
    const result = await SpaceGoStore.updateBookingStatus(bookingId, "cancelled");
    setIsCancelling(false);

    if (!result.ok) {
      error("Could not cancel booking", result.error);
      return;
    }
    setIsCancelConfirmOpen(false);
    setSelectedBooking(null);
    success("Booking Cancelled", "The slot has been released and the host notified.");
  };

  const openPass = (b: Booking) => {
    setSelectedBooking(b);
    setIsPassModalOpen(true);
  };

  const openCancel = (b: Booking) => {
    setSelectedBooking(b);
    setIsCancelConfirmOpen(true);
  };

  const renderActions = (b: Booking) => (
    <div className="flex flex-wrap items-center gap-2 md:justify-end">
      {b.status === "approved" && b.access_code && (
        <Button variant="outline" size="sm" onClick={() => openPass(b)}>
          <KeyRound className="h-4 w-4" aria-hidden="true" />
          Access code
        </Button>
      )}

      {(b.status === "approved" || b.status === "completed") && (
        <Button variant="outline" size="sm" onClick={() => setAddressBooking(b)}>
          <Navigation className="h-4 w-4" aria-hidden="true" />
          Address
        </Button>
      )}

      {b.status !== "cancelled" && b.status !== "completed" && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => openCancel(b)}
          className="text-danger hover:bg-danger-soft hover:text-danger"
        >
          Cancel
        </Button>
      )}

      <Link
        href={`/spaces/${b.space_id}`}
        aria-label={`View ${b.space_title}`}
        title="View space"
        className={buttonClasses({ variant: "ghost", size: "icon", className: "h-9 w-9 pointer-coarse:h-11 pointer-coarse:w-11" })}
      >
        <ExternalLink className="h-4 w-4" aria-hidden="true" />
      </Link>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bookings"
        description="Check the status of your requests, find access codes and cancel bookings you no longer need."
        actions={
          <Link href="/spaces" className={buttonClasses({ variant: "primary" })}>
            Book a space
          </Link>
        }
      />

      <FilterTabs label="Filter by status" value={filterTab} options={tabOptions} onChange={setFilterTab} />

      {isLoading ? (
        <Card padding="none" role="status" aria-label="Loading bookings">
          <ul className="divide-y divide-line">
            {[1, 2, 3, 4].map((n) => (
              <li key={n} className="flex items-center gap-4 px-5 py-4">
                <Skeleton className="h-14 w-14 shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-1/3" />
                </div>
                <Skeleton className="hidden h-6 w-24 sm:block" />
              </li>
            ))}
          </ul>
        </Card>
      ) : filteredBookings.length === 0 ? (
        bookings.length === 0 ? (
          <EmptyState
            icon={<CalendarCheck />}
            title="No bookings yet"
            description="Find a space and send a booking request. It will show up here with its status."
            action={
              <Link href="/spaces" className={buttonClasses({ variant: "outline" })}>
                Find a space
              </Link>
            }
          />
        ) : (
          <EmptyState
            icon={<CalendarCheck />}
            title={`No ${activeTabLabel} bookings`}
            description="None of your bookings have this status right now."
            actionLabel="Show all bookings"
            onAction={() => setFilterTab("all")}
          />
        )
      ) : (
        <>
          {/* Mobile: stacked cards */}
          <ul className="space-y-3 md:hidden">
            {filteredBookings.map((b) => (
              <li key={b.id}>
                <Card padding="sm" className="space-y-3">
                  <div className="flex items-start gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={b.space_image} alt="" className="h-16 w-16 shrink-0 rounded-md object-cover" />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-base font-medium text-ink">{b.space_title}</p>
                      <p className="flex items-center gap-1.5 text-sm text-ink-muted">
                        <MapPin className="h-4 w-4 shrink-0 text-ink-subtle" aria-hidden="true" />
                        <span className="truncate">{b.space_location}</span>
                      </p>
                      <BookingStatusBadge status={b.status} />
                    </div>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div>
                      <dt className="text-ink-muted">Date</dt>
                      <dd className="text-ink">
                        {formatDate(b.start_date)} · {b.duration_units} {b.duration_type}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-ink-muted">Total</dt>
                      <dd className="font-medium text-ink">{formatCurrency(b.total_price, b.currency)}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-ink-muted">Reference</dt>
                      <dd className="break-all font-mono text-ink">{b.id}</dd>
                    </div>
                  </dl>
                  <div className="border-t border-line pt-3">{renderActions(b)}</div>
                </Card>
              </li>
            ))}
          </ul>

          {/* md+: table */}
          <Card padding="none" className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Your bookings</caption>
              <thead className="border-b border-line bg-surface-muted text-ink-muted">
                <tr>
                  <th scope="col" className="px-5 py-3 font-medium">Space</th>
                  <th scope="col" className="px-4 py-3 font-medium">Date</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Total</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredBookings.map((b) => (
                  <tr key={b.id} className="align-middle">
                    <td className="px-5 py-4">
                      <div className="flex min-w-0 items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={b.space_image} alt="" className="h-12 w-12 shrink-0 rounded-md object-cover" />
                        <div className="min-w-0">
                          <p className="font-medium text-ink">{b.space_title}</p>
                          <p className="text-ink-muted">{b.space_location}</p>
                          <p className="font-mono text-ink-subtle">{b.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-ink">
                      {formatDate(b.start_date)}
                      <span className="block text-ink-muted">
                        {b.duration_units} {b.duration_type}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-right font-medium text-ink">
                      {formatCurrency(b.total_price, b.currency)}
                    </td>
                    <td className="px-4 py-4">
                      <BookingStatusBadge status={b.status} />
                    </td>
                    <td className="px-5 py-4">{renderActions(b)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {/* Access code modal */}
      {selectedBooking && isPassModalOpen && (
        <Modal
          isOpen={isPassModalOpen}
          onClose={() => setIsPassModalOpen(false)}
          title="Access code"
          description="Show this code when you arrive at the space."
          maxWidth="sm"
        >
          <div className="space-y-5">
            <div className="rounded-lg border border-line bg-surface-muted p-6 text-center">
              <p className="font-mono text-2xl font-semibold tracking-widest text-ink">
                {selectedBooking.access_code}
              </p>
              <p className="mt-3 text-sm text-ink-muted">
                {selectedBooking.space_title} · {formatDate(selectedBooking.start_date)}
              </p>
            </div>

            <Button variant="outline" className="w-full" onClick={() => setIsPassModalOpen(false)}>
              Done
            </Button>
          </div>
        </Modal>
      )}

      {addressBooking && (
        <BookingAddressModal
          booking={addressBooking}
          userId={user?.id ?? null}
          onClose={() => setAddressBooking(null)}
        />
      )}

      {/* Cancellation confirmation */}
      {selectedBooking && isCancelConfirmOpen && (
        <Modal
          isOpen={isCancelConfirmOpen}
          onClose={() => setIsCancelConfirmOpen(false)}
          title="Cancel this booking?"
          description={`${selectedBooking.space_title} on ${formatDate(selectedBooking.start_date)}`}
          maxWidth="sm"
        >
          <div className="space-y-5">
            <p className="flex gap-2 text-sm text-ink-muted">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink-subtle" aria-hidden="true" />
              <span>The booking will be marked as cancelled and the time will be released for others to book.</span>
            </p>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setIsCancelConfirmOpen(false)}>
                Keep booking
              </Button>
              <Button
                variant="danger"
                onClick={() => handleCancelBooking(selectedBooking.id)}
                isLoading={isCancelling}
              >
                Cancel booking
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/** Street address of a confirmed booking, fetched on demand from the database. */
function BookingAddressModal({
  booking,
  userId,
  onClose,
}: {
  booking: Booking;
  userId: string | null;
  onClose: () => void;
}) {
  const [state, setState] = useState<
    { status: "loading" } | { status: "ready"; address: SpaceAddress | null } | { status: "error"; message: string }
  >({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    SpaceGoStore.getSpaceAddress(booking.space_id, userId).then((result) => {
      if (cancelled) return;
      setState(result.ok ? { status: "ready", address: result.data } : { status: "error", message: result.error });
    });
    return () => {
      cancelled = true;
    };
  }, [booking.space_id, userId]);

  const address = state.status === "ready" ? state.address : null;
  const mapHref =
    address && address.lat !== null && address.lng !== null
      ? `https://www.openstreetmap.org/?mlat=${address.lat.toFixed(6)}&mlon=${address.lng.toFixed(6)}#map=18/${address.lat.toFixed(6)}/${address.lng.toFixed(6)}`
      : null;

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Address"
      description={`${booking.space_title} · ${formatDate(booking.start_date)}`}
      maxWidth="sm"
    >
      <div className="space-y-5" aria-live="polite">
        {state.status === "loading" && (
          <div className="space-y-2" aria-hidden="true">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        )}
        {state.status === "error" && (
          <p className="text-sm text-danger">Could not load the address. {state.message}</p>
        )}
        {state.status === "ready" && !address && (
          <p className="text-sm text-ink-muted">
            The address isn&apos;t available for this booking. It is shared once the host confirms a booking.
          </p>
        )}
        {address && (
          <div className="rounded-lg border border-line bg-surface-muted p-4">
            <p className="text-base font-medium text-ink">{address.address || "Street address not provided"}</p>
            <p className="mt-1 text-sm text-ink-muted">
              {[address.city, address.postal_code, address.country].filter(Boolean).join(", ")}
            </p>
            {address.landmark && <p className="mt-2 text-sm text-ink-muted">Landmark: {address.landmark}</p>}
          </div>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
          {mapHref && (
            <a href={mapHref} target="_blank" rel="noopener noreferrer" className={buttonClasses({ variant: "primary" })}>
              Open in map
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
          )}
        </div>
      </div>
    </Modal>
  );
}
