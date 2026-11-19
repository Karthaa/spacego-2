-- ============================================================
-- SPACEGO APP-STATE TABLES (Supabase demo backend)
-- ============================================================
-- The client types in src/types use string IDs and nested objects, while
-- 20261108_init.sql models a UUID/Supabase-Auth production schema. These
-- tables intentionally mirror the client types so the existing demo store can
-- move from localStorage to Supabase without rewriting every page.
--
-- Apply this migration in the Supabase SQL editor before setting
-- NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
--
-- The RLS policies below are permissive because this is a public demo with no
-- Supabase Auth session. Tighten them before using real user data.

-- 1. Spaces
CREATE TABLE IF NOT EXISTS public.spacego_spaces (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_spacego_spaces_created ON public.spacego_spaces(created_at);

-- 2. Bookings
CREATE TABLE IF NOT EXISTS public.spacego_bookings (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_spacego_bookings_created ON public.spacego_bookings(created_at);

-- 3. Property activation requests
CREATE TABLE IF NOT EXISTS public.spacego_activations (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_spacego_activations_created ON public.spacego_activations(created_at);

-- 4. Demand searches
CREATE TABLE IF NOT EXISTS public.spacego_demand_searches (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_spacego_demand_created ON public.spacego_demand_searches(created_at);

-- 5. Workspace enquiries
CREATE TABLE IF NOT EXISTS public.spacego_enquiries (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_spacego_enquiries_created ON public.spacego_enquiries(created_at);

-- 6. Notifications
CREATE TABLE IF NOT EXISTS public.spacego_notifications (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_spacego_notifications_created ON public.spacego_notifications(created_at);

-- 7. Favourites
CREATE TABLE IF NOT EXISTS public.spacego_favourites (
  user_id TEXT NOT NULL,
  space_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, space_id)
);
CREATE INDEX IF NOT EXISTS idx_spacego_favourites_user ON public.spacego_favourites(user_id);

-- ============================================================
-- RLS: public demo access
-- ============================================================
ALTER TABLE public.spacego_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spacego_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spacego_activations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spacego_demand_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spacego_enquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spacego_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spacego_favourites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "spacego_demo_all" ON public.spacego_spaces;
CREATE POLICY "spacego_demo_all" ON public.spacego_spaces
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "spacego_demo_all" ON public.spacego_bookings;
CREATE POLICY "spacego_demo_all" ON public.spacego_bookings
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "spacego_demo_all" ON public.spacego_activations;
CREATE POLICY "spacego_demo_all" ON public.spacego_activations
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "spacego_demo_all" ON public.spacego_demand_searches;
CREATE POLICY "spacego_demo_all" ON public.spacego_demand_searches
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "spacego_demo_all" ON public.spacego_enquiries;
CREATE POLICY "spacego_demo_all" ON public.spacego_enquiries
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "spacego_demo_all" ON public.spacego_notifications;
CREATE POLICY "spacego_demo_all" ON public.spacego_notifications
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "spacego_demo_all" ON public.spacego_favourites;
CREATE POLICY "spacego_demo_all" ON public.spacego_favourites
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.spacego_spaces,
  public.spacego_bookings,
  public.spacego_activations,
  public.spacego_demand_searches,
  public.spacego_enquiries,
  public.spacego_notifications,
  public.spacego_favourites
TO anon, authenticated;
