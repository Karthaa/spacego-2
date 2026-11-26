/**
 * Booking price, matching spacego_create_booking in the database exactly:
 *   base  = rate for the duration x number of hours, days or months
 *           x guests, only for hourly or daily bookings of types that are not
 *           hired whole (auditorium, event_space);
 *   fee   = round(base x 0.10);
 *   total = base + fee.
 */

export type DurationType = "hourly" | "daily" | "monthly";

/** Types hired as a whole venue: the rate covers the venue, whatever the guest count. */
const WHOLE_VENUE = new Set(["auditorium", "event_space"]);

export function isWholeVenue(category: string): boolean {
  return WHOLE_VENUE.has(category);
}

/** True when the rate is multiplied by guests (people, or vehicles for parking). */
export function pricedPerSeat(category: string, duration: DurationType): boolean {
  return duration !== "monthly" && !isWholeVenue(category);
}

export function bookingPrice(
  category: string,
  duration: DurationType,
  rate: number,
  units: number,
  seats: number
): { base: number; fee: number; total: number; perSeat: boolean } {
  const perSeat = pricedPerSeat(category, duration);
  const base = rate * units * (perSeat ? seats : 1);
  const fee = Math.round(base * 0.1);
  return { base, fee, total: base + fee, perSeat };
}
