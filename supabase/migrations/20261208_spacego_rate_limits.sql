-- SpaceGo: rate limits for the forms anyone can send, and for the signed-in
-- requests that notify other people.
--
-- Forward-only. Run as ONE transaction in the Supabase SQL editor, staging
-- first, then production, after 20261207_spacego_security_hardening.sql.
-- Safe to re-run. It changes no rows and no existing function: the limits run
-- in a BEFORE INSERT trigger on the four tables these requests write to, so
-- spacego_submit_enquiry(), spacego_log_demand(), spacego_create_booking() and
-- spacego_submit_activation() keep their code, arguments and grants. Check it
-- afterwards with supabase/tests/rate_limits_test.sql.
--
-- Why in the database: the browser calls these functions directly on Supabase
-- with the public key, so a limit in the Next.js app or on Cloudflare would
-- never see those requests (see 20261121, section 15B).
--
-- Limits (fixed windows, in UTC):
--
--   Enquiries (spacego_submit_enquiry, open to everyone)
--     5 an hour for one email address
--     10 an hour and 30 a day for one signed-in account
--     20 every 10 minutes and 200 a day for all signed-out visitors together
--   Over a limit the enquiry is refused (SQLSTATE P0001, HINT 'rate_limited')
--   with a message the form shows as it is.
--
--   Search logging (spacego_log_demand, open to everyone, analytics only)
--     10 every 10 minutes for the same place, type and seat count
--     60 a minute and 10,000 a day for everyone together
--   Over a limit the search is not logged. The call still succeeds, so search
--   itself never breaks.
--
--   Booking requests (spacego_create_booking): 20 an hour, 60 a day per account
--   Property activation requests (spacego_submit_activation): 10 an hour,
--   30 a day per account. Both are refused like enquiries.
--
-- Only requests that come through the Supabase API as anon or authenticated
-- are counted. The SQL editor, migrations and the service role are not.
--
-- What it doesn't do: it keeps no IP address (search logging is anonymous by
-- design), so someone sending many signed-out enquiries can use up the shared
-- signed-out limit for a while. Signed-in users still get through on their
-- own limit. The stronger fix stays the one in 20261121 section 15B:
-- Cloudflare Turnstile checked on a server route.
--
-- The counters live in public.spacego_rate_limits: no API access (RLS on, no
-- policies, privileges revoked), and windows that started more than three
-- days ago are deleted as new requests come in. Email buckets hold a SHA-256
-- of the address, never the address.
--
-- To change a limit, edit it in spacego_rate_limit_guard() below and run the
-- CREATE OR REPLACE FUNCTION again.
--
-- Undo (manual, in one transaction):
--   DROP TRIGGER IF EXISTS spacego_rate_limit ON public.spacego_enquiries;
--   DROP TRIGGER IF EXISTS spacego_rate_limit ON public.spacego_demand_searches;
--   DROP TRIGGER IF EXISTS spacego_rate_limit ON public.spacego_bookings;
--   DROP TRIGGER IF EXISTS spacego_rate_limit ON public.spacego_activations;
--   DROP FUNCTION IF EXISTS public.spacego_rate_limit_guard();
--   DROP FUNCTION IF EXISTS public.spacego_rate_limit_hit(text, interval, integer);
--   DROP FUNCTION IF EXISTS public.spacego_rate_limit_cleanup();
--   DROP TABLE IF EXISTS public.spacego_rate_limits;

BEGIN;

-- 1. Counters. One row per bucket and window.
CREATE TABLE IF NOT EXISTS public.spacego_rate_limits (
  bucket text NOT NULL,
  window_seconds integer NOT NULL CHECK (window_seconds > 0),
  window_start timestamptz NOT NULL,
  hits integer NOT NULL DEFAULT 0 CHECK (hits >= 0),
  PRIMARY KEY (bucket, window_seconds, window_start)
);

CREATE INDEX IF NOT EXISTS spacego_rate_limits_window_start_idx
  ON public.spacego_rate_limits (window_start);

ALTER TABLE public.spacego_rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies: only the functions below (and the service role) touch it.
REVOKE ALL ON TABLE public.spacego_rate_limits FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.spacego_rate_limits IS
  'Request counters for spacego_rate_limit_guard(). No API access. Rows older than three days are deleted automatically.';

-- 2. Delete windows that started more than three days ago (the longest window
--    is one day).
CREATE OR REPLACE FUNCTION public.spacego_rate_limit_cleanup()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.spacego_rate_limits
  WHERE window_start < now() - interval '3 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$fn$;

REVOKE ALL ON FUNCTION public.spacego_rate_limit_cleanup() FROM PUBLIC, anon, authenticated;

-- 3. Count one request in a bucket's current window. True while the count is
--    within the limit.
CREATE OR REPLACE FUNCTION public.spacego_rate_limit_hit(
  p_bucket text,
  p_window interval,
  p_limit integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_seconds integer;
  v_start timestamptz;
  v_hits integer;
BEGIN
  v_seconds := extract(epoch FROM p_window)::integer;
  IF p_bucket IS NULL OR btrim(p_bucket) = '' OR v_seconds IS NULL OR v_seconds < 1
     OR p_limit IS NULL OR p_limit < 0 THEN
    RAISE EXCEPTION 'Invalid rate limit' USING ERRCODE = '22023';
  END IF;

  v_start := to_timestamp(floor(extract(epoch FROM now()) / v_seconds) * v_seconds);

  INSERT INTO public.spacego_rate_limits AS r (bucket, window_seconds, window_start, hits)
  VALUES (p_bucket, v_seconds, v_start, 1)
  ON CONFLICT (bucket, window_seconds, window_start)
  DO UPDATE SET hits = r.hits + 1
  RETURNING r.hits INTO v_hits;

  -- About one request in a hundred also clears out old windows.
  IF random() < 0.01 THEN
    PERFORM public.spacego_rate_limit_cleanup();
  END IF;

  RETURN v_hits <= p_limit;
END;
$fn$;

REVOKE ALL ON FUNCTION public.spacego_rate_limit_hit(text, interval, integer)
  FROM PUBLIC, anon, authenticated;

-- 4. The trigger. Checks run in order and stop at the first limit reached, so
--    a flood of one repeated request uses up only its own bucket.
CREATE OR REPLACE FUNCTION public.spacego_rate_limit_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  -- The same lookup as auth.role(), written out so this doesn't depend on it.
  v_role text := COALESCE(
    NULLIF(current_setting('request.jwt.claim.role', true), ''),
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
  );
  v_uid uuid := auth.uid();
  v_email text;
  v_key text;
BEGIN
  -- Only API requests made with the public key or a user's session.
  IF v_role IS NULL OR v_role NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'spacego_enquiries' THEN
    v_email := lower(btrim(COALESCE(NEW.data ->> 'email', '')));
    IF v_email <> '' AND NOT public.spacego_rate_limit_hit(
         'enquiry:email:' || encode(sha256(convert_to(v_email, 'UTF8')), 'hex'),
         interval '1 hour', 5) THEN
      RAISE EXCEPTION 'You have sent several enquiries with this email address in the last hour. Please wait a while before sending another.'
        USING ERRCODE = 'P0001', HINT = 'rate_limited';
    END IF;

    IF v_uid IS NOT NULL THEN
      IF NOT public.spacego_rate_limit_hit('enquiry:user:' || v_uid::text, interval '1 hour', 10)
         OR NOT public.spacego_rate_limit_hit('enquiry:user:' || v_uid::text, interval '1 day', 30) THEN
        RAISE EXCEPTION 'You have sent a lot of enquiries recently. Please wait a while before sending another.'
          USING ERRCODE = 'P0001', HINT = 'rate_limited';
      END IF;
    ELSE
      IF NOT public.spacego_rate_limit_hit('enquiry:anon', interval '10 minutes', 20)
         OR NOT public.spacego_rate_limit_hit('enquiry:anon', interval '1 day', 200) THEN
        RAISE EXCEPTION 'SpaceGo is getting a lot of enquiries right now. Please try again in a few minutes, or sign in and send it from your account.'
          USING ERRCODE = 'P0001', HINT = 'rate_limited';
      END IF;
    END IF;
    RETURN NEW;

  ELSIF TG_TABLE_NAME = 'spacego_demand_searches' THEN
    v_key := encode(sha256(convert_to(
      lower(COALESCE(NEW.data ->> 'location_query', '')) || '|' ||
      COALESCE(NEW.data ->> 'category', '') || '|' ||
      COALESCE(NEW.data ->> 'seats', ''), 'UTF8')), 'hex');
    IF NOT public.spacego_rate_limit_hit('demand:query:' || v_key, interval '10 minutes', 10) THEN
      RETURN NULL;  -- skip logging; the search itself is unaffected
    END IF;
    IF NOT public.spacego_rate_limit_hit('demand:all', interval '1 minute', 60) THEN
      RETURN NULL;
    END IF;
    IF NOT public.spacego_rate_limit_hit('demand:all', interval '1 day', 10000) THEN
      RETURN NULL;
    END IF;
    RETURN NEW;

  ELSIF TG_TABLE_NAME = 'spacego_bookings' THEN
    IF v_uid IS NULL THEN
      RETURN NEW;  -- spacego_create_booking() already requires sign-in
    END IF;
    IF NOT public.spacego_rate_limit_hit('booking:user:' || v_uid::text, interval '1 hour', 20)
       OR NOT public.spacego_rate_limit_hit('booking:user:' || v_uid::text, interval '1 day', 60) THEN
      RAISE EXCEPTION 'You have sent a lot of booking requests recently. Please wait a while before sending another.'
        USING ERRCODE = 'P0001', HINT = 'rate_limited';
    END IF;
    RETURN NEW;

  ELSIF TG_TABLE_NAME = 'spacego_activations' THEN
    IF v_uid IS NULL THEN
      RETURN NEW;  -- spacego_submit_activation() already requires sign-in
    END IF;
    IF NOT public.spacego_rate_limit_hit('activation:user:' || v_uid::text, interval '1 hour', 10)
       OR NOT public.spacego_rate_limit_hit('activation:user:' || v_uid::text, interval '1 day', 30) THEN
      RAISE EXCEPTION 'You have sent a lot of property requests recently. Please wait a while before sending another.'
        USING ERRCODE = 'P0001', HINT = 'rate_limited';
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.spacego_rate_limit_guard() FROM PUBLIC, anon, authenticated;

-- 5. Attach it. It fires after spacego_enforce_payload_id (triggers on the
--    same event run in name order), so malformed rows are refused first.
DROP TRIGGER IF EXISTS spacego_rate_limit ON public.spacego_enquiries;
CREATE TRIGGER spacego_rate_limit
  BEFORE INSERT ON public.spacego_enquiries
  FOR EACH ROW EXECUTE FUNCTION public.spacego_rate_limit_guard();

DROP TRIGGER IF EXISTS spacego_rate_limit ON public.spacego_demand_searches;
CREATE TRIGGER spacego_rate_limit
  BEFORE INSERT ON public.spacego_demand_searches
  FOR EACH ROW EXECUTE FUNCTION public.spacego_rate_limit_guard();

DROP TRIGGER IF EXISTS spacego_rate_limit ON public.spacego_bookings;
CREATE TRIGGER spacego_rate_limit
  BEFORE INSERT ON public.spacego_bookings
  FOR EACH ROW EXECUTE FUNCTION public.spacego_rate_limit_guard();

DROP TRIGGER IF EXISTS spacego_rate_limit ON public.spacego_activations;
CREATE TRIGGER spacego_rate_limit
  BEFORE INSERT ON public.spacego_activations
  FOR EACH ROW EXECUTE FUNCTION public.spacego_rate_limit_guard();

COMMIT;
