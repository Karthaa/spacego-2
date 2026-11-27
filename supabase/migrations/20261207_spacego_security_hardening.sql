-- SpaceGo: close API access to the unused first-generation tables, and give the
-- role-guard trigger function a fixed search_path where it exists.
--
-- Forward-only. Run as ONE transaction in the Supabase SQL editor, staging
-- first, then production. Safe to re-run. It changes no rows and no table the
-- app uses. Check it afterwards with supabase/tests/security_hardening_test.sql.
--
-- 1. The nine tables from 20261108_init.sql (spaces, space_images, bookings,
--    blocked_slots, favourites, notifications, property_activation_requests,
--    workspace_enquiries, demand_searches) are unused: the app reads and
--    writes the spacego_* tables. Supabase still grants the anon and
--    authenticated roles access to them, and three have INSERT policies
--    WITH CHECK (true), so anyone holding the public key could add rows
--    through the REST API. This revokes every privilege that PUBLIC, anon
--    and authenticated hold on them. Their rows, their policies and the
--    service role's access stay. To undo it for one table (RLS still applies):
--      GRANT ALL ON TABLE public.<table> TO anon, authenticated;
--
-- 2. public.check_profile_role_update() runs from the trg_protect_profile_role
--    trigger on profiles. It was created on staging and production outside
--    these migrations and is SECURITY DEFINER. If it has no fixed search_path,
--    it gets "public, extensions, pg_temp": the schemas it resolves names in
--    today, with temporary objects searched last so they can't shadow them.
--    Projects without the function, or where it already has a search_path,
--    are left alone.

BEGIN;

DO $legacy$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'spaces', 'space_images', 'bookings', 'blocked_slots', 'favourites',
    'notifications', 'property_activation_requests', 'workspace_enquiries',
    'demand_searches'
  ]
  LOOP
    IF to_regclass(format('public.%I', v_table)) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', v_table);
    END IF;
  END LOOP;
END
$legacy$;

DO $guard$
BEGIN
  IF to_regprocedure('public.check_profile_role_update()') IS NULL THEN
    RETURN;  -- not on this project
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_proc p, unnest(COALESCE(p.proconfig, '{}'::text[])) AS c(setting)
    WHERE p.oid = to_regprocedure('public.check_profile_role_update()')
      AND c.setting LIKE 'search_path=%'
  ) THEN
    RETURN;  -- already has one
  END IF;
  ALTER FUNCTION public.check_profile_role_update() SET search_path = public, extensions, pg_temp;
END
$guard$;

COMMIT;
