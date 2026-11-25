"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { buttonClasses } from "@/components/ui/Button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { Info } from "lucide-react";

export default function OwnerSettingsPage() {
  const { user } = useAuth();

  const details: { label: string; value?: string }[] = [
    { label: "Name", value: user?.full_name },
    { label: "Email", value: user?.email },
    { label: "Phone", value: user?.phone },
    { label: "Company", value: user?.company_name },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Your host account details." />

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Guests see your name on your listings. Your email is used for booking updates.</CardDescription>
        </CardHeader>

        {user ? (
          <dl className="divide-y divide-line border-t border-line">
            {details.map((d) => (
              <div key={d.label} className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3 sm:gap-4">
                <dt className="text-sm font-medium text-ink-muted">{d.label}</dt>
                <dd className="break-words text-base text-ink sm:col-span-2">
                  {d.value ? d.value : <span className="text-ink-subtle">Not added</span>}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <div className="space-y-3 border-t border-line pt-4" role="status" aria-label="Loading account details">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-5 w-1/3" />
          </div>
        )}

        <div className="mt-5">
          <Link href="/dashboard/profile" className={buttonClasses({ variant: "outline" })}>
            Edit profile
          </Link>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payouts and cancellation policy</CardTitle>
        </CardHeader>
        <div className="flex gap-3 rounded-md bg-surface-muted p-4 text-sm text-ink-muted">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink-subtle" aria-hidden="true" />
          <p>
            You can&apos;t add payout details or choose a cancellation policy in SpaceGo yet. Nothing is collected or
            paid out through this page.
          </p>
        </div>
      </Card>
    </div>
  );
}
