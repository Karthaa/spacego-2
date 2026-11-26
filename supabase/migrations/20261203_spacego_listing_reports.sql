-- SpaceGo: guests can report a listing; admins work through the reports.
--
-- Forward-only, non-destructive, re-runnable. Apply AFTER
-- 20261127_spacego_listing_review.sql (decisions go to its audit table).
--
--   * spacego_report_listing(space, reason, details): signed-in users, not the
--     listing's own host. One open report per person per listing, at most 10
--     reports per person per day. Admins get a notification.
--   * spacego_resolve_report(report, 'resolved' | 'dismissed', note): admins
--     only, with a note; logged to spacego_listing_review_events. Suspending
--     the listing itself still goes through spacego_review_listing().
--   * Reporters can read their own reports; admins read all. Nobody writes the
--     table directly.
--
-- Rollback (manual): DROP FUNCTION spacego_report_listing(text,text,text),
-- spacego_resolve_report(uuid,text,text); keep the table (it is a record).

DO $$
BEGIN
  IF to_regclass('public.spacego_listing_review_events') IS NULL
     OR to_regprocedure('public.spacego_create_notification(text,text,text,text,text)') IS NULL THEN
    RAISE EXCEPTION 'Apply 20261121 and 20261127 SpaceGo migrations first';
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.spacego_listing_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id text NOT NULL,
  reporter_id uuid NOT NULL,
  reason text NOT NULL CHECK (reason IN ('not_real', 'wrong_info', 'unsafe', 'scam', 'offensive', 'other')),
  details text NOT NULL DEFAULT '' CHECK (char_length(details) <= 2000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  resolution_note text,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS spacego_listing_reports_one_open_idx
  ON public.spacego_listing_reports (space_id, reporter_id) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS spacego_listing_reports_status_idx
  ON public.spacego_listing_reports (status, created_at);
CREATE INDEX IF NOT EXISTS spacego_listing_reports_reporter_idx
  ON public.spacego_listing_reports (reporter_id, created_at);

ALTER TABLE public.spacego_listing_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.spacego_listing_reports FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.spacego_listing_reports TO authenticated;

DROP POLICY IF EXISTS spacego_listing_reports_read ON public.spacego_listing_reports;
CREATE POLICY spacego_listing_reports_read
  ON public.spacego_listing_reports
  FOR SELECT TO authenticated
  USING (reporter_id = (SELECT auth.uid()) OR public.is_admin());

COMMENT ON TABLE public.spacego_listing_reports IS
  'Reports about listings from signed-in users. Written only by SECURITY DEFINER functions.';

CREATE OR REPLACE FUNCTION public.spacego_report_listing(p_space_id text, p_reason text, p_details text DEFAULT '')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_space jsonb;
  v_details text := btrim(COALESCE(p_details, ''));
  v_id uuid;
  v_admin record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to report a listing' USING ERRCODE = '42501';
  END IF;
  IF p_reason IS NULL OR p_reason NOT IN ('not_real', 'wrong_info', 'unsafe', 'scam', 'offensive', 'other') THEN
    RAISE EXCEPTION 'Choose a reason' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_details) > 2000 THEN
    RAISE EXCEPTION 'Keep the details under 2000 characters' USING ERRCODE = '22023';
  END IF;
  IF p_reason = 'other' AND char_length(v_details) < 10 THEN
    RAISE EXCEPTION 'Tell us what is wrong in at least 10 characters' USING ERRCODE = '22023';
  END IF;

  SELECT s.data INTO v_space FROM public.spacego_spaces s
  WHERE s.id = p_space_id AND s.data ->> 'status' = 'published';
  IF v_space IS NULL THEN
    RAISE EXCEPTION 'Listing not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_space ->> 'owner_id' = v_uid::text THEN
    RAISE EXCEPTION 'You can''t report your own listing' USING ERRCODE = '42501';
  END IF;

  IF (SELECT count(*) FROM public.spacego_listing_reports r
      WHERE r.reporter_id = v_uid AND r.created_at > now() - interval '1 day') >= 10 THEN
    RAISE EXCEPTION 'You have sent a lot of reports today. Please try again tomorrow.' USING ERRCODE = '54000';
  END IF;

  BEGIN
    INSERT INTO public.spacego_listing_reports (space_id, reporter_id, reason, details)
    VALUES (p_space_id, v_uid, p_reason, v_details)
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'You have already reported this listing. SpaceGo is looking into it.' USING ERRCODE = '23505';
  END;

  FOR v_admin IN SELECT p.id FROM public.profiles p WHERE p.role = 'admin' LOOP
    PERFORM public.spacego_create_notification(
      v_admin.id::text,
      'Listing reported',
      left(COALESCE(v_space ->> 'title', 'A listing'), 200) || ' was reported (' || replace(p_reason, '_', ' ') || ').',
      'system',
      '/admin/spaces'
    );
  END LOOP;

  RETURN v_id;
END
$$;

CREATE OR REPLACE FUNCTION public.spacego_resolve_report(p_report_id uuid, p_status text, p_note text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_note text := btrim(COALESCE(p_note, ''));
  v_report public.spacego_listing_reports%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only SpaceGo admins can resolve reports' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('resolved', 'dismissed') THEN
    RAISE EXCEPTION 'Unknown status' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_note) < 5 OR char_length(v_note) > 1000 THEN
    RAISE EXCEPTION 'Add a note of 5 to 1000 characters' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_report FROM public.spacego_listing_reports WHERE id = p_report_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_report.status <> 'open' THEN
    RAISE EXCEPTION 'This report is already closed' USING ERRCODE = '22023';
  END IF;

  UPDATE public.spacego_listing_reports
  SET status = p_status, resolution_note = v_note, resolved_by = auth.uid(), resolved_at = now()
  WHERE id = p_report_id;

  INSERT INTO public.spacego_listing_review_events (space_id, actor_id, action, from_state, to_state, reason)
  VALUES (v_report.space_id, auth.uid(), 'report_' || p_status, 'open', p_status,
          left(v_report.reason || ': ' || v_note, 1000));
END
$$;

REVOKE ALL ON FUNCTION public.spacego_report_listing(text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.spacego_resolve_report(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.spacego_report_listing(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.spacego_resolve_report(uuid, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
