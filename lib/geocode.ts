import { prefFromJisCode } from "./constants";

// Server-side address geocoding using the free, keyless 国土地理院 (GSI)
// address search API. Used to auto-populate a store's lat/lng whenever an
// admin creates or edits a store, so "現在地から探す" (search by current
// location) has real coordinates to sort by without any manual data-entry
// step. Best-effort: on any failure (network, no match, malformed response,
// timeout) this returns null and the caller just leaves lat/lng untouched —
// a geocoding hiccup should never block saving a store.
export async function geocodeAddress(
  pref: string | null,
  city: string | null,
  address: string | null
): Promise<{ lat: number; lng: number } | null> {
  const query = [pref, city, address].filter(Boolean).join("");
  if (!query.trim()) return null;

  try {
    const res = await fetch(
      `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(query)}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;

    // The GSI endpoint returns a plain array of GeoJSON Feature objects
    // (not wrapped in a FeatureCollection):
    // [{ geometry: { type: "Point", coordinates: [lng, lat] }, properties: {...} }, ...]
    const data: unknown = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    const coords = (data[0] as { geometry?: { coordinates?: unknown } })?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) return null;

    const [lng, lat] = coords;
    if (typeof lat !== "number" || typeof lng !== "number") return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

// Server-side reverse geocoding (lat/lng -> prefecture) using the free,
// keyless 国土地理院 (GSI) reverse-geocoder API. Used to resolve a visitor's
// browser-geolocation coordinates into a prefecture for the "現在表示中の
// 都道府県" (currently displayed prefecture) feature. Best-effort, same
// pattern as geocodeAddress above: any failure (network, no match, malformed
// response, timeout) returns null and the caller falls back to the next
// source in the priority chain (IP estimate, then 全国).
export async function reverseGeocodeToPref(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress?lat=${lat}&lon=${lng}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;

    const data: unknown = await res.json();
    const muniCd = (data as { results?: { muniCd?: unknown } })?.results?.muniCd;
    if (typeof muniCd !== "string" || muniCd.length < 2) return null;

    // muniCd is a 5-digit JIS X 0401 municipality code; its first 2 digits
    // are the prefecture code (01=北海道 ... 47=沖縄県).
    return prefFromJisCode(muniCd.slice(0, 2));
  } catch {
    return null;
  }
}

// Great-circle distance between two lat/lng points, in kilometers.
export function distanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth radius, km
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
