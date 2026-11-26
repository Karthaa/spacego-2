-- SpaceGo DEMO listings for the TEST site only (Supabase project SpaceGo-Staging).
-- 51 listings based on real Kochi places: 39 coworking spaces, 6 halls and
-- 6 car parks. Each one is marked is_demo and says in its text that the venue hasn't joined
-- SpaceGo. Photos, prices and capacity are samples. No verification badge, no rating, no reviews.
-- All are Instant Book so a guest can try the whole booking flow on the test site.
-- The six made-up sample listings from the first seed (with sample ratings and checks) are taken
-- offline on the test site, as was done on production. An admin can bring them back.
--
-- Needs 20261205_spacego_new_types_and_demo_flag.sql applied first.
-- Run in the staging SQL editor. It is one transaction: it either all applies or nothing changes.
-- Re-running it skips listings that already exist.
-- It refuses to run on production, which it recognises by the step that took
-- production's six made-up sample listings offline.
-- To remove the demo listings later, see the commented block at the end.

BEGIN;

DO $$
BEGIN
  -- Production is recognised by the step that took its six made-up sample listings
  -- offline, which recorded this exact reason. The test site never had that step.
  IF EXISTS (
       SELECT 1 FROM public.spacego_listing_review_events
       WHERE reason = 'Demo listing with sample inspection records; hidden on production until real hosts list.'
     ) OR EXISTS (
       SELECT 1 FROM public.spacego_spaces
       WHERE data -> 'review' ->> 'reason' = 'Demo listing with sample inspection records; hidden on production until real hosts list.'
     ) THEN
    RAISE EXCEPTION 'This looks like PRODUCTION (its sample listings were taken offline there). Demo listings are for the test site only.';
  END IF;
  IF position('''parking''' IN pg_get_viewdef('public.spacego_public_spaces'::regclass)) = 0 THEN
    RAISE EXCEPTION 'Apply 20261205_spacego_new_types_and_demo_flag.sql first';
  END IF;
END
$$;

-- 1. The demo host. No password and a reserved .invalid address, so nobody can sign in as it.
--    The empty token columns keep the Supabase Auth users page working.
INSERT INTO auth.users (
  instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change
)
SELECT
  '00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-00000000de01', 'authenticated', 'authenticated',
  'demo-host@spacego.invalid', '{"provider":"email","providers":["email"]}'::jsonb,
  '{"role":"owner","full_name":"SpaceGo demo host"}'::jsonb, now(), now(), '', '', '', ''
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE id = '00000000-0000-4000-8000-00000000de01');

-- 2. Make the demo host an admin for this transaction only, and act as it. Admin inserts are
--    published and approved in one step, and every step is logged under the demo host.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = '00000000-0000-4000-8000-00000000de01') THEN
    RAISE EXCEPTION 'Demo host profile was not created';
  END IF;
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  UPDATE public.profiles SET role = 'admin' WHERE id = '00000000-0000-4000-8000-00000000de01';
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000de01', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000de01","role":"authenticated"}', true);
END
$$;

-- 3. The demo listings: one row per place, turned into the app's listing format below.
INSERT INTO public.spacego_spaces (id, data)
SELECT v.id, jsonb_build_object(
  'id', v.id,
  'slug', v.id,
  'title', v.title,
  'category', v.category,
  'headline', 'Demo listing: ' || CASE v.category
      WHEN 'coworking' THEN 'coworking'
      WHEN 'auditorium' THEN 'hall with seating'
      WHEN 'event_space' THEN 'event and conference halls'
      ELSE 'car and bike parking' END || ' in ' || v.locality,
  'description', format(
      'Demo listing for trying SpaceGo on the test site. It is based on a real %s, %s (%s), '
      'which hasn''t joined SpaceGo, so bookings here are only a test and never reach the venue. '
      'Photos, prices, capacity and other details are samples. %s: %s',
      CASE v.category WHEN 'coworking' THEN 'coworking space' WHEN 'auditorium' THEN 'hall'
                      WHEN 'event_space' THEN 'event venue' ELSE 'car park' END,
      v.title, v.locality,
      CASE WHEN v.source LIKE '%openstreetmap%' THEN 'Location from OpenStreetMap' ELSE 'Public listing' END,
      v.source),
  'location', jsonb_build_object(
      'city', 'Kochi', 'address', v.locality, 'state', 'Kerala', 'country', 'India',
      'coordinates', jsonb_build_object('lat', v.lat, 'lng', v.lng),
      'landmark', v.locality, 'address_visibility', 'approximate'),
  'capacity', v.capacity,
  'square_feet', v.square_feet,
  'pricing', jsonb_strip_nulls(jsonb_build_object(
      'hourly', v.hourly, 'daily', v.daily, 'monthly', v.monthly, 'currency', 'INR')),
  'amenities', CASE v.category
      WHEN 'coworking' THEN '["High-speed Wi-Fi", "Power backup", "Air conditioning", "Coffee & tea", "Meeting rooms"]'::jsonb
      WHEN 'parking' THEN '["CCTV", "Security staff", "Two-wheeler bays"]'::jsonb
      ELSE '["Stage", "Sound system", "Projector", "Air conditioning", "Parking"]'::jsonb END,
  'operating_hours', CASE v.category
      WHEN 'coworking' THEN '{"open": "09:00", "close": "19:00", "days": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]}'::jsonb
      WHEN 'parking' THEN '{"open": "06:00", "close": "23:00", "days": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]}'::jsonb
      ELSE '{"open": "08:00", "close": "22:00", "days": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]}'::jsonb END,
  'house_rules', '[]'::jsonb,
  'verification_level', 'listed',
  'passport', '{"identity_verified": false, "property_authority_verified": false, "permitted_use_confirmed": false, "connectivity_tested_mbps": 0, "power_backup_tested": false, "fire_safety_inspected": false, "inspected_by": "", "inspected_at": "", "renewal_date": "", "notes": ""}'::jsonb,
  'images', jsonb_build_array(
      jsonb_build_object('url', 'https://images.unsplash.com/' || v.photo_1 || '?auto=format&fit=crop&w=1200&q=80',
                         'caption', v.title || ' (sample photo)', 'is_cover', true),
      jsonb_build_object('url', 'https://images.unsplash.com/' || v.photo_2 || '?auto=format&fit=crop&w=1200&q=80',
                         'caption', v.title || ' (sample photo)', 'is_cover', false)),
  'owner_id', '00000000-0000-4000-8000-00000000de01',
  'owner_name', 'SpaceGo demo host',
  'owner_avatar', '',
  'status', 'published',
  'rating', 0,
  'review_count', 0,
  'instant_book', true,
  'is_demo', true,
  'demo_source', v.source,
  'created_at', v.created_at
)
FROM (VALUES
  -- id, name, type, area, lat, lng, capacity (seats or vehicles), square feet,
  -- price per hour, per day, per month (INR, samples), photo 1, photo 2, source, listed on
  ('demo-real-anaarworx', 'Anaarworx', 'coworking', 'Kakkanad', 10.0159, 76.3419, 30, 2500, NULL, 450, 7499, 'photo-1497366216548-37526070297c', 'photo-1524758631624-e2822e304c36', 'https://cofynd.com/coworking/kochi', '2026-11-26T09:00:00Z'),
  ('demo-real-worksphere', 'Worksphere', 'coworking', 'Infopark, Kakkanad', 10.0103, 76.3632, 40, 3000, NULL, 500, 7499, 'photo-1522071820081-009f0129c71c', 'photo-1497215728101-856f4ea42174', 'https://cofynd.com/coworking/kochi', '2026-11-25T09:00:00Z'),
  ('demo-real-collective-coworks-coco', 'Collective Coworks (CoCo)', 'coworking', 'Infopark Road, Kakkanad', 10.0122, 76.3555, 50, 3500, NULL, 550, 8499, 'photo-1527192491265-7e15c55b1ed2', 'photo-1497366754035-f200968a6e72', 'https://cofynd.com/coworking/kochi', '2026-11-24T09:00:00Z'),
  ('demo-real-cove-workspaces', 'Cove Workspaces', 'coworking', 'Kakkanad', 10.0159, 76.3419, 60, 4000, NULL, 600, NULL, 'photo-1497366811353-6870744d04b2', 'photo-1497215842964-222b430dc094', 'https://cofynd.com/coworking/kochi', '2026-11-23T09:00:00Z'),
  ('demo-real-incuspaze-infra-futura', 'Incuspaze Infra Futura', 'coworking', 'Infra Futura, Seaport-Airport Road, Kakkanad', 10.0159, 76.3419, 70, 4500, NULL, 450, 7000, 'photo-1504384308090-c894fdcc538d', 'photo-1517502884422-41eaead166d4', 'https://www.incuspaze.com/kochi/space-details/incuspaze-infra-futura', '2026-11-22T09:00:00Z'),
  ('demo-real-indiqube-cyber-green', 'IndiQube Cyber Green', 'coworking', 'Kakkanad', 10.0159, 76.3419, 30, 2500, NULL, 500, 8000, 'photo-1497366216548-37526070297c', 'photo-1524758631624-e2822e304c36', 'https://indiqube.com/kochi/', '2026-11-21T09:00:00Z'),
  ('demo-real-indiqube-caspian', 'IndiQube Caspian', 'coworking', 'Kakkanad', 10.0159, 76.3419, 40, 3000, NULL, 550, NULL, 'photo-1522071820081-009f0129c71c', 'photo-1497215728101-856f4ea42174', 'https://indiqube.com/kochi/', '2026-11-20T09:00:00Z'),
  ('demo-real-bodhi-infotech', 'Bodhi Infotech', 'coworking', 'Kinfra Park, Kalamassery', 10.0512, 76.3157, 50, 3500, NULL, 600, 4000, 'photo-1527192491265-7e15c55b1ed2', 'photo-1497366754035-f200968a6e72', 'https://cofynd.com/coworking/kochi', '2026-11-19T09:00:00Z'),
  ('demo-real-arya-bhangy', 'Arya Bhangy', 'coworking', 'Kalamassery', 10.0512, 76.3157, 60, 4000, NULL, 450, 6000, 'photo-1497366811353-6870744d04b2', 'photo-1497215842964-222b430dc094', 'https://cofynd.com/coworking/kochi', '2026-11-18T09:00:00Z'),
  ('demo-real-corrazone', 'CORRAZONE', 'coworking', 'Kalamassery', 10.0512, 76.3157, 70, 4500, NULL, 500, 6000, 'photo-1504384308090-c894fdcc538d', 'photo-1517502884422-41eaead166d4', 'https://cofynd.com/coworking/kochi', '2026-11-17T09:00:00Z'),
  ('demo-real-kssia-technocity', 'Kssia Technocity', 'coworking', 'HMT Road, Kalamassery', 10.0512, 76.3157, 30, 2500, NULL, 550, 5000, 'photo-1497366216548-37526070297c', 'photo-1524758631624-e2822e304c36', 'https://cofynd.com/coworking/kochi', '2026-11-16T09:00:00Z'),
  ('demo-real-wagmi-workspace', 'Wagmi Workspace', 'coworking', 'Edappally', 10.0261, 76.3086, 40, 3000, NULL, 600, 5999, 'photo-1522071820081-009f0129c71c', 'photo-1497215728101-856f4ea42174', 'https://cofynd.com/coworking/kochi', '2026-11-15T09:00:00Z'),
  ('demo-real-marq', 'MARQ', 'coworking', 'Edappally', 10.0261, 76.3086, 50, 3500, NULL, 450, 7500, 'photo-1527192491265-7e15c55b1ed2', 'photo-1497366754035-f200968a6e72', 'https://cofynd.com/coworking/kochi', '2026-11-14T09:00:00Z'),
  ('demo-real-dotspace', 'Dotspace', 'coworking', 'Edappally', 10.0261, 76.3086, 60, 4000, NULL, 500, 5000, 'photo-1497366811353-6870744d04b2', 'photo-1497215842964-222b430dc094', 'https://cofynd.com/coworking/kochi', '2026-11-13T09:00:00Z'),
  ('demo-real-incuspaze-oberon-mall', 'Incuspaze Oberon Mall', 'coworking', 'Oberon Mall, Edappally', 10.0261, 76.3086, 70, 4500, NULL, 550, 7500, 'photo-1504384308090-c894fdcc538d', 'photo-1517502884422-41eaead166d4', 'https://www.incuspaze.com/kochi/space-details/incuspaze-oberon-mall', '2026-11-12T09:00:00Z'),
  ('demo-real-indiqube-square', 'IndiQube Square', 'coworking', 'Edappally', 10.0261, 76.3086, 30, 2500, NULL, 600, 14000, 'photo-1497366216548-37526070297c', 'photo-1524758631624-e2822e304c36', 'https://indiqube.com/kochi/', '2026-11-11T09:00:00Z'),
  ('demo-real-calm-workspaces', 'Calm Workspaces', 'coworking', 'Palarivattom', 10.0023, 76.3084, 40, 3000, NULL, 450, 7500, 'photo-1522071820081-009f0129c71c', 'photo-1497215728101-856f4ea42174', 'https://cofynd.com/coworking/kochi', '2026-11-10T09:00:00Z'),
  ('demo-real-cowired', 'Cowired', 'coworking', 'Palarivattom', 10.0023, 76.3084, 50, 3500, NULL, 500, 6500, 'photo-1527192491265-7e15c55b1ed2', 'photo-1497366754035-f200968a6e72', 'https://cofynd.com/coworking/kochi', '2026-11-09T09:00:00Z'),
  ('demo-real-indiqube-paradise', 'IndiQube Paradise', 'coworking', 'Palarivattom', 10.0023, 76.3084, 60, 4000, NULL, 550, 9000, 'photo-1497366811353-6870744d04b2', 'photo-1497215842964-222b430dc094', 'https://indiqube.com/kochi/', '2026-11-08T09:00:00Z'),
  ('demo-real-centre-a', 'Centre A', 'coworking', 'MG Road', 9.9706, 76.2853, 70, 4500, NULL, 600, 7500, 'photo-1504384308090-c894fdcc538d', 'photo-1517502884422-41eaead166d4', 'https://cofynd.com/coworking/kochi', '2026-11-07T09:00:00Z'),
  ('demo-real-fortune-cowork', 'Fortune Cowork', 'coworking', 'Near MG Road metro station', 9.9706, 76.2853, 30, 2500, NULL, 450, 5995, 'photo-1497366216548-37526070297c', 'photo-1524758631624-e2822e304c36', 'https://cofynd.com/coworking/kochi', '2026-11-26T09:00:00Z'),
  ('demo-real-awfis', 'Awfis', 'coworking', 'Mezhukkattil Matrix, Chittoor Road', 9.9706, 76.2853, 40, 3000, NULL, 500, 13000, 'photo-1522071820081-009f0129c71c', 'photo-1497215728101-856f4ea42174', 'https://www.awfis.com/inspiration/?p=10638', '2026-11-25T09:00:00Z'),
  ('demo-real-innerspace-coworking', 'Innerspace Coworking', 'coworking', 'SRM Road', 9.992, 76.288, 50, 3500, NULL, 550, 7000, 'photo-1527192491265-7e15c55b1ed2', 'photo-1497366754035-f200968a6e72', 'https://cofynd.com/coworking/kochi', '2026-11-24T09:00:00Z'),
  ('demo-real-incuspaze-deshabhimani-road', 'Incuspaze Deshabhimani Road', 'coworking', 'Deshabhimani Road, Kaloor', 9.9978, 76.2923, 60, 4000, NULL, 600, 7499, 'photo-1497366811353-6870744d04b2', 'photo-1497215842964-222b430dc094', 'https://cofynd.com/coworking/kochi', '2026-11-23T09:00:00Z'),
  ('demo-real-factorm', 'Factorm', 'coworking', 'October Road, Vyttila', 9.9676, 76.3206, 70, 4500, NULL, 450, 5000, 'photo-1504384308090-c894fdcc538d', 'photo-1517502884422-41eaead166d4', 'https://cofynd.com/coworking/kochi', '2026-11-22T09:00:00Z'),
  ('demo-real-workzo', 'Workzo', 'coworking', 'Tripunithura', 9.9451, 76.3486, 30, 2500, NULL, 500, 5999, 'photo-1497366216548-37526070297c', 'photo-1524758631624-e2822e304c36', 'https://cofynd.com/coworking/kochi', '2026-11-21T09:00:00Z'),
  ('demo-real-bee-worker', 'Bee Worker', 'coworking', 'Grande Tower, Pulinchode Junction, Aluva', 10.1076, 76.3516, 40, 3000, NULL, 550, 4000, 'photo-1522071820081-009f0129c71c', 'photo-1497215728101-856f4ea42174', 'https://cofynd.com/coworking/kochi', '2026-11-20T09:00:00Z'),
  ('demo-real-spacelance', 'Spacelance', 'coworking', 'Valamkottil Towers, Judgemukku, Kakkanad', 10.0159, 76.3419, 50, 3500, NULL, 600, 6500, 'photo-1527192491265-7e15c55b1ed2', 'photo-1497366754035-f200968a6e72', 'https://cofynd.com/coworking/kochi', '2026-11-19T09:00:00Z'),
  ('demo-real-greennest-business-centre', 'GreenNest Business Centre', 'coworking', 'Giri Nagar, Kadavanthra', 9.9663, 76.2989, 60, 4000, NULL, 450, 5990, 'photo-1497366811353-6870744d04b2', 'photo-1497215842964-222b430dc094', 'https://cofynd.com/coworking/greennest-business-centre-ernakulam-kochi', '2026-11-18T09:00:00Z'),
  ('demo-real-dewspace', 'dewSpace', 'coworking', 'Paramara Road, Ernakulam North', 9.992, 76.288, 70, 4500, NULL, 500, NULL, 'photo-1504384308090-c894fdcc538d', 'photo-1517502884422-41eaead166d4', 'https://myhq.in/dedicated/coworking-space/dewspace-ernakulam', '2026-11-17T09:00:00Z'),
  ('demo-real-ciasl-business-centre', 'CIASL Business Centre', 'coworking', 'CIAL Aeropark, Nedumbassery', 10.155, 76.39, 30, 2500, NULL, 550, 9999, 'photo-1497366216548-37526070297c', 'photo-1524758631624-e2822e304c36', 'https://myhq.in/dedicated/coworking-space/ciasl-business-centre-nedumbassery', '2026-11-16T09:00:00Z'),
  ('demo-real-next57', 'Next57', 'coworking', 'Sahodaran Ayyappan Road', 9.9663, 76.2989, 40, 3000, NULL, 600, NULL, 'photo-1522071820081-009f0129c71c', 'photo-1497215728101-856f4ea42174', 'https://www.coworker.com/india/kochi/next57/review', '2026-11-15T09:00:00Z'),
  ('demo-real-inq-cowork', 'InQ Cowork', 'coworking', 'InQ Tower, NH Bypass, Palarivattom', 10.0008, 76.3133, 50, 3500, NULL, 637, 7009, 'photo-1527192491265-7e15c55b1ed2', 'photo-1497366754035-f200968a6e72', 'https://www.coworkingcafe.com/coworking-property/in/kl/kochi/inq-kochi/', '2026-11-14T09:00:00Z'),
  ('demo-real-wolfpack-workspaces', 'Wolfpack Workspaces', 'coworking', 'Iyyattil Junction, off MG Road', 9.9731, 76.285, 60, 4000, NULL, 600, 10200, 'photo-1497366811353-6870744d04b2', 'photo-1497215842964-222b430dc094', 'https://www.coworkingcafe.com/coworking-property/in/kl/kochi/wolfpack-iyyattil-junction', '2026-11-13T09:00:00Z'),
  ('demo-real-clover-business-center', 'Clover Business Center', 'coworking', 'Asset Corridor, Ponekkara, Edappally', 10.0261, 76.3086, 70, 4500, NULL, 550, NULL, 'photo-1504384308090-c894fdcc538d', 'photo-1517502884422-41eaead166d4', 'https://myhq.in/dedicated/coworking-space/cloverbusiness-center-edappally', '2026-11-12T09:00:00Z'),
  ('demo-real-spaces-66-mg-road', 'Spaces, 66 MG Road', 'coworking', 'Emgee Square, Padma Junction, MG Road', 9.979, 76.282, 30, 2500, NULL, 1390, NULL, 'photo-1497366216548-37526070297c', 'photo-1524758631624-e2822e304c36', 'https://www.spacesworks.com/en/in/7994', '2026-11-11T09:00:00Z'),
  ('demo-real-regus-sl-plaza', 'Regus, SL Plaza', 'coworking', 'SL Plaza, Palarivattom', 10.0023, 76.3084, 40, 3000, NULL, 1390, NULL, 'photo-1522071820081-009f0129c71c', 'photo-1497215728101-856f4ea42174', 'https://www.regus.com/en/in/11389', '2026-11-10T09:00:00Z'),
  ('demo-real-regus-nippon-q1-mall', 'Regus, Nippon Q1 Mall', 'coworking', 'Nippon Q1 Mall, NH 66, Vennala', 9.995, 76.314, 50, 3500, NULL, 2290, NULL, 'photo-1527192491265-7e15c55b1ed2', 'photo-1497366754035-f200968a6e72', 'https://www.regus.com/en/in/7695', '2026-11-09T09:00:00Z'),
  ('demo-real-regus-upper-crest', 'Regus, Upper Crest', 'coworking', 'Upper Crest, Infopark Road, Kakkanad', 10.0122, 76.3555, 60, 4000, NULL, 1490, NULL, 'photo-1497366811353-6870744d04b2', 'photo-1497215842964-222b430dc094', 'https://www.regus.com/en/in/8537', '2026-11-08T09:00:00Z'),
  ('demo-real-fine-arts-hall', 'Fine Arts Hall', 'auditorium', 'Foreshore Road, Ernakulam', 9.96356, 76.28319, 700, 8400, 6000, 45000, NULL, 'photo-1505373877841-8d25f7d46678', 'photo-1540575467063-178a50c2df87', 'https://www.openstreetmap.org/?mlat=9.96356&mlon=76.28319#map=17/9.96356/76.28319', '2026-11-25T10:00:00Z'),
  ('demo-real-tdm-hall', 'TDM Hall', 'auditorium', 'Durbar Hall Road, Ernakulam', 9.96781, 76.28395, 500, 6000, 5000, 35000, NULL, 'photo-1540575467063-178a50c2df87', 'photo-1511578314322-379afb476865', 'https://www.openstreetmap.org/?mlat=9.96781&mlon=76.28395#map=17/9.96781/76.28395', '2026-11-24T10:00:00Z'),
  ('demo-real-ernakulam-town-hall', 'Ernakulam Town Hall', 'auditorium', 'Banerji Road, Ernakulam', 9.99121, 76.28844, 800, 9600, 6500, 50000, NULL, 'photo-1511578314322-379afb476865', 'photo-1505373877841-8d25f7d46678', 'https://www.openstreetmap.org/?mlat=9.99121&mlon=76.28844#map=17/9.99121/76.28844', '2026-11-23T10:00:00Z'),
  ('demo-real-lulu-bolgatty-international-convention-centre', 'Lulu Bolgatty International Convention Centre', 'auditorium', 'Bolgatty, Mulavukad', 9.98712, 76.26503, 2000, 24000, 25000, 200000, NULL, 'photo-1505373877841-8d25f7d46678', 'photo-1540575467063-178a50c2df87', 'https://www.openstreetmap.org/?mlat=9.98712&mlon=76.26503#map=17/9.98712/76.26503', '2026-11-22T10:00:00Z'),
  ('demo-real-adlux-international-convention-and-exhibition-centre', 'Adlux International Convention and Exhibition Centre', 'event_space', 'Karukutty, Angamaly', 10.23508, 76.37226, 3000, 36000, 20000, 150000, NULL, 'photo-1540575467063-178a50c2df87', 'photo-1511578314322-379afb476865', 'https://www.openstreetmap.org/?mlat=10.23508&mlon=76.37226#map=17/10.23508/76.37226', '2026-11-21T10:00:00Z'),
  ('demo-real-crowne-plaza-kochi-event-halls', 'Crowne Plaza Kochi event halls', 'event_space', 'Kundannoor, Maradu', 9.93377, 76.31891, 600, 7200, 12000, 90000, NULL, 'photo-1511578314322-379afb476865', 'photo-1505373877841-8d25f7d46678', 'https://www.openstreetmap.org/?mlat=9.93377&mlon=76.31891#map=17/9.93377/76.31891', '2026-11-20T10:00:00Z'),
  ('demo-real-vadakkekotta-metro-multi-level-parking', 'Vadakkekotta Metro multi-level parking', 'parking', 'Vadakkekotta, Tripunithura', 9.95265, 76.33933, 300, 45000, 20, 100, NULL, 'photo-1506521781263-d8422e82f27a', 'photo-1573348722427-f1d6819fdf98', 'https://www.openstreetmap.org/?mlat=9.95265&mlon=76.33933#map=17/9.95265/76.33933', '2026-11-24T11:00:00Z'),
  ('demo-real-aluva-metro-station-parking', 'Aluva Metro station parking', 'parking', 'Aluva', 10.1099, 76.34947, 150, 22500, 20, 100, NULL, 'photo-1573348722427-f1d6819fdf98', 'photo-1506521781263-d8422e82f27a', 'https://www.openstreetmap.org/?mlat=10.1099&mlon=76.34947#map=17/10.1099/76.34947', '2026-11-23T11:00:00Z'),
  ('demo-real-vyttila-mobility-hub-parking', 'Vyttila Mobility Hub parking', 'parking', 'Vyttila', 9.96847, 76.32194, 250, 37500, 30, 150, NULL, 'photo-1506521781263-d8422e82f27a', 'photo-1573348722427-f1d6819fdf98', 'https://www.openstreetmap.org/?mlat=9.96847&mlon=76.32194#map=17/9.96847/76.32194', '2026-11-22T11:00:00Z'),
  ('demo-real-cochin-international-airport-car-park', 'Cochin International Airport car park', 'parking', 'Nedumbassery', 10.15449, 76.39249, 1500, 225000, 60, 400, NULL, 'photo-1573348722427-f1d6819fdf98', 'photo-1506521781263-d8422e82f27a', 'https://www.openstreetmap.org/?mlat=10.15449&mlon=76.39249#map=17/10.15449/76.39249', '2026-11-21T11:00:00Z'),
  ('demo-real-lulu-mall-kochi-parking', 'LuLu Mall Kochi parking', 'parking', 'Edappally', 10.02722, 76.30789, 1000, 150000, 40, 250, NULL, 'photo-1506521781263-d8422e82f27a', 'photo-1573348722427-f1d6819fdf98', 'https://www.openstreetmap.org/?mlat=10.02722&mlon=76.30789#map=17/10.02722/76.30789', '2026-11-20T11:00:00Z'),
  ('demo-real-ernakulam-junction-station-parking', 'Ernakulam Junction station parking', 'parking', 'Ernakulam South', 9.97061, 76.29097, 200, 30000, 25, 120, NULL, 'photo-1573348722427-f1d6819fdf98', 'photo-1506521781263-d8422e82f27a', 'https://www.openstreetmap.org/?mlat=9.97061&mlon=76.29097#map=17/9.97061/76.29097', '2026-11-19T11:00:00Z')
) AS v(id, title, category, locality, lat, lng, capacity, square_feet,
       hourly, daily, monthly, photo_1, photo_2, source, created_at)
WHERE NOT EXISTS (SELECT 1 FROM public.spacego_spaces s WHERE s.id = v.id);

-- 4. Take the six made-up sample listings offline on the test site (same step as on production).
DO $$
DECLARE v_id text;
BEGIN
  FOR v_id IN
    SELECT s.id FROM public.spacego_spaces s
    WHERE s.data ->> 'owner_id' = 'user-owner-1'
      AND s.data ->> 'status' = 'published'
      AND public.spacego_review_state(s.data) = 'approved'
    ORDER BY s.id
  LOOP
    PERFORM public.spacego_review_listing(v_id, 'suspend',
      'Made-up sample listing with sample ratings and checks; replaced on the test site by labelled demo listings.');
  END LOOP;
END
$$;

-- 5. Set the demo host back to owner, stop acting as it, and check the result.
DO $$
DECLARE v_public integer; v_role text;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  UPDATE public.profiles SET role = 'owner' WHERE id = '00000000-0000-4000-8000-00000000de01';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);

  SELECT count(*) INTO v_public FROM public.spacego_public_spaces WHERE data ->> 'is_demo' = 'true';
  SELECT role::text INTO v_role FROM public.profiles WHERE id = '00000000-0000-4000-8000-00000000de01';
  IF v_public < 51 THEN
    RAISE EXCEPTION 'Expected at least 51 public demo listings, found %', v_public;
  END IF;
  IF v_role IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Demo host should be back to owner, is %', v_role;
  END IF;
END
$$;

COMMIT;

-- Result: public listings by type, and how many are demo listings.
SELECT data ->> 'category' AS type,
       count(*) FILTER (WHERE data ->> 'is_demo' = 'true') AS demo_listings,
       count(*) AS all_public_listings
FROM public.spacego_public_spaces
GROUP BY 1 ORDER BY 1;

-- To remove every demo listing later (test site only), run this on its own:
-- BEGIN;
-- DELETE FROM public.spacego_spaces
-- WHERE data ->> 'is_demo' = 'true' AND data ->> 'owner_id' = '00000000-0000-4000-8000-00000000de01';
-- COMMIT;
