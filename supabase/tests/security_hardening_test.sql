-- SpaceGo security hardening checks (20261207_spacego_security_hardening.sql).
-- Safe to run on STAGING or PRODUCTION: catalog checks plus one fixture user,
-- all inside one transaction that is rolled back, so no rows are left behind.
--   psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/security_hardening_test.sql
-- Every check raises an exception on failure; success prints
-- "security hardening: all checks passed".

BEGIN;

DO $catalog$
DECLARE
  v_table text;
  v_role text;
  v_bad text;
BEGIN
  -- 1. The unused first-generation tables are closed to the API roles.
  FOREACH v_table IN ARRAY ARRAY[
    'spaces', 'space_images', 'bookings', 'blocked_slots', 'favourites',
    'notifications', 'property_activation_requests', 'workspace_enquiries',
    'demand_searches'
  ]
  LOOP
    CONTINUE WHEN to_regclass(format('public.%I', v_table)) IS NULL;
    FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF has_table_privilege(v_role, format('public.%I', v_table),
                             'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER') THEN
        RAISE EXCEPTION '% still has access to public.%', v_role, v_table;
      END IF;
    END LOOP;
  END LOOP;

  -- 2. Every table in public has row-level security on.
  SELECT string_agg(c.relname, ', ') INTO v_bad
  FROM pg_class c
  WHERE c.relnamespace = 'public'::regnamespace
    AND c.relkind IN ('r', 'p')
    AND NOT c.relrowsecurity
    -- Tables that belong to an extension (PostGIS's spatial_ref_sys, say) are not ours.
    AND NOT EXISTS (
      SELECT 1 FROM pg_depend d
      WHERE d.classid = 'pg_class'::regclass AND d.objid = c.oid AND d.deptype = 'e'
    );
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Tables without row-level security: %', v_bad;
  END IF;

  -- 3. The role-guard function has a fixed search_path (this migration's job),
  --    and any other SECURITY DEFINER function without one is reported.
  IF to_regprocedure('public.check_profile_role_update()') IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM pg_proc p, unnest(COALESCE(p.proconfig, '{}'::text[])) AS c(setting)
    WHERE p.oid = to_regprocedure('public.check_profile_role_update()')
      AND c.setting LIKE 'search_path=%'
  ) THEN
    RAISE EXCEPTION 'public.check_profile_role_update() still has no fixed search_path; apply 20261207 first';
  END IF;
  SELECT string_agg(p.oid::regprocedure::text, ', ') INTO v_bad
  FROM pg_proc p
  WHERE p.pronamespace = 'public'::regnamespace
    AND p.prosecdef
    AND NOT EXISTS (
      SELECT 1 FROM unnest(COALESCE(p.proconfig, '{}'::text[])) AS c(setting)
      WHERE c.setting LIKE 'search_path=%'
    );
  IF v_bad IS NOT NULL THEN
    RAISE WARNING 'SECURITY DEFINER functions without a fixed search_path (not from these migrations; review them): %', v_bad;
  END IF;

  -- 4. What the app relies on is still granted.
  IF NOT has_table_privilege('anon', 'public.spacego_public_spaces', 'SELECT') THEN
    RAISE EXCEPTION 'anon can no longer read public.spacego_public_spaces';
  END IF;
  IF NOT has_table_privilege('authenticated', 'public.spacego_favourites', 'INSERT, DELETE') THEN
    RAISE EXCEPTION 'authenticated can no longer save favourites';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname = 'spacego_search_spaces'
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  ) THEN
    RAISE EXCEPTION 'anon can no longer search spaces';
  END IF;
END
$catalog$;

-- 5. Where the role-guard trigger exists, it still runs after its search_path
--    change: a member can rename themselves, and cannot make themselves admin.
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES ('00000000-0000-4000-8000-00000000f501', 'security-hardening-fixture@example.invalid',
        '{"role": "seeker", "full_name": "Security Fixture"}'::jsonb);
SELECT set_config('request.jwt.claims',
                  '{"sub": "00000000-0000-4000-8000-00000000f501", "role": "authenticated"}', true);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000f501', true);

DO $guard$
DECLARE
  v_blocked boolean := false;
BEGIN
  UPDATE public.profiles SET full_name = 'Security Fixture Renamed'
  WHERE id = '00000000-0000-4000-8000-00000000f501';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The fixture user has no profile; is the on_auth_user_created trigger missing?';
  END IF;

  IF to_regprocedure('public.check_profile_role_update()') IS NULL THEN
    RETURN;  -- this project has no role-guard trigger
  END IF;
  BEGIN
    UPDATE public.profiles SET role = 'admin'
    WHERE id = '00000000-0000-4000-8000-00000000f501';
  EXCEPTION
    -- The guard's own refusal. Any other error (an unresolved name, say)
    -- propagates and fails this test.
    WHEN raise_exception OR insufficient_privilege THEN
      v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'The role guard let a member make themselves admin';
  END IF;
END
$guard$;

DO $done$ BEGIN RAISE NOTICE 'security hardening: all checks passed'; END $done$;

ROLLBACK;
