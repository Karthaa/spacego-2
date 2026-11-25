"use client";

import React from "react";
import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { CheckCircle2, HardDrive } from "lucide-react";

const MIGRATION_PATH = "supabase/migrations/20261119_spacego_app_state.sql";

export default function AdminSettingsPage() {
  const supabaseConnected = isSupabaseConfigured();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="How this SpaceGo deployment is set up. Platform rules are fixed in code and can't be edited here yet."
      />

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Data storage</CardTitle>
            {supabaseConnected ? (
              <Badge variant="success" size="md">
                <CheckCircle2 aria-hidden="true" />
                Supabase configured
              </Badge>
            ) : (
              <Badge variant="warning" size="md">
                <HardDrive aria-hidden="true" />
                Local demo storage
              </Badge>
            )}
          </div>
          <CardDescription>Where bookings, spaces and requests are read from and saved to.</CardDescription>
        </CardHeader>

        <p className="text-base leading-relaxed text-ink-muted">
          {supabaseConnected ? (
            <>
              The app loads its collections from the Supabase app-state tables and saves changes back to Supabase.
              Apply <code className="rounded-sm bg-surface-muted px-1.5 py-0.5 font-mono text-sm text-ink">{MIGRATION_PATH}</code>{" "}
              before the first deploy.
            </>
          ) : (
            <>
              The app is using built-in demo data stored in this browser. To connect Supabase, apply{" "}
              <code className="rounded-sm bg-surface-muted px-1.5 py-0.5 font-mono text-sm text-ink">{MIGRATION_PATH}</code>{" "}
              and set{" "}
              <code className="rounded-sm bg-surface-muted px-1.5 py-0.5 font-mono text-sm text-ink">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
              and{" "}
              <code className="rounded-sm bg-surface-muted px-1.5 py-0.5 font-mono text-sm text-ink">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{" "}
              for the build.
            </>
          )}
        </p>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Platform rules</CardTitle>
          <CardDescription>Current behaviour. Changing these requires a code change.</CardDescription>
        </CardHeader>

        <dl className="divide-y divide-line">
          <div className="flex flex-col gap-1 py-3 first:pt-0 sm:flex-row sm:justify-between sm:gap-6">
            <dt className="text-base font-medium text-ink">Service fee</dt>
            <dd className="text-base text-ink-muted sm:text-right">10% of the booking cost, shown to guests and included in totals</dd>
          </div>
          <div className="flex flex-col gap-1 py-3 sm:flex-row sm:justify-between sm:gap-6">
            <dt className="text-base font-medium text-ink">Verification tiers</dt>
            <dd className="text-base text-ink-muted sm:text-right">
              Assigned by admins on the{" "}
              <Link href="/admin/spaces" className="font-medium text-accent hover:text-accent-hover">
                Spaces
              </Link>{" "}
              page. New listings start as &ldquo;New listing&rdquo;.
            </dd>
          </div>
          <div className="flex flex-col gap-1 py-3 last:pb-0 sm:flex-row sm:justify-between sm:gap-6">
            <dt className="text-base font-medium text-ink">Admin access</dt>
            <dd className="text-base text-ink-muted sm:text-right">
              Granted by setting a profile&rsquo;s role to admin in Supabase
            </dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
