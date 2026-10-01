# Architecture decisions — IMP 01102026 (ADR-48 … ADR-58)

ADR-01…47 stay in force. Defaults Claude Code applies and reports; it does not stop to ask.

## ADR-48 — iOS stays a PWA this cycle; the app says so

No native iOS build (Xaviel's call). The web app detects iOS standalone (`navigator.standalone` /
`display-mode: standalone` + iOS UA) and shows a capability card on Conducir, Viajes → Ajustes and
the welcome's permissions slide: "En iPhone (web) solo viajes manuales con la app abierta; la
detección automática existe solo en la app de Android." Service worker: **network-first for
`index.html`**, cache-first for hashed `/_expo/static/*`, `carguy-v5`, `clients.claim`;
`navigator.storage.persist()` requested once after the first vehicle exists. A native iOS project
is **not** prepared (would be dead config); the Play/App Store checklist in NEXT.md gets an iOS line.

## ADR-49 — Location freshness is a rule, not a hope

`lib/trips/freshness.ts`: a fix is drawable when `now − timestamp ≤ 15 s` and `accuracy ≤ 50 m`;
otherwise the UI shows "Buscando GPS…" and the last good dot greyed. Web: `enableHighAccuracy: true,
maximumAge: 0, timeout: 20 s`; Android: `getCurrentPositionAsync` first, last-known only as a
placeholder (greyed). The same rule gates the start of auto detection (never start a trip on a
cached fix).

## ADR-50 — Android auto-trip diagnostics before changes

Phase 0 runs on the Redmi: `adb logcat` filtered on Car Guy + expo-location while the app is
backgrounded; `Location.hasStartedLocationUpdatesAsync`; permission state (`always`?); MIUI
autostart app-op; the trip_state row; notification channel; battery optimisation state. The
finding decides the fix; the package does not guess. If everything is green, the acceptance is
Xaviel's drive with the Redmi (manual checklist) and note 7 closes as "iPhone limitation +
Android verified".

## ADR-51 — Gauge model: fraction + raw, per-vehicle type, learned mapping

`vehicle.gauge_type` (`needle8` default · `segments` · `percent`), `gauge_segments` (3–20),
`gauge_reserve_at` (segments where the light turns on, nullable). Readings stored as
`gauge_before_frac`/`gauge_after_frac` (0–1) + `gauge_before_raw`/`gauge_after_raw`; the eighths
columns stay filled for needle gauges (older clients keep working). Calibration
(`lib/domain/gaugeCalibration.ts`): monotone (PAV) regression of liters vs reading anchored at
reserve and C, linear prior with shrinkage n/(n+0.5… per research 03), partials half weight,
"aprendido" when ≥ 2 full fills at ≥ 2 distinct readings below F; recomputed on each fuel-log
change, cached on the vehicle (`gauge_calibration` JSON) and synced. Output always with a band;
the UI never shows a bare number. Range = liters × distance-weighted recent km/L. Tank-capacity
change > 2 L offers a reset.

## ADR-52 — Updates: EAS Update for JS, in-app APK prompt for native

`expo-updates` with `runtimeVersion: { policy: 'fingerprint' }`, channels `production`
(release-apk/production profiles) and `preview`; `checkAutomatically: ON_LOAD`,
`fallbackToCacheTimeout: 0`; a "Hay una actualización · Reiniciar" banner when
`fetchUpdateAsync()` lands; `tools/release-apk.sh` gains `--ota` (runs `eas update --channel
production` for JS-only releases and refuses when the fingerprint changed). Native changes →
`/api/apk` comparison on launch (`nativeApplicationVersion` vs release tag) → "Nueva versión X ·
NN MB · Descargar e instalar" → `File.downloadFileAsync` with progress → `content://` URI →
`android.intent.action.VIEW` with the APK MIME; the user does the install taps. Web: a toast
"Nueva versión disponible · Recargar" when the SW finds a new `index.html`. Free tier: 1,000
update MAU — far above 30 users.

## ADR-53 — Money: no ads; "Apoyar Car Guy" + a usage meter

AdMob cannot approve an app that is not in a supported store (ads would be "limited" at best) and
30 users yield cents; ads also conflict with a driving app's safety. The app gets Más → **Apoyar
Car Guy**: why (backend costs), what it costs (read from the admin meter, rounded), a PayPal.me
link **only after Xaviel confirms a test payment works for a DR account** (else bank transfer
details he types into the admin panel — stored in `carguy.app_config`, never in the repo), and
the existing `premium` role granted by the admin as thanks (cosmetic: a hanko on the profile).
Admin → **Uso y costos**: DB size (`pg_database_size` via RPC), Storage bytes (existing RPC per
user + total), MAU (profiles active 30 d), Realtime messages (from the junte counters), vs the
free-tier limits with a bar and the date when Pro would be needed at the current slope. Ads stay
documented as not-now in NEXT.md; no ad slot in the UI.

## ADR-54 — Public profiles through functions, never through row policies alone

`profiles` gains `handle` (unique, citext/lowercase, 3–20, reserved list), `bio`, `is_public`,
`photo_public`, `show_*` switches (cars, stats, fichas). Other users read profiles **only** via
`security definer` functions returning a fixed safe column set (`get_public_profile(handle)`,
`search_profiles(q)`), so private columns cannot leak; `anon` may call `get_public_profile` for
`/u/<handle>` (Vercel function, OG tags, same pattern as `/c/<slug>`). Helpers live in a
non-exposed schema `carguy_private` (`--shared`: schema + grants). `pg_trgm` + `unaccent`
extensions (`--shared`) for handle/name search with accent folding.

## ADR-55 — Follow graph, friends, blocks, requests

`follow(follower_id, followee_id, status accepted|requested, created_at)`; public accounts accept
instantly, private accounts get a request; `friends` = mutual accepted follows (view over the
caller's rows); `block` removes follows both ways and hides both profiles; a per-day follow cap
(100) in the trigger; `report(target_type, target_id, reason)` with the feedback RPC's
rate-limit pattern. Cloud-only tables with a small local cache (counts, my friends) for offline.

## ADR-56 — Privacy by default on anything shared

Trips are never public. `trip_share(trip_id, visibility followers|friends|public, polyline_trimmed,
…)` is created by the owner per trip; the trimmed polyline cuts **300 m + a seeded random 0–200 m**
at both ends and cuts through any `privacy_zone` (home/work, 300 m default, local-first table),
splitting rather than reconnecting across a zone. Profiles expose aggregated stats only behind
switches; no other user's speed is ever shown (live or after); no speed rankings — the Terms
forbid street racing and the app must not nudge it. Avatars: `photo_public` default **off** for
photos, on for the drawn avatars.

## ADR-57 — Juntes: Realtime Broadcast + Presence, no stored positions

`junte(id, owner_id, title, starts_at, ends_at, meeting lat/lng/label, visibility, code)`,
`junte_member(junte_id, user_id, role, status, trip_share_id, joined_at)`. Live map: private
channel `carguy:junte:<id>` with Broadcast for positions (adaptive interval
T = max(4 s, n²/60) so 100 msg/s is never crossed on Free) and Presence for who is online; RLS on
`realtime.messages` scoped to `carguy:junte:` topics and members within the live window (start −
30 min → end or +6 h); positions are **never persisted**; a `kick` broadcast handles removal (RLS
is cached per connection). Android publishes from the background task over the REST broadcast
endpoint; iPhone PWA only in the foreground (banner says so). After the junte: members link a
`trip_share` (trimmed), the page shows all routes, km, photos (album items linked), and a `junte`
event per car. Invites by code + deep link `carguy://junte/<code>` and `/j/<code>` (reuse the
garage-invite pattern). Chat (`junte_message` + Realtime, report/delete/block) ships **behind
`FEATURE_JUNTE_CHAT = false`** — built, not released, until push notifications exist.

## ADR-58 — Fix pack 2.4.3 first; social on its own cloud files

Phase 1 ships without schema; Phase 2 writes v10 + `sql/033–036` (gauge/profile/social/junte) at
once; `realtime.messages` policies and extensions are the only `--shared` statements and are
listed verbatim for Xaviel. `x-core` remains additive; Music Hub untouched; the Realtime "Allow
public access" setting is **not** changed.
