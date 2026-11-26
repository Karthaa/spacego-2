-- ============================================================
-- SPACEGO AUTH PHASE 1 — PROFILE HARDENING (ADDITIVE)
-- ============================================================
-- The existing public.profiles table from 20261108_init.sql already has the
-- required columns:
--   id, email, full_name, role, avatar_url, phone, company_name,
--   created_at, updated_at
--
-- Do NOT re-run 20261108_init.sql. This migration only hardens the existing
-- table, adds the signup trigger, and replaces the unsafe policies. It is
-- intentionally idempotent so it can be applied once per project from the
-- Supabase SQL editor.
--
-- Apply as the table owner (the SQL editor's default `postgres` role). The
-- SECURITY DEFINER helper relies on the owner bypassing RLS to avoid recursive
-- profile policies.
--
-- This file is NOT executed automatically by the application.

-- 1. Safe admin helper -------------------------------------------------------
-- Replaces the original function, which had no fixed search_path.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND role = 'admin'
  );
$$;

-- Keep EXECUTE available to the roles used by the legacy spaces policies.
-- The function only ever returns true for an authenticated admin profile.
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

-- 2. Create a profile for every new auth user --------------------------------
-- Public registration may only create seeker/owner profiles. Any other value,
-- including a forged "admin" value in user metadata, is downgraded to seeker.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  requested_role text;
  -- %TYPE follows the column, so this works whether profiles.role is TEXT
  -- (20261108_init.sql) or a user_role enum (older projects such as staging).
  -- PL/pgSQL assignment converts the validated text value to that type.
  profile_role public.profiles.role%TYPE;
  display_name text;
BEGIN
  requested_role := COALESCE(NEW.raw_user_meta_data ->> 'role', 'seeker');
  IF requested_role NOT IN ('seeker', 'owner') THEN
    requested_role := 'seeker';
  END IF;
  profile_role := requested_role;

  display_name := NULLIF(btrim(COALESCE(NEW.raw_user_meta_data ->> 'full_name', '')), '');
  IF display_name IS NULL THEN
    display_name := split_part(COALESCE(NEW.email, 'SpaceGo user'), '@', 1);
  END IF;

  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    phone,
    company_name
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    display_name,
    profile_role,
    NULLIF(btrim(COALESCE(NEW.raw_user_meta_data ->> 'phone', '')), ''),
    NULLIF(btrim(COALESCE(NEW.raw_user_meta_data ->> 'company_name', '')), '')
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Trigger functions are only invoked by Postgres, never by client roles.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;

-- 3. Backfill profiles for auth users that predate the trigger --------------
-- Idempotent: only inserts rows that are missing. Existing profiles, including
-- their roles, are never modified. Written as a loop with a %TYPE variable so
-- it works whether profiles.role is TEXT or an enum (a plain INSERT ... SELECT
-- of a text expression into an enum column is rejected by Postgres).
DO $backfill$
DECLARE
  u record;
  profile_role public.profiles.role%TYPE;
BEGIN
  FOR u IN
    SELECT au.id, au.email, au.raw_user_meta_data
    FROM auth.users au
    LEFT JOIN public.profiles p ON p.id = au.id
    WHERE p.id IS NULL
  LOOP
    profile_role := CASE
      WHEN u.raw_user_meta_data ->> 'role' IN ('seeker', 'owner')
        THEN u.raw_user_meta_data ->> 'role'
      ELSE 'seeker'
    END;

    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
      u.id,
      COALESCE(u.email, ''),
      COALESCE(
        NULLIF(btrim(COALESCE(u.raw_user_meta_data ->> 'full_name', '')), ''),
        split_part(COALESCE(u.email, 'SpaceGo user'), '@', 1)
      ),
      profile_role
    )
    ON CONFLICT (id) DO NOTHING;
  END LOOP;
END
$backfill$;

-- 4. Keep updated_at accurate ----------------------------------------------
CREATE OR REPLACE FUNCTION public.set_profiles_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_profiles_updated_at();

REVOKE ALL ON FUNCTION public.set_profiles_updated_at() FROM PUBLIC;

-- 5. Replace the unsafe profile policies -----------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Ensure the allowed roles are constrained even if an older project applied a
-- variant of the base schema. The base 20261108_init.sql already has an
-- equivalent check; this only adds a named constraint when it is missing.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_role_allowed_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_role_allowed_check
      CHECK (role IN ('seeker', 'owner', 'admin'));
  END IF;
END $$;

DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins full profile access" ON public.profiles;
-- Policy names used by older project templates (e.g. staging). The first one
-- let every signed-in user read every profile, including emails.
DROP POLICY IF EXISTS "Public profiles are readable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins have full access to profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

-- Users can read their own profile; admins can read every profile. The
-- helper is SECURITY DEFINER, so this does not recurse through this policy.
CREATE POLICY "profiles_select_own_or_admin"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = (SELECT auth.uid()) OR public.is_admin());

-- Users can update only their own row. Column-level grants below decide which
-- fields are actually writable, so role/email/id changes are rejected.
CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

-- No INSERT or DELETE policy for client roles. Rows are created by the
-- SECURITY DEFINER trigger; deletion is a service-role operation.

-- 6. Column-level privileges ------------------------------------------------
-- Supabase grants table-wide privileges by default. Remove them and grant only
-- the personal fields the profile page is allowed to change.
REVOKE ALL ON TABLE public.profiles FROM anon;
REVOKE ALL ON TABLE public.profiles FROM authenticated;

GRANT SELECT ON TABLE public.profiles TO authenticated;
GRANT UPDATE (full_name, phone, company_name, avatar_url)
  ON TABLE public.profiles
  TO authenticated;

-- Admins are identified by public.profiles.role, never by user_metadata.
-- To bootstrap the first administrator, use the SQL editor or service role:
--
--   UPDATE public.profiles SET role = 'admin' WHERE email = 'ops@example.com';
--
-- Normal users cannot perform that update: `role` is not in the column grant.
