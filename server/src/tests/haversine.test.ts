import { describe, expect, it } from 'vitest';
import { haversineMeters, isWithinRadius } from '../utils/haversine';

describe('haversine', () => {
  it('titik sama = 0 m', () => {
    expect(haversineMeters(-6.3, 107.15, -6.3, 107.15)).toBe(0);
  });
  it('0.001 derajat lintang sekitar 111 m', () => {
    const d = haversineMeters(-6.3, 107.15, -6.299, 107.15);
    expect(d).toBeGreaterThan(110);
    expect(d).toBeLessThan(112.5);
  });
  it('isWithinRadius true di dalam, false di luar', () => {
    const center = { lat: -6.3, lng: 107.15 };
    expect(isWithinRadius({ lat: -6.2995, lng: 107.15 }, center, 100).ok).toBe(true);
    expect(isWithinRadius({ lat: -6.298, lng: 107.15 }, center, 100).ok).toBe(false);
  });
});
