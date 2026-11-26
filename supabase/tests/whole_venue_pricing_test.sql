-- SpaceGo: halls and event venues are priced per booking; desks and parking per seat or vehicle.
-- Safe to run on STAGING: one transaction, rolled back at the end.
--   psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/whole_venue_pricing_test.sql
-- Success prints "whole venue pricing: all checks passed".

BEGIN;

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-4000-8000-0000000f8001', 'wv-admin@example.invalid', '{"role":"owner","full_name":"Pricing Admin"}'),
  ('00000000-0000-4000-8000-0000000f8002', 'wv-host@example.invalid', '{"role":"owner","full_name":"Pricing Host"}'),
  ('00000000-0000-4000-8000-0000000f8003', 'wv-guest@example.invalid', '{"role":"seeker","full_name":"Pricing Guest"}');
-- Some projects (staging, production) only let service_role or an admin grant
-- the admin role. Act as service_role for this fixture only.
DO $$ BEGIN PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true); END $$;
UPDATE public.profiles SET role = 'admin' WHERE id = '00000000-0000-4000-8000-0000000f8001';
DO $$ BEGIN PERFORM set_config('request.jwt.claims', '', true); END $$;

DO $$ BEGIN PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000f8001', true); END $$;
INSERT INTO public.spacego_spaces (id, data)
SELECT 'zz-wv-' || t.category, jsonb_build_object(
  'id', 'zz-wv-' || t.category, 'owner_id', '00000000-0000-4000-8000-0000000f8002',
  'title', 'Pricing ' || t.category, 'slug', 'zz-wv-' || t.category, 'category', t.category,
  'status', 'published', 'instant_book', true, 'capacity', 500, 'square_feet', 9000,
  'pricing', jsonb_build_object('hourly', 1000, 'daily', 10000, 'currency', 'INR'),
  'location', jsonb_build_object('city', 'Kochi', 'address', '1 Test Road', 'country', 'India',
    'coordinates', jsonb_build_object('lat', 9.97, 'lng', 76.29)))
FROM (VALUES ('auditorium'), ('event_space'), ('coworking'), ('meeting_room'), ('parking')) AS t(category);

SET LOCAL ROLE authenticated;
DO $checks$
DECLARE
  t0 timestamptz := date_trunc('hour', now()) + interval '40 days';
  b jsonb;
  r record;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000f8003', true);
  -- category, duration, units, seats, expected base (before the 10% service fee)
  FOR r IN SELECT * FROM (VALUES
      ('auditorium',   'daily',  2, 200, 20000),   -- whole hall: 10000 x 2 days
      ('auditorium',   'hourly', 3, 150,  3000),   -- whole hall: 1000 x 3 hours
      ('event_space',  'daily',  1, 300, 10000),   -- whole venue
      ('coworking',    'daily',  2,   3, 60000),   -- per person: 10000 x 2 x 3
      ('meeting_room', 'hourly', 2,   4,  8000),   -- unchanged: per seat
      ('parking',      'hourly', 3,   2,  6000)    -- per vehicle: 1000 x 3 x 2
    ) AS v(category, duration, units, seats, base)
  LOOP
    b := public.spacego_create_booking('zz-wv-' || r.category, t0,
      t0 + CASE r.duration WHEN 'daily' THEN r.units * interval '1 day' ELSE r.units * interval '1 hour' END,
      r.duration, r.units, r.seats);
    IF (b ->> 'total_price')::numeric IS DISTINCT FROM (r.base + round(r.base * 0.10)) THEN
      RAISE EXCEPTION '% % x% for % seats: expected total %, got %',
        r.category, r.duration, r.units, r.seats, r.base + round(r.base * 0.10), b ->> 'total_price';
    END IF;
    IF (b ->> 'seats')::integer IS DISTINCT FROM r.seats THEN
      RAISE EXCEPTION '% booking should still record % guests, got %', r.category, r.seats, b ->> 'seats';
    END IF;
    t0 := t0 + interval '5 days';  -- keep bookings apart
  END LOOP;

  -- Capacity is still enforced for halls.
  BEGIN
    PERFORM public.spacego_create_booking('zz-wv-auditorium', t0, t0 + interval '1 day', 'daily', 1, 501);
    RAISE EXCEPTION 'a hall booking above capacity should be refused';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    NULL;
  END;
END
$checks$;
RESET ROLE;

DO $$ BEGIN RAISE NOTICE 'whole venue pricing: all checks passed'; END $$;

ROLLBACK;
