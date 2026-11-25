"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useSpaceGoVersion } from "@/context/SpaceGoDataProvider";
import { SpaceGoStore } from "@/lib/data/store";
import { PropertyActivationRequest } from "@/types";
import { ActivationStatusBadge } from "@/components/ui/Badge";
import { buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatDate } from "@/lib/utils";
import { ArrowRight, Building2, MapPin, Plus } from "lucide-react";

const PROPERTY_TYPE_LABEL: Record<PropertyActivationRequest["property_type"], string> = {
  vacant_floor: "Vacant floor",
  excess_office: "Unused office space",
  retail_commercial: "Retail or commercial unit",
  hotel_space: "Hotel space",
  independent_building: "Standalone building",
  studio_hall: "Studio or hall",
};

export default function OwnerActivationProjectsPage() {
  const { user } = useAuth();
  const dataVersion = useSpaceGoVersion();

  // Remote mode loads this from spacego_owner_activations, which already
  // limits rows to auth.uid(); filtering by owner keeps admins/demo correct.
  const requests = useMemo<PropertyActivationRequest[]>(() => {
    void dataVersion;
    return user ? SpaceGoStore.getActivationRequestsByOwner(user.id) : [];
  }, [user, dataVersion]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Property activation"
        description="Properties you've submitted for SpaceGo to review as possible workspaces, and where each one stands."
        actions={
          <Link href="/activation" className={buttonClasses()}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Submit a property
          </Link>
        }
      />

      {requests.length === 0 ? (
        <EmptyState
          icon={<Building2 />}
          title="No properties submitted"
          description="Have an empty floor or unused commercial space? Submit it and the SpaceGo team will review whether it could work as a bookable workspace."
          action={
            <Link href="/activation" className={buttonClasses()}>
              Submit a property
            </Link>
          }
        />
      ) : (
        <ul className="space-y-4">
          {requests.map((req) => (
            <li key={req.id}>
              <Card padding="sm" className="flex flex-col gap-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <ActivationStatusBadge status={req.status} />
                    <span className="font-mono text-sm text-ink-subtle">{req.id}</span>
                  </div>
                  <h2 className="text-base font-medium text-ink">{req.property_address}</h2>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-muted">
                    <span>{PROPERTY_TYPE_LABEL[req.property_type] ?? req.property_type.replace(/_/g, " ")}</span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-4 w-4 shrink-0 text-ink-subtle" aria-hidden="true" />
                      {req.city}
                    </span>
                    <span>{req.approx_square_feet.toLocaleString()} sq ft</span>
                    <span>Submitted {formatDate(req.created_at)}</span>
                  </div>
                </div>

                <Link
                  href={`/activation/track?ref=${req.id}`}
                  className={buttonClasses({ variant: "outline", size: "sm", className: "self-start lg:self-center" })}
                >
                  View progress
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
