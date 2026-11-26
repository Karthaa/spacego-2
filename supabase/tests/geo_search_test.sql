-- SpaceGo location search checks.
-- Safe to run on STAGING: everything happens inside one transaction that is
-- rolled back at the end, so no rows are left behind.
--   psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/geo_search_test.sql
-- Every check raises an exception on failure; success prints "geo search: all checks passed".

BEGIN;

-- Fixture owner (admin, so fixture listings can carry a verification level).
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES ('00000000-0000-4000-8000-00000000f001', 'geo-search-fixture@example.invalid',
        '{"role": "owner", "full_name": "Geo Search Fixture"}'::jsonb);
-- Some projects (staging, production) have a trigger that only lets
-- service_role or an admin grant the admin role. Act as service_role for
-- this fixture only; the setting is local to this transaction.
DO $$ BEGIN PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true); END $$;
UPDATE public.profiles SET role = 'admin' WHERE id = '00000000-0000-4000-8000-00000000f001';
DO $$ BEGIN PERFORM set_config('request.jwt.claims', '', true); END $$;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000f001', true);

-- Fixture rows (ids prefixed so they cannot collide with real data). They sit in open
-- sea about 330 km south of Kochi, so real listings never crowd them out of a page of
-- results. Their spacing is as in central Kochi: one about 5 km from the first, one
-- about 175 km away.
INSERT INTO public.spacego_spaces (id, data) VALUES
  ('zz-geo-test-pub-1', jsonb_build_object('square_feet', 500,
    'owner_id', '00000000-0000-4000-8000-00000000f001', 'id', 'zz-geo-test-pub-1', 'title', 'Geo test published A', 'slug', 'geo-test-a',
    'category', 'coworking', 'status', 'published', 'verification_level', 'checked',
    'passport', jsonb_build_object('identity_verified', true, 'inspected_at', '2026-11-20'),
    'capacity', 20, 'instant_book', true, 'amenities', jsonb_build_array('Wi-Fi', 'Parking'),
    'pricing', jsonb_build_object('hourly', 150, 'daily', 600, 'currency', 'INR'),
    'location', jsonb_build_object('city', 'Kochi', 'address', '1 Test Road', 'country', 'India',
      'coordinates', jsonb_build_object('lat', 6.98123, 'lng', 76.29987)))),
  ('zz-geo-test-pub-2', jsonb_build_object('square_feet', 500,
    'owner_id', '00000000-0000-4000-8000-00000000f001', 'id', 'zz-geo-test-pub-2', 'title', 'Geo test published B', 'slug', 'geo-test-b',
    'category', 'meeting_room', 'status', 'published', 'verification_level', 'listed',
    'capacity', 6, 'amenities', jsonb_build_array('Wi-Fi'),
    'pricing', jsonb_build_object('hourly', 400, 'currency', 'INR'),
    'location', jsonb_build_object('city', 'Kochi', 'address', '2 Test Road', 'country', 'India',
      'coordinates', jsonb_build_object('lat', 7.0261, 'lng', 76.3125)))),
  ('zz-geo-test-draft', jsonb_build_object('square_feet', 500,
    'owner_id', '00000000-0000-4000-8000-00000000f001', 'id', 'zz-geo-test-draft', 'title', 'Geo test draft', 'slug', 'geo-test-draft',
    'category', 'coworking', 'status', 'draft', 'capacity', 4,
    'pricing', jsonb_build_object('daily', 100, 'currency', 'INR'),
    'location', jsonb_build_object('city', 'Kochi', 'address', '3 Secret Lane', 'country', 'India',
      'coordinates', jsonb_build_object('lat', 6.9816, 'lng', 76.2999)))),
  ('zz-geo-test-far', jsonb_build_object('square_feet', 500,
    'owner_id', '00000000-0000-4000-8000-00000000f001', 'id', 'zz-geo-test-far', 'title', 'Geo test far away', 'slug', 'geo-test-far',
    'category', 'coworking', 'status', 'published', 'capacity', 4,
    'pricing', jsonb_build_object('daily', 100, 'currency', 'INR'),
    'location', jsonb_build_object('city', 'Thiruvananthapuram', 'address', '4 Far Road', 'country', 'India',
      'coordinates', jsonb_build_object('lat', 5.5241, 'lng', 76.9366)))),
  ('zz-geo-test-badcoords', jsonb_build_object('square_feet', 500,
    'owner_id', '00000000-0000-4000-8000-00000000f001', 'id', 'zz-geo-test-badcoords', 'title', 'Geo test bad coordinates', 'slug', 'geo-test-bad',
    'category', 'coworking', 'status', 'published', 'capacity', 4,
    'pricing', jsonb_build_object('daily', 100, 'currency', 'INR'),
    'location', jsonb_build_object('city', 'Kochi', 'address', '5 Test Road', 'country', 'India', 'coordinates', jsonb_build_object('lat', 'abc', 'lng', 76.3))));

DO $checks$
DECLARE
  v_count integer;
  v_row record;
BEGIN
  -- Approximate point: snapped to the 0.005 degree grid, never the raw value.
  SELECT extensions.st_y(geo_public::extensions.geometry) AS lat,
         extensions.st_x(geo_public::extensions.geometry) AS lng
    INTO v_row FROM public.spacego_spaces WHERE id = 'zz-geo-test-pub-1';
  IF abs(v_row.lat - 6.98) > 1e-9 OR abs(v_row.lng - 76.30) > 1e-9 THEN
    RAISE EXCEPTION 'geo_public not snapped as expected: % %', v_row.lat, v_row.lng;
  END IF;

  IF (SELECT geo_public FROM public.spacego_spaces WHERE id = 'zz-geo-test-badcoords') IS NOT NULL THEN
    RAISE EXCEPTION 'invalid coordinates should give a NULL geo_public';
  END IF;
END
$checks$;

-- Run the rest as the anonymous web role.
SET LOCAL ROLE anon;

DO $anon_checks$
DECLARE
  v_count integer;
  v_ids text[];
  v_row record;
BEGIN
  -- 10 km around the fixtures: both published ones, never the draft or the far one.
  SELECT array_agg(id ORDER BY distance_m) INTO v_ids
  FROM public.spacego_search_spaces(6.9816, 76.2999, 10000)
  WHERE id LIKE 'zz-geo-test-%';
  IF v_ids IS DISTINCT FROM ARRAY['zz-geo-test-pub-1', 'zz-geo-test-pub-2'] THEN
    RAISE EXCEPTION 'unexpected radius results: %', v_ids;
  END IF;

  -- Distances are rounded to 100 m and measured from the approximate point.
  SELECT * INTO v_row FROM public.spacego_search_spaces(6.9816, 76.2999, 10000)
  WHERE id = 'zz-geo-test-pub-1';
  IF v_row.distance_m % 100 <> 0 THEN
    RAISE EXCEPTION 'distance not rounded: %', v_row.distance_m;
  END IF;
  IF v_row.data ? 'owner_id' OR (v_row.data -> 'passport') ? 'notes'
     OR (v_row.data -> 'passport') ? 'inspected_by' OR (v_row.data -> 'location') ? 'coordinates' THEN
    RAISE EXCEPTION 'search leaked a private field: %', v_row.data;
  END IF;
  IF abs(v_row.approx_lat - 6.98) > 1e-9 THEN
    RAISE EXCEPTION 'search returned a non-approximate latitude: %', v_row.approx_lat;
  END IF;

  -- Small radius excludes the second listing (about 5 km away).
  SELECT count(*) INTO v_count FROM public.spacego_search_spaces(6.98, 76.30, 1000)
  WHERE id LIKE 'zz-geo-test-%';
  IF v_count <> 1 THEN RAISE EXCEPTION '1 km radius expected 1 result, got %', v_count; END IF;

  -- Filters.
  SELECT count(*) INTO v_count FROM public.spacego_search_spaces(6.9816, 76.2999, 10000,
    p_categories => ARRAY['meeting_room']) WHERE id LIKE 'zz-geo-test-%';
  IF v_count <> 1 THEN RAISE EXCEPTION 'category filter expected 1, got %', v_count; END IF;

  SELECT count(*) INTO v_count FROM public.spacego_search_spaces(6.9816, 76.2999, 10000,
    p_amenities => ARRAY['Parking']) WHERE id LIKE 'zz-geo-test-%';
  IF v_count <> 1 THEN RAISE EXCEPTION 'amenity filter expected 1, got %', v_count; END IF;

  SELECT count(*) INTO v_count FROM public.spacego_search_spaces(6.9816, 76.2999, 10000,
    p_price_unit => 'daily') WHERE id LIKE 'zz-geo-test-%';
  IF v_count <> 1 THEN RAISE EXCEPTION 'daily price unit expected 1, got %', v_count; END IF;

  SELECT count(*) INTO v_count FROM public.spacego_search_spaces(6.9816, 76.2999, 10000,
    p_price_unit => 'hourly', p_max_price => 200) WHERE id LIKE 'zz-geo-test-%';
  IF v_count <> 1 THEN RAISE EXCEPTION 'hourly max price expected 1, got %', v_count; END IF;

  SELECT count(*) INTO v_count FROM public.spacego_search_spaces(6.9816, 76.2999, 10000,
    p_min_capacity => 10) WHERE id LIKE 'zz-geo-test-%';
  IF v_count <> 1 THEN RAISE EXCEPTION 'capacity filter expected 1, got %', v_count; END IF;

  SELECT count(*) INTO v_count FROM public.spacego_search_spaces(6.9816, 76.2999, 10000,
    p_verified_only => true) WHERE id LIKE 'zz-geo-test-%';
  IF v_count <> 1 THEN RAISE EXCEPTION 'verified filter expected 1, got %', v_count; END IF;

  SELECT count(*) INTO v_count FROM public.spacego_search_spaces(6.9816, 76.2999, 10000,
    p_instant_only => true) WHERE id LIKE 'zz-geo-test-%';
  IF v_count <> 1 THEN RAISE EXCEPTION 'instant filter expected 1, got %', v_count; END IF;

  -- Price sort.
  SELECT array_agg(id) INTO v_ids FROM (
    SELECT id FROM public.spacego_search_spaces(6.9816, 76.2999, 10000, p_price_unit => 'hourly', p_sort => 'price_desc')
    WHERE id LIKE 'zz-geo-test-%') t;
  IF v_ids IS DISTINCT FROM ARRAY['zz-geo-test-pub-2', 'zz-geo-test-pub-1'] THEN
    RAISE EXCEPTION 'price_desc order wrong: %', v_ids;
  END IF;

  -- Pagination and total.
  SELECT count(*) INTO v_count FROM public.spacego_search_spaces(6.9816, 76.2999, 10000, p_limit => 1);
  IF v_count <> 1 THEN RAISE EXCEPTION 'limit not applied'; END IF;

  -- Radius is capped at 50 km: the listing about 175 km away never appears.
  SELECT count(*) INTO v_count FROM public.spacego_search_spaces(6.9816, 76.2999, 5000000)
  WHERE id = 'zz-geo-test-far';
  IF v_count <> 0 THEN RAISE EXCEPTION 'radius cap not applied'; END IF;

  -- Bad input is rejected.
  BEGIN
    PERFORM * FROM public.spacego_search_spaces(123, 76.3, 1000);
    RAISE EXCEPTION 'invalid latitude accepted';
  EXCEPTION WHEN invalid_parameter_value THEN
    NULL;
  END;

  -- Single-listing point: approximate for published, nothing for drafts.
  SELECT * INTO v_row FROM public.spacego_public_space_point('zz-geo-test-pub-1');
  IF v_row.approx_lat IS NULL OR abs(v_row.approx_lat - 6.98) > 1e-9 THEN
    RAISE EXCEPTION 'public point wrong: %', v_row.approx_lat;
  END IF;
  SELECT count(*) INTO v_count FROM public.spacego_public_space_point('zz-geo-test-draft');
  IF v_count <> 0 THEN RAISE EXCEPTION 'draft listing point exposed'; END IF;

  -- anon still cannot read the base table directly.
  BEGIN
    PERFORM 1 FROM public.spacego_spaces LIMIT 1;
    RAISE EXCEPTION 'anon can read spacego_spaces';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END
$anon_checks$;

RESET ROLE;

DO $done$ BEGIN RAISE NOTICE 'geo search: all checks passed'; END $done$;

ROLLBACK;
