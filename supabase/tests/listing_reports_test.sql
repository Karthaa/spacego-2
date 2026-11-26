-- SpaceGo listing reports.
-- Safe to run on STAGING: one transaction, rolled back at the end.
--   psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/listing_reports_test.sql
-- Success prints "listing reports: all checks passed".

BEGIN;

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-4000-8000-0000000f0001', 'rp-guest@example.invalid', '{"role":"seeker","full_name":"Report Guest"}'),
  ('00000000-0000-4000-8000-0000000f0002', 'rp-other@example.invalid', '{"role":"seeker","full_name":"Other Guest"}'),
  ('00000000-0000-4000-8000-0000000f0003', 'rp-host@example.invalid', '{"role":"owner","full_name":"Report Host"}'),
  ('00000000-0000-4000-8000-0000000f0004', 'rp-admin@example.invalid', '{"role":"owner","full_name":"Report Admin"}');
UPDATE public.profiles SET role = 'admin' WHERE id = '00000000-0000-4000-8000-0000000f0004';

SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000f0004', true);
INSERT INTO public.spacego_spaces (id, data)
SELECT v.id, jsonb_build_object(
  'id', v.id, 'owner_id', '00000000-0000-4000-8000-0000000f0003',
  'title', 'Report test desk', 'slug', v.id, 'category', 'coworking', 'status', v.status,
  'capacity', 10, 'square_feet', 800, 'pricing', jsonb_build_object('daily', 500, 'currency', 'INR'),
  'location', jsonb_build_object('city', 'Kochi', 'address', '1 Report Road', 'country', 'India',
    'coordinates', jsonb_build_object('lat', 10.01, 'lng', 76.34)))
FROM (VALUES ('zz-rp-live', 'published'), ('zz-rp-draft', 'draft')) AS v(id, status);

CREATE FUNCTION pg_temp.act_as(p_uid text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claim.sub', p_uid, true);
$$;

CREATE FUNCTION pg_temp.expect_error(p_sql text, p_state text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RAISE EXCEPTION 'expected SQLSTATE % from: %', p_state, p_sql;
EXCEPTION WHEN others THEN
  IF SQLSTATE <> p_state THEN
    RAISE EXCEPTION 'expected SQLSTATE % but got % (%) from: %', p_state, SQLSTATE, SQLERRM, p_sql;
  END IF;
END
$$;

SET LOCAL ROLE authenticated;

DO $checks$
DECLARE
  guest text := '00000000-0000-4000-8000-0000000f0001';
  other text := '00000000-0000-4000-8000-0000000f0002';
  host text := '00000000-0000-4000-8000-0000000f0003';
  admin text := '00000000-0000-4000-8000-0000000f0004';
  v_id uuid;
  v_count integer;
BEGIN
  PERFORM pg_temp.act_as(guest);
  v_id := public.spacego_report_listing('zz-rp-live', 'wrong_info', 'The photos show a different building.');
  PERFORM pg_temp.expect_error($$SELECT public.spacego_report_listing('zz-rp-live', 'scam', 'Second report while the first is open.')$$, '23505');
  PERFORM pg_temp.expect_error($$SELECT public.spacego_report_listing('zz-rp-live', 'other', 'short')$$, '22023');
  PERFORM pg_temp.expect_error($$SELECT public.spacego_report_listing('zz-rp-live', 'made_up', '')$$, '22023');
  PERFORM pg_temp.expect_error($$SELECT public.spacego_report_listing('zz-rp-draft', 'scam', 'Hidden listing.')$$, 'P0002');
  PERFORM pg_temp.expect_error($$INSERT INTO public.spacego_listing_reports (space_id, reporter_id, reason) VALUES ('zz-rp-live', auth.uid(), 'scam')$$, '42501');

  PERFORM pg_temp.act_as(host);
  PERFORM pg_temp.expect_error($$SELECT public.spacego_report_listing('zz-rp-live', 'scam', 'Reporting my own listing.')$$, '42501');
  SELECT count(*) INTO v_count FROM public.spacego_listing_reports;
  IF v_count <> 0 THEN RAISE EXCEPTION 'host can read who reported them'; END IF;

  PERFORM pg_temp.act_as(other);
  SELECT count(*) INTO v_count FROM public.spacego_listing_reports;
  IF v_count <> 0 THEN RAISE EXCEPTION 'another user can read reports'; END IF;
  PERFORM pg_temp.expect_error(format($$SELECT public.spacego_resolve_report(%L, 'dismissed', 'Not an admin')$$, v_id), '42501');

  -- Admins are notified, see it, and close it with a note.
  PERFORM pg_temp.act_as(admin);
  SELECT count(*) INTO v_count FROM public.spacego_notifications
  WHERE data ->> 'user_id' = admin AND data ->> 'message' = 'Report test desk was reported (wrong info).';
  IF v_count <> 1 THEN RAISE EXCEPTION 'admin not notified (%)', v_count; END IF;
  SELECT count(*) INTO v_count FROM public.spacego_listing_reports WHERE status = 'open' AND space_id = 'zz-rp-live';
  IF v_count <> 1 THEN RAISE EXCEPTION 'admin cannot see the report'; END IF;
  PERFORM pg_temp.expect_error(format($$SELECT public.spacego_resolve_report(%L, 'resolved', 'ok')$$, v_id), '22023');
  PERFORM public.spacego_resolve_report(v_id, 'resolved', 'Asked the host to replace the photos.');
  PERFORM pg_temp.expect_error(format($$SELECT public.spacego_resolve_report(%L, 'dismissed', 'Closing it twice.')$$, v_id), '22023');
  SELECT count(*) INTO v_count FROM public.spacego_listing_review_events
  WHERE space_id = 'zz-rp-live' AND action = 'report_resolved';
  IF v_count <> 1 THEN RAISE EXCEPTION 'resolution not logged'; END IF;

  -- After it is closed, the guest can report again; and sees their own reports.
  PERFORM pg_temp.act_as(guest);
  PERFORM public.spacego_report_listing('zz-rp-live', 'unsafe', 'Fire exit is blocked.');
  SELECT count(*) INTO v_count FROM public.spacego_listing_reports WHERE reporter_id = guest::uuid;
  IF v_count <> 2 THEN RAISE EXCEPTION 'reporter cannot see their own reports'; END IF;

  RAISE NOTICE 'listing reports: all checks passed';
END
$checks$;

ROLLBACK;
