-- ============================================================
-- SpaceGo: location search (PostGIS)
-- ============================================================
-- Forward-only and additive. Apply to STAGING first.
--
-- What it does
--   1. Enables PostGIS in the `extensions` schema (Supabase convention).
--   2. Adds a STORED generated column `geo_public` to public.spacego_spaces.
--      It holds an APPROXIMATE point: the listing's coordinates snapped to a
--      0.005 degree grid (about 550 m north-south). The exact coordinates in
--      the JSON payload are never returned by anything in this migration.
--   3. Adds a GiST index on that column.
--   4. Adds public.spacego_search_spaces(...), a SECURITY DEFINER RPC that
--      returns PUBLISHED listings only, within a radius of a point, with
--      optional filters, sorting and pagination. Rows are read through the
--      existing allowlisted view public.spacego_public_spaces, so the RPC
--      cannot leak any field the public view does not already expose.
--      Radius filtering and distances use the approximate point as well, so
--      the exact location cannot be recovered by probing with many radii.
--
-- What it does NOT do
--   - No data is modified or deleted. No policy is dropped or weakened.
--   - No existing function or view is replaced.
--
-- Also adds public.spacego_public_space_point(id), the approximate point of
-- one published listing, for the map on the listing page.
--
-- Rollback (manual, if ever needed):
--   DROP FUNCTION IF EXISTS public.spacego_public_space_point(text);
--   DROP FUNCTION IF EXISTS public.spacego_search_spaces(
--     double precision, double precision, integer, text[], numeric, numeric,
--     text, text[], integer, boolean, boolean, text, integer, integer);
--   DROP INDEX IF EXISTS public.spacego_spaces_geo_public_idx;
--   ALTER TABLE public.spacego_spaces DROP COLUMN IF EXISTS geo_public;
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 0. Preconditions
-- ------------------------------------------------------------
DO $guard$
DECLARE
  v_schema text;
BEGIN
  IF to_regclass('public.spacego_spaces') IS NULL THEN
    RAISE EXCEPTION 'public.spacego_spaces is missing; apply earlier SpaceGo migrations first';
  END IF;
  IF to_regclass('public.spacego_public_spaces') IS NULL THEN
    RAISE EXCEPTION 'public.spacego_public_spaces is missing; apply 20261121_spacego_rls_hardening.sql first';
  END IF;

  SELECT n.nspname INTO v_schema
  FROM pg_extension e
  JOIN pg_namespace n ON n.oid = e.extnamespace
  WHERE e.extname = 'postgis';

  IF v_schema IS NOT NULL AND v_schema <> 'extensions' THEN
    RAISE EXCEPTION
      'PostGIS is installed in schema %, expected extensions. Nothing was changed.', v_schema;
  END IF;
END
$guard$;

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;

-- ------------------------------------------------------------
-- 1. Approximate public point
-- ------------------------------------------------------------
-- Nested CASE keeps the casts behind the format checks (AND does not
-- guarantee evaluation order). Invalid or missing coordinates give NULL,
-- which simply keeps a listing out of location search.
ALTER TABLE public.spacego_spaces
  ADD COLUMN IF NOT EXISTS geo_public extensions.geography(Point, 4326)
  GENERATED ALWAYS AS (
    CASE
      WHEN (data -> 'location' -> 'coordinates' ->> 'lat') ~ '^-?[0-9]{1,3}([.][0-9]{1,20})?$'
       AND (data -> 'location' -> 'coordinates' ->> 'lng') ~ '^-?[0-9]{1,3}([.][0-9]{1,20})?$'
      THEN
        CASE
          WHEN abs((data -> 'location' -> 'coordinates' ->> 'lat')::numeric) <= 85
           AND abs((data -> 'location' -> 'coordinates' ->> 'lng')::numeric) <= 180
           AND NOT (
             (data -> 'location' -> 'coordinates' ->> 'lat')::numeric = 0
             AND (data -> 'location' -> 'coordinates' ->> 'lng')::numeric = 0
           )
          THEN extensions.st_setsrid(
            extensions.st_makepoint(
              (round((data -> 'location' -> 'coordinates' ->> 'lng')::numeric / 0.005) * 0.005)::double precision,
              (round((data -> 'location' -> 'coordinates' ->> 'lat')::numeric / 0.005) * 0.005)::double precision
            ),
            4326
          )::extensions.geography
        END
    END
  ) STORED;

COMMENT ON COLUMN public.spacego_spaces.geo_public IS
  'Approximate public location (coordinates snapped to a 0.005 degree grid). Used only for location search; exact coordinates stay in the private JSON payload.';

CREATE INDEX IF NOT EXISTS spacego_spaces_geo_public_idx
  ON public.spacego_spaces USING gist (geo_public);

-- ------------------------------------------------------------
-- 2. Search RPC
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.spacego_search_spaces(
  p_lat double precision,
  p_lng double precision,
  p_radius_m integer DEFAULT 5000,
  p_categories text[] DEFAULT NULL,
  p_min_price numeric DEFAULT NULL,
  p_max_price numeric DEFAULT NULL,
  p_price_unit text DEFAULT NULL,
  p_amenities text[] DEFAULT NULL,
  p_min_capacity integer DEFAULT NULL,
  p_verified_only boolean DEFAULT false,
  p_instant_only boolean DEFAULT false,
  p_sort text DEFAULT 'distance',
  p_limit integer DEFAULT 24,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id text,
  data jsonb,
  approx_lat double precision,
  approx_lng double precision,
  distance_m integer,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_origin extensions.geography;
  v_radius integer;
  v_limit integer;
  v_offset integer;
  v_unit text;
  v_sort text;
BEGIN
  IF p_lat IS NULL OR p_lng IS NULL
     OR p_lat < -85 OR p_lat > 85 OR p_lng < -180 OR p_lng > 180 THEN
    RAISE EXCEPTION 'Invalid search location' USING ERRCODE = '22023';
  END IF;

  v_radius := least(greatest(coalesce(p_radius_m, 5000), 250), 50000);
  v_limit := least(greatest(coalesce(p_limit, 24), 1), 50);
  v_offset := least(greatest(coalesce(p_offset, 0), 0), 1000);
  v_unit := CASE WHEN p_price_unit IN ('hourly', 'daily', 'weekly', 'monthly') THEN p_price_unit END;
  v_sort := CASE WHEN p_sort IN ('distance', 'price_asc', 'price_desc', 'newest') THEN p_sort ELSE 'distance' END;

  IF p_categories IS NOT NULL AND cardinality(p_categories) > 10 THEN
    RAISE EXCEPTION 'Too many categories' USING ERRCODE = '22023';
  END IF;
  IF p_amenities IS NOT NULL AND cardinality(p_amenities) > 20 THEN
    RAISE EXCEPTION 'Too many amenities' USING ERRCODE = '22023';
  END IF;

  v_origin := extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography;

  RETURN QUERY
  WITH candidates AS (
    SELECT
      v.id,
      v.data,
      s.geo_public,
      extensions.st_distance(s.geo_public, v_origin) AS dist,
      CASE
        WHEN v_unit IS NOT NULL THEN
          CASE WHEN (v.data -> 'pricing' ->> v_unit) ~ '^[0-9]{1,12}([.][0-9]{1,4})?$'
            THEN (v.data -> 'pricing' ->> v_unit)::numeric END
        ELSE coalesce(
          CASE WHEN (v.data -> 'pricing' ->> 'daily') ~ '^[0-9]{1,12}([.][0-9]{1,4})?$'
            THEN (v.data -> 'pricing' ->> 'daily')::numeric END,
          CASE WHEN (v.data -> 'pricing' ->> 'hourly') ~ '^[0-9]{1,12}([.][0-9]{1,4})?$'
            THEN (v.data -> 'pricing' ->> 'hourly')::numeric END,
          CASE WHEN (v.data -> 'pricing' ->> 'monthly') ~ '^[0-9]{1,12}([.][0-9]{1,4})?$'
            THEN (v.data -> 'pricing' ->> 'monthly')::numeric END
        )
      END AS price,
      v.created_at
    FROM public.spacego_public_spaces v
    JOIN public.spacego_spaces s ON s.id = v.id
    WHERE s.geo_public IS NOT NULL
      AND extensions.st_dwithin(s.geo_public, v_origin, v_radius)
      AND (p_categories IS NULL OR cardinality(p_categories) = 0
           OR v.data ->> 'category' = ANY (p_categories))
      AND (p_amenities IS NULL OR cardinality(p_amenities) = 0
           OR (v.data -> 'amenities') ?& p_amenities)
      AND (p_min_capacity IS NULL
           OR coalesce((v.data ->> 'capacity')::integer, 0) >= p_min_capacity)
      AND (NOT coalesce(p_verified_only, false)
           OR v.data ->> 'verification_level' IN ('checked', 'ready', 'pro'))
      AND (NOT coalesce(p_instant_only, false)
           OR (v.data -> 'instant_book') = 'true'::jsonb)
  ),
  filtered AS (
    SELECT c.*
    FROM candidates c
    WHERE (v_unit IS NULL OR c.price IS NOT NULL)
      AND (p_min_price IS NULL OR (c.price IS NOT NULL AND c.price >= p_min_price))
      AND (p_max_price IS NULL OR (c.price IS NOT NULL AND c.price <= p_max_price))
  )
  SELECT
    f.id,
    f.data,
    extensions.st_y(f.geo_public::extensions.geometry),
    extensions.st_x(f.geo_public::extensions.geometry),
    (round(f.dist / 100.0) * 100)::integer,
    count(*) OVER ()
  FROM filtered f
  ORDER BY
    CASE WHEN v_sort = 'distance' THEN f.dist END ASC NULLS LAST,
    CASE WHEN v_sort = 'price_asc' THEN f.price END ASC NULLS LAST,
    CASE WHEN v_sort = 'price_desc' THEN f.price END DESC NULLS LAST,
    CASE WHEN v_sort = 'newest' THEN f.created_at END DESC NULLS LAST,
    f.dist ASC,
    f.id ASC
  LIMIT v_limit
  OFFSET v_offset;
END;
$fn$;

COMMENT ON FUNCTION public.spacego_search_spaces(
  double precision, double precision, integer, text[], numeric, numeric,
  text, text[], integer, boolean, boolean, text, integer, integer
) IS
  'Location search over PUBLISHED SpaceGo listings. Reads through spacego_public_spaces; returns approximate points and straight-line distances rounded to 100 m. Radius 250 m to 50 km, page size up to 50.';

REVOKE ALL ON FUNCTION public.spacego_search_spaces(
  double precision, double precision, integer, text[], numeric, numeric,
  text, text[], integer, boolean, boolean, text, integer, integer
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.spacego_search_spaces(
  double precision, double precision, integer, text[], numeric, numeric,
  text, text[], integer, boolean, boolean, text, integer, integer
) TO anon, authenticated;

-- ------------------------------------------------------------
-- 3. Approximate point for one published listing (detail page map)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.spacego_public_space_point(p_id text)
RETURNS TABLE (approx_lat double precision, approx_lng double precision)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
  SELECT
    extensions.st_y(s.geo_public::extensions.geometry),
    extensions.st_x(s.geo_public::extensions.geometry)
  FROM public.spacego_spaces s
  WHERE (s.id = p_id OR s.data ->> 'slug' = p_id)
    AND s.data ->> 'status' = 'published'
    AND s.geo_public IS NOT NULL
  LIMIT 1;
$fn$;

COMMENT ON FUNCTION public.spacego_public_space_point(text) IS
  'Approximate public point (0.005 degree grid) of one PUBLISHED listing, for the listing page map. Never the exact coordinates.';

REVOKE ALL ON FUNCTION public.spacego_public_space_point(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.spacego_public_space_point(text) TO anon, authenticated;

-- Ask PostgREST to pick up the new function.
NOTIFY pgrst, 'reload schema';

COMMIT;
