"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useSpaceGoVersion } from "@/context/SpaceGoDataProvider";
import { SpaceGoStore } from "@/lib/data/store";
import { Space } from "@/types";
import { SpaceCard } from "@/components/common/SpaceCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Heart, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function SavedSpacesPage() {
  const { user } = useAuth();
  const dataVersion = useSpaceGoVersion();

  const savedSpaces = useMemo<Space[]>(() => {
    void dataVersion;
    if (!user) return [];
    const favIds = SpaceGoStore.getUserFavourites(user.id);
    return SpaceGoStore.getPublishedSpaces().filter((s) => favIds.includes(s.id));
  }, [user, dataVersion]);

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Saved Workspaces
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Spaces you have bookmarked for quick rebooking and team review.
          </p>
        </div>

        <Link href="/spaces">
          <Button variant="outline" size="sm" className="font-semibold">
            <Search className="w-4 h-4 text-teal-600" />
            <span>Discover More Spaces</span>
          </Button>
        </Link>
      </div>

      {savedSpaces.length === 0 ? (
        <EmptyState
          icon={<Heart className="w-8 h-8 text-rose-400" />}
          title="No saved workspaces yet"
          description="Click the heart icon on any workspace card to keep track of spaces you like."
          actionLabel="Explore Workspaces"
          onAction={() => (window.location.href = "/spaces")}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {savedSpaces.map((space) => (
            <SpaceCard
              key={space.id}
              space={space}
            />
          ))}
        </div>
      )}

    </div>
  );
}
