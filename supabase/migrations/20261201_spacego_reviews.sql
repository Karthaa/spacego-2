-- SpaceGo: genuine reviews, only from guests whose booking has ended.
--
-- Forward-only, non-destructive, re-runnable. Apply AFTER
-- 20261127_spacego_listing_review.sql (moderation is written to its audit
-- table).
--
-- Rules
--   * One review per booking (unique booking_id), written only through
--     spacego_submit_review() by the guest on that booking, once the booking
--     was confirmed ('approved' or 'completed') and its end date has passed.
--   * Rating 1 to 5 and 20 to 2000 characters of text.
--   * The host of the space can add or edit one public response.
--   * Admins can hide a review (with a reason) or restore it; both are logged.
--   * The public sees published reviews of published listings through
--     spacego_public_reviews, with the author's first name only, and an
--     aggregate in spacego_public_review_summary. No other column is public.
--   * Nothing here touches the legacy data.rating / data.review_count fields;
--     the app no longer displays them.
--
-- Rollback (manual): DROP VIEW spacego_public_review_summary,
-- spacego_public_reviews; DROP FUNCTION spacego_submit_review(text,integer,text),
-- spacego_respond_to_review(uuid,text), spacego_moderate_review(uuid,text,text);
-- DROP TABLE spacego_space_reviews (this deletes reviews; export them first).

DO $$
BEGIN
  IF to_regclass('public.spacego_listing_review_events') IS NULL
     OR to_regprocedure('public.spacego_create_notification(text,text,text,text,text)') IS NULL THEN
    RAISE EXCEPTION 'Apply 20261121 and 20261127 SpaceGo migrations first';
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.spacego_space_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id text NOT NULL UNIQUE REFERENCES public.spacego_bookings (id) ON DELETE CASCADE,
  space_id text NOT NULL,
  author_id uuid NOT NULL,
  author_name text NOT NULL DEFAULT '',
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body text NOT NULL CHECK (char_length(body) BETWEEN 20 AND 2000),
  host_response text CHECK (host_response IS NULL OR char_length(host_response) BETWEEN 1 AND 2000),
  host_responded_at timestamptz,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'hidden')),
  moderation_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS spacego_space_reviews_space_idx
  ON public.spacego_space_reviews (space_id, created_at DESC);
CREATE INDEX IF NOT EXISTS spacego_space_reviews_author_idx
  ON public.spacego_space_reviews (author_id);

ALTER TABLE public.spacego_space_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.spacego_space_reviews FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.spacego_space_reviews TO authenticated;

-- Authors see their own reviews (hidden ones too), hosts see reviews of their
-- spaces, admins see everything. Writes only go through the functions below.
DROP POLICY IF EXISTS spacego_space_reviews_read ON public.spacego_space_reviews;
CREATE POLICY spacego_space_reviews_read
  ON public.spacego_space_reviews
  FOR SELECT TO authenticated
  USING (
    author_id = (SELECT auth.uid())
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.spacego_spaces s
      WHERE s.id = spacego_space_reviews.space_id
        AND s.data ->> 'owner_id' = (SELECT auth.uid())::text
    )
  );

COMMENT ON TABLE public.spacego_space_reviews IS
  'Guest reviews, one per ended confirmed booking. Written only by SECURITY DEFINER functions.';

-- Public read models ----------------------------------------------------------
CREATE OR REPLACE VIEW public.spacego_public_reviews
WITH (security_barrier = true, security_invoker = false)
AS
SELECT
  r.id,
  r.space_id,
  r.author_name,
  r.rating,
  r.body,
  r.host_response,
  r.host_responded_at,
  r.created_at
FROM public.spacego_space_reviews r
JOIN public.spacego_spaces s
  ON s.id = r.space_id
 AND s.data ->> 'status' = 'published'
WHERE r.status = 'published';

REVOKE ALL ON TABLE public.spacego_public_reviews FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.spacego_public_reviews TO anon, authenticated;

CREATE OR REPLACE VIEW public.spacego_public_review_summary
WITH (security_barrier = true, security_invoker = false)
AS
SELECT
  v.space_id,
  count(*)::integer AS review_count,
  round(avg(v.rating)::numeric, 1) AS average_rating
FROM public.spacego_public_reviews v
GROUP BY v.space_id;

REVOKE ALL ON TABLE public.spacego_public_review_summary FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.spacego_public_review_summary TO anon, authenticated;

-- Guest: write a review --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.spacego_submit_review(
  p_booking_id text,
  p_rating integer,
  p_body text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_booking jsonb;
  v_end timestamptz;
  v_body text := btrim(COALESCE(p_body, ''));
  v_name text;
  v_id uuid;
  v_space jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to write a review' USING ERRCODE = '42501';
  END IF;

  SELECT b.data INTO v_booking
  FROM public.spacego_bookings b
  WHERE b.id = p_booking_id
  FOR UPDATE;

  IF v_booking IS NULL OR v_booking ->> 'user_id' IS DISTINCT FROM v_uid::text THEN
    RAISE EXCEPTION 'Booking not found' USING ERRCODE = 'P0002';
  END IF;

  IF COALESCE(v_booking ->> 'status', '') NOT IN ('approved', 'completed') THEN
    RAISE EXCEPTION 'Only confirmed bookings can be reviewed' USING ERRCODE = '42501';
  END IF;

  BEGIN
    v_end := (v_booking ->> 'end_date')::timestamptz;
  EXCEPTION WHEN others THEN
    v_end := NULL;
  END;
  IF v_end IS NULL OR v_end > now() THEN
    RAISE EXCEPTION 'You can review this space once your booking has ended' USING ERRCODE = '22023';
  END IF;

  IF p_rating IS NULL OR p_rating NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'Choose a rating from 1 to 5' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_body) NOT BETWEEN 20 AND 2000 THEN
    RAISE EXCEPTION 'Write between 20 and 2000 characters' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (SELECT 1 FROM public.spacego_space_reviews r WHERE r.booking_id = p_booking_id) THEN
    RAISE EXCEPTION 'You have already reviewed this booking' USING ERRCODE = '23505';
  END IF;

  SELECT left(split_part(btrim(COALESCE(p.full_name, '')), ' ', 1), 40) INTO v_name
  FROM public.profiles p WHERE p.id = v_uid;

  INSERT INTO public.spacego_space_reviews (booking_id, space_id, author_id, author_name, rating, body)
  VALUES (p_booking_id, v_booking ->> 'space_id', v_uid, COALESCE(NULLIF(v_name, ''), 'Guest'), p_rating, v_body)
  RETURNING id INTO v_id;

  SELECT s.data INTO v_space FROM public.spacego_spaces s WHERE s.id = v_booking ->> 'space_id';
  IF v_space ->> 'owner_id' IS NOT NULL THEN
    PERFORM public.spacego_create_notification(
      v_space ->> 'owner_id',
      'New review',
      COALESCE(NULLIF(v_name, ''), 'A guest') || ' reviewed ' || COALESCE(v_space ->> 'title', 'your space')
        || ' (' || p_rating || ' of 5).',
      'system',
      '/spaces/' || (v_booking ->> 'space_id')
    );
  END IF;

  RETURN v_id;
END
$$;

-- Host: respond publicly ------------------------------------------------------
CREATE OR REPLACE FUNCTION public.spacego_respond_to_review(p_review_id uuid, p_response text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_text text := btrim(COALESCE(p_response, ''));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to respond' USING ERRCODE = '42501';
  END IF;
  IF char_length(v_text) NOT BETWEEN 1 AND 2000 THEN
    RAISE EXCEPTION 'Write between 1 and 2000 characters' USING ERRCODE = '22023';
  END IF;

  UPDATE public.spacego_space_reviews r
  SET host_response = v_text, host_responded_at = now(), updated_at = now()
  WHERE r.id = p_review_id
    AND EXISTS (
      SELECT 1 FROM public.spacego_spaces s
      WHERE s.id = r.space_id AND s.data ->> 'owner_id' = v_uid::text
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only the host of this space can respond' USING ERRCODE = '42501';
  END IF;
END
$$;

-- Admin: hide or restore ------------------------------------------------------
CREATE OR REPLACE FUNCTION public.spacego_moderate_review(p_review_id uuid, p_action text, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_reason text := NULLIF(btrim(COALESCE(p_reason, '')), '');
  v_review public.spacego_space_reviews%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only SpaceGo admins can moderate reviews' USING ERRCODE = '42501';
  END IF;
  IF p_action NOT IN ('hide', 'restore') THEN
    RAISE EXCEPTION 'Unknown action' USING ERRCODE = '22023';
  END IF;
  IF p_action = 'hide' AND (v_reason IS NULL OR char_length(v_reason) < 10) THEN
    RAISE EXCEPTION 'Give a reason of at least 10 characters' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_review FROM public.spacego_space_reviews WHERE id = p_review_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Review not found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.spacego_space_reviews
  SET status = CASE p_action WHEN 'hide' THEN 'hidden' ELSE 'published' END,
      moderation_reason = CASE p_action WHEN 'hide' THEN left(v_reason, 1000) ELSE NULL END,
      updated_at = now()
  WHERE id = p_review_id;

  INSERT INTO public.spacego_listing_review_events (space_id, actor_id, action, from_state, to_state, reason)
  VALUES (v_review.space_id, auth.uid(), 'guest_review_' || p_action, v_review.status,
          CASE p_action WHEN 'hide' THEN 'hidden' ELSE 'published' END,
          left(COALESCE(v_reason, ''), 1000));
END
$$;

REVOKE ALL ON FUNCTION public.spacego_submit_review(text, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.spacego_respond_to_review(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.spacego_moderate_review(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.spacego_submit_review(text, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.spacego_respond_to_review(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.spacego_moderate_review(uuid, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
