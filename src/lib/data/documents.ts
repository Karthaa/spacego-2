"use client";

import type { ListingDocument, ListingDocumentKind } from "@/types";
import { createSignedFileUrl, isRemoteEnabled, removeStorageFile, uploadPrivateFile } from "./remote";

export const LISTING_DOCUMENT_BUCKET = "listing-documents";
export const MAX_LISTING_DOCUMENTS = 6;
const MAX_BYTES = 10 * 1024 * 1024;
const TYPES: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" };

export const DOCUMENT_KIND_LABELS: Record<ListingDocumentKind, string> = {
  ownership: "Proof of ownership",
  authority: "Lease or letter of permission",
  business_registration: "Business registration",
  address_proof: "Utility bill or address proof",
  other: "Other",
};

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

function randomName(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Upload a verification document to the private bucket. */
export async function uploadListingDocument(file: File, kind: ListingDocumentKind, userId: string): Promise<Result<ListingDocument>> {
  if (!isRemoteEnabled()) {
    return { ok: false, error: "Document upload needs the SpaceGo backend. It isn't available in this demo." };
  }
  const ext = TYPES[file.type];
  if (!ext) return { ok: false, error: "Upload a PDF, JPEG or PNG file." };
  if (file.size > MAX_BYTES) return { ok: false, error: "Files can be up to 10 MB." };
  const path = `${userId}/${randomName()}.${ext}`;
  const result = await uploadPrivateFile(LISTING_DOCUMENT_BUCKET, path, file, file.type);
  if (!result.ok) return result;
  return {
    ok: true,
    data: { path, kind, name: file.name.slice(0, 200) || `Document.${ext}`, uploaded_at: new Date().toISOString() },
  };
}

/** A link that works for 60 seconds, for the host or an admin. */
export function signedDocumentUrl(path: string): Promise<Result<string>> {
  return createSignedFileUrl(LISTING_DOCUMENT_BUCKET, path, 60);
}

export function removeListingDocument(path: string): Promise<Result<null>> {
  return removeStorageFile(LISTING_DOCUMENT_BUCKET, path);
}
