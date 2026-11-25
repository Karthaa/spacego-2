"use client";

import React from "react";
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-surface-muted", className)}
      {...props}
    />
  );
}

export function SpaceCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg" role="status" aria-label="Loading workspace">
      <Skeleton className="aspect-[4/3] w-full rounded-lg" />
      <div className="space-y-2.5 pt-3">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-5 w-10" />
        </div>
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-5 w-1/3" />
      </div>
    </div>
  );
}
