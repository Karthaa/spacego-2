"use client";

import {
  Space,
  Booking,
  PropertyActivationRequest,
  WorkspaceEnquiry,
  DemandSearch,
  NotificationItem,
  ActivationStatus,
  BookingStatus,
  ActivationScore,
  UserRole,
  WorkspaceCategory,
} from "@/types";
import {
  INITIAL_SPACES,
  INITIAL_BOOKINGS,
  INITIAL_ACTIVATION_REQUESTS,
  INITIAL_DEMAND_SEARCHES,
  INITIAL_ENQUIRIES,
  INITIAL_NOTIFICATIONS,
} from "./mockData";
import {
  callRpc,
  deleteSpaceRow,
  fetchFavouriteIds,
  fetchRows,
  insertSpaceRow,
  isRemoteEnabled as isSupabaseBackendEnabled,
  REMOTE_RPCS,
  REMOTE_TABLES,
  REMOTE_VIEWS,
  setFavouriteRow,
  updateSpaceRow,
} from "./remote";
import {
  approximatePoint,
  haversineMeters,
  isValidLatLng,
  MAX_RADIUS_M,
  roundDistance,
  type LatLng,
} from "@/lib/geo";

/**
 * SpaceGo data store.
 *
 * Two modes:
 *  - Remote (Supabase configured): data lives in memory only, loaded for the
 *    signed-in viewer through RLS-filtered tables, the sanitized public view
 *    and the owner activation view. Every write goes through a validated RPC
 *    (or, for spaces/favourites, an RLS-guarded direct write) and is awaited;
 *    failures are returned to the caller, never swallowed.
 *  - Local demo (Supabase not configured): the original localStorage demo.
 *
 * Reads are synchronous snapshots. Components subscribe via
 * `useSpaceGoVersion()` (see SpaceGoDataProvider) to re-read after changes.
 */

export type StoreResult<T> = { ok: true; data: T } | { ok: false; error: string };

export type NearbySort = "distance" | "price_asc" | "price_desc" | "newest";
export type PriceUnit = "hourly" | "daily" | "monthly";

export interface NearbySearchParams {
  center: LatLng;
  radiusM: number;
  categories?: WorkspaceCategory[];
  priceUnit?: PriceUnit | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  amenities?: string[];
  minCapacity?: number | null;
  verifiedOnly?: boolean;
  instantOnly?: boolean;
  sort?: NearbySort;
  limit?: number;
  offset?: number;
}

export interface NearbySpace {
  space: Space;
  /** Approximate public point (never the exact address). */
  point: LatLng;
  /** Straight-line distance from the search centre, rounded to 100 m. */
  distanceM: number;
}

export interface NearbySearchResult {
  items: NearbySpace[];
  total: number;
  /** "server": PostGIS RPC. "demo": local sample data, filtered in the browser. */
  source: "server" | "demo";
}

interface SearchRpcRow {
  id: string;
  data: Partial<Space> & { id: string };
  approx_lat: number;
  approx_lng: number;
  distance_m: number;
  total_count: number;
}

function nearbyPrice(space: Space, unit: PriceUnit | null | undefined): number | null {
  if (unit) return space.pricing[unit] ?? null;
  return space.pricing.daily ?? space.pricing.hourly ?? space.pricing.monthly ?? null;
}

const VERIFIED_LEVELS = new Set(["checked", "ready", "pro"]);

/** Demo-mode search: the same rules as spacego_search_spaces, in the browser. */
function searchLocal(spaces: Space[], p: NearbySearchParams): NearbySearchResult {
  const radius = Math.min(Math.max(p.radiusM, 250), MAX_RADIUS_M);
  const limit = Math.min(Math.max(p.limit ?? 24, 1), 50);
  const offset = Math.max(p.offset ?? 0, 0);
  const sort = p.sort ?? "distance";

  const matches: (NearbySpace & { price: number | null })[] = [];
  for (const space of spaces) {
    if (space.status !== "published") continue;
    const c = space.location?.coordinates;
    if (!c || !isValidLatLng(c.lat, c.lng)) continue;
    const point = approximatePoint(c);
    const dist = haversineMeters(p.center, point);
    if (dist > radius) continue;
    if (p.categories?.length && !p.categories.includes(space.category)) continue;
    if (p.amenities?.length && !p.amenities.every((a) => space.amenities.includes(a))) continue;
    if (p.minCapacity && space.capacity < p.minCapacity) continue;
    if (p.verifiedOnly && !VERIFIED_LEVELS.has(space.verification_level)) continue;
    if (p.instantOnly && !space.instant_book) continue;
    const price = nearbyPrice(space, p.priceUnit);
    if (p.priceUnit && price == null) continue;
    if (p.minPrice != null && (price == null || price < p.minPrice)) continue;
    if (p.maxPrice != null && (price == null || price > p.maxPrice)) continue;
    matches.push({ space, point, distanceM: roundDistance(dist), price });
  }

  const byNum = (a: number | null, b: number | null, dir: 1 | -1) =>
    a == null ? 1 : b == null ? -1 : (a - b) * dir;
  matches.sort((a, b) => {
    let d = 0;
    if (sort === "price_asc") d = byNum(a.price, b.price, 1);
    else if (sort === "price_desc") d = byNum(a.price, b.price, -1);
    else if (sort === "newest") d = (b.space.created_at ?? "").localeCompare(a.space.created_at ?? "");
    return d || a.distanceM - b.distanceM || a.space.id.localeCompare(b.space.id);
  });

  return {
    items: matches.slice(offset, offset + limit).map(({ space, point, distanceM }) => ({ space, point, distanceM })),
    total: matches.length,
    source: "demo",
  };
}

export const NEARBY_NOT_ENABLED =
  "Location search isn't switched on for this database yet. Browse all spaces instead, or try again later.";

export interface StoreViewer {
  id: string;
  role: UserRole;
}

export interface DemandAnalyticsRow {
  location_query: string;
  category: string | null;
  total_searches: number;
  zero_result_searches: number;
  searches_with_seats: number;
}

export interface CreateBookingInput {
  space: Space;
  user: { id: string; name: string; email: string };
  start_date: string;
  end_date: string;
  duration_type: "hourly" | "daily" | "monthly";
  duration_units: number;
  seats: number;
  /** Used by local demo mode only; the server always recalculates the price. */
  total_price: number;
  special_requests?: string;
}

export type NewSpaceInput = Partial<Space> & {
  title: string;
  category: Space["category"];
};

export interface SpaceOwner {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
}

export type ActivationInput = Omit<
  PropertyActivationRequest,
  "id" | "status" | "created_at" | "activation_score" | "admin_notes"
>;

export type EnquiryInput = Omit<WorkspaceEnquiry, "id" | "status" | "created_at" | "user_id">;

const WORKSPACE_CATEGORIES: readonly WorkspaceCategory[] = [
  "coworking",
  "private_office",
  "meeting_room",
  "training_room",
  "studio",
  "event_space",
];

// Local demo storage keys. In remote mode these are never written, and any
// copies left by older builds (which cached other users' rows) are removed.
const SPACES_KEY = "spacego_spaces";
const BOOKINGS_KEY = "spacego_bookings";
const ACTIVATIONS_KEY = "spacego_activations";
const DEMAND_KEY = "spacego_demand";
const ENQUIRIES_KEY = "spacego_enquiries";
const NOTIFICATIONS_KEY = "spacego_notifications";
const FAVOURITES_KEY = "spacego_favourites";

const LEGACY_LOCAL_KEYS = [
  SPACES_KEY,
  BOOKINGS_KEY,
  ACTIVATIONS_KEY,
  DEMAND_KEY,
  ENQUIRIES_KEY,
  NOTIFICATIONS_KEY,
  FAVOURITES_KEY,
];

// ---------------------------------------------------------------------------
// Change subscription
// ---------------------------------------------------------------------------

const listeners = new Set<() => void>();
let version = 0;

function notify(): void {
  version += 1;
  listeners.forEach((listener) => listener());
}

// ---------------------------------------------------------------------------
// Remote (in-memory) state
// ---------------------------------------------------------------------------

interface RemoteState {
  spaces: Space[];
  bookings: Booking[];
  activations: PropertyActivationRequest[];
  demand: DemandSearch[];
  enquiries: WorkspaceEnquiry[];
  notifications: NotificationItem[];
  favourites: string[];
}

function emptyRemoteState(): RemoteState {
  return {
    spaces: [],
    bookings: [],
    activations: [],
    demand: [],
    enquiries: [],
    notifications: [],
    favourites: [],
  };
}

let remoteState: RemoteState = emptyRemoteState();
let viewer: StoreViewer | null = null;
let hydrateKey: string | null = null;
let hydratePromise: Promise<StoreResult<null>> | null = null;
let loadsInFlight = 0;

/** Track an in-flight remote load so screens can show loading states. */
function trackLoad(promise: Promise<StoreResult<null>>): Promise<StoreResult<null>> {
  loadsInFlight += 1;
  notify();
  return promise.finally(() => {
    loadsInFlight -= 1;
    notify();
  });
}

function remoteMode(): boolean {
  return isSupabaseBackendEnabled();
}

function viewerKey(next: StoreViewer | null): string {
  return next ? `${next.id}:${next.role}` : "anon";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function newestFirst<T extends { created_at?: string }>(items: T[]): T[] {
  return [...items].sort((a, b) =>
    (b.created_at ?? "").localeCompare(a.created_at ?? "")
  );
}

function upsertById<T extends { id: string }>(items: T[], item: T): T[] {
  const index = items.findIndex((existing) => existing.id === item.id);
  if (index === -1) return [item, ...items];
  const next = [...items];
  next[index] = item;
  return next;
}

function getStored<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch (e) {
    console.error(`Error reading ${key} from storage:`, e);
    return fallback;
  }
}

function setStored<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error(`Error writing ${key} to storage:`, e);
  }
}

function clearLegacyLocalCopies(): void {
  if (typeof window === "undefined") return;
  try {
    LEGACY_LOCAL_KEYS.forEach((key) => localStorage.removeItem(key));
  } catch {
    // Storage may be unavailable (private browsing); nothing to clean up.
  }
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

/**
 * Normalise a space row. Rows from `spacego_public_spaces` intentionally omit
 * owner_id, owner_email, coordinates and passport inspector fields, and emit
 * null for unset prices; fill safe defaults so the UI types hold.
 */
function normalizeSpace(raw: Partial<Space> & { id: string }): Space {
  const location: Partial<Space["location"]> = raw.location ?? {};
  const pricing: Partial<Space["pricing"]> = raw.pricing ?? {};
  const passport: Partial<Space["passport"]> = raw.passport ?? {};
  const hours: Partial<Space["operating_hours"]> = raw.operating_hours ?? {};

  return {
    id: raw.id,
    title: stringOr(raw.title, "Untitled workspace"),
    slug: stringOr(raw.slug, raw.id),
    category: (WORKSPACE_CATEGORIES as readonly string[]).includes(raw.category ?? "")
      ? (raw.category as WorkspaceCategory)
      : "coworking",
    headline: stringOr(raw.headline, ""),
    description: stringOr(raw.description, ""),
    location: {
      city: stringOr(location.city, ""),
      address: stringOr(location.address, ""),
      state: optionalString(location.state),
      country: stringOr(location.country, ""),
      postal_code: optionalString(location.postal_code),
      landmark: optionalString(location.landmark),
      coordinates: {
        lat: numberOr(location.coordinates?.lat, 0),
        lng: numberOr(location.coordinates?.lng, 0),
      },
    },
    capacity: numberOr(raw.capacity, 0),
    square_feet: numberOr(raw.square_feet, 0),
    pricing: {
      hourly: optionalNumber(pricing.hourly),
      daily: optionalNumber(pricing.daily),
      weekly: optionalNumber(pricing.weekly),
      monthly: optionalNumber(pricing.monthly),
      currency: stringOr(pricing.currency, "USD") || "USD",
    },
    amenities: Array.isArray(raw.amenities) ? raw.amenities : [],
    operating_hours: {
      open: stringOr(hours.open, ""),
      close: stringOr(hours.close, ""),
      days: Array.isArray(hours.days) ? hours.days : [],
    },
    house_rules: Array.isArray(raw.house_rules) ? raw.house_rules : [],
    verification_level: raw.verification_level ?? "listed",
    passport: {
      identity_verified: Boolean(passport.identity_verified),
      property_authority_verified: Boolean(passport.property_authority_verified),
      permitted_use_confirmed: Boolean(passport.permitted_use_confirmed),
      connectivity_tested_mbps: numberOr(passport.connectivity_tested_mbps, 0),
      power_backup_tested: Boolean(passport.power_backup_tested),
      fire_safety_inspected: Boolean(passport.fire_safety_inspected),
      inspected_by: stringOr(passport.inspected_by, ""),
      inspected_at: stringOr(passport.inspected_at, ""),
      renewal_date: stringOr(passport.renewal_date, ""),
      notes: stringOr(passport.notes, ""),
    },
    images: Array.isArray(raw.images) ? raw.images : [],
    owner_id: stringOr(raw.owner_id, ""),
    owner_name: stringOr(raw.owner_name, ""),
    owner_avatar: stringOr(raw.owner_avatar, ""),
    owner_email: optionalString(raw.owner_email),
    status: raw.status ?? "published",
    rating: numberOr(Number(raw.rating), 0),
    review_count: numberOr(Number(raw.review_count), 0),
    instant_book: Boolean(raw.instant_book),
    created_at: stringOr(raw.created_at, ""),
  };
}

function normalizeBooking(raw: Booking): Booking {
  return {
    ...raw,
    total_price: Number(raw.total_price) || 0,
    special_requests: optionalString(raw.special_requests),
    access_code: optionalString(raw.access_code),
  };
}

/** Owner view rows omit breakdown_notes/admin_notes and may carry null scores. */
function normalizeActivation(raw: PropertyActivationRequest): PropertyActivationRequest {
  const score = raw.activation_score as Partial<Record<keyof ActivationScore, unknown>> | null | undefined;
  const hasScore = score && typeof score === "object" && typeof score.total === "number";

  return {
    ...raw,
    existing_facilities: Array.isArray(raw.existing_facilities) ? raw.existing_facilities : [],
    photos: Array.isArray(raw.photos) ? raw.photos : [],
    approx_square_feet: Number(raw.approx_square_feet) || 0,
    expected_budget_usd: Number(raw.expected_budget_usd) || 0,
    admin_notes: optionalString(raw.admin_notes),
    activation_score: hasScore
      ? {
          total: numberOr(score.total, 0),
          demand_score: numberOr(score.demand_score, 0),
          economics_score: numberOr(score.economics_score, 0),
          readiness_score: numberOr(score.readiness_score, 0),
          location_score: numberOr(score.location_score, 0),
          operational_score: numberOr(score.operational_score, 0),
          breakdown_notes: stringOr(score.breakdown_notes, ""),
        }
      : undefined,
  };
}

function normalizeEnquiry(raw: WorkspaceEnquiry): WorkspaceEnquiry {
  return {
    ...raw,
    company: optionalString(raw.company),
    budget_range: stringOr(raw.budget_range, ""),
    notes: stringOr(raw.notes, ""),
  };
}

function normalizeDemand(raw: DemandSearch): DemandSearch {
  return {
    ...raw,
    category: optionalString(raw.category),
    seats: optionalNumber(raw.seats),
  };
}

function validCategory(category?: string): WorkspaceCategory | null {
  return category && (WORKSPACE_CATEGORIES as readonly string[]).includes(category)
    ? (category as WorkspaceCategory)
    : null;
}

function requireViewer(): StoreResult<StoreViewer> {
  if (!viewer) {
    return { ok: false, error: "Please sign in to continue." };
  }
  return { ok: true, data: viewer };
}

function newLocalId(prefix: string): string {
  const random =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `${prefix}-${random}`;
}

// ---------------------------------------------------------------------------
// Local demo helpers
// ---------------------------------------------------------------------------

function addLocalNotification(
  notification: Omit<NotificationItem, "id" | "read" | "created_at">
): void {
  const all = getStored<NotificationItem[]>(NOTIFICATIONS_KEY, INITIAL_NOTIFICATIONS);
  const newNotif: NotificationItem = {
    ...notification,
    id: newLocalId("notif"),
    read: false,
    created_at: new Date().toISOString(),
  };
  setStored(NOTIFICATIONS_KEY, [newNotif, ...all]);
}

// ---------------------------------------------------------------------------
// Remote loading
// ---------------------------------------------------------------------------

async function loadRemote(next: StoreViewer | null): Promise<StoreResult<null>> {
  const errors: string[] = [];
  const state = emptyRemoteState();

  const isOwner = next?.role === "owner";
  const isAdmin = next?.role === "admin";

  const [publicSpaces, ownSpaces, bookings, notifications, enquiries, favourites, activations, demand] =
    await Promise.all([
      fetchRows<Space>(REMOTE_VIEWS.publicSpaces),
      next && (isOwner || isAdmin) ? fetchRows<Space>(REMOTE_TABLES.spaces) : null,
      next ? fetchRows<Booking>(REMOTE_TABLES.bookings) : null,
      next ? fetchRows<NotificationItem>(REMOTE_TABLES.notifications) : null,
      next ? fetchRows<WorkspaceEnquiry>(REMOTE_TABLES.enquiries) : null,
      next ? fetchFavouriteIds(next.id) : null,
      isAdmin
        ? fetchRows<PropertyActivationRequest>(REMOTE_TABLES.activations)
        : isOwner
          ? fetchRows<PropertyActivationRequest>(REMOTE_VIEWS.ownerActivations)
          : null,
      isAdmin ? fetchRows<DemandSearch>(REMOTE_TABLES.demandSearches) : null,
    ]);

  if (publicSpaces.ok) {
    state.spaces = publicSpaces.data.map(normalizeSpace);
  } else {
    errors.push(publicSpaces.error);
  }

  if (ownSpaces) {
    if (ownSpaces.ok) {
      // Full owner/admin rows override the sanitized public copies.
      for (const space of ownSpaces.data.map(normalizeSpace)) {
        state.spaces = upsertById(state.spaces, space);
      }
    } else {
      errors.push(ownSpaces.error);
    }
  }
  state.spaces = newestFirst(state.spaces);

  if (bookings) {
    if (bookings.ok) state.bookings = newestFirst(bookings.data.map(normalizeBooking));
    else errors.push(bookings.error);
  }
  if (notifications) {
    if (notifications.ok) state.notifications = newestFirst(notifications.data);
    else errors.push(notifications.error);
  }
  if (enquiries) {
    if (enquiries.ok) state.enquiries = newestFirst(enquiries.data.map(normalizeEnquiry));
    else errors.push(enquiries.error);
  }
  if (favourites) {
    if (favourites.ok) state.favourites = favourites.data;
    else errors.push(favourites.error);
  }
  if (activations) {
    if (activations.ok) state.activations = newestFirst(activations.data.map(normalizeActivation));
    else errors.push(activations.error);
  }
  if (demand) {
    if (demand.ok) state.demand = newestFirst(demand.data.map(normalizeDemand));
    else errors.push(demand.error);
  }

  // Ignore a stale load if the viewer changed while it was in flight.
  if (viewerKey(next) !== hydrateKey) return { ok: true, data: null };

  remoteState = state;
  notify();

  if (errors.length > 0) {
    return { ok: false, error: Array.from(new Set(errors)).join(" ") };
  }
  return { ok: true, data: null };
}

async function refreshNotifications(): Promise<void> {
  if (!remoteMode() || !viewer) return;
  const key = hydrateKey;
  const result = await fetchRows<NotificationItem>(REMOTE_TABLES.notifications);
  if (!result.ok || key !== hydrateKey) return;
  remoteState = { ...remoteState, notifications: newestFirst(result.data) };
  notify();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const SpaceGoStore = {
  isRemoteEnabled: (): boolean => remoteMode(),

  subscribe: (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  getVersion: (): number => version,

  /**
   * Load the data the given viewer may see. Call again whenever the signed-in
   * user (or their role) changes. Local demo mode has nothing to load.
   */
  hydrate: (next: StoreViewer | null): Promise<StoreResult<null>> => {
    if (!remoteMode()) {
      viewer = next;
      return Promise.resolve({ ok: true, data: null });
    }

    const key = viewerKey(next);
    if (hydratePromise && hydrateKey === key) return hydratePromise;

    if (hydrateKey !== key) {
      // Drop the previous viewer's private data immediately.
      remoteState = { ...emptyRemoteState(), spaces: remoteState.spaces.filter((s) => s.status === "published") };
      notify();
    }

    viewer = next;
    hydrateKey = key;
    clearLegacyLocalCopies();
    hydratePromise = trackLoad(loadRemote(next));
    return hydratePromise;
  },

  /** True while remote data is being (re)loaded. */
  isLoading: (): boolean => loadsInFlight > 0,

  /** Re-fetch everything for the current viewer. */
  refresh: (): Promise<StoreResult<null>> => {
    if (!remoteMode()) {
      notify();
      return Promise.resolve({ ok: true, data: null });
    }
    hydratePromise = trackLoad(loadRemote(viewer));
    return hydratePromise;
  },

  // --- SPACES ---
  getSpaces: (): Space[] => {
    if (remoteMode()) return remoteState.spaces;
    return getStored<Space[]>(SPACES_KEY, INITIAL_SPACES);
  },

  /** Published spaces only — use for public discovery screens. */
  getPublishedSpaces: (): Space[] => {
    return SpaceGoStore.getSpaces().filter((s) => s.status === "published");
  },

  /**
   * Published spaces near a point. Remote mode calls the PostGIS RPC; local
   * demo mode filters the sample data with the same rules. Never falls back
   * to sample data when a real database is configured.
   */
  searchNearby: async (params: NearbySearchParams): Promise<StoreResult<NearbySearchResult>> => {
    if (!remoteMode()) {
      return { ok: true, data: searchLocal(SpaceGoStore.getSpaces(), params) };
    }

    const result = await callRpc<SearchRpcRow[]>(REMOTE_RPCS.searchSpaces, {
      p_lat: params.center.lat,
      p_lng: params.center.lng,
      p_radius_m: Math.round(Math.min(Math.max(params.radiusM, 250), MAX_RADIUS_M)),
      p_categories: params.categories?.length ? params.categories : null,
      p_min_price: params.minPrice ?? null,
      p_max_price: params.maxPrice ?? null,
      p_price_unit: params.priceUnit ?? null,
      p_amenities: params.amenities?.length ? params.amenities : null,
      p_min_capacity: params.minCapacity ?? null,
      p_verified_only: Boolean(params.verifiedOnly),
      p_instant_only: Boolean(params.instantOnly),
      p_sort: params.sort ?? "distance",
      p_limit: params.limit ?? 24,
      p_offset: params.offset ?? 0,
    });

    if (!result.ok) {
      if (/missing the required function/i.test(result.error)) {
        return { ok: false, error: NEARBY_NOT_ENABLED };
      }
      return result;
    }

    const rows = result.data ?? [];
    return {
      ok: true,
      data: {
        items: rows.map((row) => ({
          space: normalizeSpace({ ...row.data, id: row.id }),
          point: { lat: Number(row.approx_lat), lng: Number(row.approx_lng) },
          distanceM: Number(row.distance_m) || 0,
        })),
        total: rows.length > 0 ? Number(rows[0].total_count) || rows.length : 0,
        source: "server",
      },
    };
  },

  getSpaceById: (id: string): Space | undefined => {
    return SpaceGoStore.getSpaces().find((s) => s.id === id || s.slug === id);
  },

  getSpacesByOwner: (ownerId: string): Space[] => {
    return SpaceGoStore.getSpaces().filter((s) => s.owner_id === ownerId);
  },

  addSpace: async (
    newSpaceData: NewSpaceInput,
    owner: SpaceOwner
  ): Promise<StoreResult<Space>> => {
    const id = newLocalId("space");
    const baseSlug = newSpaceData.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const slug = `${baseSlug || "workspace"}-${id.slice(-6)}`;

    const space: Space = {
      id,
      slug,
      title: newSpaceData.title,
      category: newSpaceData.category,
      headline: newSpaceData.headline || "Modern professional workspace in prime location",
      description: newSpaceData.description || "Spacious, bright, and professionally maintained workspace.",
      location: newSpaceData.location || {
        city: "San Francisco",
        address: "100 Innovation Way",
        country: "United States",
        coordinates: { lat: 37.7749, lng: -122.4194 },
      },
      capacity: newSpaceData.capacity || 10,
      square_feet: newSpaceData.square_feet || 1200,
      pricing: newSpaceData.pricing || {
        hourly: 25,
        daily: 120,
        currency: "USD",
      },
      amenities: newSpaceData.amenities || [],
      operating_hours: newSpaceData.operating_hours || {
        open: "08:00",
        close: "20:00",
        days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
      },
      house_rules: newSpaceData.house_rules || [],
      // New listings start unverified; only admins raise the level. The
      // database write guard enforces this for non-admins regardless.
      verification_level: "listed",
      passport: {
        identity_verified: false,
        property_authority_verified: false,
        permitted_use_confirmed: false,
        connectivity_tested_mbps: 0,
        power_backup_tested: false,
        fire_safety_inspected: false,
        inspected_by: "",
        inspected_at: "",
        renewal_date: "",
        notes: "",
      },
      images: newSpaceData.images && newSpaceData.images.length > 0 ? newSpaceData.images : [
        {
          url: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80",
          caption: "Primary workspace",
          is_cover: true,
        },
      ],
      owner_id: owner.id,
      owner_name: owner.full_name,
      owner_avatar: owner.avatar_url || "",
      owner_email: owner.email,
      status: newSpaceData.status === "draft" ? "draft" : "published",
      rating: 5.0,
      review_count: 0,
      instant_book: Boolean(newSpaceData.instant_book),
      created_at: new Date().toISOString(),
    };

    // JSON payloads must not carry undefined-valued price keys.
    space.pricing = Object.fromEntries(
      Object.entries(space.pricing).filter(([, value]) => value !== undefined)
    ) as Space["pricing"];

    if (remoteMode()) {
      const who = requireViewer();
      if (!who.ok) return who;
      if (who.data.id !== owner.id && who.data.role !== "admin") {
        return { ok: false, error: "You can only create listings for your own account." };
      }

      const result = await insertSpaceRow(space);
      if (!result.ok) return result;
      const saved = normalizeSpace(result.data);
      remoteState = { ...remoteState, spaces: upsertById(remoteState.spaces, saved) };
      notify();
      return { ok: true, data: saved };
    }

    setStored(SPACES_KEY, [space, ...SpaceGoStore.getSpaces()]);
    notify();
    return { ok: true, data: space };
  },

  updateSpace: async (id: string, updates: Partial<Space>): Promise<StoreResult<Space>> => {
    const current = SpaceGoStore.getSpaces().find((s) => s.id === id);
    if (!current) return { ok: false, error: "Workspace not found." };

    const updatedSpace: Space = { ...current, ...updates, id: current.id };

    if (remoteMode()) {
      // Rows from the public view carry no owner_id; only owners (who load
      // their full rows) and admins (who load every row) can edit.
      if (!current.owner_id && viewer?.role !== "admin") {
        return { ok: false, error: "You can only edit workspaces you own." };
      }
      const result = await updateSpaceRow(updatedSpace);
      if (!result.ok) return result;
      const saved = normalizeSpace(result.data);
      remoteState = { ...remoteState, spaces: upsertById(remoteState.spaces, saved) };
      notify();
      return { ok: true, data: saved };
    }

    const spaces = SpaceGoStore.getSpaces().map((s) => (s.id === id ? updatedSpace : s));
    setStored(SPACES_KEY, spaces);
    notify();
    return { ok: true, data: updatedSpace };
  },

  /**
   * Admins hard-delete. Owners have no DELETE policy after the RLS hardening,
   * so their "remove" archives the listing instead.
   */
  deleteSpace: async (id: string): Promise<StoreResult<"deleted" | "archived">> => {
    if (remoteMode()) {
      const who = requireViewer();
      if (!who.ok) return who;

      if (who.data.role === "admin") {
        const result = await deleteSpaceRow(id);
        if (!result.ok) return result;
        remoteState = { ...remoteState, spaces: remoteState.spaces.filter((s) => s.id !== id) };
        notify();
        return { ok: true, data: "deleted" };
      }

      const archived = await SpaceGoStore.updateSpace(id, { status: "archived" });
      if (!archived.ok) return archived;
      return { ok: true, data: "archived" };
    }

    const spaces = SpaceGoStore.getSpaces();
    const filtered = spaces.filter((s) => s.id !== id);
    if (filtered.length === spaces.length) return { ok: false, error: "Workspace not found." };
    setStored(SPACES_KEY, filtered);
    notify();
    return { ok: true, data: "deleted" };
  },

  // --- BOOKINGS ---
  getBookings: (): Booking[] => {
    if (remoteMode()) return remoteState.bookings;
    return getStored<Booking[]>(BOOKINGS_KEY, INITIAL_BOOKINGS);
  },

  getBookingById: (id: string): Booking | undefined => {
    return SpaceGoStore.getBookings().find((b) => b.id === id);
  },

  getBookingsBySeeker: (userId: string): Booking[] => {
    return SpaceGoStore.getBookings().filter((b) => b.user_id === userId);
  },

  getBookingsByOwner: (ownerId: string): Booking[] => {
    return SpaceGoStore.getBookings().filter((b) => b.owner_id === ownerId);
  },

  /**
   * UX hint only. The server (spacego_create_booking / approval) is the source
   * of truth, and in remote mode the client can only see bookings it is a
   * party to. Mirrors the server rule: approved/completed bookings hold
   * inventory; pending requests may overlap.
   */
  checkBookingConflict: (
    spaceId: string,
    startDateStr: string,
    endDateStr: string,
    excludeBookingId?: string
  ): { hasConflict: boolean; conflictingBooking?: Booking } => {
    const reqStart = new Date(startDateStr).getTime();
    const reqEnd = new Date(endDateStr).getTime();

    const conflict = SpaceGoStore.getBookings().find((b) => {
      if (b.space_id !== spaceId) return false;
      if (excludeBookingId && b.id === excludeBookingId) return false;
      if (b.status !== "approved" && b.status !== "completed") return false;

      const bStart = new Date(b.start_date).getTime();
      const bEnd = new Date(b.end_date).getTime();
      return reqStart < bEnd && reqEnd > bStart;
    });

    return { hasConflict: Boolean(conflict), conflictingBooking: conflict };
  },

  createBooking: async (bookingInput: CreateBookingInput): Promise<StoreResult<Booking>> => {
    const { hasConflict } = SpaceGoStore.checkBookingConflict(
      bookingInput.space.id,
      bookingInput.start_date,
      bookingInput.end_date
    );
    if (hasConflict) {
      return {
        ok: false,
        error: "This space is already booked during this period. Please select alternative dates or times.",
      };
    }

    if (remoteMode()) {
      const who = requireViewer();
      if (!who.ok) return who;

      const result = await callRpc<Booking>(REMOTE_RPCS.createBooking, {
        p_space_id: bookingInput.space.id,
        p_start_date: bookingInput.start_date,
        p_end_date: bookingInput.end_date,
        p_duration_type: bookingInput.duration_type,
        p_duration_units: bookingInput.duration_units,
        p_seats: bookingInput.seats,
        p_special_requests: bookingInput.special_requests?.trim() || null,
      });
      if (!result.ok) return result;
      if (!result.data || typeof result.data !== "object") {
        return { ok: false, error: "The booking service returned an unexpected response." };
      }

      const booking = normalizeBooking(result.data);
      remoteState = { ...remoteState, bookings: upsertById(remoteState.bookings, booking) };
      notify();
      void refreshNotifications();
      return { ok: true, data: booking };
    }

    const id = `SPG-${new Date().getFullYear()}-${newLocalId("x").slice(2, 8).toUpperCase()}`;
    const status: BookingStatus = bookingInput.space.instant_book ? "approved" : "pending";
    const accessCode =
      status === "approved"
        ? `PASS-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
        : undefined;

    const newBooking: Booking = {
      id,
      space_id: bookingInput.space.id,
      space_title: bookingInput.space.title,
      space_category: bookingInput.space.category,
      space_image: bookingInput.space.images[0]?.url || "",
      space_location: `${bookingInput.space.location.city}, ${bookingInput.space.location.country}`,
      user_id: bookingInput.user.id,
      user_name: bookingInput.user.name,
      user_email: bookingInput.user.email,
      owner_id: bookingInput.space.owner_id,
      start_date: bookingInput.start_date,
      end_date: bookingInput.end_date,
      duration_type: bookingInput.duration_type,
      duration_units: bookingInput.duration_units,
      seats: bookingInput.seats,
      total_price: bookingInput.total_price,
      currency: bookingInput.space.pricing.currency || "USD",
      status,
      special_requests: bookingInput.special_requests,
      access_code: accessCode,
      created_at: new Date().toISOString(),
    };

    setStored(BOOKINGS_KEY, [newBooking, ...SpaceGoStore.getBookings()]);

    addLocalNotification({
      user_id: bookingInput.space.owner_id,
      title: "New Booking Request",
      message: `${bookingInput.user.name} submitted a ${bookingInput.duration_type} request for ${bookingInput.space.title} (${id}).`,
      type: "booking_update",
      link: "/owner/bookings",
    });
    addLocalNotification({
      user_id: bookingInput.user.id,
      title: status === "approved" ? "Booking Confirmed!" : "Booking Request Received",
      message:
        status === "approved"
          ? `Your booking at ${bookingInput.space.title} is confirmed. Pass code: ${accessCode}`
          : `Your request for ${bookingInput.space.title} is awaiting host approval. Reference: ${id}`,
      type: "booking_update",
      link: "/dashboard/bookings",
    });

    notify();
    return { ok: true, data: newBooking };
  },

  updateBookingStatus: async (
    id: string,
    status: BookingStatus,
    note?: string
  ): Promise<StoreResult<Booking>> => {
    if (remoteMode()) {
      const who = requireViewer();
      if (!who.ok) return who;

      const result = await callRpc<Booking>(REMOTE_RPCS.updateBookingStatus, {
        p_booking_id: id,
        p_new_status: status,
        p_note: note?.trim() || null,
      });
      if (!result.ok) return result;
      if (!result.data || typeof result.data !== "object") {
        return { ok: false, error: "The booking service returned an unexpected response." };
      }

      const booking = normalizeBooking(result.data);
      remoteState = { ...remoteState, bookings: upsertById(remoteState.bookings, booking) };
      notify();
      void refreshNotifications();
      return { ok: true, data: booking };
    }

    const bookings = SpaceGoStore.getBookings();
    const index = bookings.findIndex((b) => b.id === id);
    if (index === -1) return { ok: false, error: "Booking not found." };

    const booking = { ...bookings[index], status };
    bookings[index] = booking;
    setStored(BOOKINGS_KEY, bookings);

    addLocalNotification({
      user_id: booking.user_id,
      title: `Booking Status: ${status.toUpperCase()}`,
      message: `Your booking for ${booking.space_title} (${id}) has been updated to ${status}.`,
      type: "booking_update",
      link: "/dashboard/bookings",
    });

    notify();
    return { ok: true, data: booking };
  },

  // --- PROPERTY ACTIVATION SERVICE ---
  getActivationRequests: (): PropertyActivationRequest[] => {
    if (remoteMode()) return remoteState.activations;
    return getStored<PropertyActivationRequest[]>(ACTIVATIONS_KEY, INITIAL_ACTIVATION_REQUESTS);
  },

  getActivationRequestById: (id: string): PropertyActivationRequest | undefined => {
    const needle = id.trim().toLowerCase();
    return SpaceGoStore.getActivationRequests().find((item) => item.id.toLowerCase() === needle);
  },

  getActivationRequestsByOwner: (ownerEmailOrId: string): PropertyActivationRequest[] => {
    const needle = ownerEmailOrId.toLowerCase();
    return SpaceGoStore.getActivationRequests().filter(
      (item) => item.owner_id === ownerEmailOrId || item.email.toLowerCase() === needle
    );
  },

  createActivationRequest: async (
    data: ActivationInput
  ): Promise<StoreResult<PropertyActivationRequest>> => {
    if (remoteMode()) {
      const who = requireViewer();
      if (!who.ok) return who;

      // The server assigns id, owner_id, status and timestamps; scoring is
      // done by the review team, not the browser.
      const result = await callRpc<PropertyActivationRequest>(REMOTE_RPCS.submitActivation, {
        p_data: {
          owner_name: data.owner_name,
          email: data.email,
          phone: data.phone,
          property_address: data.property_address,
          city: data.city,
          property_type: data.property_type,
          approx_square_feet: data.approx_square_feet,
          current_condition: data.current_condition,
          existing_facilities: data.existing_facilities,
          expected_budget_usd: data.expected_budget_usd,
          preferred_model: data.preferred_model,
          target_timeline: data.target_timeline,
          additional_notes: data.additional_notes,
          photos: data.photos,
        },
      });
      if (!result.ok) return result;
      if (!result.data || typeof result.data !== "object") {
        return { ok: false, error: "The activation service returned an unexpected response." };
      }

      const request = normalizeActivation(result.data);
      remoteState = { ...remoteState, activations: upsertById(remoteState.activations, request) };
      notify();
      void refreshNotifications();
      return { ok: true, data: request };
    }

    const id = `ACT-${new Date().getFullYear()}-${newLocalId("x").slice(2, 8).toUpperCase()}`;

    // Demo-only preliminary score.
    let readinessScore = 12;
    if (data.current_condition === "fully_furnished") readinessScore = 19;
    else if (data.current_condition === "partially_furnished") readinessScore = 16;
    else if (data.current_condition === "bare_shell") readinessScore = 13;
    else readinessScore = 9;

    const facilitiesBonus = Math.min(data.existing_facilities.length * 1.5, 6);
    const demandScore = Math.floor(20 + Math.random() * 8);
    const econScore = Math.floor(18 + Math.random() * 6);
    const locScore = 12;
    const opScore = 8;
    const totalScore = Math.min(
      100,
      Math.round(demandScore + econScore + readinessScore + facilitiesBonus + locScore + opScore)
    );

    const newRequest: PropertyActivationRequest = {
      ...data,
      id,
      status: "submitted",
      activation_score: {
        total: totalScore,
        demand_score: demandScore,
        economics_score: econScore,
        readiness_score: Math.min(20, Math.round(readinessScore + facilitiesBonus)),
        location_score: locScore,
        operational_score: opScore,
        breakdown_notes: `Preliminary score calculated. Property provides ${data.approx_square_feet} sq.ft. in ${data.city}. Verification team will validate on-site layout and electrical capacity.`,
      },
      created_at: new Date().toISOString(),
    };

    setStored(ACTIVATIONS_KEY, [newRequest, ...SpaceGoStore.getActivationRequests()]);

    if (data.owner_id) {
      addLocalNotification({
        user_id: data.owner_id,
        title: "Property Activation Request Submitted",
        message: `Your activation request for ${data.property_address} (${id}) is now queued for preliminary screening.`,
        type: "activation_update",
        link: `/activation/track?ref=${id}`,
      });
    }

    notify();
    return { ok: true, data: newRequest };
  },

  updateActivationStatus: async (
    id: string,
    status: ActivationStatus,
    adminNotes?: string,
    scoreUpdates?: Partial<ActivationScore>
  ): Promise<StoreResult<PropertyActivationRequest>> => {
    if (remoteMode()) {
      const who = requireViewer();
      if (!who.ok) return who;

      const result = await callRpc<PropertyActivationRequest>(REMOTE_RPCS.updateActivationStatus, {
        p_activation_id: id,
        p_status: status,
        p_admin_notes: adminNotes ?? null,
        p_score: scoreUpdates && Object.keys(scoreUpdates).length > 0 ? scoreUpdates : null,
      });
      if (!result.ok) return result;
      if (!result.data || typeof result.data !== "object") {
        return { ok: false, error: "The activation service returned an unexpected response." };
      }

      const request = normalizeActivation(result.data);
      remoteState = { ...remoteState, activations: upsertById(remoteState.activations, request) };
      notify();
      void refreshNotifications();
      return { ok: true, data: request };
    }

    const list = SpaceGoStore.getActivationRequests();
    const index = list.findIndex((a) => a.id.toLowerCase() === id.toLowerCase());
    if (index === -1) return { ok: false, error: "Activation request not found." };

    const request: PropertyActivationRequest = { ...list[index], status };
    if (adminNotes !== undefined) request.admin_notes = adminNotes;
    if (scoreUpdates && request.activation_score) {
      request.activation_score = { ...request.activation_score, ...scoreUpdates };
    }

    list[index] = request;
    setStored(ACTIVATIONS_KEY, list);

    if (request.owner_id) {
      addLocalNotification({
        user_id: request.owner_id,
        title: `Activation Request Status: ${status.replace("_", " ").toUpperCase()}`,
        message: `Status updated for ${request.property_address} (${request.id}).`,
        type: "activation_update",
        link: `/activation/track?ref=${request.id}`,
      });
    }

    notify();
    return { ok: true, data: request };
  },

  // --- DEMAND INTELLIGENCE & ENQUIRIES ---
  getDemandSearches: (): DemandSearch[] => {
    if (remoteMode()) return remoteState.demand;
    return getStored<DemandSearch[]>(DEMAND_KEY, INITIAL_DEMAND_SEARCHES);
  },

  /**
   * Record an anonymous demand signal. Failures are logged, not shown: search
   * must keep working even if logging is rate limited or unavailable.
   */
  logSearchQuery: async (query: {
    location: string;
    category?: string;
    seats?: number;
    resultCount: number;
  }): Promise<void> => {
    const location = query.location.trim();
    if (!location) return;
    const category = validCategory(query.category);
    const seats =
      query.seats && Number.isInteger(query.seats) && query.seats >= 1 && query.seats <= 10000
        ? query.seats
        : null;
    const resultCount = Math.max(0, Math.floor(query.resultCount) || 0);

    if (remoteMode()) {
      const result = await callRpc<string>(REMOTE_RPCS.logDemand, {
        p_location: location,
        p_category: category,
        p_seats: seats,
        p_result_count: resultCount,
      });
      if (!result.ok) console.warn("SpaceGo: demand signal not recorded:", result.error);
      return;
    }

    const newEntry: DemandSearch = {
      id: newLocalId("ds"),
      location_query: location,
      category: category ?? undefined,
      seats: seats ?? undefined,
      has_results: resultCount > 0,
      result_count: resultCount,
      created_at: new Date().toISOString(),
    };
    setStored(DEMAND_KEY, [newEntry, ...SpaceGoStore.getDemandSearches()].slice(0, 100));
    notify();
  },

  /** Admin-only aggregate of demand signals (server-side in remote mode). */
  getDemandAnalytics: async (days = 90): Promise<StoreResult<DemandAnalyticsRow[]>> => {
    if (remoteMode()) {
      const result = await callRpc<DemandAnalyticsRow[]>(REMOTE_RPCS.demandAnalytics, {
        p_days: days,
      });
      if (!result.ok) return result;
      return {
        ok: true,
        data: (result.data ?? []).map((row) => ({
          location_query: String(row.location_query ?? "(unknown)"),
          category: row.category ?? null,
          total_searches: Number(row.total_searches) || 0,
          zero_result_searches: Number(row.zero_result_searches) || 0,
          searches_with_seats: Number(row.searches_with_seats) || 0,
        })),
      };
    }

    const since = Date.now() - days * 24 * 3600 * 1000;
    const groups = new Map<string, DemandAnalyticsRow>();
    for (const s of SpaceGoStore.getDemandSearches()) {
      const created = new Date(s.created_at).getTime();
      if (Number.isFinite(created) && created < since) continue;
      const location = s.location_query.trim() || "(unknown)";
      const category = s.category ?? null;
      const key = `${location}\u0000${category ?? ""}`;
      const row = groups.get(key) ?? {
        location_query: location,
        category,
        total_searches: 0,
        zero_result_searches: 0,
        searches_with_seats: 0,
      };
      row.total_searches += 1;
      if (!s.has_results) row.zero_result_searches += 1;
      if (s.seats) row.searches_with_seats += 1;
      groups.set(key, row);
    }
    return {
      ok: true,
      data: Array.from(groups.values()).sort(
        (a, b) => b.total_searches - a.total_searches || a.location_query.localeCompare(b.location_query)
      ),
    };
  },

  getEnquiries: (): WorkspaceEnquiry[] => {
    if (remoteMode()) return remoteState.enquiries;
    return getStored<WorkspaceEnquiry[]>(ENQUIRIES_KEY, INITIAL_ENQUIRIES);
  },

  getEnquiriesByUser: (userId: string): WorkspaceEnquiry[] => {
    return SpaceGoStore.getEnquiries().filter((e) => e.user_id === userId);
  },

  createEnquiry: async (data: EnquiryInput): Promise<StoreResult<WorkspaceEnquiry>> => {
    if (remoteMode()) {
      const preferredStart = /^\d{4}-\d{2}-\d{2}$/.test(data.preferred_start)
        ? data.preferred_start
        : null;

      const result = await callRpc<WorkspaceEnquiry>(REMOTE_RPCS.submitEnquiry, {
        p_user_name: data.user_name,
        p_email: data.email,
        p_company: data.company ?? null,
        p_location_requested: data.location_requested,
        p_category_requested: data.category_requested,
        p_seats_needed: data.seats_needed,
        p_preferred_start: preferredStart,
        p_budget_range: data.budget_range,
        p_notes: data.notes,
      });
      if (!result.ok) return result;
      if (!result.data || typeof result.data !== "object") {
        return { ok: false, error: "The request service returned an unexpected response." };
      }

      // Anonymous callers receive only a receipt ({ id, status, created_at }).
      if (viewer) {
        const enquiry = normalizeEnquiry(result.data);
        remoteState = { ...remoteState, enquiries: upsertById(remoteState.enquiries, enquiry) };
        notify();
        return { ok: true, data: enquiry };
      }
      return {
        ok: true,
        data: normalizeEnquiry({ ...data, ...result.data, user_id: undefined }),
      };
    }

    const newEnquiry: WorkspaceEnquiry = {
      ...data,
      user_id: viewer?.id,
      id: newLocalId("enq"),
      status: "new",
      created_at: new Date().toISOString(),
    };
    setStored(ENQUIRIES_KEY, [newEnquiry, ...SpaceGoStore.getEnquiries()]);
    notify();
    return { ok: true, data: newEnquiry };
  },

  updateEnquiryStatus: async (
    id: string,
    status: WorkspaceEnquiry["status"]
  ): Promise<StoreResult<WorkspaceEnquiry>> => {
    if (remoteMode()) {
      const who = requireViewer();
      if (!who.ok) return who;

      const result = await callRpc<WorkspaceEnquiry>(REMOTE_RPCS.updateEnquiryStatus, {
        p_enquiry_id: id,
        p_status: status,
      });
      if (!result.ok) return result;
      if (!result.data || typeof result.data !== "object") {
        return { ok: false, error: "The request service returned an unexpected response." };
      }

      const enquiry = normalizeEnquiry(result.data);
      remoteState = { ...remoteState, enquiries: upsertById(remoteState.enquiries, enquiry) };
      notify();
      return { ok: true, data: enquiry };
    }

    const list = SpaceGoStore.getEnquiries();
    const index = list.findIndex((e) => e.id === id);
    if (index === -1) return { ok: false, error: "Request not found." };
    const enquiry = { ...list[index], status };
    list[index] = enquiry;
    setStored(ENQUIRIES_KEY, list);
    notify();
    return { ok: true, data: enquiry };
  },

  // --- FAVOURITES ---
  getUserFavourites: (userId: string): string[] => {
    if (remoteMode()) {
      return viewer && viewer.id === userId ? remoteState.favourites : [];
    }
    const allFavs = getStored<Record<string, string[]>>(FAVOURITES_KEY, {});
    return allFavs[userId] || [];
  },

  /** Returns the new favourite state on success. */
  toggleFavourite: async (userId: string, spaceId: string): Promise<StoreResult<boolean>> => {
    const isFav = SpaceGoStore.getUserFavourites(userId).includes(spaceId);
    const nextActive = !isFav;

    if (remoteMode()) {
      const who = requireViewer();
      if (!who.ok) return who;
      if (who.data.id !== userId) {
        return { ok: false, error: "You can only change your own favourites." };
      }

      const result = await setFavouriteRow(userId, spaceId, nextActive);
      if (!result.ok) return result;

      remoteState = {
        ...remoteState,
        favourites: nextActive
          ? Array.from(new Set([...remoteState.favourites, spaceId]))
          : remoteState.favourites.filter((id) => id !== spaceId),
      };
      notify();
      return { ok: true, data: nextActive };
    }

    const allFavs = getStored<Record<string, string[]>>(FAVOURITES_KEY, {});
    const currentList = allFavs[userId] || [];
    allFavs[userId] = nextActive
      ? [...currentList, spaceId]
      : currentList.filter((id) => id !== spaceId);
    setStored(FAVOURITES_KEY, allFavs);
    notify();
    return { ok: true, data: nextActive };
  },

  // --- NOTIFICATIONS ---
  getUserNotifications: (userId: string): NotificationItem[] => {
    if (remoteMode()) {
      return remoteState.notifications.filter((n) => n.user_id === userId);
    }
    const all = getStored<NotificationItem[]>(NOTIFICATIONS_KEY, INITIAL_NOTIFICATIONS);
    return all.filter((n) => n.user_id === userId);
  },

  markNotificationRead: async (id: string): Promise<StoreResult<null>> => {
    if (remoteMode()) {
      const who = requireViewer();
      if (!who.ok) return who;

      const result = await callRpc<NotificationItem>(REMOTE_RPCS.markNotificationRead, {
        p_notification_id: id,
        p_read: true,
      });
      if (!result.ok) return result;
      remoteState = {
        ...remoteState,
        notifications: remoteState.notifications.map((n) =>
          n.id === id ? { ...n, read: true } : n
        ),
      };
      notify();
      return { ok: true, data: null };
    }

    const all = getStored<NotificationItem[]>(NOTIFICATIONS_KEY, INITIAL_NOTIFICATIONS);
    const item = all.find((n) => n.id === id);
    if (!item) return { ok: false, error: "Notification not found." };
    item.read = true;
    setStored(NOTIFICATIONS_KEY, all);
    notify();
    return { ok: true, data: null };
  },
};
