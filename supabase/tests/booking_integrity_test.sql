-- SpaceGo booking integrity: duplicate requests and status history.
-- Safe to run on STAGING: one transaction, rolled back at the end.
--   psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/booking_integrity_test.sql
-- Success prints "booking integrity: all checks passed".

BEGIN;

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-4000-8000-0000000e0001', 'bi-guest@example.invalid', '{"role":"seeker","full_name":"Integrity Guest"}'),
  ('00000000-0000-4000-8000-0000000e0002', 'bi-other@example.invalid', '{"role":"seeker","full_name":"Other Guest"}'),
  ('00000000-0000-4000-8000-0000000e0003', 'bi-host@example.invalid', '{"role":"owner","full_name":"Integrity Host"}'),
  ('00000000-0000-4000-8000-0000000e0004', 'bi-admin@example.invalid', '{"role":"owner","full_name":"Integrity Admin"}');
-- Some projects (staging, production) have a trigger that only lets
-- service_role or an admin grant the admin role. Act as service_role for
-- this fixture only; the setting is local to this transaction.
DO $$ BEGIN PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true); END $$;
UPDATE public.profiles SET role = 'admin' WHERE id = '00000000-0000-4000-8000-0000000e0004';
DO $$ BEGIN PERFORM set_config('request.jwt.claims', '', true); END $$;

SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000e0004', true);
INSERT INTO public.spacego_spaces (id, data) VALUES ('zz-bi-space', jsonb_build_object(
  'id', 'zz-bi-space', 'owner_id', '00000000-0000-4000-8000-0000000e0003',
  'title', 'Integrity desk', 'slug', 'zz-bi-space', 'category', 'coworking', 'status', 'published',
  'capacity', 10, 'square_feet', 800, 'pricing', jsonb_build_object('hourly', 100, 'currency', 'INR'),
  'location', jsonb_build_object('city', 'Kochi', 'address', '1 Integrity Road', 'country', 'India',
    'coordinates', jsonb_build_object('lat', 10.01, 'lng', 76.34))));

CREATE FUNCTION pg_temp.act_as(p_uid text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claim.sub', p_uid, true);
$$;

SET LOCAL ROLE authenticated;

DO $checks$
DECLARE
  guest text := '00000000-0000-4000-8000-0000000e0001';
  other text := '00000000-0000-4000-8000-0000000e0002';
  host text := '00000000-0000-4000-8000-0000000e0003';
  t0 timestamptz := date_trunc('hour', now()) + interval '30 days';
  a jsonb;
  c jsonb;
  v_failed boolean;
  v_count integer;
BEGIN
  PERFORM pg_temp.act_as(guest);
  a := public.spacego_create_booking('zz-bi-space', t0, t0 + interval '2 hours', 'hourly', 2, 1);

  -- Same guest, overlapping time: refused.
  v_failed := false;
  BEGIN
    PERFORM public.spacego_create_booking('zz-bi-space', t0 + interval '1 hour', t0 + interval '3 hours', 'hourly', 2, 1);
  EXCEPTION WHEN unique_violation THEN v_failed := true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'duplicate overlapping request was accepted'; END IF;

  -- Same guest, later time: fine.
  c := public.spacego_create_booking('zz-bi-space', t0 + interval '3 hours', t0 + interval '4 hours', 'hourly', 1, 1);

  -- Another guest, overlapping pending request: fine.
  PERFORM pg_temp.act_as(other);
  PERFORM public.spacego_create_booking('zz-bi-space', t0, t0 + interval '2 hours', 'hourly', 2, 1);

  -- Host confirms the first request; guest cancels the second.
  PERFORM pg_temp.act_as(host);
  PERFORM public.spacego_update_booking_status(a ->> 'id', 'approved');
  PERFORM pg_temp.act_as(guest);
  PERFORM public.spacego_update_booking_status(c ->> 'id', 'cancelled');

  -- After cancelling, the same slot can be requested again.
  PERFORM public.spacego_create_booking('zz-bi-space', t0 + interval '3 hours', t0 + interval '4 hours', 'hourly', 1, 1);

  -- History: the guest sees theirs, in order.
  SELECT count(*) INTO v_count FROM public.spacego_booking_events
  WHERE booking_id = a ->> 'id'
    AND ((from_status IS NULL AND to_status = 'pending') OR (from_status = 'pending' AND to_status = 'approved'));
  IF v_count <> 2 THEN RAISE EXCEPTION 'history for the confirmed booking is wrong (%)', v_count; END IF;
  SELECT count(*) INTO v_count FROM public.spacego_booking_events
  WHERE booking_id = c ->> 'id' AND from_status = 'pending' AND to_status = 'cancelled';
  IF v_count <> 1 THEN RAISE EXCEPTION 'cancellation not recorded'; END IF;

  -- The host sees it; another guest doesn't.
  PERFORM pg_temp.act_as(host);
  SELECT count(*) INTO v_count FROM public.spacego_booking_events WHERE booking_id = a ->> 'id';
  IF v_count <> 2 THEN RAISE EXCEPTION 'host cannot read the booking history'; END IF;
  PERFORM pg_temp.act_as(other);
  SELECT count(*) INTO v_count FROM public.spacego_booking_events WHERE booking_id = a ->> 'id';
  IF v_count <> 0 THEN RAISE EXCEPTION 'another guest can read the booking history'; END IF;

  -- Nobody writes the history directly.
  v_failed := false;
  BEGIN
    INSERT INTO public.spacego_booking_events (booking_id, to_status) VALUES (a ->> 'id', 'approved');
  EXCEPTION WHEN insufficient_privilege THEN v_failed := true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'direct history insert allowed'; END IF;

  RAISE NOTICE 'booking integrity: all checks passed';
END
$checks$;

ROLLBACK;
