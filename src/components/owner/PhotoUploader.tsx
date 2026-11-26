"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { ImagePlus, Loader2, Star, X } from "lucide-react";
import type { SpaceImage } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { ACCEPTED_PHOTO_TYPES, MAX_LISTING_PHOTOS, uploadListingPhoto } from "@/lib/data/photos";
import { cn } from "@/lib/utils";

interface PhotoUploaderProps {
  images: SpaceImage[];
  onChange: (images: SpaceImage[]) => void;
  error?: string;
  id?: string;
}

/** Real photos of the space: upload, choose the cover, remove. */
export function PhotoUploader({ images, onChange, error, id }: PhotoUploaderProps) {
  const { user } = useAuth();
  const inputId = useId();
  const [uploading, setUploading] = useState(0);
  const [problems, setProblems] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const latest = useRef(images);
  useEffect(() => {
    latest.current = images;
  }, [images]);

  const withCover = (list: SpaceImage[]) => list.map((img, i) => ({ ...img, is_cover: i === 0 }));

  const addFiles = async (files: FileList | File[]) => {
    if (!user) {
      setProblems(["Sign in again to upload photos."]);
      return;
    }
    const room = MAX_LISTING_PHOTOS - latest.current.length;
    const chosen = Array.from(files).slice(0, Math.max(0, room));
    const errors: string[] = [];
    if (files.length > chosen.length) errors.push(`You can add up to ${MAX_LISTING_PHOTOS} photos.`);
    setUploading((n) => n + chosen.length);
    for (const file of chosen) {
      const result = await uploadListingPhoto(file, user.id);
      setUploading((n) => n - 1);
      if (result.ok) {
        latest.current = withCover([...latest.current, result.data]);
        onChange(latest.current);
      }
      else errors.push(result.error);
    }
    setProblems(errors);
  };

  const remove = (index: number) => onChange(withCover(images.filter((_, i) => i !== index)));
  const makeCover = (index: number) => onChange(withCover([images[index], ...images.filter((_, i) => i !== index)]));

  return (
    <fieldset id={id} tabIndex={-1} className="outline-none" aria-describedby={`${inputId}-help`}>
      <legend className="text-lg font-semibold text-ink">
        Photos <span className="text-danger" aria-hidden="true">*</span>
      </legend>
      <p id={`${inputId}-help`} className="mt-1 text-sm text-ink-muted">
        Add real photos of this space (JPEG, PNG or WebP). The first photo is the cover. Photos are resized and their
        location data is removed before upload.
      </p>

      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {images.map((img, i) => (
          <li key={img.url} className="group relative overflow-hidden rounded-md border border-line bg-surface-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt={img.caption || `Photo ${i + 1}`} className="aspect-[4/3] w-full object-cover" />
            {i === 0 ? (
              <span className="absolute left-2 top-2 rounded-sm bg-black/60 px-2 py-0.5 text-xs font-medium text-photo-ink">Cover</span>
            ) : (
              <button
                type="button"
                onClick={() => makeCover(i)}
                className="absolute left-2 top-2 inline-flex h-8 items-center gap-1 rounded-sm bg-black/60 px-2 text-xs font-medium text-photo-ink hover:bg-black/75"
              >
                <Star className="h-3.5 w-3.5" aria-hidden="true" />
                Make cover
              </button>
            )}
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label={`Remove photo ${i + 1}`}
              className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-photo-ink hover:bg-black/75"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </li>
        ))}
        {Array.from({ length: uploading }, (_, i) => (
          <li key={`up-${i}`} className="flex aspect-[4/3] items-center justify-center rounded-md border border-line bg-surface-muted">
            <Loader2 className="h-5 w-5 animate-spin text-ink-subtle" aria-hidden="true" />
            <span className="sr-only">Uploading</span>
          </li>
        ))}
        {images.length + uploading < MAX_LISTING_PHOTOS && (
          <li>
            <label
              htmlFor={inputId}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                if (e.dataTransfer.files.length) void addFiles(e.dataTransfer.files);
              }}
              className={cn(
                "flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border border-dashed text-sm font-medium text-ink transition-colors",
                dragOver ? "border-accent bg-accent-soft" : "border-line-strong bg-surface hover:bg-surface-muted",
                error && images.length === 0 && "border-danger"
              )}
            >
              <ImagePlus className="h-5 w-5 text-ink-subtle" aria-hidden="true" />
              {images.length === 0 ? "Add photos" : "Add more"}
              <span className="text-xs font-normal text-ink-muted">or drop them here</span>
            </label>
            <input
              id={inputId}
              type="file"
              accept={ACCEPTED_PHOTO_TYPES.join(",")}
              multiple
              className="sr-only"
              onChange={(e) => {
                if (e.target.files?.length) void addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </li>
        )}
      </ul>

      {(problems.length > 0 || error) && (
        <div role="alert" className="mt-3 space-y-1 text-sm font-medium text-danger">
          {error && images.length === 0 && <p>{error}</p>}
          {problems.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      )}
    </fieldset>
  );
}
