-- SpaceGo: two new space types (parking, auditorium) and a demo-listing flag.
--
-- Forward-only. Run as ONE transaction in the Supabase SQL editor, staging first.
-- Safe to re-run: functions that already allow the new types are left alone,
-- and the view is replaced with the same definition.
--
-- What it changes:
-- 1. The four functions that check a listing's category against a fixed list
--    (spacego_guard_space_write, spacego_create_booking, spacego_log_demand,
--    spacego_submit_enquiry) also accept 'parking' and 'auditorium'. They are
--    rewritten from their live definitions, so nothing else in them changes.
-- 2. The public read model public.spacego_public_spaces (last defined in
--    20261129) passes the two new categories through and exposes a boolean
--    is_demo (false unless the listing data sets it). Everything else in the
--    view is unchanged.
--
-- The legacy table public.spaces (from 20261108_init, unused by the app and
-- empty) keeps its old category check on purpose.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.spacego_public_spaces') IS NULL
     OR to_regprocedure('public.spacego_space_address(text)') IS NULL THEN
    RAISE EXCEPTION 'Apply 20261129_spacego_address_privacy.sql first';
  END IF;
END
$$;

-- 1. Category lists inside functions ----------------------------------------
DO $rewrite$
DECLARE
  v_old CONSTANT text := '''training_room'', ''studio'', ''event_space''';
  v_new CONSTANT text := '''training_room'', ''studio'', ''event_space'', ''parking'', ''auditorium''';
  v_name text;
  v_oid oid;
  v_n integer;
  v_def text;
BEGIN
  FOREACH v_name IN ARRAY ARRAY[
    'spacego_guard_space_write', 'spacego_create_booking',
    'spacego_log_demand', 'spacego_submit_enquiry'
  ] LOOP
    SELECT count(*), min(p.oid) INTO v_n, v_oid
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = v_name AND p.prokind = 'f';
    IF v_n <> 1 THEN
      RAISE EXCEPTION 'Expected exactly one function public.%, found %', v_name, v_n;
    END IF;

    v_def := pg_get_functiondef(v_oid);
    IF position(v_new IN v_def) > 0 THEN
      CONTINUE;  -- already allows the new types
    END IF;
    IF (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 THEN
      RAISE EXCEPTION 'Category list not found exactly once in public.%', v_name;
    END IF;

    EXECUTE replace(v_def, v_old, v_new);

    IF position(v_new IN pg_get_functiondef(v_oid)) = 0 THEN
      RAISE EXCEPTION 'Rewrite of public.% did not take effect', v_name;
    END IF;
  END LOOP;
END
$rewrite$;

-- 2. Public read model --------------------------------------------------------
CREATE OR REPLACE VIEW public.spacego_public_spaces
WITH (security_barrier = true, security_invoker = false)
AS
SELECT
  s.id,
  s.created_at,
  jsonb_build_object(
    'id', s.id,
    'title', CASE
      WHEN jsonb_typeof(s.data -> 'title') = 'string'
        THEN left(s.data ->> 'title', 200)
      ELSE ''
    END,
    'slug', CASE
      WHEN jsonb_typeof(s.data -> 'slug') = 'string'
        THEN left(s.data ->> 'slug', 200)
      ELSE ''
    END,
    'category', CASE
      WHEN s.data ->> 'category' IN (
        'coworking', 'private_office', 'meeting_room',
        'training_room', 'studio', 'event_space',
        'parking', 'auditorium'
      ) THEN s.data ->> 'category'
      ELSE ''
    END,
    'headline', CASE
      WHEN jsonb_typeof(s.data -> 'headline') = 'string'
        THEN left(s.data ->> 'headline', 500)
      ELSE ''
    END,
    'description', CASE
      WHEN jsonb_typeof(s.data -> 'description') = 'string'
        THEN left(s.data ->> 'description', 10000)
      ELSE ''
    END,
    'location', jsonb_build_object(
      'city', CASE
        WHEN jsonb_typeof(s.data -> 'location' -> 'city') = 'string'
          THEN left(s.data -> 'location' ->> 'city', 160)
        ELSE ''
      END,
      -- Street address only when the host chose to show it before booking
      -- (the choice is part of the admin-reviewed listing). Otherwise
      -- guests see the area; confirmed guests get it from
      -- spacego_space_address().
      'address', CASE
        WHEN s.data -> 'location' ->> 'address_visibility' = 'exact'
          AND jsonb_typeof(s.data -> 'location' -> 'address') = 'string'
          THEN left(s.data -> 'location' ->> 'address', 500)
        ELSE ''
      END,
      'address_visibility', CASE
        WHEN s.data -> 'location' ->> 'address_visibility' = 'exact' THEN 'exact'
        ELSE 'approximate'
      END,
      'state', CASE
        WHEN jsonb_typeof(s.data -> 'location' -> 'state') = 'string'
          THEN left(s.data -> 'location' ->> 'state', 160)
        ELSE ''
      END,
      'country', CASE
        WHEN jsonb_typeof(s.data -> 'location' -> 'country') = 'string'
          THEN left(s.data -> 'location' ->> 'country', 160)
        ELSE ''
      END,
      'postal_code', CASE
        WHEN jsonb_typeof(s.data -> 'location' -> 'postal_code') = 'string'
          THEN left(s.data -> 'location' ->> 'postal_code', 40)
        ELSE ''
      END,
      'landmark', CASE
        WHEN s.data -> 'location' ->> 'address_visibility' = 'exact'
          AND jsonb_typeof(s.data -> 'location' -> 'landmark') = 'string'
          THEN left(s.data -> 'location' ->> 'landmark', 200)
        ELSE ''
      END
    ),
    'capacity', CASE
      -- Integer-valued JSON numbers may arrive as "25.0". The regex admits only
      -- integral decimals, and the numeric intermediate means a decimal string
      -- is never cast directly to integer. Malformed or out-of-range values
      -- fall back to 0 instead of aborting the whole view.
      WHEN btrim(COALESCE(s.data ->> 'capacity', '')) ~
        '^[+-]?[0-9]{1,9}([.]0+)?$'
        THEN btrim(s.data ->> 'capacity')::numeric::integer
      ELSE 0
    END,
    'square_feet', CASE
      WHEN btrim(COALESCE(s.data ->> 'square_feet', '')) ~
        '^[+-]?[0-9]{1,9}([.]0+)?$'
        THEN btrim(s.data ->> 'square_feet')::numeric::integer
      ELSE 0
    END,
    'pricing', CASE
      WHEN jsonb_typeof(s.data -> 'pricing') = 'object' THEN
        jsonb_build_object(
          'hourly', CASE
            WHEN jsonb_typeof(s.data -> 'pricing' -> 'hourly') = 'number'
              THEN s.data -> 'pricing' -> 'hourly'
            ELSE NULL::jsonb
          END,
          'daily', CASE
            WHEN jsonb_typeof(s.data -> 'pricing' -> 'daily') = 'number'
              THEN s.data -> 'pricing' -> 'daily'
            ELSE NULL::jsonb
          END,
          'weekly', CASE
            WHEN jsonb_typeof(s.data -> 'pricing' -> 'weekly') = 'number'
              THEN s.data -> 'pricing' -> 'weekly'
            ELSE NULL::jsonb
          END,
          'monthly', CASE
            WHEN jsonb_typeof(s.data -> 'pricing' -> 'monthly') = 'number'
              THEN s.data -> 'pricing' -> 'monthly'
            ELSE NULL::jsonb
          END,
          'currency', CASE
            WHEN jsonb_typeof(s.data -> 'pricing' -> 'currency') = 'string'
              AND (s.data -> 'pricing' ->> 'currency') ~ '^[A-Za-z]{3}$'
              THEN upper(s.data -> 'pricing' ->> 'currency')
            ELSE 'USD'
          END
        )
      ELSE jsonb_build_object(
        'hourly', NULL::jsonb,
        'daily', NULL::jsonb,
        'weekly', NULL::jsonb,
        'monthly', NULL::jsonb,
        'currency', 'USD'
      )
    END,
    'amenities', COALESCE((
      SELECT jsonb_agg(items.value ORDER BY items.ord)
      FROM (
        SELECT a.value, a.ord
        FROM jsonb_array_elements(
          CASE
            WHEN jsonb_typeof(s.data -> 'amenities') = 'array'
              THEN s.data -> 'amenities'
            ELSE '[]'::jsonb
          END
        ) WITH ORDINALITY AS a(value, ord)
        WHERE jsonb_typeof(a.value) = 'string'
          AND btrim(a.value #>> '{}') <> ''
          AND length(a.value #>> '{}') <= 200
        ORDER BY a.ord
        LIMIT 50
      ) AS items
    ), '[]'::jsonb),
    'operating_hours', jsonb_build_object(
      'open', CASE
        WHEN jsonb_typeof(s.data -> 'operating_hours' -> 'open') = 'string'
          THEN left(s.data -> 'operating_hours' ->> 'open', 50)
        ELSE ''
      END,
      'close', CASE
        WHEN jsonb_typeof(s.data -> 'operating_hours' -> 'close') = 'string'
          THEN left(s.data -> 'operating_hours' ->> 'close', 50)
        ELSE ''
      END,
      'days', COALESCE((
        SELECT jsonb_agg(items.value ORDER BY items.ord)
        FROM (
          SELECT d.value, d.ord
          FROM jsonb_array_elements(
            CASE
              WHEN jsonb_typeof(s.data -> 'operating_hours' -> 'days') = 'array'
                THEN s.data -> 'operating_hours' -> 'days'
              ELSE '[]'::jsonb
            END
          ) WITH ORDINALITY AS d(value, ord)
          WHERE jsonb_typeof(d.value) = 'string'
            AND btrim(d.value #>> '{}') <> ''
            AND length(d.value #>> '{}') <= 20
          ORDER BY d.ord
          LIMIT 14
        ) AS items
      ), '[]'::jsonb)
    ),
    'house_rules', COALESCE((
      SELECT jsonb_agg(items.value ORDER BY items.ord)
      FROM (
        SELECT r.value, r.ord
        FROM jsonb_array_elements(
          CASE
            WHEN jsonb_typeof(s.data -> 'house_rules') = 'array'
              THEN s.data -> 'house_rules'
            ELSE '[]'::jsonb
          END
        ) WITH ORDINALITY AS r(value, ord)
        WHERE jsonb_typeof(r.value) = 'string'
          AND btrim(r.value #>> '{}') <> ''
          AND length(r.value #>> '{}') <= 500
        ORDER BY r.ord
        LIMIT 50
      ) AS items
    ), '[]'::jsonb),
    'verification_level', CASE
      WHEN s.data ->> 'verification_level' IN (
        'listed', 'checked', 'ready', 'pro'
      ) THEN s.data ->> 'verification_level'
      ELSE 'listed'
    END,
    'passport', jsonb_build_object(
      'identity_verified', CASE
        WHEN jsonb_typeof(
          s.data -> 'passport' -> 'identity_verified'
        ) = 'boolean'
          THEN s.data -> 'passport' -> 'identity_verified'
        ELSE 'false'::jsonb
      END,
      'property_authority_verified', CASE
        WHEN jsonb_typeof(
          s.data -> 'passport' -> 'property_authority_verified'
        ) = 'boolean'
          THEN s.data -> 'passport' -> 'property_authority_verified'
        ELSE 'false'::jsonb
      END,
      'permitted_use_confirmed', CASE
        WHEN jsonb_typeof(
          s.data -> 'passport' -> 'permitted_use_confirmed'
        ) = 'boolean'
          THEN s.data -> 'passport' -> 'permitted_use_confirmed'
        ELSE 'false'::jsonb
      END,
      'connectivity_tested_mbps', CASE
        WHEN btrim(
          COALESCE(s.data -> 'passport' ->> 'connectivity_tested_mbps', '')
        ) ~ '^[+-]?[0-9]{1,12}([.][0-9]{1,6})?$'
          THEN btrim(
            s.data -> 'passport' ->> 'connectivity_tested_mbps'
          )::numeric
        ELSE 0
      END,
      'power_backup_tested', CASE
        WHEN jsonb_typeof(
          s.data -> 'passport' -> 'power_backup_tested'
        ) = 'boolean'
          THEN s.data -> 'passport' -> 'power_backup_tested'
        ELSE 'false'::jsonb
      END,
      'fire_safety_inspected', CASE
        WHEN jsonb_typeof(
          s.data -> 'passport' -> 'fire_safety_inspected'
        ) = 'boolean'
          THEN s.data -> 'passport' -> 'fire_safety_inspected'
        ELSE 'false'::jsonb
      END,
      'inspected_at', CASE
        WHEN jsonb_typeof(s.data -> 'passport' -> 'inspected_at') = 'string'
          THEN left(s.data -> 'passport' ->> 'inspected_at', 50)
        ELSE ''
      END,
      'renewal_date', CASE
        WHEN jsonb_typeof(s.data -> 'passport' -> 'renewal_date') = 'string'
          THEN left(s.data -> 'passport' ->> 'renewal_date', 50)
        ELSE ''
      END
    ),
    'images', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'url', left(items.value ->> 'url', 2000),
          'caption', CASE
            WHEN jsonb_typeof(items.value -> 'caption') = 'string'
              THEN left(items.value ->> 'caption', 500)
            ELSE ''
          END,
          'is_cover', CASE
            WHEN jsonb_typeof(items.value -> 'is_cover') = 'boolean'
              THEN items.value -> 'is_cover'
            ELSE 'false'::jsonb
          END
        ) ORDER BY items.ord
      )
      FROM (
        SELECT img.value, img.ord
        FROM jsonb_array_elements(
          CASE
            WHEN jsonb_typeof(s.data -> 'images') = 'array'
              THEN s.data -> 'images'
            ELSE '[]'::jsonb
          END
        ) WITH ORDINALITY AS img(value, ord)
        WHERE jsonb_typeof(img.value) = 'object'
          AND jsonb_typeof(img.value -> 'url') = 'string'
          AND btrim(img.value ->> 'url') <> ''
        ORDER BY img.ord
        LIMIT 30
      ) AS items
    ), '[]'::jsonb),
    'owner_name', CASE
      WHEN jsonb_typeof(s.data -> 'owner_name') = 'string'
        THEN left(s.data ->> 'owner_name', 200)
      ELSE ''
    END,
    'owner_avatar', CASE
      WHEN btrim(COALESCE(owner_profile.avatar_url, '')) <> ''
        THEN left(btrim(owner_profile.avatar_url), 2000)
      ELSE ''
    END,
    'status', 'published',
    'rating', CASE
      WHEN btrim(COALESCE(s.data ->> 'rating', '')) ~
        '^[+-]?[0-9]{1,12}([.][0-9]{1,6})?$'
        THEN btrim(s.data ->> 'rating')::numeric
      ELSE 0
    END,
    'review_count', CASE
      WHEN btrim(COALESCE(s.data ->> 'review_count', '')) ~
        '^[+-]?[0-9]{1,9}([.]0+)?$'
        THEN btrim(s.data ->> 'review_count')::numeric::integer
      ELSE 0
    END,
    'instant_book', CASE
      WHEN jsonb_typeof(s.data -> 'instant_book') = 'boolean'
        THEN s.data -> 'instant_book'
      ELSE 'false'::jsonb
    END,
    -- Demo listings (test site only) say so on the card and the listing page.
    'is_demo', CASE
      WHEN jsonb_typeof(s.data -> 'is_demo') = 'boolean'
        THEN s.data -> 'is_demo'
      ELSE 'false'::jsonb
    END,
    'created_at', CASE
      WHEN jsonb_typeof(s.data -> 'created_at') = 'string'
        THEN to_jsonb(left(s.data ->> 'created_at', 50))
      ELSE to_jsonb(s.created_at)
    END
  ) AS data
FROM public.spacego_spaces s
LEFT JOIN public.profiles owner_profile
  ON owner_profile.id::text = s.data ->> 'owner_id'
 AND owner_profile.role IN ('owner', 'admin')
WHERE s.data ->> 'status' = 'published';

COMMENT ON VIEW public.spacego_public_spaces IS
  'Public read model for published SpaceGo workspaces. Explicit allowlist; excludes owner id, owner contact details, passport notes/inspector identity, coordinates, and unknown JSONB keys. Street address and landmark only when location.address_visibility = exact. is_demo marks demo listings (test site only). owner_avatar is derived from the owner profile, not workspace JSON.';

REVOKE ALL ON TABLE public.spacego_public_spaces FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.spacego_public_spaces TO anon, authenticated;

COMMIT;
