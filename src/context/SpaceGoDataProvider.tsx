"use client";

import React, { useEffect, useState } from "react";
import { SpaceGoStore } from "@/lib/data/store";

const HYDRATION_TIMEOUT_MS = 8000;

/**
 * Loads the Supabase-backed collections before rendering the app. When
 * Supabase is not configured, this is a pass-through and the demo keeps
 * using localStorage.
 */
export function SpaceGoDataProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(!SpaceGoStore.isRemoteEnabled());

  useEffect(() => {
    if (!SpaceGoStore.isRemoteEnabled()) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const timeout = new Promise<boolean>((resolve) => {
      timer = setTimeout(() => resolve(false), HYDRATION_TIMEOUT_MS);
    });

    Promise.race([SpaceGoStore.hydrate(), timeout]).finally(() => {
      if (timer) clearTimeout(timer);
      if (!cancelled) setReady(true);
    });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-teal-600" />
          <p className="text-sm font-medium text-slate-500">
            Loading workspace data…
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
