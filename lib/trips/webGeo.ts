/**
 * The W3C options every web watch needs (IMP 01102026, iPhone drive of 2026-10-02).
 *
 * expo-location's web shim hands the options object to `navigator.geolocation.watchPosition` as is, so the
 * native keys (`accuracy`, `timeInterval`, `distanceInterval`) mean nothing to a browser. Without
 * `enableHighAccuracy` Safari on iPhone answers from Wi-Fi/cell — ≈ 65 m or worse and no speed — and the trip
 * machine drops every fix over 30 m: no route, no speed, "Viaje muy corto (0 m)". Ignored natively.
 */
export const WEB_PRECISE_GPS = {
  enableHighAccuracy: true,
  // Never a cached position.
  maximumAge: 0,
  // Wait up to 20 s for a real one; a timeout reaches the watch's error handler and the watch goes on.
  timeout: 20_000,
} as const;
