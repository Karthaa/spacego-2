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
} from "@/types";
import {
  INITIAL_SPACES,
  INITIAL_BOOKINGS,
  INITIAL_ACTIVATION_REQUESTS,
  INITIAL_DEMAND_SEARCHES,
  INITIAL_ENQUIRIES,
  INITIAL_NOTIFICATIONS,
} from "./mockData";

// Storage keys
const SPACES_KEY = "spacego_spaces";
const BOOKINGS_KEY = "spacego_bookings";
const ACTIVATIONS_KEY = "spacego_activations";
const DEMAND_KEY = "spacego_demand";
const ENQUIRIES_KEY = "spacego_enquiries";
const NOTIFICATIONS_KEY = "spacego_notifications";
const FAVOURITES_KEY = "spacego_favourites";

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

export const SpaceGoStore = {
  // --- SPACES ---
  getSpaces: (): Space[] => {
    return getStored<Space[]>(SPACES_KEY, INITIAL_SPACES);
  },

  getSpaceById: (id: string): Space | undefined => {
    const spaces = SpaceGoStore.getSpaces();
    return spaces.find((s) => s.id === id || s.slug === id);
  },

  getSpacesByOwner: (ownerId: string): Space[] => {
    const spaces = SpaceGoStore.getSpaces();
    return spaces.filter((s) => s.owner_id === ownerId);
  },

  addSpace: (newSpaceData: Partial<Space> & { title: string; category: Space["category"] }): Space => {
    const spaces = SpaceGoStore.getSpaces();
    const id = `space-${Date.now()}`;
    const slug = newSpaceData.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    
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
      amenities: newSpaceData.amenities || [
        "High-Speed Fiber WiFi",
        "Conference AV",
        "Ergonomic Seating",
        "Espresso Machine",
      ],
      operating_hours: newSpaceData.operating_hours || {
        open: "08:00",
        close: "20:00",
        days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
      },
      house_rules: newSpaceData.house_rules || [
        "Respect quiet zones",
        "Clear desks when leaving",
      ],
      verification_level: newSpaceData.verification_level || "checked",
      passport: newSpaceData.passport || {
        identity_verified: true,
        property_authority_verified: true,
        permitted_use_confirmed: true,
        connectivity_tested_mbps: 350,
        power_backup_tested: true,
        fire_safety_inspected: true,
        inspected_by: "SpaceGo Verification Ops",
        inspected_at: new Date().toISOString().split("T")[0],
        renewal_date: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().split("T")[0],
        notes: "Verified on listing onboarding.",
      },
      images: newSpaceData.images && newSpaceData.images.length > 0 ? newSpaceData.images : [
        {
          url: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80",
          caption: "Primary workspace",
          is_cover: true,
        },
      ],
      owner_id: newSpaceData.owner_id || "user-owner-1",
      owner_name: newSpaceData.owner_name || "Elena Rostova",
      owner_avatar: newSpaceData.owner_avatar || "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=250&q=80",
      owner_email: newSpaceData.owner_email || "elena.owner@spacego.io",
      status: newSpaceData.status || "published",
      rating: 5.0,
      review_count: 0,
      instant_book: Boolean(newSpaceData.instant_book),
      created_at: new Date().toISOString(),
    };

    const updated = [space, ...spaces];
    setStored(SPACES_KEY, updated);
    return space;
  },

  updateSpace: (id: string, updates: Partial<Space>): Space | null => {
    const spaces = SpaceGoStore.getSpaces();
    const index = spaces.findIndex((s) => s.id === id);
    if (index === -1) return null;

    const updatedSpace = { ...spaces[index], ...updates };
    spaces[index] = updatedSpace;
    setStored(SPACES_KEY, spaces);
    return updatedSpace;
  },

  deleteSpace: (id: string): boolean => {
    const spaces = SpaceGoStore.getSpaces();
    const filtered = spaces.filter((s) => s.id !== id);
    if (filtered.length === spaces.length) return false;
    setStored(SPACES_KEY, filtered);
    return true;
  },

  // --- BOOKINGS & CONFLICT PREVENTION ---
  getBookings: (): Booking[] => {
    return getStored<Booking[]>(BOOKINGS_KEY, INITIAL_BOOKINGS);
  },

  getBookingById: (id: string): Booking | undefined => {
    const bookings = SpaceGoStore.getBookings();
    return bookings.find((b) => b.id === id);
  },

  getBookingsBySeeker: (userId: string): Booking[] => {
    const bookings = SpaceGoStore.getBookings();
    return bookings.filter((b) => b.user_id === userId);
  },

  getBookingsByOwner: (ownerId: string): Booking[] => {
    const bookings = SpaceGoStore.getBookings();
    return bookings.filter((b) => b.owner_id === ownerId);
  },

  // Check if a time slot has a confirmed or pending booking conflict
  checkBookingConflict: (
    spaceId: string,
    startDateStr: string,
    endDateStr: string,
    excludeBookingId?: string
  ): { hasConflict: boolean; conflictingBooking?: Booking } => {
    const bookings = SpaceGoStore.getBookings();
    const reqStart = new Date(startDateStr).getTime();
    const reqEnd = new Date(endDateStr).getTime();

    const conflict = bookings.find((b) => {
      if (b.space_id !== spaceId) return false;
      if (excludeBookingId && b.id === excludeBookingId) return false;
      // Only approved or pending bookings block slots (cancelled or declined do not)
      if (b.status === "cancelled" || b.status === "declined") return false;

      const bStart = new Date(b.start_date).getTime();
      const bEnd = new Date(b.end_date).getTime();

      // Overlap formula: startA < endB and endA > startB
      return reqStart < bEnd && reqEnd > bStart;
    });

    return {
      hasConflict: Boolean(conflict),
      conflictingBooking: conflict,
    };
  },

  createBooking: (bookingInput: {
    space: Space;
    user: { id: string; name: string; email: string };
    start_date: string;
    end_date: string;
    duration_type: "hourly" | "daily" | "monthly";
    duration_units: number;
    seats: number;
    total_price: number;
    special_requests?: string;
  }): { success: boolean; booking?: Booking; error?: string } => {
    // 1. Conflict verification
    const { hasConflict, conflictingBooking } = SpaceGoStore.checkBookingConflict(
      bookingInput.space.id,
      bookingInput.start_date,
      bookingInput.end_date
    );

    if (hasConflict) {
      return {
        success: false,
        error: `This space is already booked during this period (${conflictingBooking?.status === "approved" ? "Confirmed Booking" : "Hold in Progress"}). Please select alternative dates or times.`,
      };
    }

    const id = `SPG-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const accessCode = `PASS-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

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
      status: bookingInput.space.instant_book ? "approved" : "pending",
      special_requests: bookingInput.special_requests,
      access_code: accessCode,
      created_at: new Date().toISOString(),
    };

    const bookings = SpaceGoStore.getBookings();
    setStored(BOOKINGS_KEY, [newBooking, ...bookings]);

    // Send notifications to owner and user
    SpaceGoStore.addNotification({
      user_id: bookingInput.space.owner_id,
      title: "New Booking Request",
      message: `${bookingInput.user.name} submitted a ${bookingInput.duration_type} request for ${bookingInput.space.title} (${id}).`,
      type: "booking_update",
      link: "/owner/bookings",
    });

    SpaceGoStore.addNotification({
      user_id: bookingInput.user.id,
      title: newBooking.status === "approved" ? "Booking Confirmed!" : "Booking Request Received",
      message:
        newBooking.status === "approved"
          ? `Your booking at ${bookingInput.space.title} is confirmed. Pass code: ${accessCode}`
          : `Your request for ${bookingInput.space.title} is awaiting host approval. Reference: ${id}`,
      type: "booking_update",
      link: "/dashboard/bookings",
    });

    return { success: true, booking: newBooking };
  },

  updateBookingStatus: (id: string, status: BookingStatus): Booking | null => {
    const bookings = SpaceGoStore.getBookings();
    const index = bookings.findIndex((b) => b.id === id);
    if (index === -1) return null;

    const booking = bookings[index];
    booking.status = status;
    bookings[index] = booking;
    setStored(BOOKINGS_KEY, bookings);

    // Notify seeker
    SpaceGoStore.addNotification({
      user_id: booking.user_id,
      title: `Booking Status: ${status.toUpperCase()}`,
      message: `Your booking for ${booking.space_title} (${id}) has been updated to ${status}.`,
      type: "booking_update",
      link: "/dashboard/bookings",
    });

    return booking;
  },

  // --- PROPERTY ACTIVATION SERVICE ---
  getActivationRequests: (): PropertyActivationRequest[] => {
    return getStored<PropertyActivationRequest[]>(ACTIVATIONS_KEY, INITIAL_ACTIVATION_REQUESTS);
  },

  getActivationRequestById: (id: string): PropertyActivationRequest | undefined => {
    const list = SpaceGoStore.getActivationRequests();
    return list.find((item) => item.id.toLowerCase() === id.trim().toLowerCase());
  },

  getActivationRequestsByOwner: (ownerEmailOrId: string): PropertyActivationRequest[] => {
    const list = SpaceGoStore.getActivationRequests();
    return list.filter(
      (item) =>
        item.owner_id === ownerEmailOrId ||
        item.email.toLowerCase() === ownerEmailOrId.toLowerCase()
    );
  },

  createActivationRequest: (
    data: Omit<PropertyActivationRequest, "id" | "status" | "created_at">
  ): PropertyActivationRequest => {
    const list = SpaceGoStore.getActivationRequests();
    const id = `ACT-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    // Initial preliminary score calculation based on floor area, condition & facilities
    let readinessScore = 12;
    if (data.current_condition === "fully_furnished") readinessScore = 19;
    else if (data.current_condition === "partially_furnished") readinessScore = 16;
    else if (data.current_condition === "bare_shell") readinessScore = 13;
    else readinessScore = 9;

    const facilitiesBonus = Math.min(data.existing_facilities.length * 1.5, 6);
    const demandScore = Math.floor(20 + Math.random() * 8); // based on local demand index
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

    setStored(ACTIVATIONS_KEY, [newRequest, ...list]);

    // Notify user
    if (data.owner_id) {
      SpaceGoStore.addNotification({
        user_id: data.owner_id,
        title: "Property Activation Request Submitted",
        message: `Your activation request for ${data.property_address} (${id}) is now queued for preliminary screening.`,
        type: "activation_update",
        link: `/activation/track?ref=${id}`,
      });
    }

    return newRequest;
  },

  updateActivationStatus: (
    id: string,
    status: ActivationStatus,
    adminNotes?: string,
    scoreUpdates?: Partial<ActivationScore>
  ): PropertyActivationRequest | null => {
    const list = SpaceGoStore.getActivationRequests();
    const index = list.findIndex((a) => a.id.toLowerCase() === id.toLowerCase());
    if (index === -1) return null;

    const request = list[index];
    request.status = status;
    if (adminNotes !== undefined) request.admin_notes = adminNotes;
    if (scoreUpdates && request.activation_score) {
      request.activation_score = {
        ...request.activation_score,
        ...scoreUpdates,
      };
    }

    list[index] = request;
    setStored(ACTIVATIONS_KEY, list);

    if (request.owner_id) {
      SpaceGoStore.addNotification({
        user_id: request.owner_id,
        title: `Activation Request Status: ${status.replace("_", " ").toUpperCase()}`,
        message: `Status updated for ${request.property_address} (${request.id}). ${adminNotes || ""}`,
        type: "activation_update",
        link: `/activation/track?ref=${request.id}`,
      });
    }

    return request;
  },

  // --- DEMAND INTELLIGENCE & ENQUIRIES ---
  getDemandSearches: (): DemandSearch[] => {
    return getStored<DemandSearch[]>(DEMAND_KEY, INITIAL_DEMAND_SEARCHES);
  },

  logSearchQuery: (query: { location: string; category?: string; seats?: number; resultCount: number }): void => {
    if (!query.location.trim()) return;
    const searches = SpaceGoStore.getDemandSearches();
    const newEntry: DemandSearch = {
      id: `ds-${Date.now()}`,
      location_query: query.location.trim(),
      category: query.category,
      seats: query.seats,
      has_results: query.resultCount > 0,
      result_count: query.resultCount,
      created_at: new Date().toISOString(),
    };
    // keep latest 100 searches
    setStored(DEMAND_KEY, [newEntry, ...searches].slice(0, 100));
  },

  getEnquiries: (): WorkspaceEnquiry[] => {
    return getStored<WorkspaceEnquiry[]>(ENQUIRIES_KEY, INITIAL_ENQUIRIES);
  },

  createEnquiry: (data: Omit<WorkspaceEnquiry, "id" | "status" | "created_at">): WorkspaceEnquiry => {
    const list = SpaceGoStore.getEnquiries();
    const newEnquiry: WorkspaceEnquiry = {
      ...data,
      id: `enq-${Date.now()}`,
      status: "new",
      created_at: new Date().toISOString(),
    };
    setStored(ENQUIRIES_KEY, [newEnquiry, ...list]);
    return newEnquiry;
  },

  updateEnquiryStatus: (id: string, status: "new" | "contacted" | "fulfilled"): void => {
    const list = SpaceGoStore.getEnquiries();
    const index = list.findIndex((e) => e.id === id);
    if (index !== -1) {
      list[index].status = status;
      setStored(ENQUIRIES_KEY, list);
    }
  },

  // --- FAVOURITES ---
  getUserFavourites: (userId: string): string[] => {
    const allFavs = getStored<Record<string, string[]>>(FAVOURITES_KEY, {
      "user-seeker-1": ["space-1", "space-3"],
    });
    return allFavs[userId] || [];
  },

  toggleFavourite: (userId: string, spaceId: string): boolean => {
    const allFavs = getStored<Record<string, string[]>>(FAVOURITES_KEY, {
      "user-seeker-1": ["space-1", "space-3"],
    });
    const currentList = allFavs[userId] || [];
    const isFav = currentList.includes(spaceId);

    if (isFav) {
      allFavs[userId] = currentList.filter((id) => id !== spaceId);
    } else {
      allFavs[userId] = [...currentList, spaceId];
    }

    setStored(FAVOURITES_KEY, allFavs);
    return !isFav;
  },

  // --- NOTIFICATIONS ---
  getUserNotifications: (userId: string): NotificationItem[] => {
    const all = getStored<NotificationItem[]>(NOTIFICATIONS_KEY, INITIAL_NOTIFICATIONS);
    return all.filter((n) => n.user_id === userId);
  },

  markNotificationRead: (id: string): void => {
    const all = getStored<NotificationItem[]>(NOTIFICATIONS_KEY, INITIAL_NOTIFICATIONS);
    const item = all.find((n) => n.id === id);
    if (item) {
      item.read = true;
      setStored(NOTIFICATIONS_KEY, all);
    }
  },

  addNotification: (notification: Omit<NotificationItem, "id" | "read" | "created_at">): void => {
    const all = getStored<NotificationItem[]>(NOTIFICATIONS_KEY, INITIAL_NOTIFICATIONS);
    const newNotif: NotificationItem = {
      ...notification,
      id: `notif-${Date.now()}`,
      read: false,
      created_at: new Date().toISOString(),
    };
    setStored(NOTIFICATIONS_KEY, [newNotif, ...all]);
  },
};
