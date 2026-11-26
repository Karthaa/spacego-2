import React from "react";
import { isTestSite } from "@/lib/site";

/** Thin notice on every page of the test site. Renders nothing elsewhere. */
export function TestSiteBanner() {
  if (!isTestSite()) return null;
  return (
    <div role="note" className="bg-ink px-4 py-1.5 text-center text-sm text-surface">
      Demo site with sample listings. This isn&apos;t the public SpaceGo.
    </div>
  );
}
