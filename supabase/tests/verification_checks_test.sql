-- SpaceGo verification checks: a tier needs recorded, dated checks.
-- Safe to run on STAGING: one transaction, rolled back at the end.
--   psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/verification_checks_test.sql
-- Success prints "verification checks: all checks passed".

BEGIN;

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-4000-8000-0000000c0001', 'checks-owner@example.invalid', '{"role":"owner","full_name":"Checks Owner"}'),
  ('00000000-0000-4000-8000-0000000c0002', 'checks-admin@example.invalid', '{"role":"owner","full_name":"Checks Admin"}');
UPDATE public.profiles SET role = 'admin' WHERE id = '00000000-0000-4000-8000-0000000c0002';

CREATE FUNCTION pg_temp.act_as(p_uid text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claim.sub', p_uid, true);
$$;

SET LOCAL ROLE authenticated;

DO $checks$
DECLARE
  owner_id text := '00000000-0000-4000-8000-0000000c0001';
  admin_id text := '00000000-0000-4000-8000-0000000c0002';
  v_data jsonb;
  v_count integer;
  v_failed boolean;
BEGIN
  -- Owner creates a listing; tries to give it a tier and checks.
  PERFORM pg_temp.act_as(owner_id);
  INSERT INTO public.spacego_spaces (id, data) VALUES ('zz-checks-1', jsonb_build_object(
    'id', 'zz-checks-1', 'owner_id', owner_id, 'title', 'Checks fixture', 'slug', 'zz-checks-1',
    'category', 'coworking', 'status', 'draft', 'capacity', 10, 'square_feet', 800,
    'verification_level', 'pro',
    'passport', jsonb_build_object('identity_verified', true, 'inspected_at', '2026-11-20'),
    'pricing', jsonb_build_object('daily', 500, 'currency', 'INR'),
    'location', jsonb_build_object('city', 'Kochi', 'address', '1 Checks Road', 'country', 'India',
      'coordinates', jsonb_build_object('lat', 10.01, 'lng', 76.34))));
  SELECT data INTO v_data FROM public.spacego_spaces WHERE id = 'zz-checks-1';
  IF v_data ->> 'verification_level' <> 'listed' OR (v_data -> 'passport' ->> 'identity_verified')::boolean THEN
    RAISE EXCEPTION 'owner set their own tier or checks: % %', v_data ->> 'verification_level', v_data -> 'passport';
  END IF;
  UPDATE public.spacego_spaces
  SET data = data || '{"verification_level":"checked","passport":{"fire_safety_inspected":true,"inspected_at":"2026-11-20"}}'
  WHERE id = 'zz-checks-1';
  SELECT data INTO v_data FROM public.spacego_spaces WHERE id = 'zz-checks-1';
  IF v_data ->> 'verification_level' <> 'listed' OR (v_data -> 'passport' ->> 'fire_safety_inspected')::boolean THEN
    RAISE EXCEPTION 'owner update changed the tier or checks';
  END IF;

  -- Admin: a tier without checks is refused.
  PERFORM pg_temp.act_as(admin_id);
  v_failed := false;
  BEGIN
    UPDATE public.spacego_spaces SET data = data || '{"verification_level":"pro"}' WHERE id = 'zz-checks-1';
  EXCEPTION WHEN check_violation THEN v_failed := true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'tier without checks was accepted'; END IF;

  -- Checks without a date are refused.
  v_failed := false;
  BEGIN
    UPDATE public.spacego_spaces
    SET data = jsonb_set(data, '{passport}', (data -> 'passport') || '{"identity_verified":true,"inspected_at":""}')
    WHERE id = 'zz-checks-1';
  EXCEPTION WHEN check_violation THEN v_failed := true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'undated checks were accepted'; END IF;

  -- Dated checks plus a tier are accepted and logged.
  UPDATE public.spacego_spaces
  SET data = jsonb_set(data, '{passport}', (data -> 'passport') ||
    '{"identity_verified":true,"connectivity_tested_mbps":120,"inspected_at":"2026-11-25"}')
    || '{"verification_level":"checked"}'
  WHERE id = 'zz-checks-1';
  SELECT data INTO v_data FROM public.spacego_spaces WHERE id = 'zz-checks-1';
  IF v_data ->> 'verification_level' <> 'checked' THEN RAISE EXCEPTION 'admin tier not saved'; END IF;
  SELECT count(*) INTO v_count FROM public.spacego_listing_review_events
  WHERE space_id = 'zz-checks-1' AND action = 'checks_recorded' AND to_state = 'checked'
    AND reason = 'connectivity_tested_mbps, identity_verified';
  IF v_count <> 1 THEN RAISE EXCEPTION 'checks not logged (%)', v_count; END IF;

  -- Clearing every check while keeping the tier is refused.
  v_failed := false;
  BEGIN
    UPDATE public.spacego_spaces
    SET data = jsonb_set(data, '{passport}', (data -> 'passport') ||
      '{"identity_verified":false,"connectivity_tested_mbps":0}')
    WHERE id = 'zz-checks-1';
  EXCEPTION WHEN check_violation THEN v_failed := true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'tier kept after clearing every check'; END IF;

  -- An owner edit after that keeps the admin's tier and checks.
  PERFORM pg_temp.act_as(owner_id);
  UPDATE public.spacego_spaces SET data = jsonb_set(data, '{pricing,daily}', '550') WHERE id = 'zz-checks-1';
  SELECT data INTO v_data FROM public.spacego_spaces WHERE id = 'zz-checks-1';
  IF v_data ->> 'verification_level' <> 'checked' OR NOT (v_data -> 'passport' ->> 'identity_verified')::boolean THEN
    RAISE EXCEPTION 'owner edit dropped the admin checks';
  END IF;

  -- Unrelated admin edits on a listing that has no checks still work.
  PERFORM pg_temp.act_as(admin_id);
  UPDATE public.spacego_spaces
  SET data = jsonb_set(data, '{passport}', (data -> 'passport') || '{"identity_verified":false,"connectivity_tested_mbps":0}')
    || '{"verification_level":"listed"}'
  WHERE id = 'zz-checks-1';
  UPDATE public.spacego_spaces SET data = data || '{"headline":"Edited by admin"}' WHERE id = 'zz-checks-1';

  RAISE NOTICE 'verification checks: all checks passed';
END
$checks$;

ROLLBACK;
