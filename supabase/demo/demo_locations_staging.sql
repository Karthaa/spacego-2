-- SpaceGo DEMO listings, TEST site only (Supabase project SpaceGo-Staging).
-- Moves 21 demo listings from the centre of their area to their own building, so listings in
-- the same area stop sharing one map point. Each location comes from the space's public listing
-- pages (source under each row). The site still shows every listing at an approximate point,
-- rounded to about 500 m, as it does for all listings.
-- Also corrects IndiQube Paradise's area: it is at Carnival Infopark, Kakkanad, not Palarivattom.
--
-- Run in the staging SQL editor after demo_listings_staging.sql. It is one transaction: it either
-- all applies or nothing changes. Re-running it changes nothing.
-- It refuses to run on production, like demo_listings_staging.sql.

BEGIN;

DO $$
BEGIN
  IF EXISTS (
       SELECT 1 FROM public.spacego_listing_review_events
       WHERE reason = 'Demo listing with sample inspection records; hidden on production until real hosts list.'
     ) OR EXISTS (
       SELECT 1 FROM public.spacego_spaces
       WHERE data -> 'review' ->> 'reason' = 'Demo listing with sample inspection records; hidden on production until real hosts list.'
     ) THEN
    RAISE EXCEPTION 'This looks like PRODUCTION (its sample listings were taken offline there). Demo listings are for the test site only.';
  END IF;
  IF (SELECT count(*) FROM public.spacego_spaces
      WHERE data ->> 'is_demo' = 'true' AND data ->> 'owner_id' = '00000000-0000-4000-8000-00000000de01') < 51 THEN
    RAISE EXCEPTION 'Run demo_listings_staging.sql first';
  END IF;
END
$$;

-- 1. The new locations. The area text is only set where it was wrong.
CREATE TEMP TABLE demo_new_location (id text PRIMARY KEY, lat numeric, lng numeric, area text) ON COMMIT DROP;
INSERT INTO demo_new_location (id, lat, lng, area) VALUES
  -- https://www.coworkingcafe.com/coworking-property/in/kl/kochi/indiqube-cyber-green
  ('demo-real-indiqube-cyber-green', 10.01031, 76.36706, NULL),
  -- https://www.coworkingcafe.com/coworking-property/in/kl/kakkanad/indiqube-caspian/
  ('demo-real-indiqube-caspian', 10.00636, 76.3752, NULL),
  -- https://www.coworkingcafe.com/coworking-property/in/kl/kochi/indiqube-square/
  ('demo-real-indiqube-square', 10.01439, 76.31114, NULL),
  -- https://coworkingcafe.com/coworking-property/in/kl/kochi/indiqube-paradise
  ('demo-real-indiqube-paradise', 10.01419, 76.36349, 'Carnival Infopark, Infopark Phase 1, Kakkanad'),
  -- https://myhq.in/dedicated/coworking-space/arya-bhangy-ernakulam
  ('demo-real-arya-bhangy', 10.06814, 76.32883, NULL),
  -- https://gharpe.com/ernakulam/kssia-technocity
  ('demo-real-kssia-technocity', 10.0531, 76.33254, NULL),
  -- https://www.office-hub.com/in/properties/unichira-thoppil-rd-edappally-kochi-kerala-a0vQg00000NZPfpIAH
  ('demo-real-wagmi-workspace', 10.02967, 76.31989, NULL),
  -- https://www.regus.com/en/in/8537
  ('demo-real-regus-upper-crest', 10.0106, 76.3601, NULL),
  -- https://www.incuspaze.com/kochi/space-details/incuspaze-infra-futura
  ('demo-real-incuspaze-infra-futura', 10.03086, 76.33387, NULL),
  -- https://www.coworkingcafe.com/coworking-property/in/kl/kochi/cowired-coworking-space/
  ('demo-real-cowired', 10.00039, 76.31188, NULL),
  -- https://www.coworkingcafe.com/coworking-property/in/kl/kochi/innerspace-kaloor/
  ('demo-real-innerspace-coworking', 9.99729, 76.28585, NULL),
  -- https://www.coworkingcafe.com/coworking-property/in/kl/kochi/awfis-mezmatrix
  ('demo-real-awfis', 9.97578, 76.28517, NULL),
  -- https://en.wikipedia.org/wiki/Oberon_Mall
  ('demo-real-incuspaze-oberon-mall', 10.01444, 76.31222, NULL),
  -- https://www.office-hub.com/in/properties/opposite-infopark-smart-city-short-road-edachira-kakkanad-kerala-a0vQg00000NhmgrIAB
  ('demo-real-collective-coworks-coco', 10.01548, 76.36446, NULL),
  -- https://www.coworkingcafe.com/coworking-property/in/kl/kochi/paramara-road/
  ('demo-real-dewspace', 9.98971, 76.28511, NULL),
  -- https://www.office-hub.com/in/properties/ponekkara-edappally-ernakulam-kerala-a0vQg00000NnpCEIAZ
  ('demo-real-clover-business-center', 10.02825, 76.30536, NULL),
  -- https://www.office-hub.com/in/properties/sl-plazapalarivattom-kochi-kerala-a0vQg00000eiMDtIAM
  ('demo-real-regus-sl-plaza', 10.0035, 76.30596, NULL),
  -- https://www.coworkingcafe.com/coworking-property/in/kl/kochi/centre-a
  ('demo-real-centre-a', 9.98449, 76.28172, NULL),
  -- https://www.office-hub.com/in/properties/girinagar-housing-colony-giri-nagar-kadavanthra-kochi-kerala-a0vQg00000N5zdVIAR
  ('demo-real-greennest-business-centre', 9.96446, 76.29914, NULL),
  -- https://www.coworkingcafe.com/coworking-property/in/kl/kochi/dotspace-total-tower
  ('demo-real-dotspace', 10.01759, 76.30256, NULL),
  -- https://www.office-hub.com/in/properties/panadans-cusat-kalamassery-kochi-kerala-a0vQg00000N6Le2IAF
  ('demo-real-corrazone', 10.04696, 76.31819, NULL);

-- 2. Act as the demo host, as an admin for this transaction only, so the listings stay published
--    and approved. (When a host moves a listing, it goes back for review.)
DO $$
BEGIN
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  UPDATE public.profiles SET role = 'admin' WHERE id = '00000000-0000-4000-8000-00000000de01';
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000de01', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000de01","role":"authenticated"}', true);
END
$$;

-- 3. Correct the area text, in the same places the demo script puts it.
UPDATE public.spacego_spaces s
SET data = s.data || jsonb_build_object(
  'headline', 'Demo listing: coworking in ' || n.area,
  'description', replace(s.data ->> 'description',
                         '(' || (s.data -> 'location' ->> 'address') || ')', '(' || n.area || ')'),
  'location', (s.data -> 'location') || jsonb_build_object('address', n.area, 'landmark', n.area))
FROM demo_new_location n
WHERE s.id = n.id
  AND n.area IS NOT NULL
  AND s.data ->> 'category' = 'coworking'
  AND s.data ->> 'is_demo' = 'true'
  AND s.data ->> 'owner_id' = '00000000-0000-4000-8000-00000000de01'
  AND s.data -> 'location' ->> 'address' IS DISTINCT FROM n.area;

-- 4. Move each listing to its building.
UPDATE public.spacego_spaces s
SET data = jsonb_set(s.data, '{location,coordinates}', jsonb_build_object('lat', n.lat, 'lng', n.lng))
FROM demo_new_location n
WHERE s.id = n.id
  AND s.data ->> 'is_demo' = 'true'
  AND s.data ->> 'owner_id' = '00000000-0000-4000-8000-00000000de01'
  AND s.data -> 'location' -> 'coordinates' IS DISTINCT FROM jsonb_build_object('lat', n.lat, 'lng', n.lng);

-- 5. Set the demo host back to owner, stop acting as it, and check the result.
DO $$
DECLARE v_moved integer; v_ok integer; v_public integer; v_role text;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  UPDATE public.profiles SET role = 'owner' WHERE id = '00000000-0000-4000-8000-00000000de01';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);

  SELECT count(*) INTO v_moved FROM demo_new_location;
  SELECT count(*) INTO v_ok
  FROM demo_new_location n JOIN public.spacego_spaces s ON s.id = n.id
  WHERE s.data -> 'location' -> 'coordinates' = jsonb_build_object('lat', n.lat, 'lng', n.lng)
    AND (n.area IS NULL OR s.data -> 'location' ->> 'address' = n.area)
    AND s.data ->> 'status' = 'published'
    AND public.spacego_review_state(s.data) = 'approved'
    AND s.geo_public IS NOT NULL;
  IF v_ok <> v_moved OR v_moved <> 21 THEN
    RAISE EXCEPTION 'Expected 21 moved, published and approved demo listings, found %', v_ok;
  END IF;
  SELECT count(*) INTO v_public FROM public.spacego_public_spaces WHERE data ->> 'is_demo' = 'true';
  IF v_public < 51 THEN
    RAISE EXCEPTION 'Expected at least 51 public demo listings, found %', v_public;
  END IF;
  SELECT role::text INTO v_role FROM public.profiles WHERE id = '00000000-0000-4000-8000-00000000de01';
  IF v_role IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Demo host should be back to owner, is %', v_role;
  END IF;
END
$$;

COMMIT;

-- Result: demo listings, and how many separate points they now show at on the map.
SELECT count(*) AS demo_listings,
       count(DISTINCT extensions.st_astext(geo_public::extensions.geometry)) AS map_points
FROM public.spacego_spaces
WHERE data ->> 'is_demo' = 'true';
