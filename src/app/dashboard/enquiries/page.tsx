"use client";

import React, { useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useSpaceGoVersion } from "@/context/SpaceGoDataProvider";
import { SpaceGoStore } from "@/lib/data/store";
import { WorkspaceEnquiry } from "@/types";
import { DemandRequestModal } from "@/components/common/DemandRequestModal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { PageHeader } from "@/components/ui/PageHeader";
import { categoryNoun } from "@/lib/categories";
import { formatDate } from "@/lib/utils";
import { MessageSquarePlus, Plus } from "lucide-react";

const STATUS: Record<WorkspaceEnquiry["status"], { label: string; variant: "neutral" | "brand" | "success" }> = {
  new: { label: "Received", variant: "neutral" },
  contacted: { label: "Contacted", variant: "brand" },
  fulfilled: { label: "Fulfilled", variant: "success" },
};

function EnquiryStatusBadge({ status }: { status: WorkspaceEnquiry["status"] }) {
  const s = STATUS[status] ?? { label: status, variant: "neutral" as const };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

function typeLabel(category: WorkspaceEnquiry["category_requested"]): string {
  return category === "all" ? "Any type" : categoryNoun(category);
}

export default function SeekerEnquiriesPage() {
  const { user } = useAuth();
  const dataVersion = useSpaceGoVersion();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Only the signed-in user's own requests (RLS also enforces this remotely).
  const enquiries = useMemo<WorkspaceEnquiry[]>(() => {
    void dataVersion;
    return user ? SpaceGoStore.getEnquiriesByUser(user.id) : [];
  }, [user, dataVersion]);
  const isLoading = useMemo(() => {
    void dataVersion;
    return SpaceGoStore.isLoading() && enquiries.length === 0;
  }, [dataVersion, enquiries.length]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Space requests"
        description="Requests for spaces we don't list yet, such as a new area or a specific size. Each one shows whether we've been in touch."
        actions={
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            New request
          </Button>
        }
      />

      {isLoading ? (
        <Card padding="none" role="status" aria-label="Loading requests">
          <ul className="divide-y divide-line">
            {[1, 2, 3].map((n) => (
              <li key={n} className="space-y-2 px-5 py-4">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-4 w-2/3" />
              </li>
            ))}
          </ul>
        </Card>
      ) : enquiries.length === 0 ? (
        <EmptyState
          icon={<MessageSquarePlus />}
          title="No requests yet"
          description="Can't find a space in the area or size you need? Send a request with your location, team size and budget."
          actionLabel="Send a request"
          onAction={() => setIsModalOpen(true)}
        />
      ) : (
        <>
          {/* Mobile: stacked cards */}
          <ul className="space-y-3 md:hidden">
            {enquiries.map((enq) => (
              <li key={enq.id}>
                <Card padding="sm" className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-base font-medium text-ink">{enq.location_requested}</p>
                      <p className="text-sm text-ink-muted">{typeLabel(enq.category_requested)}</p>
                    </div>
                    <EnquiryStatusBadge status={enq.status} />
                  </div>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div>
                      <dt className="text-ink-muted">Seats</dt>
                      <dd className="text-ink">{enq.seats_needed}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-muted">Budget</dt>
                      <dd className="text-ink">{enq.budget_range || "Not specified"}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-muted">Submitted</dt>
                      <dd className="text-ink">{formatDate(enq.created_at)}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-muted">Reference</dt>
                      <dd className="break-all font-mono text-ink">{enq.id}</dd>
                    </div>
                  </dl>
                  {enq.notes && (
                    <p className="rounded-md bg-surface-muted p-3 text-sm text-ink-muted">{enq.notes}</p>
                  )}
                </Card>
              </li>
            ))}
          </ul>

          {/* md+: table */}
          <Card padding="none" className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Your space requests</caption>
              <thead className="border-b border-line bg-surface-muted text-ink-muted">
                <tr>
                  <th scope="col" className="px-5 py-3 font-medium">Location</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Seats</th>
                  <th scope="col" className="px-4 py-3 font-medium">Budget</th>
                  <th scope="col" className="px-4 py-3 font-medium">Submitted</th>
                  <th scope="col" className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {enquiries.map((enq) => (
                  <tr key={enq.id} className="align-top">
                    <td className="px-5 py-4">
                      <p className="font-medium text-ink">{enq.location_requested}</p>
                      <p className="text-ink-muted">{typeLabel(enq.category_requested)}</p>
                      {enq.notes && <p className="mt-1 line-clamp-2 max-w-md text-ink-muted">{enq.notes}</p>}
                      <p className="mt-1 font-mono text-ink-subtle">{enq.id}</p>
                    </td>
                    <td className="px-4 py-4 text-right text-ink">{enq.seats_needed}</td>
                    <td className="px-4 py-4 text-ink">{enq.budget_range || "Not specified"}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-ink">{formatDate(enq.created_at)}</td>
                    <td className="px-5 py-4">
                      <EnquiryStatusBadge status={enq.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}

      <DemandRequestModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
