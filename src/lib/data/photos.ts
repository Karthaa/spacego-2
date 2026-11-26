"use client";

import type { SpaceImage } from "@/types";
import { isRemoteEnabled, uploadPublicFile } from "./remote";

export const LISTING_PHOTO_BUCKET = "listing-photos";
export const MAX_LISTING_PHOTOS = 12;
export const ACCEPTED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;

export type PhotoResult = { ok: true; data: SpaceImage } | { ok: false; error: string };

function randomName(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Resize in the browser (keeps uploads small and strips EXIF, incl. GPS). */
async function downscale(file: File, maxDim: number, quality: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser can't process images.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't read that image."))), "image/jpeg", quality)
  );
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Upload one listing photo. With Supabase: resized JPEG into
 * listing-photos/<user id>/<random>.jpg (storage policies only allow a host's
 * own folder). In local demo mode the resized image is kept inline instead.
 */
export async function uploadListingPhoto(file: File, userId: string): Promise<PhotoResult> {
  if (!ACCEPTED_PHOTO_TYPES.includes(file.type)) {
    return { ok: false, error: `${file.name}: use a JPEG, PNG or WebP photo.` };
  }
  if (file.size > MAX_SOURCE_BYTES) {
    return { ok: false, error: `${file.name}: photos must be under 25 MB.` };
  }

  try {
    if (!isRemoteEnabled()) {
      const small = await downscale(file, 1200, 0.78);
      return { ok: true, data: { url: await blobToDataUrl(small), caption: "" } };
    }
    const blob = await downscale(file, 2000, 0.85);
    const result = await uploadPublicFile(LISTING_PHOTO_BUCKET, `${userId}/${randomName()}.jpg`, blob, "image/jpeg");
    if (!result.ok) return { ok: false, error: `${file.name}: ${result.error}` };
    return { ok: true, data: { url: result.data, caption: "" } };
  } catch (error) {
    return { ok: false, error: `${file.name}: ${error instanceof Error ? error.message : "upload failed."}` };
  }
}
