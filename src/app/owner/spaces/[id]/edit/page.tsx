"use client";

import React, { use, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useSpaceGoVersion } from "@/context/SpaceGoDataProvider";
import { SpaceGoStore } from "@/lib/data/store";
import { Space } from "@/types";
import { SpaceForm, SpaceFormValues } from "@/components/owner/SpaceForm";
import { buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ArrowLeft, Building2, Lock } from "lucide-react";

export default function EditWorkspaceListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: spaceId } = use(params);
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { success, error } = useToast();
  const dataVersion = useSpaceGoVersion();

  const space = useMemo<Space | undefined>(() => {
    void dataVersion;
    return SpaceGoStore.getSpaceById(spaceId);
  }, [spaceId, dataVersion]);

  const isDataLoading = useMemo(() => {
    void dataVersion;
    return SpaceGoStore.isLoading();
  }, [dataVersion]);

  const handleSubmit = async (values: SpaceFormValues): Promise<{ ok: boolean; error?: string }> => {
    if (!space) return { ok: false, error: "Workspace not found." };

    // Only listing details: owner, verification, rating and status fields are left untouched.
    const result = await SpaceGoStore.updateSpace(space.id, {
      title: values.title,
      category: values.category,
      headline: values.headline,
      description: values.description,
      location: values.location,
      capacity: values.capacity,
      square_feet: values.square_feet,
      pricing: values.pricing,
      amenities: values.amenities,
      operating_hours: values.operating_hours,
      house_rules: values.house_rules,
      images: values.images,
      instant_book: values.instant_book,
    });

    if (!result.ok) {
      error("Could not save listing", result.error);
      return { ok: false, error: result.error };
    }

    success("Listing updated", `Your changes to ${result.data.title} have been saved.`);
    router.push("/owner/properties");
    return { ok: true };
  };

  const backLink = (
    <Link
      href="/owner/properties"
      className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-ink-muted hover:text-ink"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      My listings
    </Link>
  );

  const header = (
    <div>
      {backLink}
      <PageHeader
        className="mt-1"
        title="Edit listing"
        description="Update the details, prices and photo guests see. Changes are saved to the live listing."
      />
    </div>
  );

  const backAction = (
    <Link href="/owner/properties" className={buttonClasses({ variant: "outline" })}>
      Back to my listings
    </Link>
  );

  if (isAuthLoading || (!space && isDataLoading)) {
    return (
      <div className="space-y-6">
        {header}
        <Card className="space-y-4" role="status" aria-label="Loading listing">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-11" />
          <Skeleton className="h-11" />
          <Skeleton className="h-24" />
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-6">
        {header}
        <EmptyState
          icon={<Lock />}
          title="Sign in required"
          description="Sign in with your host account to edit your listings."
          action={
            <Link href="/auth/login" className={buttonClasses()}>
              Sign in
            </Link>
          }
        />
      </div>
    );
  }

  if (!space) {
    return (
      <div className="space-y-6">
        {header}
        <EmptyState
          icon={<Building2 />}
          title="Listing not found"
          description="This listing may have been removed, or the link may be wrong."
          action={backAction}
        />
      </div>
    );
  }

  if (space.owner_id !== user.id) {
    return (
      <div className="space-y-6">
        {header}
        <EmptyState
          icon={<Lock />}
          title="You can't edit this listing"
          description="Only the host who listed this workspace can change it. Listings you own are under My listings."
          action={backAction}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}
      <SpaceForm key={space.id} mode="edit" initial={space} onSubmit={handleSubmit} submitLabel="Save changes" />
    </div>
  );
}
