import React from "react";
import { cn } from "@/lib/utils";

/**
 * Geometry of the SpaceGo mark on a 32x32 grid: a room outline that is open
 * at one corner, with a solid block (the space you book) sitting in the gap.
 * Shared with the generated app icon and Open Graph image so every surface
 * draws the same mark.
 */
export const LOGO_MARK = {
  viewBox: "0 0 32 32",
  tileRadius: 8,
  room: "M9 9h14v6h-2.5v-3.5h-9v9H15V23H9Z",
  block: { x: 17, y: 17, width: 6, height: 6, rx: 1.5 },
} as const;

export type LogoSize = "sm" | "md" | "lg";

const SIZE: Record<LogoSize, { mark: number; text: string; gap: string }> = {
  sm: { mark: 24, text: "text-base", gap: "gap-1.5" },
  md: { mark: 32, text: "text-lg", gap: "gap-2" },
  lg: { mark: 40, text: "text-xl", gap: "gap-2.5" },
};

export function LogoMark({
  size = 32,
  className,
}: {
  /** Rendered width and height in pixels. */
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox={LOGO_MARK.viewBox}
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={cn("shrink-0", className)}
    >
      <rect width="32" height="32" rx={LOGO_MARK.tileRadius} className="fill-accent" />
      <path d={LOGO_MARK.room} className="fill-accent-ink" />
      <rect {...LOGO_MARK.block} className="fill-accent-ink" />
    </svg>
  );
}

export function Logo({
  size = "md",
  showWordmark = true,
  className,
}: {
  size?: LogoSize;
  /** Show the "SpaceGo" wordmark next to the mark. */
  showWordmark?: boolean;
  className?: string;
}) {
  const s = SIZE[size];
  return (
    <span className={cn("inline-flex items-center", s.gap, className)}>
      <LogoMark size={s.mark} />
      {showWordmark ? (
        <span className={cn(s.text, "font-semibold tracking-tight text-ink")}>SpaceGo</span>
      ) : (
        <span className="sr-only">SpaceGo</span>
      )}
    </span>
  );
}
