-- ============================================================
-- SpaceGo: listing review (owners submit, SpaceGo admins decide)
-- ============================================================
-- Forward-only and additive. Apply to STAGING first, after
-- 20261121_spacego_rls_hardening.sql. Independent of the geo migration.
--
-- Review state lives in data.review (never exposed by the public view):
--   { state, reason, submitted_at, decided_at }
--   state: draft | pending | approved | changes_requested | rejected | suspended
--
-- Rules (enforced in the database, whatever the client sends):
--   - Only an APPROVED listing can be published. New owner listings start as
--     draft. Owners cannot set or edit data.review themselves.
--   - Owners submit with spacego_submit_listing_for_review(id): needs at least
--     one photo and valid map coordinates. Works from draft or
--     changes_requested; rejected and suspended listings cannot be resubmitted.
--   - If an owner changes a key fact of an approved listing (title, type,
--     address, city, coordinates or capacity), it goes back to pending and is
--     unpublished until an admin approves it again.
--   - Admins decide with spacego_review_listing(id, decision, reason):
--     approve | request_changes | reject | suspend. Every decision except
--     approve needs a reason; the owner is notified; every change is written
--     to spacego_listing_review_events (admin-readable audit log).
--   - Listings published before this migration count as approved
--     (grandfathered) without rewriting any row.
--
-- No rows are modified or deleted. No existing policy, function or view is
-- replaced; one trigger and two RPCs are added.
--
-- Rollback (manual):
--   DROP TRIGGER IF EXISTS spacego_listing_review ON public.spacego_spaces;
--   DROP FUNCTION IF EXISTS public.spacego_listing_review_guard();
--   DROP FUNCTION IF EXISTS public.spacego_submit_listing_for_review(text);
--   DROP FUNCTION IF EXISTS public.spacego_review_listing(text, text, text);
--   DROP FUNCTION IF EXISTS public.spacego_review_state(jsonb);
--   DROP TABLE IF EXISTS public.spacego_listing_review_events;
-- ============================================================

BEGIN;

DO $guard$
BEGIN
  IF to_regclass('public.spacego_spaces') IS NULL
     OR to_regprocedure('public.spacego_create_notification(text,text,text,text,text)') IS NULL
     OR to_regprocedure('public.is_admin()') IS NULL THEN
    RAISE EXCEPTION 'Apply 20261120 and 20261121 SpaceGo migrations first. Nothing was changed.';
  END IF;
END
$guard$;

-- ------------------------------------------------------------
-- 1. Audit log
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.spacego_listing_review_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  space_id text NOT NULL,
  actor_id uuid,
  action text NOT NULL,
  from_state text,
  to_state text NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS spacego_listing_review_events_space_idx
  ON public.spacego_listing_review_events (space_id, created_at DESC);

ALTER TABLE public.spacego_listing_review_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.spacego_listing_review_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.spacego_listing_review_events TO authenticated;

DROP POLICY IF EXISTS spacego_listing_review_events_admin_read ON public.spacego_listing_review_events;
CREATE POLICY spacego_listing_review_events_admin_read
  ON public.spacego_listing_review_events
  FOR SELECT TO authenticated
  USING (public.is_admin());

COMMENT ON TABLE public.spacego_listing_review_events IS
  'Append-only audit of listing review decisions. Written only by SECURITY DEFINER functions; readable by admins.';

-- ------------------------------------------------------------
-- 2. Effective review state (grandfathers old published rows)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.spacego_review_state(p_data jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $fn$
  SELECT CASE
    WHEN p_data -> 'review' ->> 'state' IN
      ('draft', 'pending', 'approved', 'changes_requested', 'rejected', 'suspended')
      THEN p_data -> 'review' ->> 'state'
    WHEN p_data ->> 'status' = 'published' THEN 'approved'
    ELSE 'draft'
  END;
$fn$;

REVOKE ALL ON FUNCTION public.spacego_review_state(jsonb) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------
-- 3. Write guard (runs after spacego_guard_space_write: triggers fire in
--    name order, and "spacego_listing_review" sorts after it)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.spacego_listing_review_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_is_admin boolean := public.is_admin();
  v_action text := current_setting('spacego.review_action', true);
  v_old_state text;
  v_new_state text;
  v_review jsonb;
  v_key_changed boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF v_is_admin THEN
      v_new_state := CASE
        WHEN NEW.data ->> 'status' = 'published' THEN 'approved'
        ELSE public.spacego_review_state(NEW.data)
      END;
    ELSE
      v_new_state := 'draft';
      IF NEW.data ->> 'status' = 'published' THEN
        NEW.data := NEW.data || jsonb_build_object('status', 'draft');
      END IF;
    END IF;
    NEW.data := NEW.data || jsonb_build_object('review', jsonb_build_object(
      'state', v_new_state,
      'reason', '',
      'submitted_at', '',
      'decided_at', CASE WHEN v_new_state = 'approved' THEN to_jsonb(now()::text) ELSE '""'::jsonb END
    ));
    INSERT INTO public.spacego_listing_review_events (space_id, actor_id, action, from_state, to_state)
    VALUES (NEW.id, auth.uid(), 'created', NULL, v_new_state);
    RETURN NEW;
  END IF;

  v_old_state := public.spacego_review_state(OLD.data);
  v_review := COALESCE(OLD.data -> 'review', '{}'::jsonb);

  -- The review RPCs set spacego.review_action for their own update only. The
  -- flag is honoured only for the change that RPC is allowed to make, so
  -- setting it some other way gains nothing.
  IF (v_action = 'decide' AND v_is_admin)
     OR (v_action = 'submit'
         AND NEW.data -> 'review' ->> 'state' = 'pending'
         AND v_old_state IN ('draft', 'changes_requested')
         AND NEW.data ->> 'status' IS DISTINCT FROM 'published') THEN
    v_new_state := public.spacego_review_state(NEW.data);
    IF v_new_state IS DISTINCT FROM v_old_state THEN
      INSERT INTO public.spacego_listing_review_events
        (space_id, actor_id, action, from_state, to_state, reason)
      VALUES (NEW.id, auth.uid(), v_action, v_old_state, v_new_state,
              NULLIF(NEW.data -> 'review' ->> 'reason', ''));
    END IF;
    RETURN NEW;
  END IF;

  IF v_is_admin THEN
    -- Direct admin edits: publishing counts as approval; anything else keeps
    -- whatever review state the admin wrote (or the previous one).
    v_new_state := CASE
      WHEN NEW.data ->> 'status' = 'published' THEN 'approved'
      ELSE COALESCE(
        CASE WHEN NEW.data -> 'review' ->> 'state' IN
          ('draft', 'pending', 'approved', 'changes_requested', 'rejected', 'suspended')
          THEN NEW.data -> 'review' ->> 'state' END,
        v_old_state)
    END;
    NEW.data := NEW.data || jsonb_build_object('review',
      COALESCE(NEW.data -> 'review', v_review) || jsonb_build_object(
        'state', v_new_state,
        'decided_at', CASE WHEN v_new_state <> v_old_state THEN to_jsonb(now()::text)
                           ELSE COALESCE(v_review -> 'decided_at', '""'::jsonb) END
      ));
    IF v_new_state IS DISTINCT FROM v_old_state THEN
      INSERT INTO public.spacego_listing_review_events (space_id, actor_id, action, from_state, to_state)
      VALUES (NEW.id, auth.uid(), 'admin_edit', v_old_state, v_new_state);
    END IF;
    RETURN NEW;
  END IF;

  -- Owners (the base guard has already checked ownership).
  NEW.data := NEW.data || jsonb_build_object('review', v_review || jsonb_build_object('state', v_old_state));
  v_new_state := v_old_state;

  v_key_changed :=
       NEW.data ->> 'title' IS DISTINCT FROM OLD.data ->> 'title'
    OR NEW.data ->> 'category' IS DISTINCT FROM OLD.data ->> 'category'
    OR NEW.data -> 'location' ->> 'address' IS DISTINCT FROM OLD.data -> 'location' ->> 'address'
    OR NEW.data -> 'location' ->> 'city' IS DISTINCT FROM OLD.data -> 'location' ->> 'city'
    OR NEW.data -> 'location' -> 'coordinates' IS DISTINCT FROM OLD.data -> 'location' -> 'coordinates'
    OR NEW.data ->> 'capacity' IS DISTINCT FROM OLD.data ->> 'capacity'
    -- Choosing to show the full street address before booking is reviewed too.
    OR (NEW.data -> 'location' ->> 'address_visibility' = 'exact'
        AND OLD.data -> 'location' ->> 'address_visibility' IS DISTINCT FROM 'exact');

  IF v_old_state = 'approved' AND v_key_changed THEN
    v_new_state := 'pending';
    NEW.data := NEW.data || jsonb_build_object(
      'status', 'draft',
      'review', v_review || jsonb_build_object(
        'state', 'pending',
        'reason', '',
        'submitted_at', to_jsonb(now()::text)
      )
    );
    INSERT INTO public.spacego_listing_review_events (space_id, actor_id, action, from_state, to_state)
    VALUES (NEW.id, auth.uid(), 'key_facts_changed', v_old_state, 'pending');
    RETURN NEW;
  END IF;

  IF NEW.data ->> 'status' = 'published'
     AND OLD.data ->> 'status' IS DISTINCT FROM 'published'
     AND v_new_state <> 'approved' THEN
    RAISE EXCEPTION 'This listing needs SpaceGo approval before it can be published. Submit it for review first.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.spacego_listing_review_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS spacego_listing_review ON public.spacego_spaces;
CREATE TRIGGER spacego_listing_review
  BEFORE INSERT OR UPDATE ON public.spacego_spaces
  FOR EACH ROW EXECUTE FUNCTION public.spacego_listing_review_guard();

-- ------------------------------------------------------------
-- 4. Owner: submit for review
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.spacego_submit_listing_for_review(p_space_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.spacego_spaces%ROWTYPE;
  v_state text;
  v_lat text;
  v_lng text;
  v_admin record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to submit a listing' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row FROM public.spacego_spaces WHERE id = p_space_id FOR UPDATE;
  IF NOT FOUND OR v_row.data ->> 'owner_id' IS DISTINCT FROM v_uid::text THEN
    RAISE EXCEPTION 'Listing not found' USING ERRCODE = 'P0002';
  END IF;

  v_state := public.spacego_review_state(v_row.data);
  IF v_state = 'pending' THEN
    RETURN v_row.data;
  END IF;
  IF v_state NOT IN ('draft', 'changes_requested') THEN
    RAISE EXCEPTION 'This listing cannot be submitted (current review state: %).', v_state
      USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(v_row.data -> 'images') IS DISTINCT FROM 'array'
     OR jsonb_array_length(v_row.data -> 'images') = 0 THEN
    RAISE EXCEPTION 'Add at least one photo before submitting.' USING ERRCODE = '22023';
  END IF;

  v_lat := v_row.data -> 'location' -> 'coordinates' ->> 'lat';
  v_lng := v_row.data -> 'location' -> 'coordinates' ->> 'lng';
  IF v_lat IS NULL OR v_lng IS NULL
     OR v_lat !~ '^-?[0-9]{1,3}([.][0-9]{1,20})?$'
     OR v_lng !~ '^-?[0-9]{1,3}([.][0-9]{1,20})?$' THEN
    RAISE EXCEPTION 'Set the location on the map before submitting.' USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('spacego.review_action', 'submit', true);
  UPDATE public.spacego_spaces
  SET data = data || jsonb_build_object(
    'status', 'draft',
    'review', COALESCE(data -> 'review', '{}'::jsonb) || jsonb_build_object(
      'state', 'pending',
      'reason', '',
      'submitted_at', to_jsonb(now()::text)
    )
  )
  WHERE id = p_space_id
  RETURNING * INTO v_row;
  PERFORM set_config('spacego.review_action', '', true);

  FOR v_admin IN SELECT p.id FROM public.profiles p WHERE p.role = 'admin' LOOP
    PERFORM public.spacego_create_notification(
      v_admin.id::text,
      'Listing waiting for review',
      left(COALESCE(v_row.data ->> 'title', 'A listing'), 200) || ' was submitted for review.',
      'system',
      '/admin/spaces'
    );
  END LOOP;

  RETURN v_row.data;
END;
$fn$;

REVOKE ALL ON FUNCTION public.spacego_submit_listing_for_review(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.spacego_submit_listing_for_review(text) TO authenticated;

-- ------------------------------------------------------------
-- 5. Admin: decide
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.spacego_review_listing(
  p_space_id text,
  p_decision text,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_row public.spacego_spaces%ROWTYPE;
  v_state text;
  v_to text;
  v_status text;
  v_reason text := left(btrim(COALESCE(p_reason, '')), 1000);
  v_title text;
  v_message text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only SpaceGo admins can review listings' USING ERRCODE = '42501';
  END IF;

  v_to := CASE p_decision
    WHEN 'approve' THEN 'approved'
    WHEN 'request_changes' THEN 'changes_requested'
    WHEN 'reject' THEN 'rejected'
    WHEN 'suspend' THEN 'suspended'
  END;
  IF v_to IS NULL THEN
    RAISE EXCEPTION 'Unknown decision' USING ERRCODE = '22023';
  END IF;
  IF v_to <> 'approved' AND length(v_reason) < 10 THEN
    RAISE EXCEPTION 'Give the host a reason (at least 10 characters).' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_row FROM public.spacego_spaces WHERE id = p_space_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Listing not found' USING ERRCODE = 'P0002';
  END IF;

  v_state := public.spacego_review_state(v_row.data);
  IF p_decision = 'suspend' AND v_state <> 'approved' THEN
    RAISE EXCEPTION 'Only approved listings can be suspended' USING ERRCODE = '22023';
  END IF;
  IF p_decision IN ('approve', 'request_changes', 'reject')
     AND v_state NOT IN ('pending', 'suspended', 'changes_requested', 'draft') THEN
    RAISE EXCEPTION 'This listing is not waiting for a decision (current: %).', v_state
      USING ERRCODE = '22023';
  END IF;

  v_status := CASE WHEN v_to = 'approved' THEN 'published' ELSE 'draft' END;

  PERFORM set_config('spacego.review_action', 'decide', true);
  UPDATE public.spacego_spaces
  SET data = data || jsonb_build_object(
    'status', v_status,
    'review', COALESCE(data -> 'review', '{}'::jsonb) || jsonb_build_object(
      'state', v_to,
      'reason', v_reason,
      'decided_at', to_jsonb(now()::text)
    )
  )
  WHERE id = p_space_id
  RETURNING * INTO v_row;
  PERFORM set_config('spacego.review_action', '', true);

  v_title := left(COALESCE(v_row.data ->> 'title', 'Your listing'), 200);
  v_message := CASE v_to
    WHEN 'approved' THEN v_title || ' was approved and is now live.'
    WHEN 'changes_requested' THEN v_title || ' needs changes: ' || v_reason
    WHEN 'rejected' THEN v_title || ' was not approved: ' || v_reason
    WHEN 'suspended' THEN v_title || ' was taken offline: ' || v_reason
  END;
  PERFORM public.spacego_create_notification(
    v_row.data ->> 'owner_id',
    CASE v_to
      WHEN 'approved' THEN 'Listing approved'
      WHEN 'changes_requested' THEN 'Changes requested'
      WHEN 'rejected' THEN 'Listing not approved'
      ELSE 'Listing suspended'
    END,
    v_message,
    'system',
    '/owner/properties'
  );

  RETURN v_row.data;
END;
$fn$;

REVOKE ALL ON FUNCTION public.spacego_review_listing(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.spacego_review_listing(text, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
