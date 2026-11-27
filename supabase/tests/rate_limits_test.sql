-- SpaceGo rate limits (20261208_spacego_rate_limits.sql).
-- Safe to run on STAGING (and production): it adds fixture users, a listing,
-- bookings and requests and resets the counters, all inside one transaction
-- that is rolled back, so nothing is left behind. For the second or so it
-- runs, other requests that hit the same counters wait for it.
--   psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rate_limits_test.sql
-- Every check raises an exception on failure; success prints
-- "rate limits: all checks passed".

BEGIN;

-- Start from empty counters. The ROLLBACK at the end puts the real ones back.
DELETE FROM public.spacego_rate_limits;

-- 1. The counters and helpers are closed to the API; the triggers are in place;
--    the four request functions are callable by the same roles as before.
DO $catalog$
DECLARE
  v_role text;
  v_fn text;
  v_table text;
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.spacego_rate_limits'::regclass) THEN
    RAISE EXCEPTION 'spacego_rate_limits has row-level security off';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'spacego_rate_limits') THEN
    RAISE EXCEPTION 'spacego_rate_limits should have no policies';
  END IF;
  FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF has_table_privilege(v_role, 'public.spacego_rate_limits',
                           'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER') THEN
      RAISE EXCEPTION '% has access to spacego_rate_limits', v_role;
    END IF;
    FOREACH v_fn IN ARRAY ARRAY[
      'public.spacego_rate_limit_hit(text, interval, integer)',
      'public.spacego_rate_limit_cleanup()',
      'public.spacego_rate_limit_guard()'
    ] LOOP
      IF has_function_privilege(v_role, v_fn, 'EXECUTE') THEN
        RAISE EXCEPTION '% can execute %', v_role, v_fn;
      END IF;
    END LOOP;
  END LOOP;

  FOREACH v_table IN ARRAY ARRAY[
    'spacego_enquiries', 'spacego_demand_searches', 'spacego_bookings', 'spacego_activations'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger t
      WHERE t.tgrelid = format('public.%I', v_table)::regclass
        AND t.tgname = 'spacego_rate_limit'
        AND t.tgenabled <> 'D'
        AND t.tgtype = 7  -- ROW, BEFORE, INSERT
    ) THEN
      RAISE EXCEPTION 'The rate-limit trigger is missing or disabled on %', v_table;
    END IF;
  END LOOP;

  FOREACH v_fn IN ARRAY ARRAY[
    'public.spacego_submit_enquiry(text, text, text, text, text, integer, date, text, text)',
    'public.spacego_log_demand(text, text, integer, integer)'
  ] LOOP
    IF NOT has_function_privilege('anon', v_fn, 'EXECUTE')
       OR NOT has_function_privilege('authenticated', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION '% is no longer callable by visitors and members', v_fn;
    END IF;
  END LOOP;
  FOREACH v_fn IN ARRAY ARRAY[
    'public.spacego_create_booking(text, timestamptz, timestamptz, text, integer, integer, text)',
    'public.spacego_submit_activation(jsonb)'
  ] LOOP
    IF has_function_privilege('anon', v_fn, 'EXECUTE')
       OR NOT has_function_privilege('authenticated', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION '% grants changed', v_fn;
    END IF;
  END LOOP;
END
$catalog$;

-- 2. The counter itself.
DO $helper$
DECLARE
  v_failed boolean := false;
BEGIN
  IF NOT public.spacego_rate_limit_hit('zz-test', interval '1 hour', 2)
     OR NOT public.spacego_rate_limit_hit('zz-test', interval '1 hour', 2) THEN
    RAISE EXCEPTION 'The first two hits should be within a limit of 2';
  END IF;
  IF public.spacego_rate_limit_hit('zz-test', interval '1 hour', 2) THEN
    RAISE EXCEPTION 'The third hit should be over a limit of 2';
  END IF;
  -- Each window size has its own count.
  IF NOT public.spacego_rate_limit_hit('zz-test', interval '1 day', 2) THEN
    RAISE EXCEPTION 'A different window should count separately';
  END IF;
  BEGIN
    PERFORM public.spacego_rate_limit_hit('zz-test', interval '0 seconds', 2);
  EXCEPTION WHEN invalid_parameter_value THEN v_failed := true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'A zero-length window was accepted'; END IF;

  -- Cleanup drops windows that started more than three days ago, nothing newer.
  INSERT INTO public.spacego_rate_limits (bucket, window_seconds, window_start, hits)
  VALUES ('zz-old', 3600, now() - interval '4 days', 1),
         ('zz-recent', 3600, now() - interval '2 days', 1);
  PERFORM public.spacego_rate_limit_cleanup();
  IF EXISTS (SELECT 1 FROM public.spacego_rate_limits WHERE bucket = 'zz-old') THEN
    RAISE EXCEPTION 'Cleanup kept a window from four days ago';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.spacego_rate_limits WHERE bucket = 'zz-recent')
     OR NOT EXISTS (SELECT 1 FROM public.spacego_rate_limits WHERE bucket = 'zz-test') THEN
    RAISE EXCEPTION 'Cleanup removed a recent window';
  END IF;
  DELETE FROM public.spacego_rate_limits;
END
$helper$;

-- Fixtures: a guest, a host with one bookable listing, an owner, an admin.
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-4000-8000-0000000f0001', 'rl-guest@example.invalid', '{"role":"seeker","full_name":"Rate Guest"}'),
  ('00000000-0000-4000-8000-0000000f0002', 'rl-host@example.invalid', '{"role":"owner","full_name":"Rate Host"}'),
  ('00000000-0000-4000-8000-0000000f0003', 'rl-owner@example.invalid', '{"role":"owner","full_name":"Rate Owner"}'),
  ('00000000-0000-4000-8000-0000000f0004', 'rl-admin@example.invalid', '{"role":"owner","full_name":"Rate Admin"}');
-- Some projects only let service_role or an admin grant the admin role.
DO $$ BEGIN PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true); END $$;
UPDATE public.profiles SET role = 'admin' WHERE id = '00000000-0000-4000-8000-0000000f0004';
DO $$ BEGIN PERFORM set_config('request.jwt.claims', '', true); END $$;

SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000f0004', true);
INSERT INTO public.spacego_spaces (id, data) VALUES ('zz-rl-space', jsonb_build_object(
  'id', 'zz-rl-space', 'owner_id', '00000000-0000-4000-8000-0000000f0002',
  'title', 'Rate limit desk', 'slug', 'zz-rl-space', 'category', 'coworking', 'status', 'published',
  'capacity', 10, 'square_feet', 800, 'pricing', jsonb_build_object('hourly', 100, 'currency', 'INR'),
  'location', jsonb_build_object('city', 'Kochi', 'address', '1 Limit Road', 'country', 'India',
    'coordinates', jsonb_build_object('lat', 10.02, 'lng', 76.31))));
SELECT set_config('request.jwt.claim.sub', '', true);

-- Act as a signed-out visitor or a signed-in member, the way the Supabase API does.
CREATE FUNCTION pg_temp.as_anon() RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claim.sub', '', true);
  SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
$$;
CREATE FUNCTION pg_temp.as_member(p_uid text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claim.sub', p_uid, true);
  SELECT set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;
-- NULL if the statement ran; the message if a rate limit refused it. Any other
-- error fails the test.
CREATE FUNCTION pg_temp.refusal(p_sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  v_hint text;
  v_message text;
BEGIN
  EXECUTE p_sql;
  RETURN NULL;
EXCEPTION WHEN raise_exception THEN
  GET STACKED DIAGNOSTICS v_hint = PG_EXCEPTION_HINT, v_message = MESSAGE_TEXT;
  IF v_hint IS DISTINCT FROM 'rate_limited' THEN
    RAISE;
  END IF;
  RETURN v_message;
END;
$$;
CREATE FUNCTION pg_temp.set_count(p_bucket text, p_window interval, p_hits integer)
RETURNS void LANGUAGE sql AS $$
  INSERT INTO public.spacego_rate_limits (bucket, window_seconds, window_start, hits)
  VALUES (p_bucket, extract(epoch FROM p_window)::integer,
          to_timestamp(floor(extract(epoch FROM now()) / extract(epoch FROM p_window))
                       * extract(epoch FROM p_window)),
          p_hits)
  ON CONFLICT (bucket, window_seconds, window_start) DO UPDATE SET hits = EXCLUDED.hits;
$$;

-- 3. Signed-out enquiries: 5 an hour per email, 20 per 10 minutes in total.
SET LOCAL ROLE anon;
DO $anon_enquiries$
DECLARE
  i integer;
  v_msg text;
BEGIN
  PERFORM pg_temp.as_anon();
  FOR i IN 1..5 LOOP
    PERFORM public.spacego_submit_enquiry('Rate Visitor', 'rl-same@example.invalid', NULL,
      'Kakkanad', 'coworking', 2, NULL, NULL, NULL);
  END LOOP;
  -- The same address in other capitals is the same address.
  v_msg := pg_temp.refusal($q$SELECT public.spacego_submit_enquiry('Rate Visitor',
    'RL-Same@Example.INVALID', NULL, 'Kakkanad', 'coworking', 2, NULL, NULL, NULL)$q$);
  IF v_msg IS NULL OR v_msg NOT LIKE '%this email address%' THEN
    RAISE EXCEPTION 'A sixth enquiry from one email in an hour was not refused (%)', v_msg;
  END IF;

  FOR i IN 1..15 LOOP
    PERFORM public.spacego_submit_enquiry('Rate Visitor', format('rl-anon-%s@example.invalid', i),
      NULL, 'Kakkanad', 'coworking', 2, NULL, NULL, NULL);
  END LOOP;
  v_msg := pg_temp.refusal($q$SELECT public.spacego_submit_enquiry('Rate Visitor',
    'rl-anon-21@example.invalid', NULL, 'Kakkanad', 'coworking', 2, NULL, NULL, NULL)$q$);
  IF v_msg IS NULL OR v_msg NOT LIKE '%sign in%' THEN
    RAISE EXCEPTION 'The 21st signed-out enquiry in 10 minutes was not refused (%)', v_msg;
  END IF;
END
$anon_enquiries$;
RESET ROLE;

DO $anon_enquiries_after$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.spacego_enquiries
  WHERE data ->> 'email' ILIKE 'rl-%@example.invalid';
  IF v_count <> 20 THEN
    RAISE EXCEPTION 'Expected 20 stored enquiries, found %', v_count;
  END IF;
  -- A refused enquiry doesn't count against the limit.
  SELECT hits INTO v_count FROM public.spacego_rate_limits
  WHERE bucket = 'enquiry:anon' AND window_seconds = 600;
  IF v_count <> 20 THEN
    RAISE EXCEPTION 'Expected the signed-out count to stay at 20, found %', v_count;
  END IF;
  -- Simulate a busy day: a fresh 10 minutes, but 200 signed-out enquiries today.
  DELETE FROM public.spacego_rate_limits WHERE bucket = 'enquiry:anon';
  PERFORM pg_temp.set_count('enquiry:anon', interval '1 day', 200);
END
$anon_enquiries_after$;

SET LOCAL ROLE anon;
DO $anon_day$
BEGIN
  PERFORM pg_temp.as_anon();
  IF pg_temp.refusal($q$SELECT public.spacego_submit_enquiry('Rate Visitor',
       'rl-day@example.invalid', NULL, 'Kakkanad', 'coworking', 2, NULL, NULL, NULL)$q$) IS NULL THEN
    RAISE EXCEPTION 'A signed-out enquiry over the daily total was not refused';
  END IF;
END
$anon_day$;
RESET ROLE;

-- 4. Signed-in enquiries: 10 an hour per account, and the signed-out total
--    doesn't apply to them.
DO $$ BEGIN PERFORM pg_temp.set_count('enquiry:anon', interval '10 minutes', 20); END $$;
SET LOCAL ROLE authenticated;
DO $member_enquiries$
DECLARE
  i integer;
  v_msg text;
BEGIN
  PERFORM pg_temp.as_member('00000000-0000-4000-8000-0000000f0001');
  FOR i IN 1..10 LOOP
    PERFORM public.spacego_submit_enquiry('Rate Guest', format('rl-member-%s@example.invalid', i),
      NULL, 'Edappally', 'meeting_room', 4, NULL, NULL, NULL);
  END LOOP;
  v_msg := pg_temp.refusal($q$SELECT public.spacego_submit_enquiry('Rate Guest',
    'rl-member-11@example.invalid', NULL, 'Edappally', 'meeting_room', 4, NULL, NULL, NULL)$q$);
  IF v_msg IS NULL OR v_msg NOT LIKE '%a lot of enquiries%' THEN
    RAISE EXCEPTION 'An 11th enquiry from one account in an hour was not refused (%)', v_msg;
  END IF;
END
$member_enquiries$;
RESET ROLE;

DO $member_day$
BEGIN
  DELETE FROM public.spacego_rate_limits
  WHERE bucket = 'enquiry:user:00000000-0000-4000-8000-0000000f0001';
  PERFORM pg_temp.set_count('enquiry:user:00000000-0000-4000-8000-0000000f0001', interval '1 day', 30);
END
$member_day$;
SET LOCAL ROLE authenticated;
DO $member_day_check$
BEGIN
  PERFORM pg_temp.as_member('00000000-0000-4000-8000-0000000f0001');
  IF pg_temp.refusal($q$SELECT public.spacego_submit_enquiry('Rate Guest',
       'rl-member-day@example.invalid', NULL, 'Edappally', 'meeting_room', 4, NULL, NULL, NULL)$q$) IS NULL THEN
    RAISE EXCEPTION 'An enquiry over the daily limit for one account was not refused';
  END IF;
END
$member_day_check$;
RESET ROLE;

-- 5. Search logging: 10 per 10 minutes for one search, 60 a minute in total.
--    Over a limit the call still succeeds; the search just isn't stored.
SET LOCAL ROLE anon;
DO $demand$
DECLARE
  i integer;
  v_id text;
BEGIN
  PERFORM pg_temp.as_anon();
  FOR i IN 1..10 LOOP
    PERFORM public.spacego_log_demand('ZZ  Rate   Query', 'coworking', 3, 0);
  END LOOP;
  v_id := public.spacego_log_demand('zz rate query', 'coworking', 3, 0);
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'A throttled search log should still return normally';
  END IF;
  -- A different seat count is a different search.
  PERFORM public.spacego_log_demand('zz rate query', 'coworking', 4, 0);
  FOR i IN 1..49 LOOP
    PERFORM public.spacego_log_demand(format('zz rate query %s', i), NULL, NULL, 1);
  END LOOP;
  -- That is 60 stored this minute; the next one is not stored.
  PERFORM public.spacego_log_demand('zz rate query extra', NULL, NULL, 1);
END
$demand$;
RESET ROLE;

DO $demand_after$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.spacego_demand_searches
  WHERE data ->> 'location_query' ILIKE 'zz rate query%';
  IF v_count <> 60 THEN
    RAISE EXCEPTION 'Expected 60 stored searches, found %', v_count;
  END IF;
  IF EXISTS (SELECT 1 FROM public.spacego_demand_searches
             WHERE data ->> 'location_query' = 'zz rate query extra') THEN
    RAISE EXCEPTION 'A search over the per-minute total was stored';
  END IF;
  -- Simulate a busy day: a fresh minute, but 10,000 searches today.
  DELETE FROM public.spacego_rate_limits WHERE bucket = 'demand:all';
  PERFORM pg_temp.set_count('demand:all', interval '1 day', 10000);
END
$demand_after$;

SET LOCAL ROLE anon;
DO $$ BEGIN PERFORM pg_temp.as_anon(); PERFORM public.spacego_log_demand('zz rate query day', NULL, NULL, 1); END $$;
RESET ROLE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.spacego_demand_searches
             WHERE data ->> 'location_query' = 'zz rate query day') THEN
    RAISE EXCEPTION 'A search over the daily total was stored';
  END IF;
END $$;

-- 6. Booking requests: 20 an hour, 60 a day per account.
SET LOCAL ROLE authenticated;
DO $bookings$
DECLARE
  t0 timestamptz := date_trunc('hour', now()) + interval '40 days';
  i integer;
  v_msg text;
BEGIN
  PERFORM pg_temp.as_member('00000000-0000-4000-8000-0000000f0001');
  FOR i IN 0..19 LOOP
    PERFORM public.spacego_create_booking('zz-rl-space', t0 + i * interval '2 hours',
      t0 + i * interval '2 hours' + interval '1 hour', 'hourly', 1, 1);
  END LOOP;
  v_msg := pg_temp.refusal(format(
    $q$SELECT public.spacego_create_booking('zz-rl-space', %L::timestamptz, %L::timestamptz, 'hourly', 1, 1)$q$,
    t0 + interval '60 hours', t0 + interval '61 hours'));
  IF v_msg IS NULL OR v_msg NOT LIKE '%booking requests%' THEN
    RAISE EXCEPTION 'A 21st booking request in an hour was not refused (%)', v_msg;
  END IF;
END
$bookings$;
RESET ROLE;

DO $bookings_after$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.spacego_bookings
  WHERE data ->> 'space_id' = 'zz-rl-space';
  IF v_count <> 20 THEN
    RAISE EXCEPTION 'Expected 20 stored booking requests, found %', v_count;
  END IF;
  DELETE FROM public.spacego_rate_limits
  WHERE bucket = 'booking:user:00000000-0000-4000-8000-0000000f0001';
  PERFORM pg_temp.set_count('booking:user:00000000-0000-4000-8000-0000000f0001', interval '1 day', 60);
END
$bookings_after$;

SET LOCAL ROLE authenticated;
DO $bookings_day$
DECLARE
  t0 timestamptz := date_trunc('hour', now()) + interval '45 days';
BEGIN
  PERFORM pg_temp.as_member('00000000-0000-4000-8000-0000000f0001');
  IF pg_temp.refusal(format(
       $q$SELECT public.spacego_create_booking('zz-rl-space', %L::timestamptz, %L::timestamptz, 'hourly', 1, 1)$q$,
       t0, t0 + interval '1 hour')) IS NULL THEN
    RAISE EXCEPTION 'A booking request over the daily limit was not refused';
  END IF;
END
$bookings_day$;

-- 7. Property activation requests: 10 an hour, 30 a day per account.
DO $activations$
DECLARE
  i integer;
  v_msg text;
  v_request jsonb := jsonb_build_object(
    'property_address', '2 Limit Road', 'city', 'Kochi',
    'property_type', 'vacant_floor', 'current_condition', 'bare_shell',
    'preferred_model', 'self_managed', 'approx_square_feet', 1200,
    'expected_budget_usd', 0);
BEGIN
  PERFORM pg_temp.as_member('00000000-0000-4000-8000-0000000f0003');
  FOR i IN 1..10 LOOP
    PERFORM public.spacego_submit_activation(v_request);
  END LOOP;
  v_msg := pg_temp.refusal(format($q$SELECT public.spacego_submit_activation(%L::jsonb)$q$, v_request));
  IF v_msg IS NULL OR v_msg NOT LIKE '%property requests%' THEN
    RAISE EXCEPTION 'An 11th activation request in an hour was not refused (%)', v_msg;
  END IF;
END
$activations$;
RESET ROLE;

DO $activations_after$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.spacego_activations
  WHERE data ->> 'owner_id' = '00000000-0000-4000-8000-0000000f0003';
  IF v_count <> 10 THEN
    RAISE EXCEPTION 'Expected 10 stored activation requests, found %', v_count;
  END IF;
  DELETE FROM public.spacego_rate_limits
  WHERE bucket = 'activation:user:00000000-0000-4000-8000-0000000f0003';
  PERFORM pg_temp.set_count('activation:user:00000000-0000-4000-8000-0000000f0003', interval '1 day', 30);
END
$activations_after$;

SET LOCAL ROLE authenticated;
DO $activations_day$
BEGIN
  PERFORM pg_temp.as_member('00000000-0000-4000-8000-0000000f0003');
  IF pg_temp.refusal($q$SELECT public.spacego_submit_activation(jsonb_build_object(
       'property_address', '2 Limit Road', 'city', 'Kochi',
       'property_type', 'vacant_floor', 'current_condition', 'bare_shell',
       'preferred_model', 'self_managed', 'approx_square_feet', 1200,
       'expected_budget_usd', 0))$q$) IS NULL THEN
    RAISE EXCEPTION 'An activation request over the daily limit was not refused';
  END IF;
END
$activations_day$;
RESET ROLE;

-- 8. The SQL editor and the service role are never limited.
DO $not_limited$
DECLARE
  i integer;
  v_count integer;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);
  FOR i IN 1..8 LOOP
    PERFORM public.spacego_submit_enquiry('Rate Editor', 'rl-editor@example.invalid', NULL,
      'Kaloor', 'coworking', 1, NULL, NULL, NULL);
  END LOOP;
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  FOR i IN 1..8 LOOP
    PERFORM public.spacego_submit_enquiry('Rate Service', 'rl-service@example.invalid', NULL,
      'Kaloor', 'coworking', 1, NULL, NULL, NULL);
  END LOOP;
  PERFORM set_config('request.jwt.claims', '', true);
  SELECT count(*) INTO v_count FROM public.spacego_enquiries
  WHERE data ->> 'email' IN ('rl-editor@example.invalid', 'rl-service@example.invalid');
  IF v_count <> 16 THEN
    RAISE EXCEPTION 'The SQL editor or service role was limited (% of 16 stored)', v_count;
  END IF;

  RAISE NOTICE 'rate limits: all checks passed';
END
$not_limited$;

ROLLBACK;
