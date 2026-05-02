import { describe, it, expect } from 'vitest';
import { haversineKm, checkDeliveryRadius, isRadiusConfigured } from '../../services/radiusService';

describe('[radiusService] - haversineKm', () => {
  it('should return 0 for identical coordinates', () => {
    expect(haversineKm(24.8607, 67.0104, 24.8607, 67.0104)).toBe(0);
  });

  it('should calculate correct distance between Karachi landmarks', () => {
    // Clifton (24.8138, 67.0300) to Saddar (24.8607, 67.0104)
    const distance = haversineKm(24.8138, 67.0300, 24.8607, 67.0104);
    // Approx 5.5 km
    expect(distance).toBeGreaterThan(5);
    expect(distance).toBeLessThan(6);
  });

  it('should calculate known long distance (London to Paris ~340km)', () => {
    const distance = haversineKm(51.5074, -0.1278, 48.8566, 2.3522);
    expect(distance).toBeGreaterThan(330);
    expect(distance).toBeLessThan(350);
  });

  it('should be symmetric (A→B equals B→A)', () => {
    const ab = haversineKm(24.8607, 67.0104, 33.6844, 73.0479);
    const ba = haversineKm(33.6844, 73.0479, 24.8607, 67.0104);
    expect(ab).toBeCloseTo(ba, 10);
  });

  it('should handle negative coordinates', () => {
    // Sydney to Auckland
    const distance = haversineKm(-33.8688, 151.2093, -36.8485, 174.7633);
    expect(distance).toBeGreaterThan(2100);
    expect(distance).toBeLessThan(2200);
  });
});

describe('[radiusService] - checkDeliveryRadius', () => {
  const restaurantLat = 24.8615;
  const restaurantLng = 67.0090;

  it('should allow delivery within radius', () => {
    // ~0.14 km away
    const result = checkDeliveryRadius(24.8607, 67.0104, restaurantLat, restaurantLng, 10);
    expect(result.allowed).toBe(true);
    expect(result.distanceKm).toBeLessThan(1);
  });

  it('should reject delivery outside radius', () => {
    // Islamabad — ~1200km away
    const result = checkDeliveryRadius(33.6844, 73.0479, restaurantLat, restaurantLng, 10);
    expect(result.allowed).toBe(false);
    expect(result.distanceKm).toBeGreaterThan(10);
  });

  it('should allow delivery at exact radius boundary', () => {
    // Find a point at ~5km
    const result = checkDeliveryRadius(24.9060, 67.0090, restaurantLat, restaurantLng, 5);
    expect(result.distanceKm).toBeCloseTo(4.95, 0);
    expect(result.allowed).toBe(true);
  });

  it('should return distance rounded to 2 decimal places', () => {
    const result = checkDeliveryRadius(24.8607, 67.0104, restaurantLat, restaurantLng, 10);
    const decimals = result.distanceKm.toString().split('.')[1]?.length ?? 0;
    expect(decimals).toBeLessThanOrEqual(2);
  });
});

describe('[radiusService] - isRadiusConfigured', () => {
  it('should return false for (0, 0) coordinates', () => {
    expect(isRadiusConfigured(0, 0)).toBe(false);
  });

  it('should return true for valid coordinates', () => {
    expect(isRadiusConfigured(24.8607, 67.0104)).toBe(true);
  });

  it('should return true if only lat is 0', () => {
    expect(isRadiusConfigured(0, 67.0104)).toBe(true);
  });

  it('should return true if only lng is 0', () => {
    expect(isRadiusConfigured(24.8607, 0)).toBe(true);
  });
});
