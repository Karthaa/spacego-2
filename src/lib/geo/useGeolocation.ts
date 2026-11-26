"use client";

import { useCallback, useRef, useState } from "react";
import type { LatLng } from "./index";

export type GeoStatus = "idle" | "locating" | "ready" | "denied" | "unavailable" | "timeout" | "insecure" | "unsupported";

const MESSAGES: Record<Exclude<GeoStatus, "idle" | "locating" | "ready">, string> = {
  denied: "Location access is blocked for this site. Allow it in your browser settings, or search for an area instead.",
  unavailable: "Your device couldn't find its location. Search for an area instead.",
  timeout: "Finding your location took too long. Try again, or search for an area.",
  insecure: "Your browser only shares location on secure (https) pages. Search for an area instead.",
  unsupported: "This browser can't share its location. Search for an area instead.",
};

/**
 * Device location, requested only when `locate()` is called from a user
 * action. Nothing is requested on page load and the position is never stored
 * or sent anywhere except as the search centre the user asked for.
 */
export function useGeolocation() {
  const [status, setStatus] = useState<GeoStatus>("idle");
  const [position, setPosition] = useState<LatLng | null>(null);
  const pending = useRef(false);

  const locate = useCallback((): Promise<LatLng | null> => {
    if (pending.current) return Promise.resolve(null);
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setStatus("unsupported");
      return Promise.resolve(null);
    }
    if (!window.isSecureContext) {
      setStatus("insecure");
      return Promise.resolve(null);
    }

    pending.current = true;
    setStatus("locating");
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          pending.current = false;
          const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setPosition(next);
          setStatus("ready");
          resolve(next);
        },
        (err) => {
          pending.current = false;
          setStatus(err.code === err.PERMISSION_DENIED ? "denied" : err.code === err.TIMEOUT ? "timeout" : "unavailable");
          resolve(null);
        },
        { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 }
      );
    });
  }, []);

  const message = status in MESSAGES ? MESSAGES[status as keyof typeof MESSAGES] : null;
  return { status, position, locate, message, reset: () => setStatus("idle") };
}
