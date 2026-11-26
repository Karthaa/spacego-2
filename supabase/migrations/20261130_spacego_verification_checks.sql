-- SpaceGo: verification tiers must be backed by recorded checks.
--
-- Forward-only, non-destructive, re-runnable. Apply AFTER
-- 20261127_spacego_listing_review.sql (it writes to that file's audit table).
--
-- Before this, an admin could give a listing the "Reviewed by SpaceGo",
-- "SpaceGo Ready" or "SpaceGo Pro" badge from a dropdown without recording
-- what was actually checked. From now on:
--   * A tier above 'listed' needs at least one recorded check in
--     data.passport (identity, right to list, permitted use, backup power,
--     fire safety, or a measured internet speed) and the date of the checks
--     (passport.inspected_at).
--   * Every change to the recorded checks or the tier is written to
--     spacego_listing_review_events (action 'checks_recorded'), with the
--     list of checks in the reason column.
-- Owners still cannot change the tier or the checks: the existing write guard
-- from 20261121 restores both on every owner write, and this trigger runs
-- after it.
--
-- Existing rows are not modified. A listing that already has a tier without
-- recorded checks keeps it until an admin next edits its tier or checks.
--
-- Rollback (manual): DROP TRIGGER spacego_verification_checks ON
-- public.spacego_spaces; DROP FUNCTION public.spacego_verification_checks();
-- DROP FUNCTION public.spacego_passport_checks(jsonb);

DO $$
BEGIN
  IF to_regclass('public.spacego_listing_review_events') IS NULL THEN
    RAISE EXCEPTION 'Apply 20261127_spacego_listing_review.sql first';
  END IF;
END
$$;

-- The recorded checks in a passport, as a sorted text array.
CREATE OR REPLACE FUNCTION public.spacego_passport_checks(p_passport jsonb)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT COALESCE(array_agg(k ORDER BY k), ARRAY[]::text[])
  FROM (
    SELECT k
    FROM unnest(ARRAY[
      'identity_verified', 'property_authority_verified', 'permitted_use_confirmed',
      'power_backup_tested', 'fire_safety_inspected'
    ]) AS k
    WHERE COALESCE(p_passport -> k, 'false'::jsonb) = 'true'::jsonb
    UNION ALL
    SELECT 'connectivity_tested_mbps'
    WHERE COALESCE(p_passport ->> 'connectivity_tested_mbps', '') ~ '^[0-9]{1,5}([.][0-9]+)?$'
      AND (p_passport ->> 'connectivity_tested_mbps')::numeric > 0
  ) facts;
$$;

REVOKE ALL ON FUNCTION public.spacego_passport_checks(jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.spacego_verification_checks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_level text := COALESCE(NEW.data ->> 'verification_level', 'listed');
  v_checks text[] := public.spacego_passport_checks(NEW.data -> 'passport');
  v_old_checks text[];
  v_changed boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_old_checks := ARRAY[]::text[];
    v_changed := v_level <> 'listed' OR cardinality(v_checks) > 0;
  ELSE
    v_old_checks := public.spacego_passport_checks(OLD.data -> 'passport');
    v_changed := v_level IS DISTINCT FROM COALESCE(OLD.data ->> 'verification_level', 'listed')
      OR v_checks IS DISTINCT FROM v_old_checks
      OR NEW.data -> 'passport' ->> 'inspected_at' IS DISTINCT FROM OLD.data -> 'passport' ->> 'inspected_at';
  END IF;

  IF NOT v_changed THEN
    RETURN NEW;
  END IF;

  IF v_level <> 'listed' AND cardinality(v_checks) = 0 THEN
    RAISE EXCEPTION 'A verification tier needs at least one recorded check'
      USING ERRCODE = '23514';
  END IF;

  IF cardinality(v_checks) > 0
     AND COALESCE(NEW.data -> 'passport' ->> 'inspected_at', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN
    RAISE EXCEPTION 'Record the date the checks were done'
      USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.spacego_listing_review_events (space_id, actor_id, action, from_state, to_state, reason)
  VALUES (
    NEW.id,
    auth.uid(),
    'checks_recorded',
    CASE WHEN TG_OP = 'UPDATE' THEN COALESCE(OLD.data ->> 'verification_level', 'listed') END,
    v_level,
    left(array_to_string(v_checks, ', '), 500)
  );

  RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION public.spacego_verification_checks() FROM PUBLIC, anon, authenticated;

-- Trigger names fire in alphabetical order: this runs after
-- spacego_enforce_payload_id, spacego_guard_space_write (which restores the
-- tier and checks on owner writes) and spacego_listing_review.
DROP TRIGGER IF EXISTS spacego_verification_checks ON public.spacego_spaces;
CREATE TRIGGER spacego_verification_checks
  BEFORE INSERT OR UPDATE ON public.spacego_spaces
  FOR EACH ROW EXECUTE FUNCTION public.spacego_verification_checks();

NOTIFY pgrst, 'reload schema';
