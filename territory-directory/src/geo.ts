import { OFFICE } from "./office";

export function haversineMi(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function milesFrom(lat: number, lng: number, origin = { lat: OFFICE.lat, lng: OFFICE.lng }): number {
  return Math.round(haversineMi(origin.lat, origin.lng, lat, lng) * 10) / 10;
}

export function mapsMultiStopUrl(
  stops: { name: string; address?: string; lat: number; lng: number }[],
  origin = OFFICE.address,
): string {
  if (!stops.length) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(origin)}`;
  }
  const point = (s: { address?: string; lat: number; lng: number }) =>
    s.address || `${s.lat},${s.lng}`;
  const destination = point(stops[stops.length - 1]);
  const waypoints = stops.slice(0, -1).map(point).join("|");
  const params = new URLSearchParams({
    api: "1",
    origin,
    destination,
  });
  if (waypoints) params.set("waypoints", waypoints);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
