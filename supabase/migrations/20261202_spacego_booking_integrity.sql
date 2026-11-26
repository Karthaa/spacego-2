-- SpaceGo: no duplicate booking requests, and a history of every booking
-- status change.
--
-- Forward-only, non-destructive, re-runnable. Apply AFTER
-- 20261121_spacego_rls_hardening.sql.
--
--   * A guest can't hold two pending or confirmed bookings for the same space
--     at overlapping times (for example by pressing "Request to book" twice).
--     Other guests' pending requests are unaffected; confirmed overlaps were
--     already refused by spacego_create_booking.
--   * Every insert and status change on spacego_bookings is appended to
--     spacego_booking_events (who, when, from, to). The guest and the host of
--     a booking, and admins, can read its history. Nobody can write to it
--     directly.
-- Existing bookings are not modified or checked retroactively.
--
-- Rollback (manual): DROP TRIGGER spacego_booking_integrity ON
-- public.spacego_bookings; DROP FUNCTION public.spacego_booking_integrity();
-- (keep spacego_booking_events, it is an audit log).

DO $$
BEGIN
  IF to_regprocedure('public.spacego_try_timestamptz(text)') IS NULL THEN
    RAISE EXCEPTION 'Apply 20261121_spacego_rls_hardening.sql first';
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.spacego_booking_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  booking_id text NOT NULL,
  actor_id uuid,
  from_status text,
  to_status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS spacego_booking_events_booking_idx
  ON public.spacego_booking_events (booking_id, created_at);

ALTER TABLE public.spacego_booking_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.spacego_booking_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.spacego_booking_events TO authenticated;

DROP POLICY IF EXISTS spacego_booking_events_read ON public.spacego_booking_events;
CREATE POLICY spacego_booking_events_read
  ON public.spacego_booking_events
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.spacego_bookings b
      WHERE b.id = spacego_booking_events.booking_id
        AND (b.data ->> 'user_id' = (SELECT auth.uid())::text
             OR b.data ->> 'owner_id' = (SELECT auth.uid())::text)
    )
  );

COMMENT ON TABLE public.spacego_booking_events IS
  'Append-only history of booking status changes, written by a trigger.';

CREATE OR REPLACE FUNCTION public.spacego_booking_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_start timestamptz;
  v_end timestamptz;
BEGIN
  IF TG_OP = 'INSERT' AND COALESCE(NEW.data ->> 'status', '') IN ('pending', 'approved') THEN
    v_start := public.spacego_try_timestamptz(NEW.data ->> 'start_date');
    v_end := public.spacego_try_timestamptz(NEW.data ->> 'end_date');
    IF v_start IS NOT NULL AND v_end IS NOT NULL AND EXISTS (
      SELECT 1
      FROM public.spacego_bookings b
      WHERE b.id <> NEW.id
        AND b.data ->> 'user_id' = NEW.data ->> 'user_id'
        AND b.data ->> 'space_id' = NEW.data ->> 'space_id'
        AND COALESCE(b.data ->> 'status', '') IN ('pending', 'approved')
        AND public.spacego_try_timestamptz(b.data ->> 'start_date') < v_end
        AND public.spacego_try_timestamptz(b.data ->> 'end_date') > v_start
    ) THEN
      RAISE EXCEPTION 'You already have a request or booking for this space at this time'
        USING ERRCODE = '23505';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.spacego_booking_events (booking_id, actor_id, from_status, to_status)
    VALUES (NEW.id, auth.uid(), NULL, COALESCE(NEW.data ->> 'status', 'unknown'));
  ELSIF NEW.data ->> 'status' IS DISTINCT FROM OLD.data ->> 'status' THEN
    INSERT INTO public.spacego_booking_events (booking_id, actor_id, from_status, to_status)
    VALUES (NEW.id, auth.uid(), OLD.data ->> 'status', COALESCE(NEW.data ->> 'status', 'unknown'));
  END IF;

  RETURN NULL;
END
$$;

REVOKE ALL ON FUNCTION public.spacego_booking_integrity() FROM PUBLIC, anon, authenticated;

-- AFTER trigger: the row exists when the history is written, and a refused
-- duplicate rolls the whole insert back.
DROP TRIGGER IF EXISTS spacego_booking_integrity ON public.spacego_bookings;
CREATE TRIGGER spacego_booking_integrity
  AFTER INSERT OR UPDATE ON public.spacego_bookings
  FOR EACH ROW EXECUTE FUNCTION public.spacego_booking_integrity();

NOTIFY pgrst, 'reload schema';
