-- SpaceGo: halls and event venues are priced per booking, not per guest.
--
-- Forward-only. Run as ONE transaction in the Supabase SQL editor, staging first.
-- Needs 20261205_spacego_new_types_and_demo_flag.sql. Safe to re-run.
--
-- Until now spacego_create_booking multiplied every hourly or daily rate by the
-- number of seats. That fits desks, but an auditorium or event venue is hired
-- whole: its rate covers the venue for the time booked, whatever the guest
-- count. For those two types the total is now rate x duration (plus the 10%
-- service fee). The guest count is still checked against capacity and saved on
-- the booking. Every other type, parking included (priced per vehicle), is
-- unchanged. Bookings made before this change keep their totals.
--
-- The function is rewritten from its live definition, so nothing else in it
-- changes; its owner, grants and settings stay as they are.

BEGIN;

DO $rewrite$
DECLARE
  -- One-line fragments, so the match doesn't depend on how the stored function
  -- breaks its lines.
  v_old CONSTANT text :=
    '* CASE WHEN p_duration_type IN (''hourly'', ''daily'') THEN p_seats ELSE 1 END;';
  v_new CONSTANT text :=
    '* CASE WHEN COALESCE(v_space ->> ''category'', '''') IN (''auditorium'', ''event_space'') THEN 1'
    || ' WHEN p_duration_type IN (''hourly'', ''daily'') THEN p_seats ELSE 1 END;';
  v_oid oid;
  v_n integer;
  v_def text;
BEGIN
  IF to_regprocedure('public.spacego_create_booking(text,timestamp with time zone,timestamp with time zone,text,integer,integer,text)') IS NULL THEN
    RAISE EXCEPTION 'public.spacego_create_booking with the expected arguments was not found';
  END IF;
  SELECT count(*), min(p.oid) INTO v_n, v_oid
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'spacego_create_booking' AND p.prokind = 'f';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one function public.spacego_create_booking, found %', v_n;
  END IF;

  v_def := pg_get_functiondef(v_oid);
  IF position('''parking'', ''auditorium''' IN v_def) = 0 THEN
    RAISE EXCEPTION 'Apply 20261205_spacego_new_types_and_demo_flag.sql first';
  END IF;
  IF position(v_new IN v_def) > 0 THEN
    RETURN;  -- already applied
  END IF;
  IF (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 THEN
    RAISE EXCEPTION 'Price calculation not found exactly once in public.spacego_create_booking';
  END IF;

  EXECUTE replace(v_def, v_old, v_new);

  IF position(v_new IN pg_get_functiondef(v_oid)) = 0 THEN
    RAISE EXCEPTION 'Rewrite of public.spacego_create_booking did not take effect';
  END IF;
END
$rewrite$;

COMMIT;
