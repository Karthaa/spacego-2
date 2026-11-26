-- SpaceGo: keep exact street addresses private until a booking is confirmed.
--
-- Forward-only, non-destructive. Re-runnable. Apply AFTER
-- 20261121_spacego_rls_hardening.sql (and after 20261126/20261127/20261128,
-- although it does not depend on them).
--
-- What it does
--   1. Re-creates public.spacego_public_spaces with the same columns and the
--      same allowlist, except:
--        * location.address and location.landmark are returned only when the
--          host chose location.address_visibility = 'exact' (shown before
--          booking). Everyone else sees city / state / country / postal code.
--        * location.address_visibility is now exposed ('exact' | 'approximate').
--      Rows are not modified; the default for every existing listing is
--      'approximate' (address hidden), which is the privacy-safe default.
--   2. Adds public.spacego_space_address(p_space_id) for signed-in users. It
--      returns the street address, landmark, postal code and exact pin only to
--      the listing's owner, an admin, or a guest who holds an approved
--      (confirmed) or completed booking for that space. Everyone else gets no
--      row. Pending, declined and cancelled bookings do not unlock it.
--
-- Rollback (manual, only if needed): re-run the spacego_public_spaces view
-- block from 20261121_spacego_rls_hardening.sql and
-- DROP FUNCTION public.spacego_space_address(text);

DO $$
BEGIN
  IF to_regclass('public.spacego_public_spaces') IS NULL
     OR to_regclass('public.spacego_bookings') IS NULL THEN
    RAISE EXCEPTION 'Apply 20261121_spacego_rls_hardening.sql first';
  END IF;
END
$$;

-- 1. Public read model -------------------------------------------------------
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
        'training_room', 'studio', 'event_space'
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
  'Public read model for published SpaceGo workspaces. Explicit allowlist; excludes owner id, owner contact details, passport notes/inspector identity, coordinates, and unknown JSONB keys. Street address and landmark only when location.address_visibility = exact. owner_avatar is derived from the owner profile, not workspace JSON.';

REVOKE ALL ON TABLE public.spacego_public_spaces FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.spacego_public_spaces TO anon, authenticated;

-- 2. Address for confirmed guests -------------------------------------------
CREATE OR REPLACE FUNCTION public.spacego_space_address(p_space_id text)
RETURNS TABLE (
  address text,
  landmark text,
  postal_code text,
  city text,
  country text,
  lat double precision,
  lng double precision
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_space jsonb;
  v_allowed boolean := false;
  v_lat text;
  v_lng text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to see the address'
      USING ERRCODE = '42501';
  END IF;

  IF p_space_id IS NULL OR length(p_space_id) > 200 THEN
    RETURN;
  END IF;

  SELECT s.data INTO v_space
  FROM public.spacego_spaces s
  WHERE s.id = p_space_id;

  IF v_space IS NULL THEN
    RETURN;
  END IF;

  IF COALESCE(v_space ->> 'owner_id', '') = v_uid::text
     OR public.is_admin() THEN
    v_allowed := true;
  ELSIF EXISTS (
    SELECT 1
    FROM public.spacego_bookings b
    WHERE b.data ->> 'space_id' = p_space_id
      AND b.data ->> 'user_id' = v_uid::text
      AND b.data ->> 'status' IN ('approved', 'completed')
  ) THEN
    v_allowed := true;
  END IF;

  IF NOT v_allowed THEN
    RETURN;
  END IF;

  v_lat := v_space -> 'location' -> 'coordinates' ->> 'lat';
  v_lng := v_space -> 'location' -> 'coordinates' ->> 'lng';

  RETURN QUERY SELECT
    left(COALESCE(v_space -> 'location' ->> 'address', ''), 500),
    left(COALESCE(v_space -> 'location' ->> 'landmark', ''), 200),
    left(COALESCE(v_space -> 'location' ->> 'postal_code', ''), 40),
    left(COALESCE(v_space -> 'location' ->> 'city', ''), 160),
    left(COALESCE(v_space -> 'location' ->> 'country', ''), 160),
    CASE WHEN v_lat ~ '^-?[0-9]{1,3}([.][0-9]{1,20})?$' THEN v_lat::double precision END,
    CASE WHEN v_lng ~ '^-?[0-9]{1,3}([.][0-9]{1,20})?$' THEN v_lng::double precision END;
END
$$;

COMMENT ON FUNCTION public.spacego_space_address(text) IS
  'Street address and exact pin of a workspace, for its owner, admins, and guests with an approved or completed booking only.';

REVOKE ALL ON FUNCTION public.spacego_space_address(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.spacego_space_address(text) TO authenticated;

NOTIFY pgrst, 'reload schema';
