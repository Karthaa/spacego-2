-- SpaceGo address privacy checks.
-- Safe to run on STAGING: one transaction, rolled back at the end.
--   psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/address_privacy_test.sql
-- Success prints "address privacy: all checks passed".

BEGIN;

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-4000-8000-0000000b0001', 'addr-owner@example.invalid', '{"role":"owner","full_name":"Address Owner"}'),
  ('00000000-0000-4000-8000-0000000b0002', 'addr-guest@example.invalid', '{"role":"seeker","full_name":"Confirmed Guest"}'),
  ('00000000-0000-4000-8000-0000000b0003', 'addr-pending@example.invalid', '{"role":"seeker","full_name":"Pending Guest"}'),
  ('00000000-0000-4000-8000-0000000b0004', 'addr-admin@example.invalid', '{"role":"owner","full_name":"Address Admin"}');
UPDATE public.profiles SET role = 'admin' WHERE id = '00000000-0000-4000-8000-0000000b0004';

-- Fixture listings, written as the admin so they are published and approved.
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000b0004', true);
INSERT INTO public.spacego_spaces (id, data)
SELECT v.id, jsonb_build_object(
  'id', v.id, 'owner_id', '00000000-0000-4000-8000-0000000b0001',
  'title', v.title, 'slug', v.id, 'category', 'coworking', 'status', 'published',
  'capacity', 10, 'square_feet', 800,
  'pricing', jsonb_build_object('daily', 500, 'currency', 'INR'),
  'location', jsonb_build_object('city', 'Kochi', 'address', v.address, 'landmark', v.landmark,
    'postal_code', '682024', 'country', 'India', 'address_visibility', v.visibility,
    'coordinates', jsonb_build_object('lat', 10.0261, 'lng', 76.3125)))
FROM (VALUES
  ('zz-addr-private', 'Private address desk', '12 Hidden Lane', 'Behind the blue gate', 'approximate'),
  ('zz-addr-public', 'Public address desk', '1 Open Street', 'Next to the metro', 'exact'),
  ('zz-addr-unset', 'Legacy desk', '7 Legacy Road', 'Old landmark', NULL)
) AS v(id, title, address, landmark, visibility);

-- Bookings: one approved for the confirmed guest, one pending for the other.
INSERT INTO public.spacego_bookings (id, data) VALUES
  ('zz-addr-b1', jsonb_build_object('id', 'zz-addr-b1', 'space_id', 'zz-addr-private',
    'user_id', '00000000-0000-4000-8000-0000000b0002', 'owner_id', '00000000-0000-4000-8000-0000000b0001',
    'status', 'approved')),
  ('zz-addr-b2', jsonb_build_object('id', 'zz-addr-b2', 'space_id', 'zz-addr-private',
    'user_id', '00000000-0000-4000-8000-0000000b0003', 'owner_id', '00000000-0000-4000-8000-0000000b0001',
    'status', 'pending'));

CREATE FUNCTION pg_temp.act_as(p_uid text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claim.sub', p_uid, true);
$$;

DO $checks$
DECLARE
  v_loc jsonb;
  v_count integer;
  v_text text;
  v_failed boolean;
BEGIN
  -- Anonymous visitors: area only, unless the host chose to show the address.
  SET LOCAL ROLE anon;
  PERFORM pg_temp.act_as('');

  SELECT data -> 'location' INTO v_loc FROM public.spacego_public_spaces WHERE id = 'zz-addr-private';
  IF v_loc IS NULL THEN RAISE EXCEPTION 'fixture listing not public'; END IF;
  IF v_loc ->> 'address' <> '' OR v_loc ->> 'landmark' <> '' THEN
    RAISE EXCEPTION 'approximate listing leaked its address: %', v_loc;
  END IF;
  IF v_loc ->> 'city' <> 'Kochi' OR v_loc ->> 'postal_code' <> '682024'
     OR v_loc ->> 'address_visibility' <> 'approximate' THEN
    RAISE EXCEPTION 'approximate listing lost its area fields: %', v_loc;
  END IF;

  SELECT data -> 'location' INTO v_loc FROM public.spacego_public_spaces WHERE id = 'zz-addr-unset';
  IF v_loc ->> 'address' <> '' OR v_loc ->> 'address_visibility' <> 'approximate' THEN
    RAISE EXCEPTION 'listing without a choice must default to approximate: %', v_loc;
  END IF;

  SELECT data -> 'location' INTO v_loc FROM public.spacego_public_spaces WHERE id = 'zz-addr-public';
  IF v_loc ->> 'address' <> '1 Open Street' OR v_loc ->> 'landmark' <> 'Next to the metro'
     OR v_loc ->> 'address_visibility' <> 'exact' THEN
    RAISE EXCEPTION 'exact listing should show its address: %', v_loc;
  END IF;

  SELECT count(*) INTO v_count FROM public.spacego_public_spaces
  WHERE id LIKE 'zz-addr-%' AND data::text LIKE '%Hidden Lane%';
  IF v_count <> 0 THEN RAISE EXCEPTION 'hidden street name appears in public JSON'; END IF;

  v_failed := false;
  BEGIN
    PERFORM * FROM public.spacego_space_address('zz-addr-private');
  EXCEPTION WHEN insufficient_privilege THEN v_failed := true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'anon could call spacego_space_address'; END IF;
  RESET ROLE;

  SET LOCAL ROLE authenticated;

  -- Confirmed guest gets the address and exact pin.
  PERFORM pg_temp.act_as('00000000-0000-4000-8000-0000000b0002');
  SELECT a.address INTO v_text FROM public.spacego_space_address('zz-addr-private') a;
  IF v_text IS DISTINCT FROM '12 Hidden Lane' THEN
    RAISE EXCEPTION 'confirmed guest should see the address, got %', v_text;
  END IF;
  SELECT count(*) INTO v_count FROM public.spacego_space_address('zz-addr-private') a
  WHERE a.lat = 10.0261 AND a.lng = 76.3125 AND a.landmark = 'Behind the blue gate';
  IF v_count <> 1 THEN RAISE EXCEPTION 'confirmed guest should get the exact pin and landmark'; END IF;
  -- ...but only for the space they booked.
  SELECT count(*) INTO v_count FROM public.spacego_space_address('zz-addr-unset');
  IF v_count <> 0 THEN RAISE EXCEPTION 'guest got the address of a space they did not book'; END IF;

  -- Pending guest gets nothing.
  PERFORM pg_temp.act_as('00000000-0000-4000-8000-0000000b0003');
  SELECT count(*) INTO v_count FROM public.spacego_space_address('zz-addr-private');
  IF v_count <> 0 THEN RAISE EXCEPTION 'pending booking unlocked the address'; END IF;

  -- Owner and admin get it.
  PERFORM pg_temp.act_as('00000000-0000-4000-8000-0000000b0001');
  SELECT count(*) INTO v_count FROM public.spacego_space_address('zz-addr-private');
  IF v_count <> 1 THEN RAISE EXCEPTION 'owner should see their own address'; END IF;
  PERFORM pg_temp.act_as('00000000-0000-4000-8000-0000000b0004');
  SELECT count(*) INTO v_count FROM public.spacego_space_address('zz-addr-unset');
  IF v_count <> 1 THEN RAISE EXCEPTION 'admin should see the address'; END IF;

  -- Unknown ids and oversized input return nothing.
  SELECT count(*) INTO v_count FROM public.spacego_space_address('zz-addr-missing');
  IF v_count <> 0 THEN RAISE EXCEPTION 'unknown space returned a row'; END IF;
  SELECT count(*) INTO v_count FROM public.spacego_space_address(repeat('x', 500));
  IF v_count <> 0 THEN RAISE EXCEPTION 'oversized id returned a row'; END IF;

  -- The pending guest's own booking row carries no street address.
  PERFORM pg_temp.act_as('00000000-0000-4000-8000-0000000b0003');
  SELECT count(*) INTO v_count FROM public.spacego_bookings WHERE data::text LIKE '%Hidden Lane%';
  IF v_count <> 0 THEN RAISE EXCEPTION 'booking rows expose the street address'; END IF;

  -- The search RPC (if installed) never carries a hidden address either.
  IF to_regprocedure('public.spacego_search_spaces(double precision,double precision,integer,text[],numeric,numeric,text,text[],integer,boolean,boolean,text,integer,integer)') IS NOT NULL THEN
    EXECUTE $q$SELECT count(*) FROM public.spacego_search_spaces(10.0261, 76.3125, 5000)
              WHERE data::text LIKE '%Hidden Lane%'$q$ INTO v_count;
    IF v_count <> 0 THEN RAISE EXCEPTION 'search RPC exposes the hidden address'; END IF;
  END IF;
  RESET ROLE;

  RAISE NOTICE 'address privacy: all checks passed';
END
$checks$;

ROLLBACK;
