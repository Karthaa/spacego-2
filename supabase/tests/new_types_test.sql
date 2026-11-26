-- SpaceGo: parking and auditorium types, and the is_demo flag.
-- Safe to run on STAGING: one transaction, rolled back at the end.
--   psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/new_types_test.sql
-- Success prints "new types: all checks passed".

BEGIN;

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-4000-8000-0000000f7001', 'nt-admin@example.invalid', '{"role":"owner","full_name":"New Types Admin"}'),
  ('00000000-0000-4000-8000-0000000f7002', 'nt-host@example.invalid', '{"role":"owner","full_name":"New Types Host"}'),
  ('00000000-0000-4000-8000-0000000f7003', 'nt-guest@example.invalid', '{"role":"seeker","full_name":"New Types Guest"}');
-- Some projects (staging, production) have a trigger that only lets
-- service_role or an admin grant the admin role. Act as service_role for
-- this fixture only; the setting is local to this transaction.
DO $$ BEGIN PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true); END $$;
UPDATE public.profiles SET role = 'admin' WHERE id = '00000000-0000-4000-8000-0000000f7001';
DO $$ BEGIN PERFORM set_config('request.jwt.claims', '', true); END $$;

DO $$ BEGIN PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000f7001', true); END $$;
INSERT INTO public.spacego_spaces (id, data) VALUES
  ('zz-nt-parking', jsonb_build_object(
    'id', 'zz-nt-parking', 'owner_id', '00000000-0000-4000-8000-0000000f7002',
    'title', 'New types parking', 'slug', 'zz-nt-parking', 'category', 'parking', 'status', 'published',
    'is_demo', true, 'instant_book', true,
    'capacity', 120, 'square_feet', 30000, 'pricing', jsonb_build_object('hourly', 40, 'daily', 200, 'currency', 'INR'),
    'location', jsonb_build_object('city', 'Kochi', 'address', '1 Parking Road', 'country', 'India',
      'coordinates', jsonb_build_object('lat', 9.9685, 'lng', 76.3219)))),
  ('zz-nt-hall', jsonb_build_object(
    'id', 'zz-nt-hall', 'owner_id', '00000000-0000-4000-8000-0000000f7002',
    'title', 'New types hall', 'slug', 'zz-nt-hall', 'category', 'auditorium', 'status', 'published',
    'capacity', 600, 'square_feet', 9000, 'pricing', jsonb_build_object('hourly', 5000, 'daily', 40000, 'currency', 'INR'),
    'location', jsonb_build_object('city', 'Kochi', 'address', '2 Hall Road', 'country', 'India',
      'coordinates', jsonb_build_object('lat', 9.9636, 'lng', 76.2832))));

CREATE FUNCTION pg_temp.act_as(p_uid text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claim.sub', p_uid, true);
$$;

DO $admin_checks$
DECLARE
  v_failed boolean := false;
BEGIN
  -- An unknown type is still refused.
  BEGIN
    INSERT INTO public.spacego_spaces (id, data) VALUES ('zz-nt-bad', jsonb_build_object(
      'id', 'zz-nt-bad', 'owner_id', '00000000-0000-4000-8000-0000000f7002',
      'title', 'Bad type', 'slug', 'zz-nt-bad', 'category', 'garage', 'status', 'published',
      'capacity', 1, 'square_feet', 10, 'pricing', jsonb_build_object('hourly', 1, 'currency', 'INR'),
      'location', jsonb_build_object('city', 'Kochi', 'address', '3 Bad Road', 'country', 'India',
        'coordinates', jsonb_build_object('lat', 9.97, 'lng', 76.29))));
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'an unknown category should be refused';
  END IF;
END
$admin_checks$;

-- An owner (not an admin) can create a parking listing of their own.
SET LOCAL ROLE authenticated;
DO $$ BEGIN PERFORM pg_temp.act_as('00000000-0000-4000-8000-0000000f7002'); END $$;
INSERT INTO public.spacego_spaces (id, data) VALUES ('zz-nt-owner-parking', jsonb_build_object(
  'id', 'zz-nt-owner-parking', 'owner_id', '00000000-0000-4000-8000-0000000f7002',
  'title', 'Owner parking', 'slug', 'zz-nt-owner-parking', 'category', 'parking', 'status', 'draft',
  'capacity', 10, 'square_feet', 2000, 'pricing', jsonb_build_object('daily', 100, 'currency', 'INR'),
  'location', jsonb_build_object('city', 'Kochi', 'address', '4 Owner Road', 'country', 'India',
    'coordinates', jsonb_build_object('lat', 9.98, 'lng', 76.30))));
RESET ROLE;

-- Public read model and search, as the anonymous web role.
SET LOCAL ROLE anon;
DO $anon_checks$
DECLARE
  v_row record;
  v_count integer;
BEGIN
  SELECT data ->> 'category' AS category, data -> 'is_demo' AS is_demo
    INTO v_row FROM public.spacego_public_spaces WHERE id = 'zz-nt-parking';
  IF v_row.category IS DISTINCT FROM 'parking' OR v_row.is_demo IS DISTINCT FROM 'true'::jsonb THEN
    RAISE EXCEPTION 'parking listing should be public with is_demo true, got % %', v_row.category, v_row.is_demo;
  END IF;

  SELECT data ->> 'category' AS category, data -> 'is_demo' AS is_demo
    INTO v_row FROM public.spacego_public_spaces WHERE id = 'zz-nt-hall';
  IF v_row.category IS DISTINCT FROM 'auditorium' OR v_row.is_demo IS DISTINCT FROM 'false'::jsonb THEN
    RAISE EXCEPTION 'auditorium listing should be public with is_demo false, got % %', v_row.category, v_row.is_demo;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.spacego_search_spaces(9.9685, 76.3219, 2000, ARRAY['parking'])
  WHERE id = 'zz-nt-parking';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'search by the parking type should find the parking listing';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.spacego_search_spaces(9.9685, 76.3219, 2000, ARRAY['auditorium'])
  WHERE id = 'zz-nt-parking';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'search by the auditorium type should not return the parking listing';
  END IF;
END
$anon_checks$;
RESET ROLE;

-- A guest can book the new types, and demand logging accepts them.
SET LOCAL ROLE authenticated;
DO $guest_checks$
DECLARE
  t0 timestamptz := date_trunc('hour', now()) + interval '30 days';
  b jsonb;
BEGIN
  PERFORM pg_temp.act_as('00000000-0000-4000-8000-0000000f7003');
  b := public.spacego_create_booking('zz-nt-parking', t0, t0 + interval '3 hours', 'hourly', 3, 1);
  IF b IS NULL THEN
    RAISE EXCEPTION 'booking the parking listing returned nothing';
  END IF;
  IF b::text NOT LIKE '%parking%' THEN
    RAISE EXCEPTION 'booking should record the parking category: %', b;
  END IF;

  b := public.spacego_create_booking('zz-nt-hall', t0, t0 + interval '1 day', 'daily', 1, 200);
  IF b IS NULL THEN
    RAISE EXCEPTION 'booking the auditorium returned nothing';
  END IF;

  PERFORM public.spacego_log_demand('Kochi', 'auditorium', 300, 1);
  PERFORM public.spacego_log_demand('Kochi', 'parking', 2, 1);
  PERFORM public.spacego_submit_enquiry('New Types Guest', 'nt-guest@example.invalid', '', 'Kochi',
    'parking', 4, (now() + interval '7 days')::date, '', 'Test enquiry');
END
$guest_checks$;
RESET ROLE;

DO $$ BEGIN RAISE NOTICE 'new types: all checks passed'; END $$;

ROLLBACK;
