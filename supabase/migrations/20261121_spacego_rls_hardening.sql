-- ============================================================
-- SPACEGO PHASE 1B-1 — APPLICATION DATA SECURITY HARDENING
-- ============================================================
-- Repository: Karthaa/spacego-2
-- Branch:     feature/spacego-auth-foundation
-- File:       supabase/migrations/20261121_spacego_rls_hardening.sql
--
-- PURPOSE
--   Replace the permissive demo policies on the seven public.spacego_* tables
--   with ownership-aware RLS, least-privilege grants, validated write RPCs,
--   secure booking concurrency control, an explicit-allowlist public workspace
--   view, and a restricted owner-facing activation view.
--
-- PREREQUISITES
--   1. 20261108_init.sql has been applied (profiles/auth base schema).
--   2. 20261120_profiles_auth_hardening.sql has been applied. This migration
--      refuses to run unless the hardened public.is_admin() helper is present.
--   3. Run this file once, in a single transaction, as the Supabase SQL editor
--      owner (normally `postgres`). Do not run it as anon/authenticated.
--
-- SAFETY
--   * No table, column, or application row is added, altered, or dropped. The
--     read-model views are created/replaced as documented. The only policy and
--     grant replacements are on these seven application tables, which is the
--     purpose of this hardening migration.
--   * No DELETE, TRUNCATE, or UPDATE of application rows.
--   * Legacy rows with missing/ambiguous ownership are preserved and remain
--     visible only to admins. They are never guessed or reassigned.
--   * All SECURITY DEFINER functions use an empty search_path and fully
--     schema-qualified object references.
--
-- ROLLBACK
--   See the rollback section at the end of this file. The short version is:
--   drop the objects created here, then restore the demo policy block and
--   grants from 20261119_spacego_app_state.sql if a full rollback is required.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 0. PREREQUISITE GUARD
-- ------------------------------------------------------------
DO $guard$
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION
      'Apply 20261108_init.sql before 20261121_spacego_rls_hardening.sql';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'profiles'
      AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION
      'Apply 20261120_profiles_auth_hardening.sql first: public.profiles must have RLS enabled';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(ARRAY[
      'spacego_spaces',
      'spacego_bookings',
      'spacego_activations',
      'spacego_demand_searches',
      'spacego_enquiries',
      'spacego_notifications',
      'spacego_favourites'
    ]) AS t(name)
    WHERE to_regclass('public.' || t.name) IS NULL
  ) THEN
    RAISE EXCEPTION
      'Apply 20261119_spacego_app_state.sql first: all seven spacego_* tables are required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'is_admin'
      AND p.pronargs = 0
      AND p.prosecdef
      AND EXISTS (
        SELECT 1
        FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg(value)
        WHERE cfg.value LIKE 'search_path=%'
      )
  ) THEN
    RAISE EXCEPTION
      'Apply 20261120_profiles_auth_hardening.sql first: hardened public.is_admin() is required';
  END IF;
END;
$guard$;

-- ------------------------------------------------------------
-- 1. REMOVE EVERY LEGACY POLICY FROM THE SEVEN APP TABLES
-- ------------------------------------------------------------
-- The demo tables are dedicated application tables. Removing every policy,
-- rather than only spacego_demo_all, guarantees that no forgotten permissive
-- policy survives alongside the new ownership policies.
DO $policies$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'spacego_spaces',
        'spacego_bookings',
        'spacego_activations',
        'spacego_demand_searches',
        'spacego_enquiries',
        'spacego_notifications',
        'spacego_favourites'
      )
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      r.policyname, r.schemaname, r.tablename
    );
  END LOOP;
END;
$policies$;

-- ------------------------------------------------------------
-- 2. INTERNAL SAFE-CAST HELPERS
-- ------------------------------------------------------------
-- These helpers are used by RPC validation and by the booking conflict query.
-- They are intentionally not executable by client roles.
CREATE OR REPLACE FUNCTION public.spacego_try_uuid(p_value text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $fn$
BEGIN
  IF p_value IS NULL OR btrim(p_value) = '' THEN
    RETURN NULL;
  END IF;
  RETURN p_value::uuid;
EXCEPTION
  WHEN others THEN
    RETURN NULL;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.spacego_try_numeric(p_value text)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $fn$
BEGIN
  IF p_value IS NULL OR btrim(p_value) = '' THEN
    RETURN NULL;
  END IF;
  RETURN p_value::numeric;
EXCEPTION
  WHEN others THEN
    RETURN NULL;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.spacego_try_integer(p_value text)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $fn$
BEGIN
  IF p_value IS NULL OR btrim(p_value) = '' THEN
    RETURN NULL;
  END IF;
  RETURN p_value::integer;
EXCEPTION
  WHEN others THEN
    RETURN NULL;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.spacego_try_timestamptz(p_value text)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $fn$
BEGIN
  IF p_value IS NULL OR btrim(p_value) = '' THEN
    RETURN NULL;
  END IF;
  RETURN p_value::timestamptz;
EXCEPTION
  WHEN others THEN
    RETURN NULL;
END;
$fn$;

REVOKE ALL ON FUNCTION public.spacego_try_uuid(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.spacego_try_numeric(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.spacego_try_integer(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.spacego_try_timestamptz(text) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------
-- 3. INTERNAL NOTIFICATION HELPER
-- ------------------------------------------------------------
-- The only supported cross-user notification insertion path. Client roles
-- cannot execute this function directly. Invalid/legacy user IDs are ignored
-- rather than guessed, so legacy rows without real profiles do not break the
-- booking or activation operation that triggered the notification.
CREATE OR REPLACE FUNCTION public.spacego_create_notification(
  p_user_id text,
  p_title text,
  p_message text,
  p_type text,
  p_link text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_user_id uuid := public.spacego_try_uuid(p_user_id);
  v_id text;
  v_data jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = v_user_id
  ) THEN
    RETURN NULL;
  END IF;

  IF p_type IS NULL
     OR p_type NOT IN ('booking_update', 'activation_update', 'system', 'enquiry') THEN
    RAISE EXCEPTION 'Invalid notification type'
      USING ERRCODE = '22023';
  END IF;

  IF btrim(COALESCE(p_title, '')) = ''
     OR btrim(COALESCE(p_message, '')) = '' THEN
    RETURN NULL;
  END IF;

  v_id := 'notif-' || replace(gen_random_uuid()::text, '-', '');
  v_data := jsonb_build_object(
    'id', v_id,
    'user_id', v_user_id::text,
    'title', left(btrim(p_title), 160),
    'message', left(btrim(p_message), 2000),
    'type', p_type,
    'read', false,
    'created_at', now()
  );

  IF p_link IS NOT NULL AND btrim(p_link) <> '' THEN
    v_data := v_data || jsonb_build_object('link', left(btrim(p_link), 500));
  END IF;

  INSERT INTO public.spacego_notifications (id, data)
  VALUES (v_id, v_data);

  RETURN v_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.spacego_create_notification(text, text, text, text, text)
  FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------
-- 4. WRITE-GUARD TRIGGERS
-- ------------------------------------------------------------
-- Top-level id and JSONB payload id must always be identical. This protects
-- notifications and all other JSONB-backed tables from split-brain IDs.
CREATE OR REPLACE FUNCTION public.spacego_enforce_payload_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $fn$
BEGIN
  IF NEW.data IS NULL OR jsonb_typeof(NEW.data) <> 'object' THEN
    RAISE EXCEPTION 'Payload must be a JSON object'
      USING ERRCODE = '23514';
  END IF;

  IF btrim(COALESCE(NEW.id, '')) = '' THEN
    RAISE EXCEPTION 'Top-level id is required'
      USING ERRCODE = '23514';
  END IF;

  IF jsonb_typeof(NEW.data -> 'id') IS DISTINCT FROM 'string'
     OR btrim(COALESCE(NEW.data ->> 'id', '')) = '' THEN
    RAISE EXCEPTION 'Payload id must be a non-empty string'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.data ->> 'id' IS DISTINCT FROM NEW.id THEN
    RAISE EXCEPTION 'Top-level id and payload id must match'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Record ids cannot be changed'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.spacego_enforce_payload_id()
  FROM PUBLIC, anon, authenticated;

-- Owners may edit their own listing content, but they may not claim another
-- owner, self-assign verification, rewrite ratings, or publish under_review
-- records. Admins retain full moderation control.
CREATE OR REPLACE FUNCTION public.spacego_guard_space_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_is_admin boolean := public.is_admin();
  v_owner_id text;
  v_owner_uuid uuid;
  v_category text;
  v_status text;
  v_pricing jsonb;
  v_location jsonb;
  v_capacity integer;
  v_square_feet integer;
  v_currency text;
  v_profile_name text;
  v_profile_email text;
  v_default_passport jsonb;
BEGIN
  IF NEW.data IS NULL OR jsonb_typeof(NEW.data) <> 'object' THEN
    RAISE EXCEPTION 'Space payload must be a JSON object'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.data ->> 'id' IS DISTINCT FROM NEW.id THEN
    RAISE EXCEPTION 'Top-level id and payload id must match'
      USING ERRCODE = '23514';
  END IF;

  v_owner_id := NULLIF(btrim(COALESCE(NEW.data ->> 'owner_id', '')), '');
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'owner_id is required'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF v_uid IS NULL THEN
      RAISE EXCEPTION 'Authentication required'
        USING ERRCODE = '42501';
    END IF;

    v_owner_uuid := public.spacego_try_uuid(v_owner_id);
    IF v_owner_uuid IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = v_owner_uuid AND p.role IN ('owner', 'admin')
    ) THEN
      RAISE EXCEPTION 'owner_id must reference an existing owner or admin profile'
        USING ERRCODE = '23514';
    END IF;

    IF NOT v_is_admin THEN
      IF v_owner_id <> v_uid::text THEN
        RAISE EXCEPTION 'Owners may only create their own listings'
          USING ERRCODE = '42501';
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = v_uid AND p.role = 'owner'
      ) THEN
        RAISE EXCEPTION 'Owner role required to create a listing'
          USING ERRCODE = '42501';
      END IF;

      SELECT p.full_name, p.email
      INTO v_profile_name, v_profile_email
      FROM public.profiles p
      WHERE p.id = v_uid;

      v_default_passport := jsonb_build_object(
        'identity_verified', false,
        'property_authority_verified', false,
        'permitted_use_confirmed', false,
        'connectivity_tested_mbps', 0,
        'power_backup_tested', false,
        'fire_safety_inspected', false,
        'inspected_by', '',
        'inspected_at', '',
        'renewal_date', '',
        'notes', ''
      );

      NEW.data := NEW.data || jsonb_build_object(
        'owner_id', v_uid::text,
        'owner_name', left(v_profile_name, 200),
        'owner_email', left(v_profile_email, 320),
        'verification_level', 'listed',
        'passport', v_default_passport,
        'rating', 5.0,
        'review_count', 0,
        'created_at', to_jsonb(now())
      );
    ELSE
      NEW.data := NEW.data || jsonb_build_object(
        'created_at', COALESCE(NEW.data -> 'created_at', to_jsonb(now()))
      );
    END IF;
  ELSE
    IF NOT v_is_admin THEN
      IF v_uid IS NULL
         OR OLD.data ->> 'owner_id' IS DISTINCT FROM v_uid::text
         OR v_owner_id IS DISTINCT FROM v_uid::text
         OR NOT EXISTS (
           SELECT 1 FROM public.profiles p
           WHERE p.id = v_uid AND p.role = 'owner'
         ) THEN
        RAISE EXCEPTION 'Owners may only update their own listings'
          USING ERRCODE = '42501';
      END IF;

      SELECT p.full_name, p.email
      INTO v_profile_name, v_profile_email
      FROM public.profiles p
      WHERE p.id = v_uid;

      NEW.data := NEW.data || jsonb_build_object(
        'owner_id', v_uid::text,
        'owner_name', left(v_profile_name, 200),
        'owner_email', left(v_profile_email, 320),
        'verification_level', COALESCE(NULLIF(OLD.data -> 'verification_level', 'null'::jsonb), '"listed"'::jsonb),
        'passport', COALESCE(NULLIF(OLD.data -> 'passport', 'null'::jsonb), '{}'::jsonb),
        'rating', COALESCE(NULLIF(OLD.data -> 'rating', 'null'::jsonb), '5.0'::jsonb),
        'review_count', COALESCE(NULLIF(OLD.data -> 'review_count', 'null'::jsonb), '0'::jsonb),
        'created_at', COALESCE(OLD.data -> 'created_at', 'null'::jsonb)
      );
    ELSIF NEW.data ->> 'owner_id' IS DISTINCT FROM OLD.data ->> 'owner_id' THEN
      -- Admins may reassign ownership, but only to a real owner/admin profile.
      -- A legacy row can still be updated without first repairing its owner.
      v_owner_uuid := public.spacego_try_uuid(v_owner_id);
      IF v_owner_uuid IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = v_owner_uuid AND p.role IN ('owner', 'admin')
      ) THEN
        RAISE EXCEPTION 'owner_id must reference an existing owner or admin profile'
          USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;

  v_category := NEW.data ->> 'category';
  IF v_category IS NULL
     OR v_category NOT IN (
       'coworking', 'private_office', 'meeting_room',
       'training_room', 'studio', 'event_space'
     ) THEN
    RAISE EXCEPTION 'Invalid workspace category'
      USING ERRCODE = '23514';
  END IF;

  v_status := NEW.data ->> 'status';
  IF v_status IS NULL
     OR v_status NOT IN ('published', 'draft', 'under_review', 'archived') THEN
    RAISE EXCEPTION 'Invalid workspace status'
      USING ERRCODE = '23514';
  END IF;

  IF NOT v_is_admin AND v_status = 'under_review' THEN
    IF TG_OP = 'INSERT' THEN
      RAISE EXCEPTION 'Only admins may place a listing under review'
        USING ERRCODE = '42501';
    ELSIF OLD.data ->> 'status' IS DISTINCT FROM 'under_review' THEN
      RAISE EXCEPTION 'Only admins may place a listing under review'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NOT v_is_admin
     AND TG_OP = 'UPDATE'
     AND OLD.data ->> 'status' = 'under_review'
     AND v_status <> 'under_review' THEN
    RAISE EXCEPTION 'Only admins may change a listing that is under review'
      USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(NEW.data -> 'title') IS DISTINCT FROM 'string'
     OR jsonb_typeof(NEW.data -> 'slug') IS DISTINCT FROM 'string' THEN
    RAISE EXCEPTION 'Workspace title and slug must be strings'
      USING ERRCODE = '23514';
  END IF;

  IF btrim(NEW.data ->> 'title') = ''
     OR btrim(NEW.data ->> 'slug') = '' THEN
    RAISE EXCEPTION 'Workspace title and slug are required'
      USING ERRCODE = '23514';
  END IF;

  IF (NEW.data ? 'headline' AND jsonb_typeof(NEW.data -> 'headline') <> 'string')
     OR (NEW.data ? 'description' AND jsonb_typeof(NEW.data -> 'description') <> 'string') THEN
    RAISE EXCEPTION 'Workspace headline and description must be strings'
      USING ERRCODE = '23514';
  END IF;

  IF length(NEW.data ->> 'title') > 200
     OR length(NEW.data ->> 'slug') > 200
     OR length(COALESCE(NEW.data ->> 'headline', '')) > 500
     OR length(COALESCE(NEW.data ->> 'description', '')) > 10000 THEN
    RAISE EXCEPTION 'Workspace text fields exceed the allowed length'
      USING ERRCODE = '23514';
  END IF;

  v_capacity := public.spacego_try_integer(NEW.data ->> 'capacity');
  IF v_capacity IS NULL OR v_capacity NOT BETWEEN 1 AND 1000000 THEN
    RAISE EXCEPTION 'Workspace capacity must be a bounded positive integer'
      USING ERRCODE = '23514';
  END IF;

  v_square_feet := public.spacego_try_integer(NEW.data ->> 'square_feet');
  IF v_square_feet IS NULL OR v_square_feet NOT BETWEEN 1 AND 1000000000 THEN
    RAISE EXCEPTION 'Workspace square_feet must be a bounded positive integer'
      USING ERRCODE = '23514';
  END IF;

  v_pricing := NEW.data -> 'pricing';
  IF v_pricing IS NULL OR jsonb_typeof(v_pricing) <> 'object' THEN
    RAISE EXCEPTION 'Workspace pricing must be an object'
      USING ERRCODE = '23514';
  END IF;

  v_currency := NULLIF(btrim(COALESCE(v_pricing ->> 'currency', '')), '');
  IF v_currency IS NULL OR v_currency !~ '^[A-Za-z]{3}$' THEN
    RAISE EXCEPTION 'Workspace pricing.currency must be a 3-letter code'
      USING ERRCODE = '23514';
  END IF;

  -- BETWEEN also rejects NaN (NaN is greater than every non-NaN numeric).
  IF (v_pricing ? 'hourly' AND COALESCE(
        public.spacego_try_numeric(v_pricing ->> 'hourly'), -1
      ) NOT BETWEEN 0.01 AND 1000000000)
     OR (v_pricing ? 'daily' AND COALESCE(
        public.spacego_try_numeric(v_pricing ->> 'daily'), -1
      ) NOT BETWEEN 0.01 AND 1000000000)
     OR (v_pricing ? 'weekly' AND COALESCE(
        public.spacego_try_numeric(v_pricing ->> 'weekly'), -1
      ) NOT BETWEEN 0.01 AND 1000000000)
     OR (v_pricing ? 'monthly' AND COALESCE(
        public.spacego_try_numeric(v_pricing ->> 'monthly'), -1
      ) NOT BETWEEN 0.01 AND 1000000000) THEN
    RAISE EXCEPTION 'Workspace prices must be positive and bounded'
      USING ERRCODE = '23514';
  END IF;

  IF public.spacego_try_numeric(v_pricing ->> 'hourly') IS NULL
     AND public.spacego_try_numeric(v_pricing ->> 'daily') IS NULL
     AND public.spacego_try_numeric(v_pricing ->> 'weekly') IS NULL
     AND public.spacego_try_numeric(v_pricing ->> 'monthly') IS NULL THEN
    RAISE EXCEPTION 'At least one workspace price is required'
      USING ERRCODE = '23514';
  END IF;

  v_location := NEW.data -> 'location';
  IF v_location IS NULL OR jsonb_typeof(v_location) <> 'object' THEN
    RAISE EXCEPTION 'Workspace location must be an object'
      USING ERRCODE = '23514';
  END IF;

  IF jsonb_typeof(v_location -> 'city') IS DISTINCT FROM 'string'
     OR jsonb_typeof(v_location -> 'address') IS DISTINCT FROM 'string'
     OR jsonb_typeof(v_location -> 'country') IS DISTINCT FROM 'string'
     OR (v_location ? 'state' AND jsonb_typeof(v_location -> 'state') <> 'string')
     OR (v_location ? 'postal_code' AND jsonb_typeof(v_location -> 'postal_code') <> 'string') THEN
    RAISE EXCEPTION 'Workspace location text fields must be strings'
      USING ERRCODE = '23514';
  END IF;

  IF btrim(COALESCE(v_location ->> 'city', '')) = ''
     OR btrim(COALESCE(v_location ->> 'address', '')) = ''
     OR btrim(COALESCE(v_location ->> 'country', '')) = '' THEN
    RAISE EXCEPTION 'Workspace location city, address and country are required'
      USING ERRCODE = '23514';
  END IF;

  IF length(v_location ->> 'city') > 160
     OR length(v_location ->> 'address') > 500
     OR length(COALESCE(v_location ->> 'country', '')) > 160
     OR length(COALESCE(v_location ->> 'state', '')) > 160
     OR length(COALESCE(v_location ->> 'postal_code', '')) > 40 THEN
    RAISE EXCEPTION 'Workspace location fields exceed the allowed length'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.data ? 'amenities' THEN
    IF jsonb_typeof(NEW.data -> 'amenities') <> 'array' THEN
      RAISE EXCEPTION 'Workspace amenities must be an array'
        USING ERRCODE = '23514';
    END IF;

    IF jsonb_array_length(NEW.data -> 'amenities') > 50
       OR EXISTS (
         SELECT 1
         FROM jsonb_array_elements(NEW.data -> 'amenities') AS a(value)
         WHERE jsonb_typeof(a.value) <> 'string'
            OR btrim(a.value #>> '{}') = ''
            OR length(a.value #>> '{}') > 200
       ) THEN
      RAISE EXCEPTION 'Workspace amenities must be at most 50 non-empty strings'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.data ? 'house_rules' THEN
    IF jsonb_typeof(NEW.data -> 'house_rules') <> 'array' THEN
      RAISE EXCEPTION 'Workspace house_rules must be an array'
        USING ERRCODE = '23514';
    END IF;

    IF jsonb_array_length(NEW.data -> 'house_rules') > 50
       OR EXISTS (
         SELECT 1
         FROM jsonb_array_elements(NEW.data -> 'house_rules') AS r(value)
         WHERE jsonb_typeof(r.value) <> 'string'
            OR btrim(r.value #>> '{}') = ''
            OR length(r.value #>> '{}') > 500
       ) THEN
      RAISE EXCEPTION 'Workspace house_rules must be at most 50 non-empty strings'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.data ? 'operating_hours' THEN
    IF jsonb_typeof(NEW.data -> 'operating_hours') <> 'object' THEN
      RAISE EXCEPTION 'Workspace operating_hours must be an object'
        USING ERRCODE = '23514';
    END IF;

    IF jsonb_typeof(NEW.data -> 'operating_hours' -> 'open') IS DISTINCT FROM 'string'
       OR jsonb_typeof(NEW.data -> 'operating_hours' -> 'close') IS DISTINCT FROM 'string'
       OR jsonb_typeof(NEW.data -> 'operating_hours' -> 'days') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'Workspace operating_hours must contain open/close strings and a days array'
        USING ERRCODE = '23514';
    END IF;

    IF jsonb_array_length(NEW.data -> 'operating_hours' -> 'days') > 14
       OR EXISTS (
         SELECT 1
         FROM jsonb_array_elements(NEW.data -> 'operating_hours' -> 'days') AS d(value)
         WHERE jsonb_typeof(d.value) <> 'string'
            OR btrim(d.value #>> '{}') = ''
            OR length(d.value #>> '{}') > 20
       ) THEN
      RAISE EXCEPTION 'Workspace operating_hours.days must be at most 14 short strings'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.data ? 'images' THEN
    IF jsonb_typeof(NEW.data -> 'images') <> 'array' THEN
      RAISE EXCEPTION 'Workspace images must be an array'
        USING ERRCODE = '23514';
    END IF;

    IF jsonb_array_length(NEW.data -> 'images') > 30 THEN
      RAISE EXCEPTION 'Workspace images must contain at most 30 entries'
        USING ERRCODE = '23514';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(NEW.data -> 'images') AS img(value)
      WHERE jsonb_typeof(img.value) <> 'object'
         OR jsonb_typeof(img.value -> 'url') IS DISTINCT FROM 'string'
         OR btrim(COALESCE(img.value ->> 'url', '')) = ''
         OR length(img.value ->> 'url') > 2000
         OR length(COALESCE(img.value ->> 'caption', '')) > 500
    ) THEN
      RAISE EXCEPTION 'Workspace images must be objects with a valid url and bounded caption'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.spacego_guard_space_write()
  FROM PUBLIC, anon, authenticated;

-- Favourites may reference only published workspaces. The RLS policies below
-- already bind user_id to auth.uid(); this trigger adds the publication check
-- and is SECURITY DEFINER so it can see all spaces.
CREATE OR REPLACE FUNCTION public.spacego_guard_favourite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
  IF NEW.user_id IS DISTINCT FROM auth.uid()::text THEN
    RAISE EXCEPTION 'Favourites may only be written for the current user'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.spacego_spaces s
    WHERE s.id = NEW.space_id
      AND s.data ->> 'status' = 'published'
  ) THEN
    RAISE EXCEPTION 'Only published workspaces may be favourited'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.spacego_guard_favourite()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS spacego_enforce_payload_id ON public.spacego_spaces;
CREATE TRIGGER spacego_enforce_payload_id
  BEFORE INSERT OR UPDATE ON public.spacego_spaces
  FOR EACH ROW EXECUTE FUNCTION public.spacego_enforce_payload_id();

DROP TRIGGER IF EXISTS spacego_guard_space_write ON public.spacego_spaces;
CREATE TRIGGER spacego_guard_space_write
  BEFORE INSERT OR UPDATE ON public.spacego_spaces
  FOR EACH ROW EXECUTE FUNCTION public.spacego_guard_space_write();

DROP TRIGGER IF EXISTS spacego_enforce_payload_id ON public.spacego_bookings;
CREATE TRIGGER spacego_enforce_payload_id
  BEFORE INSERT OR UPDATE ON public.spacego_bookings
  FOR EACH ROW EXECUTE FUNCTION public.spacego_enforce_payload_id();

DROP TRIGGER IF EXISTS spacego_enforce_payload_id ON public.spacego_activations;
CREATE TRIGGER spacego_enforce_payload_id
  BEFORE INSERT OR UPDATE ON public.spacego_activations
  FOR EACH ROW EXECUTE FUNCTION public.spacego_enforce_payload_id();

DROP TRIGGER IF EXISTS spacego_enforce_payload_id ON public.spacego_demand_searches;
CREATE TRIGGER spacego_enforce_payload_id
  BEFORE INSERT OR UPDATE ON public.spacego_demand_searches
  FOR EACH ROW EXECUTE FUNCTION public.spacego_enforce_payload_id();

DROP TRIGGER IF EXISTS spacego_enforce_payload_id ON public.spacego_enquiries;
CREATE TRIGGER spacego_enforce_payload_id
  BEFORE INSERT OR UPDATE ON public.spacego_enquiries
  FOR EACH ROW EXECUTE FUNCTION public.spacego_enforce_payload_id();

DROP TRIGGER IF EXISTS spacego_enforce_payload_id ON public.spacego_notifications;
CREATE TRIGGER spacego_enforce_payload_id
  BEFORE INSERT OR UPDATE ON public.spacego_notifications
  FOR EACH ROW EXECUTE FUNCTION public.spacego_enforce_payload_id();

DROP TRIGGER IF EXISTS spacego_guard_favourite ON public.spacego_favourites;
CREATE TRIGGER spacego_guard_favourite
  BEFORE INSERT OR UPDATE ON public.spacego_favourites
  FOR EACH ROW EXECUTE FUNCTION public.spacego_guard_favourite();

-- ------------------------------------------------------------
-- 5. BOOKING RPCs
-- ------------------------------------------------------------
-- All booking writes are server-authoritative. The client cannot choose the
-- seeker, owner, price, currency, status, booking id, or access code.
CREATE OR REPLACE FUNCTION public.spacego_create_booking(
  p_space_id text,
  p_start_date timestamptz,
  p_end_date timestamptz,
  p_duration_type text,
  p_duration_units integer,
  p_seats integer,
  p_special_requests text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_profile_role text;
  v_user_name text;
  v_user_email text;
  v_space jsonb;
  v_owner_id text;
  v_owner_uuid uuid;
  v_owner_role text;
  v_category text;
  v_title text;
  v_image text;
  v_location text;
  v_capacity integer;
  v_unit_rate numeric;
  v_base numeric;
  v_service numeric;
  v_total numeric;
  v_currency text;
  v_status text;
  v_id text;
  v_access_code text;
  v_booking jsonb;
  v_conflict jsonb;
  v_expected_end timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  IF p_space_id IS NULL OR btrim(p_space_id) = '' OR length(p_space_id) > 200 THEN
    RAISE EXCEPTION 'A valid space id is required'
      USING ERRCODE = '22023';
  END IF;

  IF p_duration_type IS NULL
     OR p_duration_type NOT IN ('hourly', 'daily', 'monthly') THEN
    RAISE EXCEPTION 'Invalid duration type'
      USING ERRCODE = '22023';
  END IF;

  IF p_duration_units IS NULL OR p_duration_units < 1
     OR (p_duration_type = 'hourly' AND p_duration_units > 744)
     OR (p_duration_type = 'daily' AND p_duration_units > 366)
     OR (p_duration_type = 'monthly' AND p_duration_units > 36) THEN
    RAISE EXCEPTION 'Invalid duration units'
      USING ERRCODE = '22023';
  END IF;

  IF p_seats IS NULL OR p_seats < 1 OR p_seats > 10000 THEN
    RAISE EXCEPTION 'Invalid seat count'
      USING ERRCODE = '22023';
  END IF;

  IF p_start_date IS NULL OR p_end_date IS NULL THEN
    RAISE EXCEPTION 'Start and end dates are required'
      USING ERRCODE = '22023';
  END IF;

  IF p_start_date < now() - interval '5 minutes' THEN
    RAISE EXCEPTION 'Bookings cannot start in the past'
      USING ERRCODE = '22023';
  END IF;

  IF p_end_date <= p_start_date THEN
    RAISE EXCEPTION 'End date must be after start date'
      USING ERRCODE = '22023';
  END IF;

  SELECT p.role, p.full_name, p.email
  INTO v_profile_role, v_user_name, v_user_email
  FROM public.profiles p
  WHERE p.id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'A complete profile is required before booking'
      USING ERRCODE = '42501';
  END IF;

  IF v_profile_role NOT IN ('seeker', 'owner', 'admin') THEN
    RAISE EXCEPTION 'Your account is not permitted to create bookings'
      USING ERRCODE = '42501';
  END IF;

  SELECT s.data INTO v_space
  FROM public.spacego_spaces s
  WHERE s.id = btrim(p_space_id);

  IF v_space IS NULL THEN
    RAISE EXCEPTION 'Workspace not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF COALESCE(v_space ->> 'status', '') <> 'published' THEN
    RAISE EXCEPTION 'Workspace is not available for booking'
      USING ERRCODE = '22023';
  END IF;

  v_owner_id := NULLIF(btrim(COALESCE(v_space ->> 'owner_id', '')), '');
  v_owner_uuid := public.spacego_try_uuid(v_owner_id);
  IF v_owner_uuid IS NULL THEN
    RAISE EXCEPTION 'Workspace owner is not configured; booking is unavailable'
      USING ERRCODE = '22023';
  END IF;

  SELECT p.role INTO v_owner_role
  FROM public.profiles p
  WHERE p.id = v_owner_uuid;

  IF NOT FOUND OR v_owner_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Workspace owner is not configured; booking is unavailable'
      USING ERRCODE = '22023';
  END IF;

  IF v_owner_uuid = v_uid THEN
    RAISE EXCEPTION 'You cannot book your own workspace'
      USING ERRCODE = '22023';
  END IF;

  v_capacity := public.spacego_try_integer(v_space ->> 'capacity');
  IF v_capacity IS NULL OR v_capacity NOT BETWEEN 1 AND 1000000 THEN
    RAISE EXCEPTION 'Workspace capacity is invalid'
      USING ERRCODE = '22023';
  END IF;

  IF p_seats > v_capacity THEN
    RAISE EXCEPTION 'Requested seats exceed workspace capacity'
      USING ERRCODE = '22023';
  END IF;

  v_expected_end := p_start_date + CASE p_duration_type
    WHEN 'hourly' THEN make_interval(hours => p_duration_units)
    WHEN 'daily' THEN make_interval(days => p_duration_units)
    ELSE make_interval(days => p_duration_units * 30)
  END;

  IF abs(extract(epoch FROM (p_end_date - v_expected_end))) > 300 THEN
    RAISE EXCEPTION 'Booking end date does not match the declared duration'
      USING ERRCODE = '22023';
  END IF;

  v_unit_rate := public.spacego_try_numeric(
    v_space -> 'pricing' ->> p_duration_type
  );
  IF v_unit_rate IS NULL OR v_unit_rate NOT BETWEEN 0.01 AND 1000000000 THEN
    RAISE EXCEPTION 'Pricing is not configured for this duration type'
      USING ERRCODE = '22023';
  END IF;

  v_base := v_unit_rate * p_duration_units
    * CASE WHEN p_duration_type IN ('hourly', 'daily') THEN p_seats ELSE 1 END;
  v_service := round(v_base * 0.10);
  v_total := v_base + v_service;

  IF v_total IS NULL OR v_total NOT BETWEEN 0.01 AND 1000000000 THEN
    RAISE EXCEPTION 'Calculated booking total is invalid'
      USING ERRCODE = '22023';
  END IF;

  v_currency := NULLIF(btrim(COALESCE(v_space -> 'pricing' ->> 'currency', '')), '');
  IF v_currency IS NULL OR v_currency !~ '^[A-Za-z]{3}$' THEN
    v_currency := 'USD';
  ELSE
    v_currency := upper(v_currency);
  END IF;

  v_category := NULLIF(btrim(COALESCE(v_space ->> 'category', '')), '');
  IF v_category IS NULL
     OR v_category NOT IN (
       'coworking', 'private_office', 'meeting_room',
       'training_room', 'studio', 'event_space'
     ) THEN
    RAISE EXCEPTION 'Workspace category is invalid'
      USING ERRCODE = '22023';
  END IF;

  v_title := COALESCE(NULLIF(btrim(v_space ->> 'title'), ''), 'Workspace');
  v_image := COALESCE(v_space -> 'images' -> 0 ->> 'url', '');
  v_location := concat_ws(
    ', ',
    NULLIF(btrim(COALESCE(v_space -> 'location' ->> 'city', '')), ''),
    COALESCE(
      NULLIF(btrim(COALESCE(v_space -> 'location' ->> 'state', '')), ''),
      NULLIF(btrim(COALESCE(v_space -> 'location' ->> 'country', '')), '')
    )
  );
  v_location := COALESCE(NULLIF(v_location, ''), 'Unknown');

  -- Transaction-scoped per-space lock. Every booking insert and every
  -- transition to approved for the same space is serialized here.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('spacego_booking:' || btrim(p_space_id), 0)
  );

  -- Fail closed when an approved/completed booking for this workspace has
  -- missing, invalid, or reversed timestamps. Its occupied interval cannot be
  -- determined, so the workspace inventory is treated as unavailable until an
  -- admin repairs the data. This prevents malformed active bookings from
  -- being silently ignored as free inventory.
  IF EXISTS (
    SELECT 1
    FROM public.spacego_bookings b
    WHERE b.data ->> 'space_id' = btrim(p_space_id)
      AND COALESCE(b.data ->> 'status', '') IN ('approved', 'completed')
      AND (
        public.spacego_try_timestamptz(b.data ->> 'start_date') IS NULL
        OR public.spacego_try_timestamptz(b.data ->> 'end_date') IS NULL
        OR public.spacego_try_timestamptz(b.data ->> 'start_date')
           >= public.spacego_try_timestamptz(b.data ->> 'end_date')
      )
  ) THEN
    RAISE EXCEPTION 'Workspace inventory is locked pending review of a malformed active booking'
      USING ERRCODE = '23P01';
  END IF;

  -- Only approved/completed bookings hold inventory. Pending requests may
  -- overlap; spacego_update_booking_status() serializes approvals with the same
  -- advisory lock and re-checks this condition before approving one.
  SELECT b.data INTO v_conflict
  FROM public.spacego_bookings b
  WHERE b.data ->> 'space_id' = btrim(p_space_id)
    AND COALESCE(b.data ->> 'status', '') IN ('approved', 'completed')
    AND public.spacego_try_timestamptz(b.data ->> 'start_date') IS NOT NULL
    AND public.spacego_try_timestamptz(b.data ->> 'end_date') IS NOT NULL
    AND p_start_date < public.spacego_try_timestamptz(b.data ->> 'end_date')
    AND p_end_date > public.spacego_try_timestamptz(b.data ->> 'start_date')
  LIMIT 1;

  IF v_conflict IS NOT NULL THEN
    RAISE EXCEPTION 'The workspace is already booked for the requested period'
      USING ERRCODE = '23P01';
  END IF;

  v_id := 'SPG-' || to_char(now(), 'YYYY') || '-'
    || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));

  IF v_space @> '{"instant_book": true}'::jsonb THEN
    v_status := 'approved';
    v_access_code := 'PASS-' || upper(
      substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)
    );
  ELSE
    v_status := 'pending';
    v_access_code := NULL;
  END IF;

  v_booking := jsonb_build_object(
    'id', v_id,
    'space_id', btrim(p_space_id),
    'space_title', v_title,
    'space_category', v_category,
    'space_image', v_image,
    'space_location', v_location,
    'user_id', v_uid::text,
    'user_name', v_user_name,
    'user_email', v_user_email,
    'owner_id', v_owner_uuid::text,
    'start_date', to_jsonb(p_start_date),
    'end_date', to_jsonb(p_end_date),
    'duration_type', p_duration_type,
    'duration_units', p_duration_units,
    'seats', p_seats,
    'total_price', v_total,
    'currency', v_currency,
    'status', v_status,
    'special_requests', NULLIF(left(btrim(COALESCE(p_special_requests, '')), 2000), ''),
    'access_code', v_access_code,
    'created_at', to_jsonb(now())
  );

  INSERT INTO public.spacego_bookings (id, data)
  VALUES (v_id, v_booking);

  PERFORM public.spacego_create_notification(
    v_owner_uuid::text,
    'New Booking Request',
    v_user_name || ' submitted a ' || p_duration_type || ' request for '
      || v_title || ' (' || v_id || ').',
    'booking_update',
    '/owner/bookings'
  );

  PERFORM public.spacego_create_notification(
    v_uid::text,
    CASE WHEN v_status = 'approved' THEN 'Booking Confirmed!' ELSE 'Booking Request Received' END,
    CASE WHEN v_status = 'approved'
      THEN 'Your booking at ' || v_title || ' is confirmed. Pass code: ' || v_access_code
      ELSE 'Your request for ' || v_title || ' is awaiting host approval. Reference: ' || v_id
    END,
    'booking_update',
    '/dashboard/bookings'
  );

  RETURN v_booking;
END;
$fn$;

REVOKE ALL ON FUNCTION public.spacego_create_booking(
  text, timestamptz, timestamptz, text, integer, integer, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.spacego_create_booking(
  text, timestamptz, timestamptz, text, integer, integer, text
) TO authenticated;

CREATE OR REPLACE FUNCTION public.spacego_update_booking_status(
  p_booking_id text,
  p_new_status text,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_booking jsonb;
  v_updated jsonb;
  v_current text;
  v_space_id text;
  v_owner_id text;
  v_start timestamptz;
  v_end timestamptz;
  v_is_admin boolean;
  v_is_owner boolean;
  v_is_seeker boolean;
  v_access_code text;
  v_conflict jsonb;
  v_note text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  IF p_booking_id IS NULL OR btrim(p_booking_id) = '' THEN
    RAISE EXCEPTION 'A booking id is required'
      USING ERRCODE = '22023';
  END IF;

  IF p_new_status IS NULL
     OR p_new_status NOT IN ('pending', 'approved', 'declined', 'cancelled', 'completed') THEN
    RAISE EXCEPTION 'Invalid booking status'
      USING ERRCODE = '22023';
  END IF;

  SELECT b.data INTO v_booking
  FROM public.spacego_bookings b
  WHERE b.id = btrim(p_booking_id)
  FOR UPDATE;

  IF v_booking IS NULL THEN
    RAISE EXCEPTION 'Booking not found'
      USING ERRCODE = 'P0002';
  END IF;

  v_current := v_booking ->> 'status';
  v_space_id := NULLIF(btrim(COALESCE(v_booking ->> 'space_id', '')), '');
  v_owner_id := NULLIF(btrim(COALESCE(v_booking ->> 'owner_id', '')), '');
  v_is_admin := public.is_admin();
  v_is_seeker := COALESCE(v_booking ->> 'user_id', '') = v_uid::text;
  v_is_owner := false;

  -- Owner authorization requires the booking to point at a real workspace
  -- whose actual owner_id matches both the booking owner_id and auth.uid().
  -- A missing workspace, a missing owner, or any mismatch fails closed.
  IF NOT v_is_admin
     AND v_owner_id = v_uid::text
     AND v_space_id IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM public.spacego_spaces s
       WHERE s.id = v_space_id
         AND s.data ->> 'owner_id' = v_owner_id
         AND s.data ->> 'owner_id' = v_uid::text
     )
     AND EXISTS (
       SELECT 1
       FROM public.profiles p
       WHERE p.id = v_uid AND p.role = 'owner'
     ) THEN
    v_is_owner := true;
  END IF;

  IF v_is_admin THEN
    NULL;
  ELSIF v_is_owner THEN
    -- IS DISTINCT FROM treats a missing legacy status as not-pending, so an
    -- ambiguous booking fails closed instead of slipping through a NULL check.
    IF p_new_status NOT IN ('approved', 'declined')
       OR v_current IS DISTINCT FROM 'pending' THEN
      RAISE EXCEPTION 'Owners may only approve or decline pending bookings'
        USING ERRCODE = '42501';
    END IF;
  ELSIF v_is_seeker THEN
    IF p_new_status <> 'cancelled'
       OR v_current IS NULL
       OR v_current NOT IN ('pending', 'approved') THEN
      RAISE EXCEPTION 'Seekers may only cancel their own pending or approved bookings'
        USING ERRCODE = '42501';
    END IF;

    IF public.spacego_try_timestamptz(v_booking ->> 'start_date') IS NULL
       OR public.spacego_try_timestamptz(v_booking ->> 'start_date') <= now() THEN
      RAISE EXCEPTION 'This booking is no longer eligible for cancellation'
        USING ERRCODE = '42501';
    END IF;
  ELSE
    RAISE EXCEPTION 'You are not allowed to change this booking'
      USING ERRCODE = '42501';
  END IF;

  IF p_new_status = 'approved' AND v_current IS DISTINCT FROM 'approved' THEN
    IF v_space_id IS NULL THEN
      RAISE EXCEPTION 'Booking has no workspace reference'
        USING ERRCODE = '22023';
    END IF;

    -- Approval must target a real workspace for every role, including admins.
    -- A booking whose workspace was deleted or never existed cannot allocate
    -- inventory. Existing booking rows are preserved; only approval is blocked.
    IF NOT EXISTS (
      SELECT 1
      FROM public.spacego_spaces s
      WHERE s.id = v_space_id
    ) THEN
      RAISE EXCEPTION 'Booking references a workspace that no longer exists'
        USING ERRCODE = '23503';
    END IF;

    v_start := public.spacego_try_timestamptz(v_booking ->> 'start_date');
    v_end := public.spacego_try_timestamptz(v_booking ->> 'end_date');

    IF v_start IS NULL OR v_end IS NULL OR v_start >= v_end THEN
      RAISE EXCEPTION 'Booking has invalid start/end timestamps and cannot be approved'
        USING ERRCODE = '22023';
    END IF;

    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('spacego_booking:' || v_space_id, 0)
    );

    -- Fail closed when any other active booking for this workspace has
    -- missing, invalid, or reversed timestamps. Such a booking cannot be
    -- placed on the timeline, so the workspace inventory is treated as
    -- unavailable until an admin repairs the data.
    IF EXISTS (
      SELECT 1
      FROM public.spacego_bookings b
      WHERE b.id <> btrim(p_booking_id)
        AND b.data ->> 'space_id' = v_space_id
        AND COALESCE(b.data ->> 'status', '') IN ('approved', 'completed')
        AND (
          public.spacego_try_timestamptz(b.data ->> 'start_date') IS NULL
          OR public.spacego_try_timestamptz(b.data ->> 'end_date') IS NULL
          OR public.spacego_try_timestamptz(b.data ->> 'start_date')
             >= public.spacego_try_timestamptz(b.data ->> 'end_date')
        )
    ) THEN
      RAISE EXCEPTION 'Workspace inventory is locked pending review of a malformed active booking'
        USING ERRCODE = '23P01';
    END IF;

    SELECT b.data INTO v_conflict
    FROM public.spacego_bookings b
    WHERE b.id <> btrim(p_booking_id)
      AND b.data ->> 'space_id' = v_space_id
      AND COALESCE(b.data ->> 'status', '') IN ('approved', 'completed')
      AND public.spacego_try_timestamptz(b.data ->> 'start_date') IS NOT NULL
      AND public.spacego_try_timestamptz(b.data ->> 'end_date') IS NOT NULL
      AND v_start < public.spacego_try_timestamptz(b.data ->> 'end_date')
      AND v_end > public.spacego_try_timestamptz(b.data ->> 'start_date')
    LIMIT 1;

    IF v_conflict IS NOT NULL THEN
      RAISE EXCEPTION 'Another booking already holds this period'
        USING ERRCODE = '23P01';
    END IF;
  END IF;

  IF p_new_status = 'approved' THEN
    v_access_code := NULLIF(btrim(COALESCE(v_booking ->> 'access_code', '')), '');
    IF v_access_code IS NULL THEN
      v_access_code := 'PASS-' || upper(
        substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)
      );
    END IF;
  ELSE
    v_access_code := NULL;
  END IF;

  v_updated := jsonb_set(
    v_booking,
    '{status}',
    to_jsonb(p_new_status),
    true
  );

  IF p_new_status IN ('pending', 'cancelled', 'declined') THEN
    v_updated := jsonb_set(v_updated, '{access_code}', 'null'::jsonb, true);
  ELSIF p_new_status = 'approved' THEN
    v_updated := jsonb_set(v_updated, '{access_code}', to_jsonb(v_access_code), true);
  END IF;

  UPDATE public.spacego_bookings
  SET data = v_updated
  WHERE id = btrim(p_booking_id);

  v_note := NULLIF(left(btrim(COALESCE(p_note, '')), 1000), '');

  IF v_is_seeker AND p_new_status = 'cancelled' THEN
    PERFORM public.spacego_create_notification(
      v_owner_id,
      'Booking Cancelled by Seeker',
      'Booking ' || btrim(p_booking_id) || ' for '
        || COALESCE(v_booking ->> 'space_title', 'your workspace')
        || ' was cancelled by the seeker.'
        || CASE WHEN v_note IS NULL THEN '' ELSE ' Note: ' || v_note END,
      'booking_update',
      '/owner/bookings'
    );
  ELSE
    PERFORM public.spacego_create_notification(
      COALESCE(v_booking ->> 'user_id', ''),
      'Booking Status: ' || upper(p_new_status),
      'Your booking for ' || COALESCE(v_booking ->> 'space_title', 'a workspace')
        || ' (' || btrim(p_booking_id) || ') is now ' || p_new_status || '.'
        || CASE WHEN v_note IS NULL THEN '' ELSE ' Note: ' || v_note END,
      'booking_update',
      '/dashboard/bookings'
    );
  END IF;

  RETURN v_updated;
END;
$fn$;

REVOKE ALL ON FUNCTION public.spacego_update_booking_status(text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.spacego_update_booking_status(text, text, text)
  TO authenticated;

-- ------------------------------------------------------------
-- 5B. BOOKING INVENTORY MODEL (DOCUMENTATION ONLY)
-- ------------------------------------------------------------
-- This migration preserves the existing exclusive whole-workspace reservation
-- model. Any approved/completed booking blocks every overlapping booking for
-- the same space, regardless of the requested seat count. Pending requests may
-- overlap, but only one overlapping request can be approved. That is the
-- correct model for private offices, meeting rooms, studios, event spaces, and
-- single-tenant coworking suites.
--
-- Capacity-aware concurrent seat booking is a different product model: several
-- approved bookings could overlap while the sum of their seats stays within the
-- workspace capacity. It is NOT implemented here and must not be enabled by
-- merely removing the overlap check. Before implementing it, confirm the
-- product rules and then design:
--   * a normalized inventory/reservation table or equivalent per-space,
--     per-interval seat ledger (JSONB-only rows are a poor fit for this);
--   * a serialization mechanism that accounts for seat totals, such as an
--     exclusion constraint with a seat sum, or a per-space advisory lock plus
--     a checked inventory update;
--   * create/approve/cancel/complete behavior for partially filled capacity;
--   * a backfill and compatibility plan for existing exclusive bookings.
--
-- The current advisory lock key remains per-space, so it also serializes any
-- future capacity-aware implementation for the same workspace.

-- ------------------------------------------------------------
-- 6. PROPERTY ACTIVATION RPCs
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.spacego_submit_activation(p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_profile_name text;
  v_profile_email text;
  v_owner_name text;
  v_email text;
  v_phone text;
  v_address text;
  v_city text;
  v_property_type text;
  v_condition text;
  v_model text;
  v_timeline text;
  v_notes text;
  v_sqft integer;
  v_budget numeric;
  v_facilities jsonb;
  v_photos jsonb;
  v_id text;
  v_request jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  IF p_data IS NULL OR jsonb_typeof(p_data) <> 'object' THEN
    RAISE EXCEPTION 'Activation payload must be a JSON object'
      USING ERRCODE = '22023';
  END IF;

  SELECT p.role, p.full_name, p.email
  INTO v_role, v_profile_name, v_profile_email
  FROM public.profiles p
  WHERE p.id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'A complete profile is required'
      USING ERRCODE = '42501';
  END IF;

  IF v_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Only owners may submit property activation requests'
      USING ERRCODE = '42501';
  END IF;

  v_owner_name := COALESCE(
    NULLIF(btrim(p_data ->> 'owner_name'), ''),
    v_profile_name
  );
  v_email := COALESCE(
    NULLIF(btrim(p_data ->> 'email'), ''),
    v_profile_email
  );
  v_phone := left(btrim(COALESCE(p_data ->> 'phone', '')), 80);
  v_address := NULLIF(left(btrim(COALESCE(p_data ->> 'property_address', '')), 500), '');
  v_city := NULLIF(left(btrim(COALESCE(p_data ->> 'city', '')), 160), '');
  v_property_type := NULLIF(btrim(COALESCE(p_data ->> 'property_type', '')), '');
  v_condition := NULLIF(btrim(COALESCE(p_data ->> 'current_condition', '')), '');
  v_model := NULLIF(btrim(COALESCE(p_data ->> 'preferred_model', '')), '');
  v_timeline := COALESCE(
    NULLIF(left(btrim(COALESCE(p_data ->> 'target_timeline', '')), 200), ''),
    'Flexible'
  );
  v_notes := left(btrim(COALESCE(p_data ->> 'additional_notes', '')), 5000);

  IF v_address IS NULL OR v_city IS NULL THEN
    RAISE EXCEPTION 'Property address and city are required'
      USING ERRCODE = '22023';
  END IF;

  IF v_email IS NULL OR length(v_email) > 320
     OR v_email !~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' THEN
    RAISE EXCEPTION 'A valid contact email is required'
      USING ERRCODE = '22023';
  END IF;

  IF v_property_type IS NULL
     OR v_property_type NOT IN (
       'vacant_floor', 'excess_office', 'retail_commercial',
       'hotel_space', 'independent_building', 'studio_hall'
     ) THEN
    RAISE EXCEPTION 'Invalid property type'
      USING ERRCODE = '22023';
  END IF;

  IF v_condition IS NULL
     OR v_condition NOT IN (
       'fully_furnished', 'partially_furnished', 'bare_shell', 'needs_renovation'
     ) THEN
    RAISE EXCEPTION 'Invalid property condition'
      USING ERRCODE = '22023';
  END IF;

  IF v_model IS NULL
     OR v_model NOT IN ('self_managed', 'assisted_activation', 'managed_partner') THEN
    RAISE EXCEPTION 'Invalid preferred activation model'
      USING ERRCODE = '22023';
  END IF;

  v_sqft := public.spacego_try_integer(p_data ->> 'approx_square_feet');
  IF v_sqft IS NULL OR v_sqft < 1 OR v_sqft > 10000000 THEN
    RAISE EXCEPTION 'approx_square_feet must be a positive integer'
      USING ERRCODE = '22023';
  END IF;

  v_budget := public.spacego_try_numeric(p_data ->> 'expected_budget_usd');
  IF v_budget IS NULL OR v_budget NOT BETWEEN 0 AND 1000000000000 THEN
    RAISE EXCEPTION 'expected_budget_usd is invalid'
      USING ERRCODE = '22023';
  END IF;

  v_facilities := CASE
    WHEN p_data ? 'existing_facilities'
      AND jsonb_typeof(p_data -> 'existing_facilities') = 'array'
      THEN p_data -> 'existing_facilities'
    ELSE '[]'::jsonb
  END;

  IF jsonb_array_length(v_facilities) > 50
     OR EXISTS (
       SELECT 1 FROM jsonb_array_elements(v_facilities) AS e(value)
       WHERE jsonb_typeof(e.value) <> 'string'
     )
     OR EXISTS (
       SELECT 1 FROM jsonb_array_elements_text(v_facilities) AS f(value)
       WHERE btrim(f.value) = '' OR length(f.value) > 200
     ) THEN
    RAISE EXCEPTION 'existing_facilities must contain at most 50 non-empty strings'
      USING ERRCODE = '22023';
  END IF;

  v_photos := CASE
    WHEN p_data ? 'photos'
      AND jsonb_typeof(p_data -> 'photos') = 'array'
      THEN p_data -> 'photos'
    ELSE '[]'::jsonb
  END;

  IF jsonb_array_length(v_photos) > 20
     OR EXISTS (
       SELECT 1 FROM jsonb_array_elements(v_photos) AS e(value)
       WHERE jsonb_typeof(e.value) <> 'string'
     )
     OR EXISTS (
       SELECT 1 FROM jsonb_array_elements_text(v_photos) AS f(value)
       WHERE btrim(f.value) = '' OR length(f.value) > 2000
     ) THEN
    RAISE EXCEPTION 'photos must contain at most 20 non-empty strings'
      USING ERRCODE = '22023';
  END IF;

  v_id := 'ACT-' || to_char(now(), 'YYYY') || '-'
    || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));

  v_request := jsonb_build_object(
    'id', v_id,
    'owner_id', v_uid::text,
    'owner_name', v_owner_name,
    'email', v_email,
    'phone', v_phone,
    'property_address', v_address,
    'city', v_city,
    'property_type', v_property_type,
    'approx_square_feet', v_sqft,
    'current_condition', v_condition,
    'existing_facilities', v_facilities,
    'expected_budget_usd', v_budget,
    'preferred_model', v_model,
    'target_timeline', v_timeline,
    'additional_notes', v_notes,
    'photos', v_photos,
    'status', 'submitted',
    'activation_score', NULL,
    'admin_notes', NULL,
    'created_at', to_jsonb(now())
  );

  INSERT INTO public.spacego_activations (id, data)
  VALUES (v_id, v_request);

  PERFORM public.spacego_create_notification(
    v_uid::text,
    'Property Activation Request Submitted',
    'Your activation request for ' || v_address || ' (' || v_id
      || ') is now queued for preliminary screening.',
    'activation_update',
    '/owner/activation'
  );

  RETURN v_request;
END;
$fn$;

REVOKE ALL ON FUNCTION public.spacego_submit_activation(jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.spacego_submit_activation(jsonb)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.spacego_update_activation_status(
  p_activation_id text,
  p_status text,
  p_admin_notes text DEFAULT NULL,
  p_score jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_request jsonb;
  v_updated jsonb;
  v_score jsonb;
  v_notes jsonb;
  v_num numeric;
  v_owner_id text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required'
      USING ERRCODE = '42501';
  END IF;

  IF p_activation_id IS NULL OR btrim(p_activation_id) = '' THEN
    RAISE EXCEPTION 'An activation id is required'
      USING ERRCODE = '22023';
  END IF;

  IF p_status IS NULL
     OR p_status NOT IN (
       'submitted', 'under_review', 'assessment_required',
       'approved_for_assessment', 'ready_for_launch', 'rejected'
     ) THEN
    RAISE EXCEPTION 'Invalid activation status'
      USING ERRCODE = '22023';
  END IF;

  SELECT a.data INTO v_request
  FROM public.spacego_activations a
  WHERE a.id = btrim(p_activation_id)
  FOR UPDATE;

  IF v_request IS NULL THEN
    RAISE EXCEPTION 'Activation request not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF p_score IS NOT NULL THEN
    IF jsonb_typeof(p_score) <> 'object' THEN
      RAISE EXCEPTION 'activation_score must be a JSON object'
        USING ERRCODE = '22023';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM jsonb_object_keys(p_score) AS keys(key)
      WHERE keys.key NOT IN (
        'total', 'demand_score', 'economics_score', 'readiness_score',
        'location_score', 'operational_score', 'breakdown_notes'
      )
    ) THEN
      RAISE EXCEPTION 'activation_score contains an unsupported field'
        USING ERRCODE = '22023';
    END IF;

    IF p_score ? 'total' THEN
      IF jsonb_typeof(p_score -> 'total') <> 'number' THEN
        RAISE EXCEPTION 'activation_score.total must be numeric'
          USING ERRCODE = '22023';
      END IF;
      v_num := (p_score ->> 'total')::numeric;
      IF v_num < 0 OR v_num > 100 THEN
        RAISE EXCEPTION 'activation_score.total must be between 0 and 100'
          USING ERRCODE = '22023';
      END IF;
    END IF;

    IF p_score ? 'demand_score' THEN
      IF jsonb_typeof(p_score -> 'demand_score') <> 'number' THEN
        RAISE EXCEPTION 'activation_score.demand_score must be numeric'
          USING ERRCODE = '22023';
      END IF;
      v_num := (p_score ->> 'demand_score')::numeric;
      IF v_num < 0 OR v_num > 30 THEN
        RAISE EXCEPTION 'activation_score.demand_score must be between 0 and 30'
          USING ERRCODE = '22023';
      END IF;
    END IF;

    IF p_score ? 'economics_score' THEN
      IF jsonb_typeof(p_score -> 'economics_score') <> 'number' THEN
        RAISE EXCEPTION 'activation_score.economics_score must be numeric'
          USING ERRCODE = '22023';
      END IF;
      v_num := (p_score ->> 'economics_score')::numeric;
      IF v_num < 0 OR v_num > 25 THEN
        RAISE EXCEPTION 'activation_score.economics_score must be between 0 and 25'
          USING ERRCODE = '22023';
      END IF;
    END IF;

    IF p_score ? 'readiness_score' THEN
      IF jsonb_typeof(p_score -> 'readiness_score') <> 'number' THEN
        RAISE EXCEPTION 'activation_score.readiness_score must be numeric'
          USING ERRCODE = '22023';
      END IF;
      v_num := (p_score ->> 'readiness_score')::numeric;
      IF v_num < 0 OR v_num > 20 THEN
        RAISE EXCEPTION 'activation_score.readiness_score must be between 0 and 20'
          USING ERRCODE = '22023';
      END IF;
    END IF;

    IF p_score ? 'location_score' THEN
      IF jsonb_typeof(p_score -> 'location_score') <> 'number' THEN
        RAISE EXCEPTION 'activation_score.location_score must be numeric'
          USING ERRCODE = '22023';
      END IF;
      v_num := (p_score ->> 'location_score')::numeric;
      IF v_num < 0 OR v_num > 15 THEN
        RAISE EXCEPTION 'activation_score.location_score must be between 0 and 15'
          USING ERRCODE = '22023';
      END IF;
    END IF;

    IF p_score ? 'operational_score' THEN
      IF jsonb_typeof(p_score -> 'operational_score') <> 'number' THEN
        RAISE EXCEPTION 'activation_score.operational_score must be numeric'
          USING ERRCODE = '22023';
      END IF;
      v_num := (p_score ->> 'operational_score')::numeric;
      IF v_num < 0 OR v_num > 10 THEN
        RAISE EXCEPTION 'activation_score.operational_score must be between 0 and 10'
          USING ERRCODE = '22023';
      END IF;
    END IF;

    IF p_score ? 'breakdown_notes' THEN
      IF jsonb_typeof(p_score -> 'breakdown_notes') <> 'string'
         OR length(p_score ->> 'breakdown_notes') > 5000 THEN
        RAISE EXCEPTION 'activation_score.breakdown_notes is invalid'
          USING ERRCODE = '22023';
      END IF;
    END IF;

    v_score := (CASE
      WHEN jsonb_typeof(v_request -> 'activation_score') = 'object'
        THEN v_request -> 'activation_score'
      ELSE '{}'::jsonb
    END) || p_score;
  ELSE
    v_score := v_request -> 'activation_score';
  END IF;

  IF p_admin_notes IS NULL THEN
    v_notes := COALESCE(v_request -> 'admin_notes', 'null'::jsonb);
  ELSE
    v_notes := to_jsonb(left(btrim(p_admin_notes), 5000));
  END IF;

  v_updated := v_request || jsonb_build_object(
    'status', p_status,
    'activation_score', v_score,
    'admin_notes', v_notes
  );

  UPDATE public.spacego_activations
  SET data = v_updated
  WHERE id = btrim(p_activation_id);

  v_owner_id := NULLIF(btrim(COALESCE(v_request ->> 'owner_id', '')), '');

  IF v_owner_id IS NOT NULL THEN
    -- Owner-facing notifications must never include admin-only review notes.
    -- p_admin_notes is retained in spacego_activations for admins only.
    PERFORM public.spacego_create_notification(
      v_owner_id,
      'Activation Request Status: ' || upper(replace(p_status, '_', ' ')),
      'Status updated for ' || COALESCE(v_request ->> 'property_address', 'your property')
        || ' (' || btrim(p_activation_id) || ').',
      'activation_update',
      '/owner/activation'
    );
  END IF;

  RETURN v_updated;
END;
$fn$;

REVOKE ALL ON FUNCTION public.spacego_update_activation_status(text, text, text, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.spacego_update_activation_status(text, text, text, jsonb)
  TO authenticated;

-- ------------------------------------------------------------
-- 7. ENQUIRY RPCs
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.spacego_submit_enquiry(
  p_user_name text,
  p_email text,
  p_company text,
  p_location_requested text,
  p_category_requested text,
  p_seats_needed integer,
  p_preferred_start date,
  p_budget_range text,
  p_notes text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_profile_name text;
  v_profile_email text;
  v_name text;
  v_email text;
  v_company text;
  v_location text;
  v_category text;
  v_budget text;
  v_notes text;
  v_id text;
  v_enquiry jsonb;
BEGIN
  IF v_uid IS NOT NULL THEN
    SELECT p.full_name, p.email
    INTO v_profile_name, v_profile_email
    FROM public.profiles p
    WHERE p.id = v_uid;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'A complete profile is required'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  v_name := COALESCE(
    NULLIF(left(btrim(COALESCE(p_user_name, '')), 160), ''),
    v_profile_name
  );
  v_email := COALESCE(
    NULLIF(left(btrim(COALESCE(p_email, '')), 320), ''),
    v_profile_email
  );
  v_company := left(btrim(COALESCE(p_company, '')), 200);
  v_location := NULLIF(left(btrim(COALESCE(p_location_requested, '')), 200), '');
  v_category := COALESCE(NULLIF(btrim(COALESCE(p_category_requested, '')), ''), 'all');
  v_budget := left(btrim(COALESCE(p_budget_range, '')), 200);
  v_notes := left(btrim(COALESCE(p_notes, '')), 5000);

  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Your name is required'
      USING ERRCODE = '22023';
  END IF;

  IF v_email IS NULL
     OR v_email !~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' THEN
    RAISE EXCEPTION 'A valid email is required'
      USING ERRCODE = '22023';
  END IF;

  IF v_location IS NULL THEN
    RAISE EXCEPTION 'A requested location is required'
      USING ERRCODE = '22023';
  END IF;

  IF v_category NOT IN (
    'all', 'coworking', 'private_office', 'meeting_room',
    'training_room', 'studio', 'event_space'
  ) THEN
    RAISE EXCEPTION 'Invalid requested category'
      USING ERRCODE = '22023';
  END IF;

  IF p_seats_needed IS NULL OR p_seats_needed < 1 OR p_seats_needed > 10000 THEN
    RAISE EXCEPTION 'seats_needed must be between 1 and 10000'
      USING ERRCODE = '22023';
  END IF;

  v_id := 'enq-' || replace(gen_random_uuid()::text, '-', '');

  v_enquiry := jsonb_build_object(
    'id', v_id,
    'user_id', CASE WHEN v_uid IS NULL THEN NULL ELSE v_uid::text END,
    'user_name', v_name,
    'email', v_email,
    'company', NULLIF(v_company, ''),
    'location_requested', v_location,
    'category_requested', v_category,
    'seats_needed', p_seats_needed,
    'preferred_start', to_jsonb(COALESCE(p_preferred_start, current_date)),
    'budget_range', NULLIF(v_budget, ''),
    'notes', v_notes,
    'status', 'new',
    'created_at', to_jsonb(now())
  );

  INSERT INTO public.spacego_enquiries (id, data)
  VALUES (v_id, v_enquiry);

  -- Anonymous callers receive only a non-sensitive receipt. They cannot read
  -- the stored contact details or any other enquiry.
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object(
      'id', v_id,
      'status', 'new',
      'created_at', v_enquiry -> 'created_at'
    );
  END IF;

  RETURN v_enquiry;
END;
$fn$;

REVOKE ALL ON FUNCTION public.spacego_submit_enquiry(
  text, text, text, text, text, integer, date, text, text
) FROM PUBLIC;
-- Anonymous execution is intentional. Rate limiting and Turnstile validation
-- must happen at the server/Cloudflare boundary; see section 15B.
GRANT EXECUTE ON FUNCTION public.spacego_submit_enquiry(
  text, text, text, text, text, integer, date, text, text
) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.spacego_update_enquiry_status(
  p_enquiry_id text,
  p_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_enquiry jsonb;
  v_updated jsonb;
  v_user_id text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required'
      USING ERRCODE = '42501';
  END IF;

  IF p_enquiry_id IS NULL OR btrim(p_enquiry_id) = '' THEN
    RAISE EXCEPTION 'An enquiry id is required'
      USING ERRCODE = '22023';
  END IF;

  IF p_status IS NULL OR p_status NOT IN ('new', 'contacted', 'fulfilled') THEN
    RAISE EXCEPTION 'Invalid enquiry status'
      USING ERRCODE = '22023';
  END IF;

  SELECT e.data INTO v_enquiry
  FROM public.spacego_enquiries e
  WHERE e.id = btrim(p_enquiry_id)
  FOR UPDATE;

  IF v_enquiry IS NULL THEN
    RAISE EXCEPTION 'Enquiry not found'
      USING ERRCODE = 'P0002';
  END IF;

  v_updated := jsonb_set(v_enquiry, '{status}', to_jsonb(p_status), true);

  UPDATE public.spacego_enquiries
  SET data = v_updated
  WHERE id = btrim(p_enquiry_id);

  v_user_id := NULLIF(btrim(COALESCE(v_enquiry ->> 'user_id', '')), '');

  IF v_user_id IS NOT NULL THEN
    PERFORM public.spacego_create_notification(
      v_user_id,
      'Workspace Request Updated',
      'Your workspace request for ' || COALESCE(v_enquiry ->> 'location_requested', 'your area')
        || ' is now marked ' || p_status || '.',
      'enquiry',
      '/dashboard/enquiries'
    );
  END IF;

  RETURN v_updated;
END;
$fn$;

REVOKE ALL ON FUNCTION public.spacego_update_enquiry_status(text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.spacego_update_enquiry_status(text, text)
  TO authenticated;

-- ------------------------------------------------------------
-- 8. DEMAND INTELLIGENCE RPCs
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.spacego_log_demand(
  p_location text,
  p_category text DEFAULT NULL,
  p_seats integer DEFAULT NULL,
  p_result_count integer DEFAULT 0
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_location text;
  v_category text;
  v_id text;
  v_entry jsonb;
BEGIN
  v_location := NULLIF(
    left(regexp_replace(btrim(COALESCE(p_location, '')), '[[:space:]]+', ' ', 'g'), 120),
    ''
  );

  IF v_location IS NULL THEN
    RAISE EXCEPTION 'A location query is required'
      USING ERRCODE = '22023';
  END IF;

  v_category := NULLIF(btrim(COALESCE(p_category, '')), '');
  IF v_category IS NOT NULL AND v_category NOT IN (
    'coworking', 'private_office', 'meeting_room',
    'training_room', 'studio', 'event_space'
  ) THEN
    RAISE EXCEPTION 'Invalid demand category'
      USING ERRCODE = '22023';
  END IF;

  IF p_seats IS NOT NULL AND (p_seats < 1 OR p_seats > 10000) THEN
    RAISE EXCEPTION 'Demand seats must be between 1 and 10000'
      USING ERRCODE = '22023';
  END IF;

  IF p_result_count IS NULL OR p_result_count < 0 OR p_result_count > 1000000000 THEN
    RAISE EXCEPTION 'Invalid result count'
      USING ERRCODE = '22023';
  END IF;

  v_id := 'ds-' || replace(gen_random_uuid()::text, '-', '');

  -- Deliberately no user id, IP address, precise coordinates, or device data.
  v_entry := jsonb_build_object(
    'id', v_id,
    'location_query', v_location,
    'category', v_category,
    'seats', p_seats,
    'has_results', p_result_count > 0,
    'result_count', p_result_count,
    'created_at', to_jsonb(now())
  );

  INSERT INTO public.spacego_demand_searches (id, data)
  VALUES (v_id, v_entry);

  RETURN v_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.spacego_log_demand(text, text, integer, integer)
  FROM PUBLIC;
-- Anonymous execution is intentional. Rate limiting and Turnstile validation
-- must happen at the server/Cloudflare boundary; see section 15B.
GRANT EXECUTE ON FUNCTION public.spacego_log_demand(text, text, integer, integer)
  TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.spacego_demand_analytics(p_days integer DEFAULT 90)
RETURNS TABLE (
  location_query text,
  category text,
  total_searches bigint,
  zero_result_searches bigint,
  searches_with_seats bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_days integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required'
      USING ERRCODE = '42501';
  END IF;

  v_days := LEAST(GREATEST(COALESCE(p_days, 90), 1), 3650);

  RETURN QUERY
  SELECT
    COALESCE(NULLIF(btrim(d.data ->> 'location_query'), ''), '(unknown)') AS location_query,
    NULLIF(btrim(d.data ->> 'category'), '') AS category,
    count(*)::bigint AS total_searches,
    count(*) FILTER (
      WHERE d.data ->> 'has_results' = 'false'
    )::bigint AS zero_result_searches,
    count(*) FILTER (
      WHERE NULLIF(d.data ->> 'seats', '') IS NOT NULL
    )::bigint AS searches_with_seats
  FROM public.spacego_demand_searches d
  WHERE d.created_at >= now() - make_interval(days => v_days)
  GROUP BY
    COALESCE(NULLIF(btrim(d.data ->> 'location_query'), ''), '(unknown)'),
    NULLIF(btrim(d.data ->> 'category'), '')
  ORDER BY 3 DESC, 1 ASC;
END;
$fn$;

REVOKE ALL ON FUNCTION public.spacego_demand_analytics(integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.spacego_demand_analytics(integer)
  TO authenticated;

-- ------------------------------------------------------------
-- 9. NOTIFICATION READ-STATE RPC
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.spacego_mark_notification_read(
  p_notification_id text,
  p_read boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_notification jsonb;
  v_updated jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  IF p_notification_id IS NULL OR btrim(p_notification_id) = '' THEN
    RAISE EXCEPTION 'A notification id is required'
      USING ERRCODE = '22023';
  END IF;

  SELECT n.data INTO v_notification
  FROM public.spacego_notifications n
  WHERE n.id = btrim(p_notification_id)
  FOR UPDATE;

  IF v_notification IS NULL THEN
    RAISE EXCEPTION 'Notification not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF COALESCE(v_notification ->> 'user_id', '') <> v_uid::text THEN
    RAISE EXCEPTION 'You may only change your own notifications'
      USING ERRCODE = '42501';
  END IF;

  v_updated := jsonb_set(
    v_notification,
    '{read}',
    to_jsonb(COALESCE(p_read, true)),
    true
  );

  UPDATE public.spacego_notifications
  SET data = v_updated
  WHERE id = btrim(p_notification_id);

  RETURN v_updated;
END;
$fn$;

REVOKE ALL ON FUNCTION public.spacego_mark_notification_read(text, boolean)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.spacego_mark_notification_read(text, boolean)
  TO authenticated;

-- ------------------------------------------------------------
-- 10. SANITIZED PUBLIC WORKSPACE VIEW
-- ------------------------------------------------------------
-- Public discovery is an explicit allowlist, not a blacklist. Only fields
-- needed by the reviewed public card, search, and detail UI are emitted.
-- owner_id, owner_email, owner contact details, passport.notes,
-- passport.inspected_by, location.coordinates, and every unknown top-level or
-- nested JSONB key are excluded by construction. owner_avatar is derived from
-- the trusted public.profiles row for the workspace owner, never from the
-- owner-supplied workspace JSON.
--
-- Do not replace this with jsonb_set()/key deletion: a newly added JSONB key
-- must never become public by default. Add fields here only after review.
--
-- Numeric coercion is inlined because the internal spacego_try_* helpers are
-- not executable by client roles, and view users must hold EXECUTE on every
-- function referenced by the view.
--
-- Do not run ALTER TABLE public.spacego_spaces FORCE ROW LEVEL SECURITY
-- without revisiting this view: it relies on the view owner bypassing RLS.
--
-- The owner_avatar lookup also relies on the view owner's privileges. Keep
-- security_invoker=false and do not grant public.profiles to anon: the view
-- emits only avatar_url and must not widen direct profile access.
CREATE OR REPLACE VIEW public.spacego_public_spaces
WITH (security_barrier = true, security_invoker = false)
AS
SELECT
  s.id,
  s.created_at,
  jsonb_build_object(
    'id', s.id,
    'title', CASE
      WHEN jsonb_typeof(s.data -> 'title') = 'string'
        THEN left(s.data ->> 'title', 200)
      ELSE ''
    END,
    'slug', CASE
      WHEN jsonb_typeof(s.data -> 'slug') = 'string'
        THEN left(s.data ->> 'slug', 200)
      ELSE ''
    END,
    'category', CASE
      WHEN s.data ->> 'category' IN (
        'coworking', 'private_office', 'meeting_room',
        'training_room', 'studio', 'event_space'
      ) THEN s.data ->> 'category'
      ELSE ''
    END,
    'headline', CASE
      WHEN jsonb_typeof(s.data -> 'headline') = 'string'
        THEN left(s.data ->> 'headline', 500)
      ELSE ''
    END,
    'description', CASE
      WHEN jsonb_typeof(s.data -> 'description') = 'string'
        THEN left(s.data ->> 'description', 10000)
      ELSE ''
    END,
    'location', jsonb_build_object(
      'city', CASE
        WHEN jsonb_typeof(s.data -> 'location' -> 'city') = 'string'
          THEN left(s.data -> 'location' ->> 'city', 160)
        ELSE ''
      END,
      'address', CASE
        WHEN jsonb_typeof(s.data -> 'location' -> 'address') = 'string'
          THEN left(s.data -> 'location' ->> 'address', 500)
        ELSE ''
      END,
      'state', CASE
        WHEN jsonb_typeof(s.data -> 'location' -> 'state') = 'string'
          THEN left(s.data -> 'location' ->> 'state', 160)
        ELSE ''
      END,
      'country', CASE
        WHEN jsonb_typeof(s.data -> 'location' -> 'country') = 'string'
          THEN left(s.data -> 'location' ->> 'country', 160)
        ELSE ''
      END,
      'postal_code', CASE
        WHEN jsonb_typeof(s.data -> 'location' -> 'postal_code') = 'string'
          THEN left(s.data -> 'location' ->> 'postal_code', 40)
        ELSE ''
      END,
      'landmark', CASE
        WHEN jsonb_typeof(s.data -> 'location' -> 'landmark') = 'string'
          THEN left(s.data -> 'location' ->> 'landmark', 200)
        ELSE ''
      END
    ),
    'capacity', CASE
      -- Integer-valued JSON numbers may arrive as "25.0". The regex admits only
      -- integral decimals, and the numeric intermediate means a decimal string
      -- is never cast directly to integer. Malformed or out-of-range values
      -- fall back to 0 instead of aborting the whole view.
      WHEN btrim(COALESCE(s.data ->> 'capacity', '')) ~
        '^[+-]?[0-9]{1,9}([.]0+)?$'
        THEN btrim(s.data ->> 'capacity')::numeric::integer
      ELSE 0
    END,
    'square_feet', CASE
      WHEN btrim(COALESCE(s.data ->> 'square_feet', '')) ~
        '^[+-]?[0-9]{1,9}([.]0+)?$'
        THEN btrim(s.data ->> 'square_feet')::numeric::integer
      ELSE 0
    END,
    'pricing', CASE
      WHEN jsonb_typeof(s.data -> 'pricing') = 'object' THEN
        jsonb_build_object(
          'hourly', CASE
            WHEN jsonb_typeof(s.data -> 'pricing' -> 'hourly') = 'number'
              THEN s.data -> 'pricing' -> 'hourly'
            ELSE NULL::jsonb
          END,
          'daily', CASE
            WHEN jsonb_typeof(s.data -> 'pricing' -> 'daily') = 'number'
              THEN s.data -> 'pricing' -> 'daily'
            ELSE NULL::jsonb
          END,
          'weekly', CASE
            WHEN jsonb_typeof(s.data -> 'pricing' -> 'weekly') = 'number'
              THEN s.data -> 'pricing' -> 'weekly'
            ELSE NULL::jsonb
          END,
          'monthly', CASE
            WHEN jsonb_typeof(s.data -> 'pricing' -> 'monthly') = 'number'
              THEN s.data -> 'pricing' -> 'monthly'
            ELSE NULL::jsonb
          END,
          'currency', CASE
            WHEN jsonb_typeof(s.data -> 'pricing' -> 'currency') = 'string'
              AND (s.data -> 'pricing' ->> 'currency') ~ '^[A-Za-z]{3}$'
              THEN upper(s.data -> 'pricing' ->> 'currency')
            ELSE 'USD'
          END
        )
      ELSE jsonb_build_object(
        'hourly', NULL::jsonb,
        'daily', NULL::jsonb,
        'weekly', NULL::jsonb,
        'monthly', NULL::jsonb,
        'currency', 'USD'
      )
    END,
    'amenities', COALESCE((
      SELECT jsonb_agg(items.value ORDER BY items.ord)
      FROM (
        SELECT a.value, a.ord
        FROM jsonb_array_elements(
          CASE
            WHEN jsonb_typeof(s.data -> 'amenities') = 'array'
              THEN s.data -> 'amenities'
            ELSE '[]'::jsonb
          END
        ) WITH ORDINALITY AS a(value, ord)
        WHERE jsonb_typeof(a.value) = 'string'
          AND btrim(a.value #>> '{}') <> ''
          AND length(a.value #>> '{}') <= 200
        ORDER BY a.ord
        LIMIT 50
      ) AS items
    ), '[]'::jsonb),
    'operating_hours', jsonb_build_object(
      'open', CASE
        WHEN jsonb_typeof(s.data -> 'operating_hours' -> 'open') = 'string'
          THEN left(s.data -> 'operating_hours' ->> 'open', 50)
        ELSE ''
      END,
      'close', CASE
        WHEN jsonb_typeof(s.data -> 'operating_hours' -> 'close') = 'string'
          THEN left(s.data -> 'operating_hours' ->> 'close', 50)
        ELSE ''
      END,
      'days', COALESCE((
        SELECT jsonb_agg(items.value ORDER BY items.ord)
        FROM (
          SELECT d.value, d.ord
          FROM jsonb_array_elements(
            CASE
              WHEN jsonb_typeof(s.data -> 'operating_hours' -> 'days') = 'array'
                THEN s.data -> 'operating_hours' -> 'days'
              ELSE '[]'::jsonb
            END
          ) WITH ORDINALITY AS d(value, ord)
          WHERE jsonb_typeof(d.value) = 'string'
            AND btrim(d.value #>> '{}') <> ''
            AND length(d.value #>> '{}') <= 20
          ORDER BY d.ord
          LIMIT 14
        ) AS items
      ), '[]'::jsonb)
    ),
    'house_rules', COALESCE((
      SELECT jsonb_agg(items.value ORDER BY items.ord)
      FROM (
        SELECT r.value, r.ord
        FROM jsonb_array_elements(
          CASE
            WHEN jsonb_typeof(s.data -> 'house_rules') = 'array'
              THEN s.data -> 'house_rules'
            ELSE '[]'::jsonb
          END
        ) WITH ORDINALITY AS r(value, ord)
        WHERE jsonb_typeof(r.value) = 'string'
          AND btrim(r.value #>> '{}') <> ''
          AND length(r.value #>> '{}') <= 500
        ORDER BY r.ord
        LIMIT 50
      ) AS items
    ), '[]'::jsonb),
    'verification_level', CASE
      WHEN s.data ->> 'verification_level' IN (
        'listed', 'checked', 'ready', 'pro'
      ) THEN s.data ->> 'verification_level'
      ELSE 'listed'
    END,
    'passport', jsonb_build_object(
      'identity_verified', CASE
        WHEN jsonb_typeof(
          s.data -> 'passport' -> 'identity_verified'
        ) = 'boolean'
          THEN s.data -> 'passport' -> 'identity_verified'
        ELSE 'false'::jsonb
      END,
      'property_authority_verified', CASE
        WHEN jsonb_typeof(
          s.data -> 'passport' -> 'property_authority_verified'
        ) = 'boolean'
          THEN s.data -> 'passport' -> 'property_authority_verified'
        ELSE 'false'::jsonb
      END,
      'permitted_use_confirmed', CASE
        WHEN jsonb_typeof(
          s.data -> 'passport' -> 'permitted_use_confirmed'
        ) = 'boolean'
          THEN s.data -> 'passport' -> 'permitted_use_confirmed'
        ELSE 'false'::jsonb
      END,
      'connectivity_tested_mbps', CASE
        WHEN btrim(
          COALESCE(s.data -> 'passport' ->> 'connectivity_tested_mbps', '')
        ) ~ '^[+-]?[0-9]{1,12}([.][0-9]{1,6})?$'
          THEN btrim(
            s.data -> 'passport' ->> 'connectivity_tested_mbps'
          )::numeric
        ELSE 0
      END,
      'power_backup_tested', CASE
        WHEN jsonb_typeof(
          s.data -> 'passport' -> 'power_backup_tested'
        ) = 'boolean'
          THEN s.data -> 'passport' -> 'power_backup_tested'
        ELSE 'false'::jsonb
      END,
      'fire_safety_inspected', CASE
        WHEN jsonb_typeof(
          s.data -> 'passport' -> 'fire_safety_inspected'
        ) = 'boolean'
          THEN s.data -> 'passport' -> 'fire_safety_inspected'
        ELSE 'false'::jsonb
      END,
      'inspected_at', CASE
        WHEN jsonb_typeof(s.data -> 'passport' -> 'inspected_at') = 'string'
          THEN left(s.data -> 'passport' ->> 'inspected_at', 50)
        ELSE ''
      END,
      'renewal_date', CASE
        WHEN jsonb_typeof(s.data -> 'passport' -> 'renewal_date') = 'string'
          THEN left(s.data -> 'passport' ->> 'renewal_date', 50)
        ELSE ''
      END
    ),
    'images', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'url', left(items.value ->> 'url', 2000),
          'caption', CASE
            WHEN jsonb_typeof(items.value -> 'caption') = 'string'
              THEN left(items.value ->> 'caption', 500)
            ELSE ''
          END,
          'is_cover', CASE
            WHEN jsonb_typeof(items.value -> 'is_cover') = 'boolean'
              THEN items.value -> 'is_cover'
            ELSE 'false'::jsonb
          END
        ) ORDER BY items.ord
      )
      FROM (
        SELECT img.value, img.ord
        FROM jsonb_array_elements(
          CASE
            WHEN jsonb_typeof(s.data -> 'images') = 'array'
              THEN s.data -> 'images'
            ELSE '[]'::jsonb
          END
        ) WITH ORDINALITY AS img(value, ord)
        WHERE jsonb_typeof(img.value) = 'object'
          AND jsonb_typeof(img.value -> 'url') = 'string'
          AND btrim(img.value ->> 'url') <> ''
        ORDER BY img.ord
        LIMIT 30
      ) AS items
    ), '[]'::jsonb),
    'owner_name', CASE
      WHEN jsonb_typeof(s.data -> 'owner_name') = 'string'
        THEN left(s.data ->> 'owner_name', 200)
      ELSE ''
    END,
    'owner_avatar', CASE
      WHEN btrim(COALESCE(owner_profile.avatar_url, '')) <> ''
        THEN left(btrim(owner_profile.avatar_url), 2000)
      ELSE ''
    END,
    'status', 'published',
    'rating', CASE
      WHEN btrim(COALESCE(s.data ->> 'rating', '')) ~
        '^[+-]?[0-9]{1,12}([.][0-9]{1,6})?$'
        THEN btrim(s.data ->> 'rating')::numeric
      ELSE 0
    END,
    'review_count', CASE
      WHEN btrim(COALESCE(s.data ->> 'review_count', '')) ~
        '^[+-]?[0-9]{1,9}([.]0+)?$'
        THEN btrim(s.data ->> 'review_count')::numeric::integer
      ELSE 0
    END,
    'instant_book', CASE
      WHEN jsonb_typeof(s.data -> 'instant_book') = 'boolean'
        THEN s.data -> 'instant_book'
      ELSE 'false'::jsonb
    END,
    'created_at', CASE
      WHEN jsonb_typeof(s.data -> 'created_at') = 'string'
        THEN to_jsonb(left(s.data ->> 'created_at', 50))
      ELSE to_jsonb(s.created_at)
    END
  ) AS data
FROM public.spacego_spaces s
LEFT JOIN public.profiles owner_profile
  ON owner_profile.id::text = s.data ->> 'owner_id'
 AND owner_profile.role IN ('owner', 'admin')
WHERE s.data ->> 'status' = 'published';

COMMENT ON VIEW public.spacego_public_spaces IS
  'Public read model for published SpaceGo workspaces. Explicit allowlist; excludes owner id, owner contact details, passport notes/inspector identity, coordinates, and unknown JSONB keys. owner_avatar is derived from the owner profile, not workspace JSON.';

REVOKE ALL ON TABLE public.spacego_public_spaces FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.spacego_public_spaces TO anon, authenticated;

-- ------------------------------------------------------------
-- 10B. RESTRICTED OWNER-FACING ACTIVATION VIEW
-- ------------------------------------------------------------
-- The base spacego_activations table is admin-only after this migration.
-- Owners read their own records through this security-definer view, which
-- emits an explicit allowlist. admin_notes and the free-text
-- activation_score.breakdown_notes are deliberately omitted; structured score
-- components remain visible because the owner UI presents them.
--
-- Admins retain full access through the base table and its admin policy. This
-- view is not an admin view: an admin querying it sees only rows whose
-- owner_id matches their own auth.uid().
--
-- Numeric coercion is inlined for the same reason as the public view: view
-- users need EXECUTE on every referenced function, and the internal helpers are
-- intentionally not client-executable.
--
-- Do not run ALTER TABLE public.spacego_activations FORCE ROW LEVEL SECURITY
-- without revisiting this view: it relies on the view owner bypassing RLS.
CREATE OR REPLACE VIEW public.spacego_owner_activations
WITH (security_barrier = true, security_invoker = false)
AS
SELECT
  a.id,
  a.created_at,
  jsonb_build_object(
    'id', a.id,
    'owner_id', CASE
      WHEN jsonb_typeof(a.data -> 'owner_id') = 'string'
        THEN left(a.data ->> 'owner_id', 200)
      ELSE ''
    END,
    'owner_name', CASE
      WHEN jsonb_typeof(a.data -> 'owner_name') = 'string'
        THEN left(a.data ->> 'owner_name', 200)
      ELSE ''
    END,
    'email', CASE
      WHEN jsonb_typeof(a.data -> 'email') = 'string'
        THEN left(a.data ->> 'email', 320)
      ELSE ''
    END,
    'phone', CASE
      WHEN jsonb_typeof(a.data -> 'phone') = 'string'
        THEN left(a.data ->> 'phone', 80)
      ELSE ''
    END,
    'property_address', CASE
      WHEN jsonb_typeof(a.data -> 'property_address') = 'string'
        THEN left(a.data ->> 'property_address', 500)
      ELSE ''
    END,
    'city', CASE
      WHEN jsonb_typeof(a.data -> 'city') = 'string'
        THEN left(a.data ->> 'city', 160)
      ELSE ''
    END,
    'property_type', CASE
      WHEN a.data ->> 'property_type' IN (
        'vacant_floor', 'excess_office', 'retail_commercial',
        'hotel_space', 'independent_building', 'studio_hall'
      ) THEN a.data ->> 'property_type'
      ELSE ''
    END,
    'approx_square_feet', CASE
      WHEN btrim(COALESCE(a.data ->> 'approx_square_feet', '')) ~
        '^[+-]?[0-9]{1,9}([.]0+)?$'
        THEN btrim(a.data ->> 'approx_square_feet')::numeric::integer
      ELSE 0
    END,
    'current_condition', CASE
      WHEN a.data ->> 'current_condition' IN (
        'fully_furnished', 'partially_furnished',
        'bare_shell', 'needs_renovation'
      ) THEN a.data ->> 'current_condition'
      ELSE ''
    END,
    'existing_facilities', COALESCE((
      SELECT jsonb_agg(items.value ORDER BY items.ord)
      FROM (
        SELECT f.value, f.ord
        FROM jsonb_array_elements(
          CASE
            WHEN jsonb_typeof(a.data -> 'existing_facilities') = 'array'
              THEN a.data -> 'existing_facilities'
            ELSE '[]'::jsonb
          END
        ) WITH ORDINALITY AS f(value, ord)
        WHERE jsonb_typeof(f.value) = 'string'
          AND btrim(f.value #>> '{}') <> ''
          AND length(f.value #>> '{}') <= 200
        ORDER BY f.ord
        LIMIT 50
      ) AS items
    ), '[]'::jsonb),
    'expected_budget_usd', CASE
      WHEN btrim(COALESCE(a.data ->> 'expected_budget_usd', '')) ~
        '^[+-]?[0-9]{1,12}([.][0-9]{1,6})?$'
        THEN btrim(a.data ->> 'expected_budget_usd')::numeric
      ELSE 0
    END,
    'preferred_model', CASE
      WHEN a.data ->> 'preferred_model' IN (
        'self_managed', 'assisted_activation', 'managed_partner'
      ) THEN a.data ->> 'preferred_model'
      ELSE ''
    END,
    'target_timeline', CASE
      WHEN jsonb_typeof(a.data -> 'target_timeline') = 'string'
        THEN left(a.data ->> 'target_timeline', 200)
      ELSE ''
    END,
    'additional_notes', CASE
      WHEN jsonb_typeof(a.data -> 'additional_notes') = 'string'
        THEN left(a.data ->> 'additional_notes', 5000)
      ELSE ''
    END,
    'photos', COALESCE((
      SELECT jsonb_agg(items.value ORDER BY items.ord)
      FROM (
        SELECT p.value, p.ord
        FROM jsonb_array_elements(
          CASE
            WHEN jsonb_typeof(a.data -> 'photos') = 'array'
              THEN a.data -> 'photos'
            ELSE '[]'::jsonb
          END
        ) WITH ORDINALITY AS p(value, ord)
        WHERE jsonb_typeof(p.value) = 'string'
          AND btrim(p.value #>> '{}') <> ''
          AND length(p.value #>> '{}') <= 2000
        ORDER BY p.ord
        LIMIT 20
      ) AS items
    ), '[]'::jsonb),
    'status', CASE
      WHEN a.data ->> 'status' IN (
        'submitted', 'under_review', 'assessment_required',
        'approved_for_assessment', 'ready_for_launch', 'rejected'
      ) THEN a.data ->> 'status'
      ELSE 'submitted'
    END,
    'activation_score', CASE
      WHEN jsonb_typeof(a.data -> 'activation_score') = 'object' THEN
        jsonb_build_object(
          'total', CASE
            WHEN jsonb_typeof(a.data -> 'activation_score' -> 'total') = 'number'
              THEN a.data -> 'activation_score' -> 'total'
            ELSE NULL::jsonb
          END,
          'demand_score', CASE
            WHEN jsonb_typeof(a.data -> 'activation_score' -> 'demand_score') = 'number'
              THEN a.data -> 'activation_score' -> 'demand_score'
            ELSE NULL::jsonb
          END,
          'economics_score', CASE
            WHEN jsonb_typeof(a.data -> 'activation_score' -> 'economics_score') = 'number'
              THEN a.data -> 'activation_score' -> 'economics_score'
            ELSE NULL::jsonb
          END,
          'readiness_score', CASE
            WHEN jsonb_typeof(a.data -> 'activation_score' -> 'readiness_score') = 'number'
              THEN a.data -> 'activation_score' -> 'readiness_score'
            ELSE NULL::jsonb
          END,
          'location_score', CASE
            WHEN jsonb_typeof(a.data -> 'activation_score' -> 'location_score') = 'number'
              THEN a.data -> 'activation_score' -> 'location_score'
            ELSE NULL::jsonb
          END,
          'operational_score', CASE
            WHEN jsonb_typeof(a.data -> 'activation_score' -> 'operational_score') = 'number'
              THEN a.data -> 'activation_score' -> 'operational_score'
            ELSE NULL::jsonb
          END
        )
      ELSE NULL
    END,
    'created_at', CASE
      WHEN jsonb_typeof(a.data -> 'created_at') = 'string'
        THEN to_jsonb(left(a.data ->> 'created_at', 50))
      ELSE to_jsonb(a.created_at)
    END
  ) AS data
FROM public.spacego_activations a
WHERE a.data ->> 'owner_id' = (SELECT auth.uid())::text;

COMMENT ON VIEW public.spacego_owner_activations IS
  'Owner read model for the current auth.uid() activation records. Explicit allowlist; excludes admin_notes, activation_score.breakdown_notes, and unknown JSONB keys. Admins use the base table.';

REVOKE ALL ON TABLE public.spacego_owner_activations
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.spacego_owner_activations TO authenticated;

-- READ-PATH INTEGRATION (application changes are outside this migration):
--   * Anonymous and public workspace reads must use spacego_public_spaces.
--   * spacego_public_spaces intentionally omits owner_id; use the base table
--     under its owner/admin RLS policy when an owner id is genuinely required.
--   * Public owner_avatar values come from public.profiles, not workspace JSON.
--   * Owner activation reads must use spacego_owner_activations.
--   * Admin activation reads must use the base spacego_activations table.
--   * Owner screens must not expect admin_notes or
--     activation_score.breakdown_notes; the safe view intentionally omits them.
--   * Notifications created before this migration are not rewritten and may
--     contain historical admin notes; run preflight query 14.9 to audit them.

-- ------------------------------------------------------------
-- 11. ROW LEVEL SECURITY POLICIES
-- ------------------------------------------------------------
ALTER TABLE public.spacego_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spacego_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spacego_activations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spacego_demand_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spacego_enquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spacego_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spacego_favourites ENABLE ROW LEVEL SECURITY;

-- Spaces: public discovery uses the view. Direct base-table reads are limited
-- to the owner and admins; owners write only their own rows.
CREATE POLICY "spacego_spaces_select_owner_or_admin"
  ON public.spacego_spaces
  FOR SELECT
  TO authenticated
  USING (
    (data ->> 'owner_id') = (SELECT auth.uid())::text
    OR public.is_admin()
  );

CREATE POLICY "spacego_spaces_insert_owner"
  ON public.spacego_spaces
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (data ->> 'owner_id') = (SELECT auth.uid())::text
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.role = 'owner'
    )
  );

CREATE POLICY "spacego_spaces_update_owner"
  ON public.spacego_spaces
  FOR UPDATE
  TO authenticated
  USING (
    (data ->> 'owner_id') = (SELECT auth.uid())::text
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.role = 'owner'
    )
  )
  WITH CHECK (
    (data ->> 'owner_id') = (SELECT auth.uid())::text
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.role = 'owner'
    )
  );

-- Owners do not receive a DELETE policy. They archive a listing by updating
-- status to 'archived' (the write guard permits that status for the owner).
-- The admin ALL policy below remains the only client-facing DELETE path; the
-- table-level DELETE grant is retained solely so an authenticated admin can
-- use it. Owner DELETE attempts fail closed at RLS.
CREATE POLICY "spacego_spaces_admin_all"
  ON public.spacego_spaces
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Bookings: the seeker and admins may read. An owner is authorized only when
-- the referenced workspace exists and its actual owner_id matches both the
-- booking owner_id and auth.uid(). Missing, mismatched, or ambiguous legacy
-- relationships fail closed. All writes go through RPCs.
CREATE POLICY "spacego_bookings_select_participant_or_admin"
  ON public.spacego_bookings
  FOR SELECT
  TO authenticated
  USING (
    (data ->> 'user_id') = (SELECT auth.uid())::text
    OR public.is_admin()
    OR (
      (data ->> 'owner_id') = (SELECT auth.uid())::text
      AND EXISTS (
        SELECT 1
        FROM public.spacego_spaces s
        WHERE s.id = spacego_bookings.data ->> 'space_id'
          AND (s.data ->> 'owner_id') = (spacego_bookings.data ->> 'owner_id')
          AND (s.data ->> 'owner_id') = (SELECT auth.uid())::text
      )
    )
  );

-- Activations: the base table is admin-only because it contains admin_notes
-- and internal review data. Owners read their own records through the
-- restricted spacego_owner_activations view. No direct client writes.
CREATE POLICY "spacego_activations_select_admin"
  ON public.spacego_activations
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Demand: non-admin users cannot read raw search data. No direct writes.
CREATE POLICY "spacego_demand_select_admin"
  ON public.spacego_demand_searches
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Enquiries: only the authenticated submitter and admins may read. Legacy
-- anonymous rows have no user_id and are therefore admin-only.
CREATE POLICY "spacego_enquiries_select_submitter_or_admin"
  ON public.spacego_enquiries
  FOR SELECT
  TO authenticated
  USING (
    (data ->> 'user_id') = (SELECT auth.uid())::text
    OR public.is_admin()
  );

-- Notifications: users read their own only. Read state is changed only
-- through spacego_mark_notification_read().
CREATE POLICY "spacego_notifications_select_own"
  ON public.spacego_notifications
  FOR SELECT
  TO authenticated
  USING ((data ->> 'user_id') = (SELECT auth.uid())::text);

-- Favourites: own rows only, including for admins.
CREATE POLICY "spacego_favourites_select_own"
  ON public.spacego_favourites
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid())::text);

CREATE POLICY "spacego_favourites_insert_own"
  ON public.spacego_favourites
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid())::text);

-- The application uses upsert(onConflict: user_id,space_id); PostgreSQL
-- requires UPDATE privilege for the DO UPDATE branch even when the row is new.
CREATE POLICY "spacego_favourites_update_own"
  ON public.spacego_favourites
  FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid())::text)
  WITH CHECK (user_id = (SELECT auth.uid())::text);

CREATE POLICY "spacego_favourites_delete_own"
  ON public.spacego_favourites
  FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid())::text);

-- ------------------------------------------------------------
-- 12. LEAST-PRIVILEGE GRANTS
-- ------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated;

REVOKE ALL PRIVILEGES ON TABLE
  public.spacego_spaces,
  public.spacego_bookings,
  public.spacego_activations,
  public.spacego_demand_searches,
  public.spacego_enquiries,
  public.spacego_notifications,
  public.spacego_favourites
FROM PUBLIC, anon, authenticated;

-- Direct table access for signed-in users. RLS still filters every row.
-- DELETE is granted only so the admin ALL policy can hard-delete; owners have
-- no DELETE policy and should archive by updating status to 'archived'.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.spacego_spaces TO authenticated;
GRANT SELECT ON TABLE public.spacego_bookings TO authenticated;
GRANT SELECT ON TABLE public.spacego_activations TO authenticated;
GRANT SELECT ON TABLE public.spacego_demand_searches TO authenticated;
GRANT SELECT ON TABLE public.spacego_enquiries TO authenticated;
GRANT SELECT ON TABLE public.spacego_notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.spacego_favourites TO authenticated;

-- Anonymous users receive no base-table grants. Public discovery goes through
-- the sanitized view; anonymous writes go through validated RPCs only.

-- ------------------------------------------------------------
-- 13. OWNERSHIP / READ-PATH INDEXES
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_spacego_spaces_owner
  ON public.spacego_spaces ((data ->> 'owner_id'));
CREATE INDEX IF NOT EXISTS idx_spacego_spaces_status
  ON public.spacego_spaces ((data ->> 'status'));

CREATE INDEX IF NOT EXISTS idx_spacego_bookings_space
  ON public.spacego_bookings ((data ->> 'space_id'));
CREATE INDEX IF NOT EXISTS idx_spacego_bookings_user
  ON public.spacego_bookings ((data ->> 'user_id'));
CREATE INDEX IF NOT EXISTS idx_spacego_bookings_owner
  ON public.spacego_bookings ((data ->> 'owner_id'));
CREATE INDEX IF NOT EXISTS idx_spacego_bookings_status
  ON public.spacego_bookings ((data ->> 'status'));

CREATE INDEX IF NOT EXISTS idx_spacego_activations_owner
  ON public.spacego_activations ((data ->> 'owner_id'));
CREATE INDEX IF NOT EXISTS idx_spacego_activations_status
  ON public.spacego_activations ((data ->> 'status'));

CREATE INDEX IF NOT EXISTS idx_spacego_demand_category
  ON public.spacego_demand_searches ((data ->> 'category'));

CREATE INDEX IF NOT EXISTS idx_spacego_enquiries_user
  ON public.spacego_enquiries ((data ->> 'user_id'));
CREATE INDEX IF NOT EXISTS idx_spacego_enquiries_status
  ON public.spacego_enquiries ((data ->> 'status'));

CREATE INDEX IF NOT EXISTS idx_spacego_notifications_user_read
  ON public.spacego_notifications ((data ->> 'user_id'), (data ->> 'read'));

-- ------------------------------------------------------------
-- 14. PREFLIGHT QUERIES (RUN MANUALLY BEFORE APPLYING)
-- ------------------------------------------------------------
-- These are comments on purpose. Save the output before applying the migration
-- so the before/after row counts and ambiguous ownership list are auditable.
/*
-- 14.1 Row counts before migration
SELECT 'spacego_spaces' AS table_name, count(*) FROM public.spacego_spaces
UNION ALL SELECT 'spacego_bookings', count(*) FROM public.spacego_bookings
UNION ALL SELECT 'spacego_activations', count(*) FROM public.spacego_activations
UNION ALL SELECT 'spacego_demand_searches', count(*) FROM public.spacego_demand_searches
UNION ALL SELECT 'spacego_enquiries', count(*) FROM public.spacego_enquiries
UNION ALL SELECT 'spacego_notifications', count(*) FROM public.spacego_notifications
UNION ALL SELECT 'spacego_favourites', count(*) FROM public.spacego_favourites;

-- 14.2 Spaces with missing/ambiguous owners (preserve; do not guess)
SELECT s.id, s.data ->> 'owner_id' AS owner_id, s.data ->> 'status' AS status
FROM public.spacego_spaces s
WHERE COALESCE(s.data ->> 'owner_id', '') = ''
   OR NOT EXISTS (
     SELECT 1 FROM public.profiles p
     WHERE p.id::text = s.data ->> 'owner_id'
   );

-- 14.3 Bookings with missing/ambiguous participant or space references
SELECT b.id,
       b.data ->> 'user_id' AS user_id,
       b.data ->> 'owner_id' AS owner_id,
       b.data ->> 'space_id' AS space_id,
       b.data ->> 'status' AS status
FROM public.spacego_bookings b
WHERE COALESCE(b.data ->> 'user_id', '') = ''
   OR COALESCE(b.data ->> 'owner_id', '') = ''
   OR NOT EXISTS (
     SELECT 1 FROM public.profiles p WHERE p.id::text = b.data ->> 'user_id'
   )
   OR NOT EXISTS (
     SELECT 1 FROM public.profiles p WHERE p.id::text = b.data ->> 'owner_id'
   )
   OR NOT EXISTS (
     SELECT 1 FROM public.spacego_spaces s WHERE s.id = b.data ->> 'space_id'
   );

-- 14.4 Activations, enquiries, notifications and favourites with ambiguous refs
SELECT 'activation' AS kind, a.id, a.data ->> 'owner_id' AS owner_id
FROM public.spacego_activations a
WHERE COALESCE(a.data ->> 'owner_id', '') <> ''
  AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id::text = a.data ->> 'owner_id')
UNION ALL
SELECT 'enquiry', e.id, e.data ->> 'user_id'
FROM public.spacego_enquiries e
WHERE COALESCE(e.data ->> 'user_id', '') <> ''
  AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id::text = e.data ->> 'user_id')
UNION ALL
SELECT 'notification', n.id, n.data ->> 'user_id'
FROM public.spacego_notifications n
WHERE COALESCE(n.data ->> 'user_id', '') = ''
   OR NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id::text = n.data ->> 'user_id')
UNION ALL
SELECT 'favourite', f.user_id || '/' || f.space_id, f.user_id
FROM public.spacego_favourites f
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id::text = f.user_id)
   OR NOT EXISTS (SELECT 1 FROM public.spacego_spaces s WHERE s.id = f.space_id);

-- 14.5 Top-level/payload id mismatches (preserve; do not auto-fix)
SELECT 'spacego_spaces' AS table_name, id FROM public.spacego_spaces WHERE data ->> 'id' IS DISTINCT FROM id
UNION ALL SELECT 'spacego_bookings', id FROM public.spacego_bookings WHERE data ->> 'id' IS DISTINCT FROM id
UNION ALL SELECT 'spacego_activations', id FROM public.spacego_activations WHERE data ->> 'id' IS DISTINCT FROM id
UNION ALL SELECT 'spacego_demand_searches', id FROM public.spacego_demand_searches WHERE data ->> 'id' IS DISTINCT FROM id
UNION ALL SELECT 'spacego_enquiries', id FROM public.spacego_enquiries WHERE data ->> 'id' IS DISTINCT FROM id
UNION ALL SELECT 'spacego_notifications', id FROM public.spacego_notifications WHERE data ->> 'id' IS DISTINCT FROM id;

-- 14.6 Existing approved/completed booking overlaps that require manual review.
-- The pg_temp helper keeps this runnable even when legacy timestamps are
-- malformed; malformed rows are excluded and should be reviewed separately.
CREATE OR REPLACE FUNCTION pg_temp.spacego_safe_ts(p_value text)
RETURNS timestamptz
LANGUAGE plpgsql
AS $safe_ts$
BEGIN
  RETURN p_value::timestamptz;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$safe_ts$;

SELECT a.id AS booking_a, b.id AS booking_b, a.data ->> 'space_id' AS space_id
FROM public.spacego_bookings a
JOIN public.spacego_bookings b
  ON b.data ->> 'space_id' = a.data ->> 'space_id'
 AND a.id < b.id
 AND COALESCE(a.data ->> 'status', '') IN ('approved', 'completed')
 AND COALESCE(b.data ->> 'status', '') IN ('approved', 'completed')
 AND pg_temp.spacego_safe_ts(a.data ->> 'start_date')
     < pg_temp.spacego_safe_ts(b.data ->> 'end_date')
 AND pg_temp.spacego_safe_ts(a.data ->> 'end_date')
     > pg_temp.spacego_safe_ts(b.data ->> 'start_date');

DROP FUNCTION pg_temp.spacego_safe_ts(text);

-- 14.7 Admin bootstrap review
SELECT id, email, role FROM public.profiles WHERE role = 'admin';

-- 14.8 Preserved spaces missing core fields required by the new write guard.
-- These rows are not modified by this migration; owners/admins must fill in
-- the missing core fields before the next update. This is a quick triage list,
-- not an exhaustive validation report.
SELECT
  s.id,
  s.data ->> 'title' AS title,
  s.data ->> 'slug' AS slug,
  s.data ->> 'category' AS category,
  s.data ->> 'status' AS status,
  s.data ->> 'capacity' AS capacity,
  s.data ->> 'square_feet' AS square_feet,
  s.data -> 'pricing' ->> 'currency' AS currency,
  s.data -> 'location' ->> 'city' AS city,
  s.data -> 'location' ->> 'address' AS address,
  s.data -> 'location' ->> 'country' AS country
FROM public.spacego_spaces s
WHERE COALESCE(btrim(s.data ->> 'title'), '') = ''
   OR COALESCE(btrim(s.data ->> 'slug'), '') = ''
   OR COALESCE(s.data ->> 'category', '') NOT IN (
        'coworking', 'private_office', 'meeting_room',
        'training_room', 'studio', 'event_space'
      )
   OR COALESCE(s.data ->> 'status', '') NOT IN (
        'published', 'draft', 'under_review', 'archived'
      )
   OR COALESCE(s.data ->> 'capacity', '') = ''
   OR COALESCE(s.data ->> 'square_feet', '') = ''
   OR COALESCE(s.data -> 'pricing' ->> 'currency', '') = ''
   OR COALESCE(btrim(s.data -> 'location' ->> 'city'), '') = ''
   OR COALESCE(btrim(s.data -> 'location' ->> 'address'), '') = ''
   OR COALESCE(btrim(s.data -> 'location' ->> 'country'), '') = '';

-- 14.9 READ-ONLY audit of historical activation_update notifications.
-- Before this migration the application appended admin notes to the
-- notification message. These rows are intentionally preserved: this query
-- only reads them and does not update, redact, or delete any notification.
-- The flags match notes still present on a related activation row; a
-- 'manual review' result may still contain a note that was later edited or
-- cleared, so inspect the full message for every row before deciding whether
-- an approved redaction is needed.
SELECT
  n.id AS notification_id,
  n.data ->> 'user_id' AS user_id,
  n.data ->> 'title' AS title,
  n.data ->> 'message' AS message,
  n.data ->> 'link' AS link,
  n.created_at AS row_created_at,
  n.data ->> 'created_at' AS payload_created_at,
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM public.spacego_activations a
      WHERE NULLIF(btrim(COALESCE(a.data ->> 'admin_notes', '')), '') IS NOT NULL
        AND strpos(
          COALESCE(n.data ->> 'message', ''),
          a.data ->> 'admin_notes'
        ) > 0
    ) THEN 'matches current admin_notes'
    WHEN EXISTS (
      SELECT 1
      FROM public.spacego_activations a
      WHERE NULLIF(btrim(COALESCE(
          a.data -> 'activation_score' ->> 'breakdown_notes', ''
        )), '') IS NOT NULL
        AND strpos(
          COALESCE(n.data ->> 'message', ''),
          a.data -> 'activation_score' ->> 'breakdown_notes'
        ) > 0
    ) THEN 'matches current breakdown_notes'
    ELSE 'manual review'
  END AS audit_hint
FROM public.spacego_notifications n
WHERE n.data ->> 'type' = 'activation_update'
ORDER BY n.created_at, n.id;

-- 14.10 READ-ONLY audit of booking/workspace reference and ownership
-- mismatches. The hardened owner authorization fails closed when the
-- referenced workspace is missing or its actual owner_id differs from the
-- booking owner_id, and approval (including admin approval) now requires the
-- workspace to exist. These rows are preserved; do not auto-reassign ownership
-- or delete bookings.
SELECT
  b.id AS booking_id,
  b.data ->> 'space_id' AS space_id,
  b.data ->> 'owner_id' AS booking_owner_id,
  s.data ->> 'owner_id' AS workspace_owner_id,
  b.data ->> 'status' AS status,
  CASE
    WHEN s.id IS NULL THEN 'workspace_missing'
    WHEN COALESCE(b.data ->> 'owner_id', '') = '' THEN 'booking_owner_missing'
    WHEN COALESCE(s.data ->> 'owner_id', '') = '' THEN 'workspace_owner_missing'
    WHEN s.data ->> 'owner_id' IS DISTINCT FROM b.data ->> 'owner_id'
      THEN 'owner_mismatch'
    ELSE 'ok'
  END AS ownership_problem
FROM public.spacego_bookings b
LEFT JOIN public.spacego_spaces s
  ON s.id = b.data ->> 'space_id'
WHERE s.id IS NULL
   OR COALESCE(b.data ->> 'owner_id', '') = ''
   OR COALESCE(s.data ->> 'owner_id', '') = ''
   OR s.data ->> 'owner_id' IS DISTINCT FROM b.data ->> 'owner_id';

-- 14.11 READ-ONLY audit of approved/completed bookings with missing, invalid,
-- or reversed start/end timestamps. The hardened create/approve paths treat
-- the affected workspace inventory as unavailable until an admin repairs the
-- timeline. A booking with a missing workspace reference cannot be attributed
-- to a specific workspace, so it is listed here but cannot automatically lock
-- any workspace.
CREATE OR REPLACE FUNCTION pg_temp.spacego_safe_ts(p_value text)
RETURNS timestamptz
LANGUAGE plpgsql
AS $safe_ts$
BEGIN
  RETURN p_value::timestamptz;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$safe_ts$;

SELECT
  b.id AS booking_id,
  b.data ->> 'space_id' AS space_id,
  b.data ->> 'owner_id' AS owner_id,
  b.data ->> 'status' AS status,
  b.data ->> 'start_date' AS start_date,
  b.data ->> 'end_date' AS end_date,
  CASE
    WHEN pg_temp.spacego_safe_ts(b.data ->> 'start_date') IS NULL
      OR pg_temp.spacego_safe_ts(b.data ->> 'end_date') IS NULL
      THEN 'missing_or_invalid'
    WHEN pg_temp.spacego_safe_ts(b.data ->> 'start_date')
         >= pg_temp.spacego_safe_ts(b.data ->> 'end_date')
      THEN 'reversed_or_empty'
    ELSE 'ok'
  END AS timestamp_problem
FROM public.spacego_bookings b
WHERE COALESCE(b.data ->> 'status', '') IN ('approved', 'completed')
  AND (
    pg_temp.spacego_safe_ts(b.data ->> 'start_date') IS NULL
    OR pg_temp.spacego_safe_ts(b.data ->> 'end_date') IS NULL
    OR pg_temp.spacego_safe_ts(b.data ->> 'start_date')
       >= pg_temp.spacego_safe_ts(b.data ->> 'end_date')
  )
ORDER BY b.id;

DROP FUNCTION pg_temp.spacego_safe_ts(text);
*/

-- ------------------------------------------------------------
-- 15. POST-APPLY VERIFICATION QUERIES (RUN MANUALLY)
-- ------------------------------------------------------------
/*
-- 15.1 RLS enabled on all seven tables
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'spacego_spaces','spacego_bookings','spacego_activations',
    'spacego_demand_searches','spacego_enquiries','spacego_notifications',
    'spacego_favourites'
  )
ORDER BY c.relname;

-- 15.2 Policies
SELECT tablename, policyname, cmd, roles, qual, with_check
FROM pg_catalog.pg_policies
WHERE schemaname = 'public'
  AND tablename LIKE 'spacego_%'
ORDER BY tablename, policyname;

-- 15.3 Table grants
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'spacego_spaces','spacego_bookings','spacego_activations',
    'spacego_demand_searches','spacego_enquiries','spacego_notifications',
    'spacego_favourites','spacego_public_spaces','spacego_owner_activations'
  )
  AND grantee IN ('anon','authenticated')
ORDER BY table_name, grantee, privilege_type;

-- 15.4 Function execute grants
SELECT p.proname, r.rolname, has_function_privilege(r.rolname, p.oid, 'EXECUTE') AS can_execute
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
CROSS JOIN pg_catalog.pg_roles r
WHERE n.nspname = 'public'
  AND p.proname LIKE 'spacego_%'
  AND r.rolname IN ('anon','authenticated')
ORDER BY p.proname, r.rolname;

-- 15.5 Trigger status
SELECT c.relname AS table_name, t.tgname, p.proname AS function_name, t.tgenabled
FROM pg_catalog.pg_trigger t
JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
JOIN pg_catalog.pg_proc p ON p.oid = t.tgfoid
WHERE n.nspname = 'public'
  AND c.relname LIKE 'spacego_%'
  AND NOT t.tgisinternal
ORDER BY c.relname, t.tgname;

-- 15.6 Public view forbidden data (all counts must be 0)
SELECT
  count(*) FILTER (WHERE data ? 'owner_email') AS owner_email_rows,
  count(*) FILTER (WHERE data ? 'owner_id') AS owner_id_rows,
  count(*) FILTER (WHERE data ? 'admin_notes') AS admin_notes_rows,
  count(*) FILTER (WHERE data #> '{passport,notes}' IS NOT NULL) AS passport_note_rows,
  count(*) FILTER (WHERE data #> '{passport,inspected_by}' IS NOT NULL) AS inspector_rows,
  count(*) FILTER (WHERE data #> '{location,coordinates}' IS NOT NULL) AS coordinate_rows
FROM public.spacego_public_spaces;

-- 15.6b Public view owner_avatar must match the trusted owner profile (or be
-- empty when the owner profile is missing). Must return 0: workspace JSON must
-- never be able to supply the public avatar URL.
SELECT count(*) AS untrusted_avatar_rows
FROM public.spacego_public_spaces v
JOIN public.spacego_spaces s ON s.id = v.id
LEFT JOIN public.profiles p
  ON p.id::text = s.data ->> 'owner_id'
 AND p.role IN ('owner', 'admin')
WHERE (v.data ->> 'owner_avatar') IS DISTINCT FROM
  left(COALESCE(NULLIF(btrim(p.avatar_url), ''), ''), 2000);

-- 15.7 Public view top-level allowlist (must return 0). The view is built
-- with jsonb_build_object(), so any new JSONB key stays private until it is
-- explicitly reviewed and added to the view definition.
SELECT count(*) AS unexpected_top_level_keys
FROM public.spacego_public_spaces v
CROSS JOIN LATERAL jsonb_object_keys(v.data) AS k(key)
WHERE k.key NOT IN (
  'id','title','slug','category','headline','description','location',
  'capacity','square_feet','pricing','amenities','operating_hours',
  'house_rules','verification_level','passport','images',
  'owner_name','owner_avatar','status','rating','review_count',
  'instant_book','created_at'
);

-- 15.8 Public view nested allowlist (must return 0). Unknown nested keys,
-- including future passport, location, pricing, hours, or image metadata,
-- must not appear.
SELECT count(*) AS unexpected_nested_keys
FROM public.spacego_public_spaces v
WHERE EXISTS (
  SELECT 1
  FROM jsonb_object_keys(
    CASE WHEN jsonb_typeof(v.data -> 'location') = 'object'
      THEN v.data -> 'location' ELSE '{}'::jsonb END
  ) AS k(key)
  WHERE k.key NOT IN (
    'city','address','state','country','postal_code','landmark'
  )
)
OR EXISTS (
  SELECT 1
  FROM jsonb_object_keys(
    CASE WHEN jsonb_typeof(v.data -> 'pricing') = 'object'
      THEN v.data -> 'pricing' ELSE '{}'::jsonb END
  ) AS k(key)
  WHERE k.key NOT IN ('hourly','daily','weekly','monthly','currency')
)
OR EXISTS (
  SELECT 1
  FROM jsonb_object_keys(
    CASE WHEN jsonb_typeof(v.data -> 'operating_hours') = 'object'
      THEN v.data -> 'operating_hours' ELSE '{}'::jsonb END
  ) AS k(key)
  WHERE k.key NOT IN ('open','close','days')
)
OR EXISTS (
  SELECT 1
  FROM jsonb_object_keys(
    CASE WHEN jsonb_typeof(v.data -> 'passport') = 'object'
      THEN v.data -> 'passport' ELSE '{}'::jsonb END
  ) AS k(key)
  WHERE k.key NOT IN (
    'identity_verified','property_authority_verified',
    'permitted_use_confirmed','connectivity_tested_mbps',
    'power_backup_tested','fire_safety_inspected','inspected_at',
    'renewal_date'
  )
)
OR EXISTS (
  SELECT 1
  FROM jsonb_array_elements(
    CASE WHEN jsonb_typeof(v.data -> 'images') = 'array'
      THEN v.data -> 'images' ELSE '[]'::jsonb END
  ) AS img(value)
  CROSS JOIN LATERAL jsonb_object_keys(img.value) AS k(key)
  WHERE k.key NOT IN ('url','caption','is_cover')
);

-- 15.9 View must expose published rows only (must return 0)
SELECT count(*)
FROM public.spacego_public_spaces v
JOIN public.spacego_spaces s ON s.id = v.id
WHERE s.data ->> 'status' <> 'published';

-- 15.10 Owner activation view forbidden data (all counts must be 0).
-- Run 15.10 through 15.12 inside the owner claim transaction in 15.14 so the
-- auth.uid() filter returns rows; a plain postgres session has no auth claims.
SELECT
  count(*) FILTER (WHERE data ? 'admin_notes') AS admin_notes_rows,
  count(*) FILTER (
    WHERE data #> '{activation_score,breakdown_notes}' IS NOT NULL
  ) AS breakdown_note_rows
FROM public.spacego_owner_activations;

-- 15.11 Owner activation view top-level allowlist (must return 0)
SELECT count(*) AS unexpected_top_level_keys
FROM public.spacego_owner_activations v
CROSS JOIN LATERAL jsonb_object_keys(v.data) AS k(key)
WHERE k.key NOT IN (
  'id','owner_id','owner_name','email','phone','property_address','city',
  'property_type','approx_square_feet','current_condition',
  'existing_facilities','expected_budget_usd','preferred_model',
  'target_timeline','additional_notes','photos','status',
  'activation_score','created_at'
);

-- 15.12 Owner activation score allowlist (must return 0). Structured score
-- components are owner-facing; breakdown_notes is admin-only.
SELECT count(*) AS unexpected_score_keys
FROM public.spacego_owner_activations v
WHERE EXISTS (
  SELECT 1
  FROM jsonb_object_keys(
    CASE WHEN jsonb_typeof(v.data -> 'activation_score') = 'object'
      THEN v.data -> 'activation_score' ELSE '{}'::jsonb END
  ) AS k(key)
  WHERE k.key NOT IN (
    'total','demand_score','economics_score','readiness_score',
    'location_score','operational_score'
  )
);

-- 15.13 Row counts after migration (must match 14.1)
SELECT 'spacego_spaces' AS table_name, count(*) FROM public.spacego_spaces
UNION ALL SELECT 'spacego_bookings', count(*) FROM public.spacego_bookings
UNION ALL SELECT 'spacego_activations', count(*) FROM public.spacego_activations
UNION ALL SELECT 'spacego_demand_searches', count(*) FROM public.spacego_demand_searches
UNION ALL SELECT 'spacego_enquiries', count(*) FROM public.spacego_enquiries
UNION ALL SELECT 'spacego_notifications', count(*) FROM public.spacego_notifications
UNION ALL SELECT 'spacego_favourites', count(*) FROM public.spacego_favourites;

-- 15.14 Ownership isolation smoke test (replace the UUID and run inside a
-- transaction). Both claim settings are supplied so the test works across
-- Supabase auth.uid() versions; real clients never set these directly.
-- The owner view must return only the owner's rows. The base activation
-- table must return 0 rows for the owner because it is admin-only.
-- BEGIN;
-- SET LOCAL ROLE authenticated;
-- SELECT set_config('request.jwt.claim.sub', '<owner-uuid>', true);
-- SELECT set_config(
--   'request.jwt.claims',
--   json_build_object('sub', '<owner-uuid>', 'role', 'authenticated')::text,
--   true
-- );
-- SELECT count(*) FROM public.spacego_owner_activations
--   WHERE data ->> 'owner_id' <> '<owner-uuid>'; -- must be 0
-- SELECT count(*) FROM public.spacego_activations; -- must be 0
-- SELECT count(*) FROM public.spacego_bookings; -- owner's own only
-- SELECT count(*) FROM public.spacego_notifications; -- owner's own only
-- SELECT count(*) FROM public.spacego_favourites; -- owner's own only
-- SELECT count(*) FROM public.spacego_public_spaces; -- published only
-- ROLLBACK;

-- 15.15 Admin base-table access (replace the UUID with an admin profile).
-- Admins must retain full activation access, including admin_notes.
-- BEGIN;
-- SET LOCAL ROLE authenticated;
-- SELECT set_config('request.jwt.claim.sub', '<admin-uuid>', true);
-- SELECT set_config(
--   'request.jwt.claims',
--   json_build_object('sub', '<admin-uuid>', 'role', 'authenticated')::text,
--   true
-- );
-- SELECT count(*) FROM public.spacego_activations; -- full activation count
-- SELECT count(*) FILTER (WHERE data ? 'admin_notes')
--   FROM public.spacego_activations; -- admin-visible notes
-- ROLLBACK;

-- 15.16 Anonymous base-table denial and view success. Run each block
-- separately: after a permission error, PostgreSQL aborts the transaction, so
-- the view check cannot share the same transaction.
-- BEGIN;
-- SET LOCAL ROLE anon;
-- SELECT count(*) FROM public.spacego_spaces; -- must fail with permission denied
-- ROLLBACK;
--
-- BEGIN;
-- SET LOCAL ROLE anon;
-- SELECT count(*) FROM public.spacego_public_spaces; -- must succeed, published only
-- ROLLBACK;
--
-- BEGIN;
-- SET LOCAL ROLE anon;
-- SELECT count(*) FROM public.spacego_owner_activations; -- must fail with permission denied
-- ROLLBACK;

-- 15.17 Workspace DELETE access. Expected: no owner DELETE policy. Only the
-- admin ALL policy may authorize DELETE; the table-level DELETE grant remains
-- solely for that admin path, while owners archive via UPDATE status.
SELECT tablename, policyname, cmd, roles
FROM pg_catalog.pg_policies
WHERE schemaname = 'public'
  AND tablename = 'spacego_spaces'
  AND cmd IN ('DELETE', 'ALL')
ORDER BY policyname;

SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'spacego_spaces'
  AND grantee IN ('anon', 'authenticated')
ORDER BY grantee, privilege_type;
*/

-- ------------------------------------------------------------
-- 15B. ANONYMOUS RPC ABUSE BOUNDARY (APPLICATION / CLOUDFLARE FOLLOW-UP)
-- ------------------------------------------------------------
-- public.spacego_submit_enquiry() and public.spacego_log_demand() are
-- intentionally executable by anon. Both are SECURITY DEFINER inserts that
-- bypass RLS, so PostgreSQL row security cannot rate-limit them. RLS protects
-- rows, not request volume. This migration does not add a fake captcha flag,
-- a client-controlled bypass, or an IP/device log.
--
-- Required follow-up before exposing these forms publicly:
--   1. Route anonymous writes through a server-side boundary (Next.js route
--      handler, Supabase Edge Function, or equivalent). Validate a Cloudflare
--      Turnstile token there with the secret key against Cloudflare's
--      siteverify API. Never accept a client boolean such as "captcha_ok",
--      "verified", or a token that is not checked server-side.
--   2. Configure Cloudflare WAF rate-limiting rules and application quotas
--      (per IP, per session, per endpoint, and globally) before the request
--      reaches PostgREST.
--   3. Keep service-role/bypass keys server-side only. Do not put a shared
--      secret in client code or add a secret RPC argument, since both are
--      visible to callers.
--   4. Once all public writes go through that server boundary, consider
--      revoking anon EXECUTE on these RPCs. Until then, direct PostgREST calls
--      remain possible and must be covered by edge rate limits.
--   5. Add product-level abuse controls (duplicate suppression, moderation
--      queues, and alerting). Those are application concerns, not RLS.

-- ------------------------------------------------------------
-- 16. ROLLBACK PROCEDURE
-- ------------------------------------------------------------
-- This migration does not change application rows, so rollback is an access
-- rollback only. Dropping spacego_owner_activations removes the owner-safe
-- read path; owners would then have no approved way to read activation records
-- because the base table is admin-only. Do not roll back in production without
-- an approved replacement owner read path.
--
-- Existing notification rows are intentionally not rewritten. Notifications
-- created before this migration may contain historical admin notes; run
-- preflight query 14.9 to audit them and redact only under an approved process.
-- New notifications exclude admin notes.
--
-- To restore the Phase 1A demo behaviour:
--
--   BEGIN;
--   DROP VIEW IF EXISTS public.spacego_owner_activations;
--   DROP VIEW IF EXISTS public.spacego_public_spaces;
--   DROP TRIGGER IF EXISTS spacego_enforce_payload_id ON public.spacego_spaces;
--   DROP TRIGGER IF EXISTS spacego_guard_space_write ON public.spacego_spaces;
--   DROP TRIGGER IF EXISTS spacego_enforce_payload_id ON public.spacego_bookings;
--   DROP TRIGGER IF EXISTS spacego_enforce_payload_id ON public.spacego_activations;
--   DROP TRIGGER IF EXISTS spacego_enforce_payload_id ON public.spacego_demand_searches;
--   DROP TRIGGER IF EXISTS spacego_enforce_payload_id ON public.spacego_enquiries;
--   DROP TRIGGER IF EXISTS spacego_enforce_payload_id ON public.spacego_notifications;
--   DROP TRIGGER IF EXISTS spacego_guard_favourite ON public.spacego_favourites;
--   DROP FUNCTION IF EXISTS public.spacego_create_booking(text,timestamptz,timestamptz,text,integer,integer,text);
--   DROP FUNCTION IF EXISTS public.spacego_update_booking_status(text,text,text);
--   DROP FUNCTION IF EXISTS public.spacego_submit_activation(jsonb);
--   DROP FUNCTION IF EXISTS public.spacego_update_activation_status(text,text,text,jsonb);
--   DROP FUNCTION IF EXISTS public.spacego_submit_enquiry(text,text,text,text,text,integer,date,text,text);
--   DROP FUNCTION IF EXISTS public.spacego_update_enquiry_status(text,text);
--   DROP FUNCTION IF EXISTS public.spacego_log_demand(text,text,integer,integer);
--   DROP FUNCTION IF EXISTS public.spacego_demand_analytics(integer);
--   DROP FUNCTION IF EXISTS public.spacego_mark_notification_read(text,boolean);
--   DROP FUNCTION IF EXISTS public.spacego_create_notification(text,text,text,text,text);
--   DROP FUNCTION IF EXISTS public.spacego_guard_space_write();
--   DROP FUNCTION IF EXISTS public.spacego_guard_favourite();
--   DROP FUNCTION IF EXISTS public.spacego_enforce_payload_id();
--   DROP FUNCTION IF EXISTS public.spacego_try_uuid(text);
--   DROP FUNCTION IF EXISTS public.spacego_try_numeric(text);
--   DROP FUNCTION IF EXISTS public.spacego_try_integer(text);
--   DROP FUNCTION IF EXISTS public.spacego_try_timestamptz(text);
--   DO $rb$
--   DECLARE
--     r record;
--   BEGIN
--     FOR r IN
--       SELECT schemaname, tablename, policyname
--       FROM pg_catalog.pg_policies
--       WHERE schemaname = 'public'
--         AND tablename IN (
--           'spacego_spaces','spacego_bookings','spacego_activations',
--           'spacego_demand_searches','spacego_enquiries',
--           'spacego_notifications','spacego_favourites'
--         )
--     LOOP
--       EXECUTE format(
--         'DROP POLICY IF EXISTS %I ON %I.%I',
--         r.policyname, r.schemaname, r.tablename
--       );
--     END LOOP;
--   END;
--   $rb$;
--   DROP INDEX IF EXISTS public.idx_spacego_spaces_owner;
--   DROP INDEX IF EXISTS public.idx_spacego_spaces_status;
--   DROP INDEX IF EXISTS public.idx_spacego_bookings_space;
--   DROP INDEX IF EXISTS public.idx_spacego_bookings_user;
--   DROP INDEX IF EXISTS public.idx_spacego_bookings_owner;
--   DROP INDEX IF EXISTS public.idx_spacego_bookings_status;
--   DROP INDEX IF EXISTS public.idx_spacego_activations_owner;
--   DROP INDEX IF EXISTS public.idx_spacego_activations_status;
--   DROP INDEX IF EXISTS public.idx_spacego_demand_category;
--   DROP INDEX IF EXISTS public.idx_spacego_enquiries_user;
--   DROP INDEX IF EXISTS public.idx_spacego_enquiries_status;
--   DROP INDEX IF EXISTS public.idx_spacego_notifications_user_read;
--   -- Remove the policies created by this migration, then restore the demo
--   -- policy block and grants from 20261119_spacego_app_state.sql if required.
--   COMMIT;
--
-- WARNING: restoring the demo policy block reopens all seven tables to anon
-- and authenticated read/write, including spacego_activations.admin_notes. Do
-- that only in a non-production environment.

COMMIT;

-- End of 20261121_spacego_rls_hardening.sql
