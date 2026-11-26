"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { SpaceGoStore } from "@/lib/data/store";
import { SpaceForm, SpaceFormValues } from "@/components/owner/SpaceForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { ArrowLeft, Info } from "lucide-react";

export default function NewWorkspaceListingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { success, error } = useToast();

  const handleSubmit = async (values: SpaceFormValues): Promise<{ ok: boolean; error?: string }> => {
    if (!user) {
      const message = "Sign in with your owner account to create a listing.";
      error("Sign in required", message);
      return { ok: false, error: message };
    }

    const result = await SpaceGoStore.addSpace(values, {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      avatar_url: user.avatar_url,
    });

    if (!result.ok) {
      error("Could not create listing", result.error);
      return { ok: false, error: result.error };
    }

    // Saved as a draft; now ask SpaceGo to review it.
    const submitted = await SpaceGoStore.submitForReview(result.data.id);
    if (!submitted.ok) {
      error("Saved as a draft", `${submitted.error} You can submit it for review from My listings.`);
    } else {
      success(
        "Submitted for review",
        `${result.data.title} goes live once SpaceGo approves it. You'll get a notification either way.`
      );
    }
    router.push("/owner/properties");
    return { ok: true };
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/owner/properties"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-ink-muted hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          My listings
        </Link>
        <PageHeader
          className="mt-1"
          title="Add a workspace"
          description="Describe your space, pin it on the map and set prices. SpaceGo reviews every new listing before it goes live."
        />
      </div>

      <div className="flex gap-3 rounded-lg border border-line bg-surface-muted p-4 text-sm text-ink-muted">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink-subtle" aria-hidden="true" />
        <p>
          After you submit, the SpaceGo team checks the listing and either approves it or tells you what to change.
          Approved listings appear as <span className="font-medium text-ink">New listing</span>; review levels such as
          &ldquo;Reviewed by SpaceGo&rdquo; are set separately by the team.
        </p>
      </div>

      <SpaceForm mode="create" onSubmit={handleSubmit} submitLabel="Submit for review" />
    </div>
  );
}
