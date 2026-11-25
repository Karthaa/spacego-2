"use client";

import React, { useEffect, useState, useSyncExternalStore } from "react";
import { SpaceGoStore } from "@/lib/data/store";
import { useAuth } from "@/context/AuthContext";

const HYDRATION_TIMEOUT_MS = 8000;

/**
 * Loads the data the signed-in viewer may see (public spaces for everyone,
 * plus RLS-filtered private rows for the signed-in user) and reloads it when
 * the user or their role changes. When Supabase is not configured this is a
 * pass-through and the demo keeps using localStorage.
 *
 * Must be rendered inside <AuthProvider>.
 */
export function SpaceGoDataProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const remote = SpaceGoStore.isRemoteEnabled();
  const [ready, setReady] = useState(!remote);

  const viewerId = user?.id ?? null;
  const viewerRole = user?.role ?? null;

  useEffect(() => {
    if (!remote || isLoading) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), HYDRATION_TIMEOUT_MS);
    });

    const next = viewerId && viewerRole ? { id: viewerId, role: viewerRole } : null;

    Promise.race([SpaceGoStore.hydrate(next), timeout])
      .then((result) => {
        if (result && !result.ok) {
          console.error("SpaceGo: some workspace data could not be loaded:", result.error);
        } else if (!result) {
          console.error("SpaceGo: loading workspace data timed out; showing what is available.");
        }
      })
      .finally(() => {
        if (timer) clearTimeout(timer);
        if (!cancelled) setReady(true);
      });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [remote, isLoading, viewerId, viewerRole]);

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

/**
 * Subscribe a component to store changes. Read store snapshots inside
 * `useMemo(() => ..., [version, ...])` so they refresh after hydration and
 * after every successful write.
 */
export function useSpaceGoVersion(): number {
  return useSyncExternalStore(
    SpaceGoStore.subscribe,
    SpaceGoStore.getVersion,
    () => 0
  );
}
