export type UserRole = "seeker" | "owner" | "admin";

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  avatar_url?: string;
  phone?: string;
  company_name?: string;
  created_at: string;
}

export type WorkspaceCategory =
  | "coworking"
  | "private_office"
  | "meeting_room"
  | "training_room"
  | "studio"
  | "event_space";

export type VerificationLevel = "listed" | "checked" | "ready" | "pro";

export interface SpaceLocation {
  city: string;
  address: string;
  state?: string;
  country: string;
  postal_code?: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  landmark?: string;
}

export interface SpacePricing {
  hourly?: number;
  daily?: number;
  weekly?: number;
  monthly?: number;
  currency: string;
}

export interface SpacePassport {
  identity_verified: boolean;
  property_authority_verified: boolean;
  permitted_use_confirmed: boolean;
  connectivity_tested_mbps: number;
  power_backup_tested: boolean;
  fire_safety_inspected: boolean;
  inspected_by: string;
  inspected_at: string;
  renewal_date: string;
  notes: string;
}

export interface SpaceImage {
  id?: string;
  url: string;
  caption: string;
  is_cover?: boolean;
}

export interface Space {
  id: string;
  title: string;
  slug: string;
  category: WorkspaceCategory;
  headline: string;
  description: string;
  location: SpaceLocation;
  capacity: number;
  square_feet: number;
  pricing: SpacePricing;
  amenities: string[];
  operating_hours: {
    open: string;
    close: string;
    days: string[];
  };
  house_rules: string[];
  verification_level: VerificationLevel;
  passport: SpacePassport;
  images: SpaceImage[];
  owner_id: string;
  owner_name: string;
  owner_avatar: string;
  owner_email?: string;
  status: "published" | "draft" | "under_review" | "archived";
  rating: number;
  review_count: number;
  instant_book: boolean;
  created_at: string;
}

export type BookingStatus =
  | "pending"
  | "approved"
  | "declined"
  | "cancelled"
  | "completed";

export interface Booking {
  id: string;
  space_id: string;
  space_title: string;
  space_category: WorkspaceCategory;
  space_image: string;
  space_location: string;
  user_id: string;
  user_name: string;
  user_email: string;
  owner_id: string;
  start_date: string;
  end_date: string;
  duration_type: "hourly" | "daily" | "monthly";
  duration_units: number;
  seats: number;
  total_price: number;
  currency: string;
  status: BookingStatus;
  special_requests?: string;
  access_code?: string;
  created_at: string;
}

export type ActivationStatus =
  | "submitted"
  | "under_review"
  | "assessment_required"
  | "approved_for_assessment"
  | "ready_for_launch"
  | "rejected";

export interface ActivationScore {
  total: number; // 0-100
  demand_score: number; // max 30
  economics_score: number; // max 25
  readiness_score: number; // max 20
  location_score: number; // max 15
  operational_score: number; // max 10
  breakdown_notes: string;
}

export interface PropertyActivationRequest {
  id: string;
  owner_id?: string;
  owner_name: string;
  email: string;
  phone: string;
  property_address: string;
  city: string;
  property_type:
    | "vacant_floor"
    | "excess_office"
    | "retail_commercial"
    | "hotel_space"
    | "independent_building"
    | "studio_hall";
  approx_square_feet: number;
  current_condition:
    | "fully_furnished"
    | "partially_furnished"
    | "bare_shell"
    | "needs_renovation";
  existing_facilities: string[];
  expected_budget_usd: number;
  preferred_model: "self_managed" | "assisted_activation" | "managed_partner";
  target_timeline: string;
  additional_notes: string;
  photos: string[];
  status: ActivationStatus;
  activation_score?: ActivationScore;
  admin_notes?: string;
  created_at: string;
}

export interface WorkspaceEnquiry {
  id: string;
  user_id?: string;
  user_name: string;
  email: string;
  company?: string;
  location_requested: string;
  category_requested: WorkspaceCategory | "all";
  seats_needed: number;
  preferred_start: string;
  budget_range: string;
  notes: string;
  status: "new" | "contacted" | "fulfilled";
  created_at: string;
}

export interface DemandSearch {
  id: string;
  location_query: string;
  category?: string;
  seats?: number;
  has_results: boolean;
  result_count: number;
  created_at: string;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: "booking_update" | "activation_update" | "system" | "enquiry";
  read: boolean;
  link?: string;
  created_at: string;
}

export interface BlockedSlot {
  id: string;
  space_id: string;
  start_date: string;
  end_date: string;
  reason: string;
}
