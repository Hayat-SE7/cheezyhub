// ─────────────────────────────────────────────────────
//  DELIVERY RADIUS SERVICE
//  Haversine formula: calculates real-world distance
//  between two GPS coordinates on Earth's surface.
// ─────────────────────────────────────────────────────

/**
 * Haversine formula — calculates distance between two
 * lat/lng points in kilometres.
 *
 * How it works:
 *   Earth is a sphere. Two points on a sphere have a
 *   "great-circle" distance. This formula computes that.
 *   Accurate to ~0.3% for distances < 1000 km.
 */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth radius in kilometres
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Check if a customer's location is within delivery range.
 *
 * @param customerLat  - Customer's latitude
 * @param customerLng  - Customer's longitude
 * @param restaurantLat - Restaurant's latitude (from SystemSettings)
 * @param restaurantLng - Restaurant's longitude (from SystemSettings)
 * @param radiusKm     - Max allowed delivery radius (from SystemSettings)
 *
 * @returns { allowed, distanceKm }
 *
 * @example
 * const { allowed, distanceKm } = checkDeliveryRadius(
 *   24.8607, 67.0104,  // Customer (Karachi)
 *   24.8615, 67.0090,  // Restaurant
 *   10                  // 10 km radius
 * );
 * // → { allowed: true, distanceKm: 0.14 }
 */
export function checkDeliveryRadius(
  customerLat: number,
  customerLng: number,
  restaurantLat: number,
  restaurantLng: number,
  radiusKm: number
): { allowed: boolean; distanceKm: number } {
  const distanceKm = haversineKm(
    restaurantLat,
    restaurantLng,
    customerLat,
    customerLng
  );

  return {
    allowed: distanceKm <= radiusKm,
    distanceKm: Math.round(distanceKm * 100) / 100, // 2 decimal places
  };
}

/**
 * If restaurant coordinates are (0, 0) — meaning not configured —
 * skip radius check and allow all orders.
 * Restaurant owner must set lat/lng in Admin > Settings first.
 */
export function isRadiusConfigured(lat: number, lng: number): boolean {
  return !(lat === 0 && lng === 0);
}
