"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useSpaceGoVersion } from "@/context/SpaceGoDataProvider";
import { SpaceGoStore } from "@/lib/data/store";
import { Booking, BookingStatus } from "@/types";
import { BookingStatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import {
  CalendarCheck,
  MapPin,
  Clock,
  QrCode,
  XCircle,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Search,
} from "lucide-react";

export default function SeekerBookingsPage() {
  const { user } = useAuth();
  const { success, error } = useToast();

  const dataVersion = useSpaceGoVersion();
  const bookings = useMemo<Booking[]>(() => {
    void dataVersion;
    return user ? SpaceGoStore.getBookingsBySeeker(user.id) : [];
  }, [user, dataVersion]);
  const [filterTab, setFilterTab] = useState<"all" | BookingStatus>("all");
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isPassModalOpen, setIsPassModalOpen] = useState(false);
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const filteredBookings = bookings.filter((b) => {
    if (filterTab === "all") return true;
    return b.status === filterTab;
  });

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

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            My Workspace Bookings
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            View booking status, access passes, and manage your workspace reservations.
          </p>
        </div>

        <Link href="/spaces">
          <Button variant="teal" size="sm" className="font-bold">
            + Book Another Space
          </Button>
        </Link>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 bg-slate-200/70 p-1 rounded-2xl w-fit">
        {(["all", "approved", "pending", "completed", "cancelled"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilterTab(tab)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all cursor-pointer ${
              filterTab === tab
                ? "bg-white text-slate-950 shadow-xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {tab === "all" ? "All Bookings" : tab}
          </button>
        ))}
      </div>

      {/* Bookings List */}
      {filteredBookings.length === 0 ? (
        <EmptyState
          icon={<CalendarCheck className="w-8 h-8" />}
          title="No bookings in this tab"
          description="You don't have any reservations matching this status filter."
          actionLabel="Explore Workspaces"
          onAction={() => (window.location.href = "/spaces")}
        />
      ) : (
        <div className="space-y-4">
          {filteredBookings.map((b) => (
            <div
              key={b.id}
              className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs hover:border-slate-300 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-5"
            >
              <div className="flex items-start sm:items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={b.space_image}
                  alt={b.space_title}
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border border-slate-200 shrink-0"
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                      {b.id}
                    </span>
                    <BookingStatusBadge status={b.status} />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">{b.space_title}</h3>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{b.space_location}</span>
                  </div>
                  <div className="text-xs text-slate-600 font-medium">
                    Scheduled for: <span className="font-bold text-slate-900">{formatDate(b.start_date)}</span> ({b.duration_units} {b.duration_type})
                  </div>
                </div>
              </div>

              {/* Price & Action Buttons */}
              <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between border-t lg:border-t-0 pt-4 lg:pt-0 border-slate-100 gap-3">
                <div className="text-left lg:text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Paid</span>
                  <span className="text-lg font-bold text-slate-900">
                    {formatCurrency(b.total_price, b.currency)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {b.status === "approved" && b.access_code && (
                    <Button
                      variant="teal"
                      size="sm"
                      onClick={() => {
                        setSelectedBooking(b);
                        setIsPassModalOpen(true);
                      }}
                      className="gap-1 font-semibold"
                    >
                      <QrCode className="w-4 h-4" />
                      <span>Entry Pass</span>
                    </Button>
                  )}

                  {b.status !== "cancelled" && b.status !== "completed" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedBooking(b);
                        setIsCancelConfirmOpen(true);
                      }}
                      className="text-rose-600 border-rose-200 hover:bg-rose-50 hover:border-rose-300"
                    >
                      Cancel
                    </Button>
                  )}

                  <Link href={`/spaces/${b.space_id}`}>
                    <Button variant="ghost" size="sm">
                      <ExternalLink className="w-4 h-4 text-slate-500" />
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Digital Access Pass Modal */}
      {selectedBooking && isPassModalOpen && (
        <Modal
          isOpen={isPassModalOpen}
          onClose={() => setIsPassModalOpen(false)}
          title="Digital Entry Pass"
          description="Present this access code upon arrival at the workspace entrance or front desk."
          maxWidth="sm"
        >
          <div className="space-y-5 text-center">
            <div className="p-6 rounded-2xl bg-slate-950 text-white space-y-4 shadow-xl">
              <div className="w-16 h-16 rounded-2xl bg-teal-500/20 border border-teal-500/40 text-teal-400 mx-auto flex items-center justify-center">
                <QrCode className="w-8 h-8" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-teal-400 tracking-wider">
                  Check-in Code
                </span>
                <div className="text-2xl font-bold font-mono tracking-widest text-white mt-1">
                  {selectedBooking.access_code}
                </div>
              </div>
              <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-800">
                {selectedBooking.space_title} • {formatDate(selectedBooking.start_date)}
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setIsPassModalOpen(false)}
            >
              Done
            </Button>
          </div>
        </Modal>
      )}

      {/* Cancellation Confirmation Dialog */}
      {selectedBooking && isCancelConfirmOpen && (
        <Modal
          isOpen={isCancelConfirmOpen}
          onClose={() => setIsCancelConfirmOpen(false)}
          title="Cancel Workspace Booking"
          description="Are you sure you want to cancel this booking request?"
          maxWidth="sm"
        >
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
              <AlertCircle className="w-4 h-4 text-amber-600 inline mr-1 -mt-0.5" />
              Cancellation Policy: Requests can be cancelled anytime before host check-in. The calendar slot will be restored.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCancelConfirmOpen(false)}
              >
                Keep Booking
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => handleCancelBooking(selectedBooking.id)}
                isLoading={isCancelling}
              >
                Confirm Cancellation
              </Button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}
