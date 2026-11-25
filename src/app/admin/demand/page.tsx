"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSpaceGoVersion } from "@/context/SpaceGoDataProvider";
import { SpaceGoStore, type DemandAnalyticsRow } from "@/lib/data/store";
import { DemandSearch, WorkspaceEnquiry } from "@/types";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader, StatCard } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { categoryLabel } from "@/lib/categories";
import { formatDate } from "@/lib/utils";
import { AlertCircle, Inbox, MapPin, Search, SearchX } from "lucide-react";

const ENQUIRY_STATUS: Record<WorkspaceEnquiry["status"], { label: string; variant: "warning" | "brand" | "success" }> = {
  new: { label: "New", variant: "warning" },
  contacted: { label: "Contacted", variant: "brand" },
  fulfilled: { label: "Fulfilled", variant: "success" },
};

function displayCategory(category: string | null | undefined): string {
  if (!category || category === "all" || category === "Any") return "Any category";
  return categoryLabel(category);
}

function BarList({
  items,
  unit,
  label,
}: {
  items: { key: string; label: string; value: number; detail?: string }[];
  unit: string;
  label: string;
}) {
  const max = Math.max(1, ...items.map((item) => item.value));
  return (
    <ul className="space-y-4" aria-label={label}>
      {items.map((item) => (
        <li key={item.key} className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-base text-ink">{item.label}</span>
            <span className="shrink-0 text-sm text-ink-muted">
              {item.value} {unit}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-muted" aria-hidden="true">
            <div className="h-full rounded-full bg-accent" style={{ width: `${(item.value / max) * 100}%` }} />
          </div>
          {item.detail && <p className="text-sm text-ink-subtle">{item.detail}</p>}
        </li>
      ))}
    </ul>
  );
}

export default function AdminDemandPage() {
  const { success, error } = useToast();
  const dataVersion = useSpaceGoVersion();
  const [busyEnquiryId, setBusyEnquiryId] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<DemandAnalyticsRow[]>([]);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  const searches = useMemo<DemandSearch[]>(() => {
    void dataVersion;
    return SpaceGoStore.getDemandSearches();
  }, [dataVersion]);

  const enquiries = useMemo<WorkspaceEnquiry[]>(() => {
    void dataVersion;
    return SpaceGoStore.getEnquiries();
  }, [dataVersion]);

  // Aggregates come from the admin-only spacego_demand_analytics RPC.
  useEffect(() => {
    let active = true;
    void SpaceGoStore.getDemandAnalytics(90).then((result) => {
      if (!active) return;
      if (result.ok) {
        setAnalytics(result.data);
        setAnalyticsError(null);
      } else {
        setAnalyticsError(result.error);
      }
    });
    return () => {
      active = false;
    };
  }, [dataVersion]);

  const handleUpdateEnquiry = async (id: string, status: "new" | "contacted" | "fulfilled") => {
    if (busyEnquiryId) return;
    setBusyEnquiryId(id);
    const result = await SpaceGoStore.updateEnquiryStatus(id, status);
    setBusyEnquiryId(null);

    if (!result.ok) {
      error("Could not update request", result.error);
      return;
    }
    success("Request updated", `Marked as ${ENQUIRY_STATUS[status].label.toLowerCase()}.`);
  };

  // Group demand by micro-market (first segment of the query)
  const locationCounts: Record<string, { total: number; zeroResults: number }> = {};
  analytics.forEach((row) => {
    const loc = row.location_query.split(",")[0].trim() || "Unknown";
    if (!locationCounts[loc]) locationCounts[loc] = { total: 0, zeroResults: 0 };
    locationCounts[loc].total += row.total_searches;
    locationCounts[loc].zeroResults += row.zero_result_searches;
  });

  const sortedLocations = Object.entries(locationCounts).sort((a, b) => b[1].total - a[1].total);

  // Group demand by category
  const categoryCounts: Record<string, number> = {};
  analytics.forEach((row) => {
    const cat = row.category || "Any";
    categoryCounts[cat] = (categoryCounts[cat] || 0) + row.total_searches;
  });
  const sortedCategories = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);

  const totalQueries = analytics.reduce((sum, row) => sum + row.total_searches, 0);
  const unfulfilledCount = analytics.reduce((sum, row) => sum + row.zero_result_searches, 0);
  const unfulfilledQueries = searches.filter((s) => !s.has_results);
  const newEnquiries = enquiries.filter((e) => e.status === "new").length;
  const zeroShare = totalQueries > 0 ? Math.round((unfulfilledCount / totalQueries) * 100) : 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Demand"
        description="What people searched for over the last 90 days, where nothing matched, and requests sent directly to SpaceGo."
      />

      {analyticsError && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-md border border-line bg-danger-soft px-4 py-3 text-sm text-danger"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>Search analytics could not be loaded: {analyticsError}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Searches, last 90 days"
          value={totalQueries.toLocaleString()}
          hint={`${sortedLocations.length} distinct locations`}
          icon={<Search />}
        />
        <StatCard
          label="Searches with no results"
          value={unfulfilledCount.toLocaleString()}
          hint={totalQueries > 0 ? `${zeroShare}% of searches found no matching space` : "No searches recorded yet"}
          icon={<SearchX />}
        />
        <StatCard
          label="Space requests"
          value={enquiries.length}
          hint={`${newEnquiries} new, not yet contacted`}
          icon={<Inbox />}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold text-ink">Most searched locations</h2>
          <p className="mt-1 text-sm text-ink-muted">Grouped by the first part of the search text.</p>
          <div className="mt-5">
            {sortedLocations.length === 0 ? (
              <p className="text-base text-ink-muted">No searches recorded in the last 90 days.</p>
            ) : (
              <BarList
                label="Searches by location"
                unit="searches"
                items={sortedLocations.slice(0, 6).map(([loc, data]) => ({
                  key: loc,
                  label: loc,
                  value: data.total,
                  detail: data.zeroResults > 0 ? `${data.zeroResults} with no results` : undefined,
                }))}
              />
            )}
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-ink">Requested space types</h2>
          <p className="mt-1 text-sm text-ink-muted">Category chosen in the search, if any.</p>
          <div className="mt-5">
            {sortedCategories.length === 0 ? (
              <p className="text-base text-ink-muted">No searches recorded in the last 90 days.</p>
            ) : (
              <BarList
                label="Searches by category"
                unit="searches"
                items={sortedCategories.slice(0, 6).map(([cat, count]) => ({
                  key: cat,
                  label: displayCategory(cat),
                  value: count,
                }))}
              />
            )}
          </div>
        </Card>
      </div>

      <section aria-labelledby="zero-results" className="space-y-3">
        <div>
          <h2 id="zero-results" className="text-lg font-semibold text-ink">
            Searches with no results
          </h2>
          <p className="text-sm text-ink-muted">Places and space types people looked for that SpaceGo couldn&rsquo;t match.</p>
        </div>

        {unfulfilledQueries.length === 0 ? (
          <EmptyState
            icon={<SearchX />}
            title="Every recorded search found a space"
            description="Searches that return no spaces will be listed here."
          />
        ) : (
          <Card padding="none">
            <ul className="divide-y divide-line">
              {unfulfilledQueries.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-col gap-1 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <MapPin className="h-4 w-4 shrink-0 text-ink-subtle" aria-hidden="true" />
                    <span className="truncate text-base text-ink">{item.location_query}</span>
                  </div>
                  <p className="pl-6.5 text-sm text-ink-muted sm:pl-0 sm:text-right">
                    {displayCategory(item.category)}
                    {item.seats ? ` · ${item.seats} seats` : ""} · {formatDate(item.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      <section aria-labelledby="space-requests" className="space-y-3">
        <div>
          <h2 id="space-requests" className="text-lg font-semibold text-ink">
            Space requests ({enquiries.length})
          </h2>
          <p className="text-sm text-ink-muted">Requests people sent when they couldn&rsquo;t find the right space.</p>
        </div>

        {enquiries.length === 0 ? (
          <EmptyState
            icon={<Inbox />}
            title="No space requests yet"
            description="When someone asks SpaceGo to find a space for them, the request will appear here."
          />
        ) : (
          <Card padding="none">
            <ul className="divide-y divide-line">
              {enquiries.map((enq) => {
                const status = ENQUIRY_STATUS[enq.status] ?? { label: enq.status, variant: "warning" as const };
                return (
                  <li key={enq.id} className="space-y-3 px-5 py-4 sm:px-6">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-base font-medium text-ink">{enq.user_name}</span>
                          {enq.company && <span className="text-sm text-ink-muted">{enq.company}</span>}
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </div>
                        <p className="text-sm text-ink-subtle">
                          <span className="font-mono text-xs">{enq.id}</span> · {formatDate(enq.created_at)}
                        </p>
                      </div>
                    </div>

                    <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
                      <div>
                        <dt className="text-ink-subtle">Location</dt>
                        <dd className="text-ink">{enq.location_requested}</dd>
                      </div>
                      <div>
                        <dt className="text-ink-subtle">Space type</dt>
                        <dd className="text-ink">{displayCategory(enq.category_requested)}</dd>
                      </div>
                      <div>
                        <dt className="text-ink-subtle">Seats</dt>
                        <dd className="text-ink">{enq.seats_needed}</dd>
                      </div>
                      <div>
                        <dt className="text-ink-subtle">Budget</dt>
                        <dd className="text-ink">{enq.budget_range}</dd>
                      </div>
                    </dl>

                    {enq.notes && (
                      <p className="rounded-md bg-surface-muted px-3.5 py-2.5 text-sm text-ink-muted">{enq.notes}</p>
                    )}

                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUpdateEnquiry(enq.id, "contacted")}
                        disabled={busyEnquiryId !== null}
                      >
                        Mark contacted
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleUpdateEnquiry(enq.id, "fulfilled")}
                        disabled={busyEnquiryId !== null}
                      >
                        Mark fulfilled
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </section>
    </div>
  );
}
