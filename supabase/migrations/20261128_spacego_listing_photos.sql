-- ============================================================
-- SpaceGo: listing photo uploads (Supabase Storage)
-- ============================================================
-- Forward-only and additive. Apply to STAGING first.
--
-- Creates the public-read bucket "listing-photos" (images only, 10 MB each)
-- and storage policies so that a signed-in OWNER or ADMIN can upload,
-- replace and delete files only inside their own folder: "<user id>/...".
-- Anyone can view a photo by its URL (listing photos are public once the
-- listing is live; file names are random, so unpublished photos are not
-- discoverable by listing the bucket, which only the uploader can do).
--
-- Private verification documents do NOT go here; they need a separate
-- private bucket with signed URLs (not part of this migration).
--
-- Rollback (manual):
--   DROP POLICY IF EXISTS spacego_listing_photos_read_own ON storage.objects;
--   DROP POLICY IF EXISTS spacego_listing_photos_insert_own ON storage.objects;
--   DROP POLICY IF EXISTS spacego_listing_photos_update_own ON storage.objects;
--   DROP POLICY IF EXISTS spacego_listing_photos_delete_own ON storage.objects;
--   -- and, once the bucket is empty: DELETE FROM storage.buckets WHERE id = 'listing-photos';
-- ============================================================

BEGIN;

DO $guard$
BEGIN
  IF to_regclass('storage.buckets') IS NULL OR to_regclass('storage.objects') IS NULL THEN
    RAISE EXCEPTION 'Supabase Storage is not set up in this database. Nothing was changed.';
  END IF;
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'public.profiles is missing; apply earlier SpaceGo migrations first.';
  END IF;
END
$guard$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'listing-photos',
  'listing-photos',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Owner or admin, uploading into their own top-level folder.
CREATE OR REPLACE FUNCTION public.spacego_can_upload_listing_photo(p_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
  SELECT auth.uid() IS NOT NULL
    AND split_part(p_name, '/', 1) = auth.uid()::text
    AND p_name ~ '^[0-9a-f-]{36}/[A-Za-z0-9_-]{8,80}[.](jpg|jpeg|png|webp)$'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('owner', 'admin')
    );
$fn$;

REVOKE ALL ON FUNCTION public.spacego_can_upload_listing_photo(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.spacego_can_upload_listing_photo(text) TO authenticated;

DROP POLICY IF EXISTS spacego_listing_photos_read_own ON storage.objects;
CREATE POLICY spacego_listing_photos_read_own ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'listing-photos' AND split_part(name, '/', 1) = auth.uid()::text);

DROP POLICY IF EXISTS spacego_listing_photos_insert_own ON storage.objects;
CREATE POLICY spacego_listing_photos_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'listing-photos' AND public.spacego_can_upload_listing_photo(name));

DROP POLICY IF EXISTS spacego_listing_photos_update_own ON storage.objects;
CREATE POLICY spacego_listing_photos_update_own ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'listing-photos' AND split_part(name, '/', 1) = auth.uid()::text)
  WITH CHECK (bucket_id = 'listing-photos' AND public.spacego_can_upload_listing_photo(name));

DROP POLICY IF EXISTS spacego_listing_photos_delete_own ON storage.objects;
CREATE POLICY spacego_listing_photos_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'listing-photos' AND split_part(name, '/', 1) = auth.uid()::text);

COMMIT;
