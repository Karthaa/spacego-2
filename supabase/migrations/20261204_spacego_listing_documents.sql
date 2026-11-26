-- SpaceGo: private verification documents for listings.
--
-- Forward-only, non-destructive, re-runnable. Apply AFTER
-- 20261128_spacego_listing_photos.sql. Needs Supabase Storage.
--
--   * Private bucket 'listing-documents' (never public): PDF, JPEG or PNG,
--     10 MB at most. Files live at '<host uid>/<random>.<ext>'.
--   * Hosts (owner or admin role) upload into their own folder and can read
--     or delete their own files. Admins can read every file, so they can open
--     a document through a short-lived signed URL. Nobody else can list,
--     read or download anything, and there are no public URLs.
--   * Which documents belong to which listing is recorded in the listing's
--     data.documents (path, kind, file name, date). The public view never
--     includes that key (it is an allowlist).
--   * Hosts are asked not to upload Aadhaar, PAN or other identity numbers.
--
-- Rollback (manual): drop the four spacego_listing_documents_* policies on
-- storage.objects and the helper function; delete the bucket once empty.

BEGIN;

DO $guard$
BEGIN
  IF to_regclass('storage.buckets') IS NULL OR to_regclass('storage.objects') IS NULL THEN
    RAISE EXCEPTION 'Supabase Storage is not set up in this database. Nothing was changed.';
  END IF;
  IF to_regprocedure('public.is_admin()') IS NULL THEN
    RAISE EXCEPTION 'Apply earlier SpaceGo migrations first.';
  END IF;
END
$guard$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'listing-documents',
  'listing-documents',
  false,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

-- If the bucket already existed, make sure it is private.
UPDATE storage.buckets SET public = false WHERE id = 'listing-documents' AND public;

CREATE OR REPLACE FUNCTION public.spacego_can_upload_listing_document(p_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
  SELECT auth.uid() IS NOT NULL
    AND split_part(p_name, '/', 1) = auth.uid()::text
    AND p_name ~ '^[0-9a-f-]{36}/[A-Za-z0-9_-]{8,80}[.](pdf|jpg|jpeg|png)$'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('owner', 'admin')
    );
$fn$;

REVOKE ALL ON FUNCTION public.spacego_can_upload_listing_document(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.spacego_can_upload_listing_document(text) TO authenticated;

DROP POLICY IF EXISTS spacego_listing_documents_read ON storage.objects;
CREATE POLICY spacego_listing_documents_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'listing-documents'
    AND (split_part(name, '/', 1) = auth.uid()::text OR public.is_admin())
  );

DROP POLICY IF EXISTS spacego_listing_documents_insert_own ON storage.objects;
CREATE POLICY spacego_listing_documents_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'listing-documents' AND public.spacego_can_upload_listing_document(name));

DROP POLICY IF EXISTS spacego_listing_documents_delete_own ON storage.objects;
CREATE POLICY spacego_listing_documents_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'listing-documents' AND split_part(name, '/', 1) = auth.uid()::text);

-- No UPDATE policy: a document is replaced by deleting it and uploading a new one.
DROP POLICY IF EXISTS spacego_listing_documents_update_own ON storage.objects;

COMMIT;
