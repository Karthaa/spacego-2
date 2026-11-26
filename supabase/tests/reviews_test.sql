-- SpaceGo guest reviews.
-- Safe to run on STAGING: one transaction, rolled back at the end.
--   psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/reviews_test.sql
-- Success prints "reviews: all checks passed".

BEGIN;

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-4000-8000-0000000d0001', 'rv-guest@example.invalid', '{"role":"seeker","full_name":"Asha Menon"}'),
  ('00000000-0000-4000-8000-0000000d0002', 'rv-other@example.invalid', '{"role":"seeker","full_name":"Other Guest"}'),
  ('00000000-0000-4000-8000-0000000d0003', 'rv-host@example.invalid', '{"role":"owner","full_name":"Review Host"}'),
  ('00000000-0000-4000-8000-0000000d0004', 'rv-admin@example.invalid', '{"role":"owner","full_name":"Review Admin"}');
UPDATE public.profiles SET role = 'admin' WHERE id = '00000000-0000-4000-8000-0000000d0004';
UPDATE public.profiles SET full_name = 'Asha Menon' WHERE id = '00000000-0000-4000-8000-0000000d0001';

SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000d0004', true);
INSERT INTO public.spacego_spaces (id, data) VALUES ('zz-rv-space', jsonb_build_object(
  'id', 'zz-rv-space', 'owner_id', '00000000-0000-4000-8000-0000000d0003',
  'title', 'Review test desk', 'slug', 'zz-rv-space', 'category', 'coworking', 'status', 'published',
  'capacity', 10, 'square_feet', 800, 'pricing', jsonb_build_object('daily', 500, 'currency', 'INR'),
  'location', jsonb_build_object('city', 'Kochi', 'address', '1 Review Lane', 'country', 'India',
    'coordinates', jsonb_build_object('lat', 10.01, 'lng', 76.34))));

INSERT INTO public.spacego_bookings (id, data)
SELECT v.id, jsonb_build_object('id', v.id, 'space_id', 'zz-rv-space', 'user_id', v.user_id,
  'owner_id', '00000000-0000-4000-8000-0000000d0003', 'status', v.status,
  'start_date', to_jsonb(now() + v.start_offset), 'end_date', to_jsonb(now() + v.start_offset + interval '2 hours'))
FROM (VALUES
  ('zz-rv-past', '00000000-0000-4000-8000-0000000d0001', 'approved', interval '-3 days'),
  ('zz-rv-future', '00000000-0000-4000-8000-0000000d0001', 'approved', interval '3 days'),
  ('zz-rv-pending', '00000000-0000-4000-8000-0000000d0001', 'pending', interval '-4 days'),
  ('zz-rv-other', '00000000-0000-4000-8000-0000000d0002', 'approved', interval '-5 days')
) AS v(id, user_id, status, start_offset);

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
  guest text := '00000000-0000-4000-8000-0000000d0001';
  other text := '00000000-0000-4000-8000-0000000d0002';
  host text := '00000000-0000-4000-8000-0000000d0003';
  admin text := '00000000-0000-4000-8000-0000000d0004';
  v_id uuid;
  v_count integer;
  v_row record;
BEGIN
  PERFORM pg_temp.act_as(guest);
  v_id := public.spacego_submit_review('zz-rv-past', 4, 'Quiet room, fast Wi-Fi and a helpful host.');
  PERFORM pg_temp.expect_error($$SELECT public.spacego_submit_review('zz-rv-past', 5, 'Trying to review the same booking twice.')$$, '23505');
  PERFORM pg_temp.expect_error($$SELECT public.spacego_submit_review('zz-rv-future', 5, 'Reviewing before the booking has ended.')$$, '22023');
  PERFORM pg_temp.expect_error($$SELECT public.spacego_submit_review('zz-rv-pending', 5, 'Reviewing a booking that was never confirmed.')$$, '42501');
  PERFORM pg_temp.expect_error($$SELECT public.spacego_submit_review('zz-rv-other', 5, 'Reviewing somebody else''s booking here.')$$, 'P0002');
  PERFORM pg_temp.expect_error($$SELECT public.spacego_submit_review('zz-rv-future', 6, 'Out of range rating for the space.')$$, '22023');
  PERFORM pg_temp.expect_error($$SELECT public.spacego_submit_review('zz-rv-missing', 5, 'Booking that does not exist at all.')$$, 'P0002');
  PERFORM pg_temp.expect_error($$INSERT INTO public.spacego_space_reviews (booking_id, space_id, author_id, rating, body)
    VALUES ('zz-rv-future', 'zz-rv-space', auth.uid(), 5, 'Direct insert that should be refused.')$$, '42501');
  PERFORM pg_temp.expect_error($$UPDATE public.spacego_space_reviews SET rating = 5$$, '42501');

  -- The host was notified.
  PERFORM pg_temp.act_as(host);
  SELECT count(*) INTO v_count FROM public.spacego_notifications
  WHERE data ->> 'user_id' = host AND data ->> 'message' LIKE 'Asha reviewed Review test desk (4 of 5).';
  IF v_count <> 1 THEN RAISE EXCEPTION 'host not notified (%)', v_count; END IF;

  -- Only the host can respond.
  PERFORM pg_temp.act_as(other);
  PERFORM pg_temp.expect_error(format($$SELECT public.spacego_respond_to_review(%L, 'Not my space.')$$, v_id), '42501');
  PERFORM pg_temp.act_as(host);
  PERFORM public.spacego_respond_to_review(v_id, 'Thanks for working with us, Asha.');

  -- Only admins moderate, with a reason.
  PERFORM pg_temp.act_as(guest);
  PERFORM pg_temp.expect_error(format($$SELECT public.spacego_moderate_review(%L, 'hide', 'Guest trying to hide it')$$, v_id), '42501');
  PERFORM pg_temp.act_as(admin);
  PERFORM pg_temp.expect_error(format($$SELECT public.spacego_moderate_review(%L, 'hide', 'short')$$, v_id), '22023');
END
$checks$;

-- Public view: first name only, no ids.
RESET ROLE;
SET LOCAL ROLE anon;
DO $anon$
DECLARE
  v_row record;
  v_count integer;
BEGIN
  SELECT * INTO v_row FROM public.spacego_public_reviews WHERE space_id = 'zz-rv-space';
  IF v_row.author_name <> 'Asha' OR v_row.rating <> 4 OR v_row.host_response <> 'Thanks for working with us, Asha.' THEN
    RAISE EXCEPTION 'public review wrong: %', row_to_json(v_row);
  END IF;
  IF row_to_json(v_row)::jsonb ?| ARRAY['author_id', 'booking_id', 'moderation_reason', 'status'] THEN
    RAISE EXCEPTION 'public review exposes private columns';
  END IF;
  SELECT count(*) INTO v_count FROM public.spacego_public_review_summary
  WHERE space_id = 'zz-rv-space' AND review_count = 1 AND average_rating = 4.0;
  IF v_count <> 1 THEN RAISE EXCEPTION 'summary wrong'; END IF;
  BEGIN
    PERFORM 1 FROM public.spacego_space_reviews;
    RAISE EXCEPTION 'anon read the base table';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  BEGIN
    PERFORM public.spacego_submit_review('zz-rv-past', 5, 'Anonymous review attempt here.');
    RAISE EXCEPTION 'anon could call spacego_submit_review';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END
$anon$;
RESET ROLE;

SET LOCAL ROLE authenticated;
DO $hide$
DECLARE
  admin text := '00000000-0000-4000-8000-0000000d0004';
  guest text := '00000000-0000-4000-8000-0000000d0001';
  other text := '00000000-0000-4000-8000-0000000d0002';
  v_id uuid;
  v_count integer;
BEGIN
  PERFORM pg_temp.act_as(admin);
  SELECT id INTO v_id FROM public.spacego_space_reviews WHERE booking_id = 'zz-rv-past';
  PERFORM public.spacego_moderate_review(v_id, 'hide', 'Contains a phone number.');
  SELECT count(*) INTO v_count FROM public.spacego_public_reviews WHERE space_id = 'zz-rv-space';
  IF v_count <> 0 THEN RAISE EXCEPTION 'hidden review still public'; END IF;
  SELECT count(*) INTO v_count FROM public.spacego_public_review_summary WHERE space_id = 'zz-rv-space';
  IF v_count <> 0 THEN RAISE EXCEPTION 'hidden review still counted'; END IF;
  SELECT count(*) INTO v_count FROM public.spacego_listing_review_events
  WHERE space_id = 'zz-rv-space' AND action = 'guest_review_hide' AND reason = 'Contains a phone number.';
  IF v_count <> 1 THEN RAISE EXCEPTION 'moderation not logged'; END IF;

  -- The author still sees their own review and why it was hidden; others don't.
  PERFORM pg_temp.act_as(guest);
  SELECT count(*) INTO v_count FROM public.spacego_space_reviews WHERE id = v_id AND status = 'hidden';
  IF v_count <> 1 THEN RAISE EXCEPTION 'author cannot see their hidden review'; END IF;
  PERFORM pg_temp.act_as(other);
  SELECT count(*) INTO v_count FROM public.spacego_space_reviews;
  IF v_count <> 0 THEN RAISE EXCEPTION 'another guest can read reviews they did not write'; END IF;

  PERFORM pg_temp.act_as(admin);
  PERFORM public.spacego_moderate_review(v_id, 'restore');
  SELECT count(*) INTO v_count FROM public.spacego_public_reviews WHERE space_id = 'zz-rv-space';
  IF v_count <> 1 THEN RAISE EXCEPTION 'restored review not public'; END IF;

  -- Reviews of an unpublished listing are not public.
  UPDATE public.spacego_spaces SET data = data || '{"status":"draft"}' WHERE id = 'zz-rv-space';
  SELECT count(*) INTO v_count FROM public.spacego_public_reviews WHERE space_id = 'zz-rv-space';
  IF v_count <> 0 THEN RAISE EXCEPTION 'reviews of a hidden listing are public'; END IF;

  RAISE NOTICE 'reviews: all checks passed';
END
$hide$;

ROLLBACK;
