const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Jarak dua koordinat dalam meter (rumus Haversine). Dipakai untuk geofencing. */
export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

export function isWithinRadius(
  point: { lat: number; lng: number },
  center: { lat: number; lng: number },
  radiusM: number,
): { ok: boolean; distanceM: number } {
  const distanceM = haversineMeters(point.lat, point.lng, center.lat, center.lng);
  return { ok: distanceM <= radiusM, distanceM };
}
