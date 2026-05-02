// ─── Reverse geocode using free Nominatim API (cached + rate-limited) ──

const geocodeCache = new Map<string, NominatimResult>();
let lastGeocodeFetch = 0;

export interface NominatimResult {
  display: string;
  houseNumber?: string;
  road?: string;
  neighbourhood?: string;
  city?: string;
  state?: string;
  country?: string;
}

export async function reverseGeocode(lat: number, lng: number): Promise<NominatimResult> {
  const cacheKey = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  const cached = geocodeCache.get(cacheKey);
  if (cached) return cached;

  // Rate limit: at least 1s between requests
  const now = Date.now();
  const wait = Math.max(0, 1000 - (now - lastGeocodeFetch));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastGeocodeFetch = Date.now();

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const data = await res.json();
    const a = data.address ?? {};

    const parts = [
      a.house_number,
      a.road || a.pedestrian || a.footway,
      a.neighbourhood || a.suburb || a.quarter,
      a.city || a.town || a.village || a.municipality,
      a.state,
      a.country,
    ].filter(Boolean);

    const result: NominatimResult = {
      display: parts.slice(0, 5).join(', ') || data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      houseNumber: a.house_number,
      road: a.road || a.pedestrian || a.footway,
      neighbourhood: a.neighbourhood || a.suburb || a.quarter,
      city: a.city || a.town || a.village || a.municipality,
      state: a.state,
      country: a.country,
    };
    geocodeCache.set(cacheKey, result);
    return result;
  } catch {
    return { display: `${lat.toFixed(5)}, ${lng.toFixed(5)}` };
  }
}
