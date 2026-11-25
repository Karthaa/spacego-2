"use client";

import React from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { ArrowRight, Building2, CalendarCheck, Sparkles, Users } from "lucide-react";

const AVAILABLE_NOW = [
  {
    href: "/admin/bookings",
    icon: CalendarCheck,
    title: "Guests",
    description: "Each booking lists the guest's name and email.",
  },
  {
    href: "/admin/spaces",
    icon: Building2,
    title: "Hosts",
    description: "Each space shows the host who listed it.",
  },
  {
    href: "/admin/activations",
    icon: Sparkles,
    title: "Property owners",
    description: "Activation requests include the owner's contact details.",
  },
];

export default function AdminUsersPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Users"
        description="Accounts and roles for guests, hosts and admins."
      />

      <EmptyState
        icon={<Users />}
        title="User management isn't connected yet"
        description="This page can't list accounts or change roles yet. Accounts and roles live in the Supabase profiles table; to make someone an admin, update their role there."
      />

      <section aria-labelledby="available-now" className="space-y-3">
        <h2 id="available-now" className="text-lg font-semibold text-ink">
          Where to find people today
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {AVAILABLE_NOW.map(({ href, icon: Icon, title, description }) => (
            <Link key={href} href={href} className="group block rounded-lg">
              <Card className="h-full transition-colors group-hover:border-line-strong">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-md bg-surface-muted text-ink-subtle">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <ArrowRight
                    className="h-4 w-4 text-ink-subtle transition-colors group-hover:text-ink"
                    aria-hidden="true"
                  />
                </div>
                <p className="mt-4 text-base font-medium text-ink">{title}</p>
                <p className="mt-1 text-sm text-ink-muted">{description}</p>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
