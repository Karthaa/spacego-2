-- SpaceGo listing review checks.
-- Safe to run on STAGING: one transaction, rolled back at the end.
--   psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/listing_review_test.sql
-- Success prints "listing review: all checks passed".

BEGIN;

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-4000-8000-0000000a0001', 'review-owner@example.invalid', '{"role":"owner","full_name":"Review Owner"}'),
  ('00000000-0000-4000-8000-0000000a0002', 'review-other@example.invalid', '{"role":"owner","full_name":"Other Owner"}'),
  ('00000000-0000-4000-8000-0000000a0003', 'review-admin@example.invalid', '{"role":"owner","full_name":"Review Admin"}');
UPDATE public.profiles SET role = 'admin' WHERE id = '00000000-0000-4000-8000-0000000a0003';

CREATE TEMP TABLE review_fixture AS
SELECT jsonb_build_object(
  'id', 'zz-review-1', 'owner_id', '00000000-0000-4000-8000-0000000a0001',
  'title', 'Review fixture desk', 'slug', 'zz-review-1', 'category', 'coworking',
  'status', 'published', 'capacity', 10, 'square_feet', 800,
  'pricing', jsonb_build_object('daily', 500, 'currency', 'INR'),
  'location', jsonb_build_object('city', 'Kochi', 'address', '1 Review Road', 'country', 'India',
    'coordinates', jsonb_build_object('lat', 10.01, 'lng', 76.34)),
  'review', jsonb_build_object('state', 'approved')
) AS data;
GRANT SELECT ON review_fixture TO authenticated;

CREATE FUNCTION pg_temp.act_as(p_uid text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claim.sub', p_uid, true);
$$;

SET LOCAL ROLE authenticated;

DO $checks$
DECLARE
  owner_id text := '00000000-0000-4000-8000-0000000a0001';
  other_id text := '00000000-0000-4000-8000-0000000a0002';
  admin_id text := '00000000-0000-4000-8000-0000000a0003';
  v_data jsonb;
  v_count integer;
  v_failed boolean;
BEGIN
  -- Owner creates a listing asking for "published" with a forged approval.
  PERFORM pg_temp.act_as(owner_id);
  INSERT INTO public.spacego_spaces (id, data) SELECT 'zz-review-1', data FROM review_fixture;
  SELECT data INTO v_data FROM public.spacego_spaces WHERE id = 'zz-review-1';
  IF v_data ->> 'status' <> 'draft' OR v_data -> 'review' ->> 'state' <> 'draft' THEN
    RAISE EXCEPTION 'new owner listing should be draft/draft, got % / %', v_data ->> 'status', v_data -> 'review' ->> 'state';
  END IF;

  -- Owner cannot publish or self-approve.
  v_failed := false;
  BEGIN
    UPDATE public.spacego_spaces SET data = data || '{"status":"published"}' WHERE id = 'zz-review-1';
  EXCEPTION WHEN insufficient_privilege THEN v_failed := true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'owner published an unreviewed listing'; END IF;

  UPDATE public.spacego_spaces SET data = data || '{"review":{"state":"approved"}}' WHERE id = 'zz-review-1';
  SELECT data INTO v_data FROM public.spacego_spaces WHERE id = 'zz-review-1';
  IF v_data -> 'review' ->> 'state' <> 'draft' THEN RAISE EXCEPTION 'owner forged review state'; END IF;

  -- Submitting needs a photo.
  v_failed := false;
  BEGIN
    PERFORM public.spacego_submit_listing_for_review('zz-review-1');
  EXCEPTION WHEN invalid_parameter_value THEN v_failed := true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'submitted without photos'; END IF;

  UPDATE public.spacego_spaces
  SET data = data || '{"images":[{"url":"https://images.unsplash.com/photo-1497366216548-37526070297c","caption":"Desk","is_cover":true}]}'
  WHERE id = 'zz-review-1';

  -- Another owner cannot submit it.
  PERFORM pg_temp.act_as(other_id);
  v_failed := false;
  BEGIN
    PERFORM public.spacego_submit_listing_for_review('zz-review-1');
  EXCEPTION WHEN no_data_found THEN v_failed := true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'another owner submitted the listing'; END IF;

  PERFORM pg_temp.act_as(owner_id);
  v_data := public.spacego_submit_listing_for_review('zz-review-1');
  IF v_data -> 'review' ->> 'state' <> 'pending' OR v_data ->> 'status' <> 'draft' THEN
    RAISE EXCEPTION 'submit did not set pending/draft';
  END IF;

  -- Owners cannot decide.
  v_failed := false;
  BEGIN
    PERFORM public.spacego_review_listing('zz-review-1', 'approve');
  EXCEPTION WHEN insufficient_privilege THEN v_failed := true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'owner approved own listing'; END IF;

  -- Admin: a reason is required for anything but approval.
  PERFORM pg_temp.act_as(admin_id);
  v_failed := false;
  BEGIN
    PERFORM public.spacego_review_listing('zz-review-1', 'request_changes', 'short');
  EXCEPTION WHEN invalid_parameter_value THEN v_failed := true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'changes requested without a proper reason'; END IF;

  v_data := public.spacego_review_listing('zz-review-1', 'request_changes', 'Please add a photo of the desks themselves.');
  IF v_data -> 'review' ->> 'state' <> 'changes_requested' THEN RAISE EXCEPTION 'request_changes failed'; END IF;

  -- The owner was notified.
  PERFORM pg_temp.act_as(owner_id);
  SELECT count(*) INTO v_count FROM public.spacego_notifications
  WHERE data ->> 'user_id' = owner_id AND data ->> 'message' LIKE '%needs changes%';
  IF v_count <> 1 THEN RAISE EXCEPTION 'owner not notified of requested changes (%)', v_count; END IF;

  -- Resubmit, then approve: now public.
  PERFORM public.spacego_submit_listing_for_review('zz-review-1');
  PERFORM pg_temp.act_as(admin_id);
  v_data := public.spacego_review_listing('zz-review-1', 'approve');
  IF v_data ->> 'status' <> 'published' OR v_data -> 'review' ->> 'state' <> 'approved' THEN
    RAISE EXCEPTION 'approve did not publish';
  END IF;
  SELECT count(*) INTO v_count FROM public.spacego_public_spaces WHERE id = 'zz-review-1';
  IF v_count <> 1 THEN RAISE EXCEPTION 'approved listing not public'; END IF;
  SELECT count(*) INTO v_count FROM public.spacego_public_spaces WHERE id = 'zz-review-1' AND data ? 'review';
  IF v_count <> 0 THEN RAISE EXCEPTION 'public view exposes review data'; END IF;

  -- Owner: price change keeps it live; title change sends it back to review.
  PERFORM pg_temp.act_as(owner_id);
  UPDATE public.spacego_spaces SET data = jsonb_set(data, '{pricing,daily}', '550') WHERE id = 'zz-review-1';
  SELECT data INTO v_data FROM public.spacego_spaces WHERE id = 'zz-review-1';
  IF v_data ->> 'status' <> 'published' THEN RAISE EXCEPTION 'price edit unpublished the listing'; END IF;

  UPDATE public.spacego_spaces SET data = data || '{"title":"Renamed fixture desk"}' WHERE id = 'zz-review-1';
  SELECT data INTO v_data FROM public.spacego_spaces WHERE id = 'zz-review-1';
  IF v_data ->> 'status' <> 'draft' OR v_data -> 'review' ->> 'state' <> 'pending' THEN
    RAISE EXCEPTION 'key-fact edit did not return the listing to review';
  END IF;

  -- Owner can unpublish an approved listing and publish it again.
  PERFORM pg_temp.act_as(admin_id);
  PERFORM public.spacego_review_listing('zz-review-1', 'approve');
  PERFORM pg_temp.act_as(owner_id);
  UPDATE public.spacego_spaces SET data = data || '{"status":"draft"}' WHERE id = 'zz-review-1';
  UPDATE public.spacego_spaces SET data = data || '{"status":"published"}' WHERE id = 'zz-review-1';

  -- Hiding the street address keeps it live; choosing to show it publicly is reviewed.
  UPDATE public.spacego_spaces SET data = jsonb_set(data, '{location,address_visibility}', '"approximate"') WHERE id = 'zz-review-1';
  SELECT data INTO v_data FROM public.spacego_spaces WHERE id = 'zz-review-1';
  IF v_data ->> 'status' <> 'published' THEN RAISE EXCEPTION 'hiding the address unpublished the listing'; END IF;
  UPDATE public.spacego_spaces SET data = jsonb_set(data, '{location,address_visibility}', '"exact"') WHERE id = 'zz-review-1';
  SELECT data INTO v_data FROM public.spacego_spaces WHERE id = 'zz-review-1';
  IF v_data ->> 'status' <> 'draft' OR v_data -> 'review' ->> 'state' <> 'pending' THEN
    RAISE EXCEPTION 'showing the street address publicly skipped review';
  END IF;
  PERFORM pg_temp.act_as(admin_id);
  PERFORM public.spacego_review_listing('zz-review-1', 'approve');

  -- Suspension: offline, and the owner cannot resubmit.
  PERFORM pg_temp.act_as(admin_id);
  v_data := public.spacego_review_listing('zz-review-1', 'suspend', 'Reported: the address does not exist.');
  IF v_data ->> 'status' <> 'draft' THEN RAISE EXCEPTION 'suspend left the listing live'; END IF;
  PERFORM pg_temp.act_as(owner_id);
  v_failed := false;
  BEGIN
    PERFORM public.spacego_submit_listing_for_review('zz-review-1');
  EXCEPTION WHEN invalid_parameter_value THEN v_failed := true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'suspended listing was resubmitted'; END IF;
  v_failed := false;
  BEGIN
    UPDATE public.spacego_spaces SET data = data || '{"status":"published"}' WHERE id = 'zz-review-1';
  EXCEPTION WHEN insufficient_privilege THEN v_failed := true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'owner republished a suspended listing'; END IF;

  -- Audit log: admins see it, owners do not.
  SELECT count(*) INTO v_count FROM public.spacego_listing_review_events WHERE space_id = 'zz-review-1';
  IF v_count <> 0 THEN RAISE EXCEPTION 'owner can read the audit log'; END IF;
  PERFORM pg_temp.act_as(admin_id);
  SELECT count(*) INTO v_count FROM public.spacego_listing_review_events WHERE space_id = 'zz-review-1';
  IF v_count < 8 THEN RAISE EXCEPTION 'audit log incomplete: % events', v_count; END IF;
END
$checks$;

RESET ROLE;

DO $grandfather$
BEGIN
  -- Rows published before the review step count as approved.
  IF public.spacego_review_state('{"status":"published"}') <> 'approved'
     OR public.spacego_review_state('{"status":"draft"}') <> 'draft' THEN
    RAISE EXCEPTION 'grandfathering rule wrong';
  END IF;
END
$grandfather$;
DO $done$ BEGIN RAISE NOTICE 'listing review: all checks passed'; END $done$;
ROLLBACK;
