"use client";

/*
 * SafeImage: a thin wrapper around a plain <img>.
 *
 * Why not next/image: next.config sets `images.unoptimized: true` (no image
 * optimizer on Cloudflare Workers), so next/image would add wrapper logic and
 * a client bundle without resizing anything. A plain <img> gives us the same
 * loading/fetchPriority/decoding/sizes controls, and for Unsplash URLs we
 * build a responsive srcset from the CDN's own `w=` parameter.
 *
 * Behaviour:
 * - Sits on a neutral bg-surface-muted box, so nothing flashes while loading.
 * - `fill` covers the nearest positioned parent; otherwise width/height set
 *   the intrinsic size and reserve the aspect ratio (no layout shift).
 * - On error (or a missing src) it swaps to a branded building placeholder,
 *   never alt text over an empty box.
 */

import React, { useCallback, useState } from "react";
import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ImgProps = Omit<
  React.ImgHTMLAttributes<HTMLImageElement>,
  "src" | "alt" | "width" | "height" | "className" | "style"
>;

export interface SafeImageProps extends ImgProps {
  src?: string | null;
  /** Required. Use "" for decorative images. */
  alt: string;
  /** Intrinsic size in CSS px. Ignored for layout when `fill` is set. */
  width?: number;
  height?: number;
  /** Cover the nearest positioned ancestor (like next/image `fill`). */
  fill?: boolean;
  /** Classes for the <img> (e.g. object-contain). Defaults to object-cover. */
  className?: string;
  /** Classes for the wrapper box (size, radius, z-index...). */
  wrapperClassName?: string;
}

const UNSPLASH_HOSTS = new Set(["images.unsplash.com", "plus.unsplash.com"]);
const SRCSET_WIDTHS = [320, 480, 640, 800, 1080, 1280, 1600, 2000];

/** Responsive srcset for Unsplash CDN URLs (their `w=` param resizes on the CDN). */
function unsplashSrcSet(src: string): string | undefined {
  try {
    const url = new URL(src);
    if (!UNSPLASH_HOSTS.has(url.hostname)) return undefined;
    return SRCSET_WIDTHS.map((w) => {
      url.searchParams.set("w", String(w));
      return `${url.toString()} ${w}w`;
    }).join(", ");
  } catch {
    return undefined;
  }
}

export function SafeImage({
  src,
  alt,
  width,
  height,
  fill = false,
  className,
  wrapperClassName,
  loading = "lazy",
  decoding = "async",
  sizes,
  srcSet,
  onError,
  ...props
}: SafeImageProps) {
  // Remember which src failed, so a new src (e.g. the next photo) gets a fresh try.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = !src || failedSrc === src;

  // An image that errors before hydration never fires React's onError; catch
  // it when the element mounts. (Lazy images not yet fetched are not complete.)
  const checkAlreadyBroken = useCallback(
    (node: HTMLImageElement | null) => {
      if (node && src && node.complete && node.naturalWidth === 0) setFailedSrc(src);
    },
    [src]
  );

  const wrapperStyle: React.CSSProperties | undefined =
    !fill && width && height ? { aspectRatio: `${width} / ${height}` } : undefined;

  const resolvedSrcSet = srcSet ?? (src && sizes ? unsplashSrcSet(src) : undefined);

  return (
    <span
      className={cn(
        "block overflow-hidden bg-surface-muted",
        fill ? "absolute inset-0" : "relative",
        wrapperClassName
      )}
      style={wrapperStyle}
    >
      {failed ? (
        <span
          className="flex h-full w-full items-center justify-center text-ink-subtle"
          {...(alt ? { role: "img", "aria-label": alt } : { "aria-hidden": true })}
        >
          <Building2 className="h-8 max-h-[40%] w-8 max-w-[40%]" aria-hidden="true" />
        </span>
      ) : (
        // A plain <img> on purpose (see the note at the top of this file).
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={checkAlreadyBroken}
          src={src ?? undefined}
          srcSet={resolvedSrcSet}
          sizes={resolvedSrcSet ? sizes : undefined}
          alt={alt}
          width={width}
          height={height}
          loading={loading}
          decoding={decoding}
          onError={(e) => {
            setFailedSrc(src ?? null);
            onError?.(e);
          }}
          className={cn("block h-full w-full object-cover", className)}
          {...props}
        />
      )}
    </span>
  );
}
