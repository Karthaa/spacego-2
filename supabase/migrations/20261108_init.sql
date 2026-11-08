-- ============================================================
-- SPACEGO DATABASE INITIAL SCHEMA & SECURITY POLICIES
-- Production PostgreSQL schema for SpaceGo Workspace Platform
-- ============================================================

-- 1. Profiles Table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('seeker', 'owner', 'admin')) DEFAULT 'seeker',
  avatar_url TEXT,
  phone TEXT,
  company_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Spaces Table
CREATE TABLE IF NOT EXISTS public.spaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('coworking', 'private_office', 'meeting_room', 'training_room', 'studio', 'event_space')),
  headline TEXT NOT NULL,
  description TEXT NOT NULL,
  
  -- Location JSON / columns
  city TEXT NOT NULL,
  address TEXT NOT NULL,
  state TEXT,
  country TEXT NOT NULL DEFAULT 'United States',
  postal_code TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  landmark TEXT,

  capacity INTEGER NOT NULL CHECK (capacity > 0),
  square_feet INTEGER NOT NULL CHECK (square_feet > 0),
  
  -- Pricing (Hourly, Daily, Monthly)
  price_hourly NUMERIC(10, 2),
  price_daily NUMERIC(10, 2),
  price_weekly NUMERIC(10, 2),
  price_monthly NUMERIC(10, 2),
  currency TEXT NOT NULL DEFAULT 'USD',
  
  -- Amenities & Operating Info
  amenities TEXT[] NOT NULL DEFAULT '{}',
  operating_hours JSONB NOT NULL DEFAULT '{"open":"08:00","close":"20:00","days":["Mon","Tue","Wed","Thu","Fri"]}',
  house_rules TEXT[] NOT NULL DEFAULT '{}',
  
  -- Verification & Space Passport
  verification_level TEXT NOT NULL CHECK (verification_level IN ('listed', 'checked', 'ready', 'pro')) DEFAULT 'listed',
  passport JSONB NOT NULL DEFAULT '{}',
  
  status TEXT NOT NULL CHECK (status IN ('published', 'draft', 'under_review', 'archived')) DEFAULT 'published',
  rating NUMERIC(3, 2) NOT NULL DEFAULT 5.0,
  review_count INTEGER NOT NULL DEFAULT 0,
  instant_book BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for lightning fast marketplace queries
CREATE INDEX IF NOT EXISTS idx_spaces_city ON public.spaces(city);
CREATE INDEX IF NOT EXISTS idx_spaces_category ON public.spaces(category);
CREATE INDEX IF NOT EXISTS idx_spaces_status ON public.spaces(status);
CREATE INDEX IF NOT EXISTS idx_spaces_price_daily ON public.spaces(price_daily);
CREATE INDEX IF NOT EXISTS idx_spaces_capacity ON public.spaces(capacity);
CREATE INDEX IF NOT EXISTS idx_spaces_verification ON public.spaces(verification_level);

-- 3. Space Images Table
CREATE TABLE IF NOT EXISTS public.space_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  caption TEXT,
  is_cover BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_space_images_space_id ON public.space_images(space_id);

-- 4. Bookings Table
CREATE TABLE IF NOT EXISTS public.bookings (
  id TEXT PRIMARY KEY, -- e.g. SPG-2026-8941
  space_id UUID NOT NULL REFERENCES public.spaces(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  duration_type TEXT NOT NULL CHECK (duration_type IN ('hourly', 'daily', 'monthly')),
  duration_units INTEGER NOT NULL CHECK (duration_units > 0),
  seats INTEGER NOT NULL CHECK (seats > 0),
  total_price NUMERIC(10, 2) NOT NULL CHECK (total_price >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'declined', 'cancelled', 'completed')) DEFAULT 'pending',
  special_requests TEXT,
  access_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_booking_dates CHECK (end_date > start_date)
);

CREATE INDEX IF NOT EXISTS idx_bookings_user ON public.bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_owner ON public.bookings(owner_id);
CREATE INDEX IF NOT EXISTS idx_bookings_space ON public.bookings(space_id);
CREATE INDEX IF NOT EXISTS idx_bookings_dates ON public.bookings(space_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);

-- 5. Availability Rules & Blocked Slots
CREATE TABLE IF NOT EXISTS public.blocked_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  reason TEXT NOT NULL DEFAULT 'Owner blocked',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blocked_slots_space ON public.blocked_slots(space_id, start_date, end_date);

-- 6. User Favourites
CREATE TABLE IF NOT EXISTS public.favourites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  space_id UUID NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, space_id)
);

-- 7. Property Activation Requests (Demand-Backed Space Activation)
CREATE TABLE IF NOT EXISTS public.property_activation_requests (
  id TEXT PRIMARY KEY, -- e.g. ACT-2026-3420
  owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  owner_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  property_address TEXT NOT NULL,
  city TEXT NOT NULL,
  property_type TEXT NOT NULL CHECK (property_type IN ('vacant_floor', 'excess_office', 'retail_commercial', 'hotel_space', 'independent_building', 'studio_hall')),
  approx_square_feet INTEGER NOT NULL,
  current_condition TEXT NOT NULL CHECK (current_condition IN ('fully_furnished', 'partially_furnished', 'bare_shell', 'needs_renovation')),
  existing_facilities TEXT[] NOT NULL DEFAULT '{}',
  expected_budget_usd NUMERIC(12, 2) NOT NULL DEFAULT 0,
  preferred_model TEXT NOT NULL CHECK (preferred_model IN ('self_managed', 'assisted_activation', 'managed_partner')),
  target_timeline TEXT NOT NULL,
  additional_notes TEXT,
  photos TEXT[] NOT NULL DEFAULT '{}',
  
  status TEXT NOT NULL CHECK (status IN ('submitted', 'under_review', 'assessment_required', 'approved_for_assessment', 'ready_for_launch', 'rejected')) DEFAULT 'submitted',
  activation_score JSONB,
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activation_status ON public.property_activation_requests(status);
CREATE INDEX IF NOT EXISTS idx_activation_city ON public.property_activation_requests(city);

-- 8. Workspace Enquiries & Custom Demand Requests
CREATE TABLE IF NOT EXISTS public.workspace_enquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT,
  location_requested TEXT NOT NULL,
  category_requested TEXT NOT NULL,
  seats_needed INTEGER NOT NULL,
  preferred_start DATE,
  budget_range TEXT,
  notes TEXT,
  status TEXT NOT NULL CHECK (status IN ('new', 'contacted', 'fulfilled')) DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Demand Searches (Demand Intelligence)
CREATE TABLE IF NOT EXISTS public.demand_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_query TEXT NOT NULL,
  category TEXT,
  seats INTEGER,
  has_results BOOLEAN NOT NULL DEFAULT TRUE,
  result_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_demand_searches_location ON public.demand_searches(location_query);
CREATE INDEX IF NOT EXISTS idx_demand_searches_created ON public.demand_searches(created_at);

-- 10. Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('booking_update', 'activation_update', 'system', 'enquiry')),
  read BOOLEAN NOT NULL DEFAULT FALSE,
  link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, read);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.space_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favourites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_activation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_enquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demand_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Helper function to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Profiles: Public can read profile basics, users can update own, admin can do all
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins full profile access" ON public.profiles FOR ALL USING (public.is_admin());

-- Spaces: Public can view published spaces, owners can view/edit their own, admins all
CREATE POLICY "Anyone can view published spaces" ON public.spaces FOR SELECT 
  USING (status = 'published' OR owner_id = auth.uid() OR public.is_admin());
CREATE POLICY "Owners can insert their spaces" ON public.spaces FOR INSERT 
  WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners can update their spaces" ON public.spaces FOR UPDATE 
  USING (auth.uid() = owner_id OR public.is_admin());
CREATE POLICY "Owners can delete their spaces" ON public.spaces FOR DELETE 
  USING (auth.uid() = owner_id OR public.is_admin());

-- Space Images: Anyone can view, space owner can manage
CREATE POLICY "Anyone can view images" ON public.space_images FOR SELECT USING (true);
CREATE POLICY "Owners manage images" ON public.space_images FOR ALL 
  USING (EXISTS (SELECT 1 FROM public.spaces WHERE id = space_images.space_id AND owner_id = auth.uid()) OR public.is_admin());

-- Bookings: Customers see their bookings, owners see bookings for their spaces, admins see all
CREATE POLICY "Users can view their bookings" ON public.bookings FOR SELECT 
  USING (user_id = auth.uid() OR owner_id = auth.uid() OR public.is_admin());
CREATE POLICY "Users can create bookings" ON public.bookings FOR INSERT 
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users or owners can update bookings" ON public.bookings FOR UPDATE 
  USING (user_id = auth.uid() OR owner_id = auth.uid() OR public.is_admin());

-- Blocked Slots: Public can view, owner can manage
CREATE POLICY "Public can view blocked slots" ON public.blocked_slots FOR SELECT USING (true);
CREATE POLICY "Owners manage blocked slots" ON public.blocked_slots FOR ALL 
  USING (EXISTS (SELECT 1 FROM public.spaces WHERE id = blocked_slots.space_id AND owner_id = auth.uid()) OR public.is_admin());

-- Favourites: User manages own favourites
CREATE POLICY "Users manage own favourites" ON public.favourites FOR ALL 
  USING (user_id = auth.uid());

-- Property Activation Requests: Owner sees own, admin sees all
CREATE POLICY "Submit activation request" ON public.property_activation_requests FOR INSERT 
  WITH CHECK (true);
CREATE POLICY "View activation request" ON public.property_activation_requests FOR SELECT 
  USING (owner_id = auth.uid() OR public.is_admin());
CREATE POLICY "Admin update activation" ON public.property_activation_requests FOR UPDATE 
  USING (public.is_admin());

-- Workspace Enquiries: Anyone can insert, admin can view/update
CREATE POLICY "Submit enquiry" ON public.workspace_enquiries FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin view enquiry" ON public.workspace_enquiries FOR ALL USING (public.is_admin());

-- Demand Searches: Anyone can log a search, admin can view
CREATE POLICY "Log search" ON public.demand_searches FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin view demand" ON public.demand_searches FOR SELECT USING (public.is_admin());

-- Notifications: User sees own notifications
CREATE POLICY "User sees own notifications" ON public.notifications FOR ALL 
  USING (user_id = auth.uid() OR public.is_admin());
