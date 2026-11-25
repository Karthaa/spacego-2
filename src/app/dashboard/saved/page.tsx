"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useSpaceGoVersion } from "@/context/SpaceGoDataProvider";
import { SpaceGoStore } from "@/lib/data/store";
import { Space } from "@/types";
import { SpaceCard } from "@/components/common/SpaceCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { SpaceCardSkeleton } from "@/components/ui/Skeleton";
import { PageHeader } from "@/components/ui/PageHeader";
import { buttonClasses } from "@/components/ui/Button";
import { Heart } from "lucide-react";

export default function SavedSpacesPage() {
  const { user } = useAuth();
  const dataVersion = useSpaceGoVersion();

  const savedSpaces = useMemo<Space[]>(() => {
    void dataVersion;
    if (!user) return [];
    const favIds = SpaceGoStore.getUserFavourites(user.id);
    return SpaceGoStore.getPublishedSpaces().filter((s) => favIds.includes(s.id));
  }, [user, dataVersion]);
  const isLoading = useMemo(() => {
    void dataVersion;
    return SpaceGoStore.isLoading() && savedSpaces.length === 0;
  }, [dataVersion, savedSpaces.length]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Saved spaces"
        description="Spaces you've saved with the heart button, so you can come back to them later."
        actions={
          <Link href="/spaces" className={buttonClasses({ variant: "outline" })}>
            Browse spaces
          </Link>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <SpaceCardSkeleton key={n} />
          ))}
        </div>
      ) : savedSpaces.length === 0 ? (
        <EmptyState
          icon={<Heart />}
          title="No saved spaces yet"
          description="Select the heart on any space to save it here."
          action={
            <Link href="/spaces" className={buttonClasses({ variant: "outline" })}>
              Browse spaces
            </Link>
          }
        />
      ) : (
        <ul className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
          {savedSpaces.map((space) => (
            <li key={space.id}>
              <SpaceCard space={space} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
