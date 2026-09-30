/**
 * The map components' contract (IMP 30092026 Phase 4, ADR-41). Screens import only from
 * components/map — never @maplibre/maplibre-react-native or maplibre-gl directly — so the
 * native (`X.tsx`) and web (`X.web.tsx`) halves stay swappable.
 */
export type RoutePoint = { lat: number; lng: number; /** km/h; null unknown */ speedKmh: number | null; /** epoch ms */ t?: number };

export type TripMapProps = {
  /** The route as recorded (trip_point) or decoded from the saved polyline — see lib/trips/geojson.ts. */
  points: RoutePoint[];
  /** The replay dot's position, when replaying. */
  replay?: { lat: number; lng: number } | null;
  height?: number;
  /** Long-press on the map (trip detail: diagnostics / export). */
  onLongPress?: () => void;
  /** Called when the style cannot load (offline, provider down) — the screen shows its fallback. */
  onUnavailable?: () => void;
};

export type HeatMapProps = {
  /** Sampled points of many trips (every ~25–50 m). */
  points: { lat: number; lng: number }[];
  height?: number;
  onUnavailable?: () => void;
};

export type LiveMapProps = {
  /** The trail so far, oldest first. Updated at most once a second by the caller. */
  trail: RoutePoint[];
  /** Follows the car (course-up) until the person pans; a re-centre button brings it back. */
  follow?: boolean;
  onUnavailable?: () => void;
};
