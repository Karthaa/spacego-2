"use client";

import React, { useMemo } from "react";
import { Navbar } from "@/components/navigation/Navbar";
import { Footer } from "@/components/navigation/Footer";
import { HeroSearch } from "@/components/home/HeroSearch";
import { CategoryBrowse } from "@/components/home/CategoryBrowse";
import { FeaturedSpaces } from "@/components/home/FeaturedSpaces";
import { KochiDirectoryPreview } from "@/components/home/KochiDirectoryPreview";
import { HowItWorks } from "@/components/home/HowItWorks";
import { OwnerCallout } from "@/components/home/OwnerCallout";
import { TrustNotes } from "@/components/home/TrustNotes";
import { SpaceGoStore } from "@/lib/data/store";
import { useSpaceGoVersion } from "@/context/SpaceGoDataProvider";

export default function HomePage() {
  const dataVersion = useSpaceGoVersion();
  const spaces = useMemo(() => {
    void dataVersion;
    return SpaceGoStore.getPublishedSpaces();
  }, [dataVersion]);

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <Navbar />
      <main id="main" className="flex-1">
        <HeroSearch spaces={spaces} />
        <CategoryBrowse />
        <FeaturedSpaces spaces={spaces} />
        <KochiDirectoryPreview />
        <HowItWorks />
        <TrustNotes />
        <OwnerCallout />
      </main>
      <Footer />
    </div>
  );
}
