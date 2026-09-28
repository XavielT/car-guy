# Architecture decisions — IMP 28092026 (continues ADR-01…15 from imp-17092026)

Defaults are final for this cycle: Claude Code applies them and reports; it does not stop to ask.
Legitimate stops: destructive/irreversible actions on `x-core`, force-push, deleting a Vercel
project, or anything the prompt marks "manual".

---

## ADR-16 — Identity v2 "Cluster JDM 90s" on top of the house palette

**Decision.** Keep `#FFB300` (primary/action/gauge) and `#FF5F00` (needle, *urgente*, gradient
mid-stop); add **JDM red `#E10600`** for fills only (redline wedge, badges, telltale *vencido*,
hazard divider) and **`#FF4D45`** whenever red is text on dark (AA 5.7:1). Neutrals `#121212 /
#1B1B1B / #212121`, hairline `#2A2A2A`, text `#EDEDED / #B3B3B3 / #8C8C8C`. Light scheme maps
amber-text → `#8F5A00`, orange-text → `#B84300`, red → `#C2000A`, green → `#1F7A3E`; fills keep the
hex with dark ink. Status ladder: ok `#3DDC84`, próximo `#FFB300`, urgente `#FF5F00`, vencido
`#E10600` (fill) / `#FF4D45` (text) — **próximo is now amber** (in v2.0 it was `#FFD166` to avoid
clashing with the accent; the cluster language makes "lit amber telltale = attention" natural, and
pills always carry a label).

**Type.** `Saira Condensed` (display/gauge numerals; 400/600/800), `Rajdhani` (UI body 500/600/700,
min 13 px), `JetBrains Mono` (data, unchanged), `Michroma 400` (wordmark and badges only), `Noto
Sans JP 500` (kanji/katakana accents only). `components/T.tsx` keeps its `face` API: display/title →
Saira Condensed, body/medium/semibold → Rajdhani, mono → JetBrains. Space Grotesk and Manrope are
removed once nothing references them.

**Texture and motion.** Carbon 2×2 twill as an SVG `Pattern` (or a tiled PNG on Android for
performance) at 6–10 % opacity on card headers, gauge bezels and the avatar frame only. Hazard
divider 4 px (amber/black for urgente, red/black for vencido). One launch "gauge sweep" per cold
start (needle 0→max→value, telltales lit 500 ms then to state), telltale blink for vencido at ≤1 Hz
for 10 s max, respecting reduced motion. Nothing loops idle.

**Kanji rules.** Only from the list in `05-design-jdm.md` (車 改 走り 峠 整備 点検 給油 燃費 記録
ハチゴー), 8–10 px, `#8C8C8C`, always next to the Spanish word, max one per screen section.

## ADR-17 — Schema v2 in one migration; cloud mirror in `sql/009`

**Decision.** All new tables of this cycle ship in **migration v2** written in PROMPT-01 (so every
later phase builds on a stable schema and the sync parity test is updated once): vehicle columns
(`nickname, status, chassis_code, engine_code, story, hero_media_id, origin, imported_year`),
`vehicle_ownership`, `album_item`, `milestone`, `mod_category`, `mod`, `mod_media`,
`vehicle_specsheet`, `spec_snapshot`, `wishlist_item`, `inventory_item`, `wheel_set`, `tire`,
`torque_spec`, `dtc_code` (bundled, not synced), `vehicle_dtc_event`, `contact`, `fluid_guide_item`,
`venue`, `track_event`, `track_session`, `setup_sheet`, `consumable_usage`, `vehicle_share`,
`vehicle_member`, plus `media` columns (`taken_at, date_precision, remote_thumb_path, blurhash,
width/height` already exist, `source`). The `history_feed` view is recreated to include `mod`,
`milestone`, `track_event` and `created_at` (which also fixes the same-day order backlog item).
Cloud: `sql/009_schema_v2.sql` + `sql/010_rls_v2.sql` + `sql/011_storage_v2.sql`, RLS same
own-rows template; `SYNC_TABLES` gains the new tables in dependency order; `BOOLEAN_COLUMNS`
updated; types regenerated. Dev seed (`app/dev/seed.tsx`) gets Xaviel's four vehicles.

## ADR-18 — Album = media with dates; Ex = ownership period; snapshots = derived

**Decision.** No new "photo" table: `media` gains `taken_at` (ISO, the photo's real date),
`date_precision` (`day|month|year`), `source` (`camera|library|import|web`), `remote_thumb_path`
(400 px JPEG q0.6 uploaded alongside), `blurhash`. `album_item(vehicle_id, media_id, caption,
milestone_id?, mod_id?, sort)` links a photo to the vehicle's album; a photo attached to a service
record, mod or session also appears in the album via its owner. `milestone(vehicle_id, kind
compra|swap|restauracion|primer_track|accidente|venta|otro, occurred_at, odometer_km, title, story,
cover_media_id)` anchors the timeline. **Ex vehicles**: `vehicle.status ∈ {activo, proyecto,
guardado, vendido, perdido}` + `vehicle_ownership(acquired_at/km/price/from, sold_at/km/price/to,
reason, is_current)`; a `vendido` vehicle leaves the switcher and lives under Garaje → Ex with its
full history read-only by default ("Editar historia" unlocks). "Así estaba el carro en <fecha>" is
**computed**: photos with `taken_at ≤ date`, mods installed by then, odometer reading nearest, not a
stored snapshot — except `spec_snapshot`, which a user can pin (ADR-19). Import of old photos:
Android via `expo-media-library` month browser (`granularPermissions: ['photo']`, handle `limited`);
web via `<input multiple>` + `exifr` lite; EXIF is stripped by the manipulator so `taken_at` is
read *before* compressing; fallback date picker with precision.

## ADR-19 — Build log: one `mod` table, derived current spec, wheel sets and tires as inventory

**Decision.** `mod_category` seeded (motor, admisión, escape, forzada, ECU/tune, combustible,
enfriamiento, transmisión, diferencial, suspensión, frenos, ruedas, gomas, exterior, aero, interior,
seguridad, iluminación, audio/eléctrico, fabricación, otro) and user-extensible. `mod` carries
`status ∈ {planeado, pedido, instalado, quitado, vendido, dañado}`, `installed_at/km`,
`removed_at/km`, `installer_type ∈ {yo, taller, amigo}`, `cost_part/labor/shipping/customs`,
`currency`, `fx_rate_to_dop`, `vendor/url`, `replaces_mod_id`, `affects_specs` and a JSON
`spec_effects` (`{hp, torque_nm, weight_kg, wheel_f, wheel_r, tire_f, tire_r, engine_code, ecu,
...}`) so **`current` = `stock` ⊕ installed mods' effects** with per-field manual override in
`vehicle_specsheet.overrides`. A mod's install event is what the v2.0 `service_record kind=mejora`
was: PROMPT-03 migrates existing `mejora` records into `mod` rows (keeping the record as the
cost/history entry, linked by `mod.service_record_id`) and the "Mejora" kind becomes an alias that
creates a mod. `wishlist_item` (priority 1–3, `est_cost`, currency, url, vendor, `status idea|
ahorrando|pedido|convertido|descartado`, `converted_mod_id`); `inventory_item` (part|wheel|tire|
fluid|tool|consumable, qty, condition, location, fits_vehicle_ids JSON); `wheel_set` (width/diam/
offset/bolt pattern/center bore, status mounted|stored|sold) and `tire` (size parsed, DOT
week/year, compound, position fl|fr|rl|rr|spare|unmounted, tread mm, `heat_cycles`, status).
`lib/domain/tires.ts`: size parser, diameter/circumference/speedo error, DOT age, offset delta —
tested.

## ADR-20 — Ficha técnica is user-owned with honest presets; DTC table bundled (MIT)

**Decision.** `vehicle_specsheet` (oil capacity/grade/filter, coolant, ATF/manual/diff, brake
fluid, plugs + gap, battery, OEM tire sizes and psi, bolt pattern, center bore, lug torque, tank,
octane, `field_sources` JSON `preset|user|vpic`, `verified_fields` JSON) + `torque_spec` rows
(item, Nm, source, photo). Presets in `lib/domain/specPresets.ts` for the garage's cars and common
DR cars (AE85/86 4A-GE & 3A-U, S13/S14, Civic EG/EK, C3 1.4/1.6 TU5, DS3 1.6 VTi/THP, Corolla,
Hilux, Yaris) — every preset value renders "sin verificar" until the user taps "Verificado por mí".
VIN decode via NHTSA vPIC `DecodeVinValues` on demand (works for USDM; **JDM chassis numbers and EU
VINs mostly won't decode — never block; `chassis_code` is first-class**). `dtc_code` table bundled
from `mytrile/obd-trouble-codes` (MIT, 3 071 rows) with a Spanish description column generated
once and shipped in the repo (`lib/domain/dtc.es.json`), local-only (not synced);
`vehicle_dtc_event` (code, seen_at, km, cleared_at, repair_record_id). `contact` (nombre, tipo
mecánico|gomera|dealer|pintor|grúa|otro, teléfono, WhatsApp, dirección, notas) linkable from
service records (`service_record.contact_id`) and mods. `fluid_guide_item(vehicle_id, kind
aceite|coolant|frenos|dirección|atf|washer|batería|otro, photo media_id, how, notes)` shown in the
inspection runner next to the matching item.

## ADR-21 — Track: event → sessions → copy-forward setup sheet

**Decision.** `venue` seeded with Autódromo de las Américas (Sunix) and user-added; `track_event`
(vehicle, venue, date, title, discipline `track_day|drift|drag|autocross|junte|prueba`, weather,
ambient/track temp, condition, odometer start/end, entry fee, fuel cost, notes); `track_session`
(seq, kind `practica|clasificacion|batalla|cronometrada|prueba|pasada_drag`, duration, laps/runs,
best/second lap ms, sector JSON, 0-100 ms, ¼ mile ms + trap, 60 ft, fuel load, ballast, driver,
`car_feel`, rating 1–5, notes, incident, video_url); `setup_sheet` 1:1 with session (per-corner
psi cold/hot, camber per corner, toe, caster, ride heights, spring rates, damper clicks + total,
sway bars, pads, bias, drift extras: steering angle, hydro, LSD type/preload, tire sizes f/r,
two-step/rev limit, compounds; `changed_from_previous` JSON); `consumable_usage` (heat cycle,
scrapped tire, pad measure, fluid, fuel). **Copy-forward**: "Nueva sesión" clones the previous
sheet and highlights changed fields on save. Drift discipline swaps the timing block for runs /
tires used / incidents. Day summary shareable as an image (view-shot of a styled card via
`react-native-view-shot` — SDK 57 compatible; on web `html2canvas`-free approach: render the card
in a `<canvas>`? No — use the same view-shot package which supports web via `dom-to-image`-like
fallback? If not viable on web, share as PDF page instead; report). Pad thickness feeds the
reminders engine (threshold 3 mm street / 5 mm track).

## ADR-22 — Sharing: public page via Vercel function + public bucket copies; shared garage via members

**Decision.** `vehicle_share(vehicle_id, slug 8-char unguessable, visibility private|link|public,
show_plate/vin/costs/location/odometer/maintenance/mods/track/docs booleans, og_media_id,
published_at, revoked_at)`; a `security_invoker` view `carguy.public_vehicle` + anon `select`
policy on `vehicle` where `share_enabled`; selected photos **copied** to public bucket
`carguy-public/<slug>/…` on enable and deleted on revoke (slug rotated). Page: `api/c/[slug].ts`
Vercel serverless function (repo stays `web.output: static`) rendering server-side HTML with OG
tags (WhatsApp needs static `og:image`) and the dossier (BaT order: hero, story, specs stock→actual,
mods, maintenance summary, track summary, photos); `vercel.json` rewrite `/c/:slug → /api/c/:slug`.
Car book PDF: **pdf-lib** on both platforms (thumbs for grids, ≤ 60 images per book, chapter per
year), privacy toggles reused. Shared garage: `vehicle_member(vehicle_id, user_id, role
owner|editor|viewer)`, `vehicle_invite(code, role, email?, expires_at)`, security-definer
`carguy.is_member(vehicle_id, min_role)`; RLS on every vehicle-scoped table switches from
`user_id = auth.uid()` to `is_member(vehicle_id)` (owner row auto-inserted for existing vehicles by
migration); sync pulls by cursor only (RLS filters), re-pulls a vehicle on membership grant, sends
`user_id` explicitly, adds `updated_by`; **new media paths** `carguy-media/v/<vehicle_id>/<id>.jpg`
with member-based storage policies (old per-user paths keep working); quota charged to the owner.

## ADR-23 — Storage quota and thumbnails

**Decision.** Upload full (1600 px q0.75) + thumb (400 px q0.6). `carguy.storage_usage_bytes()`
RPC (sum of `storage.objects.metadata->>'size'` for the user's paths); `profiles.media_quota_bytes`
default 300 MB; enforced client-side before enqueueing and server-side in the storage insert
policy. Meter in Más → Cuenta and in the album header. Signed URLs cached in memory with expiry;
`expo-image` with `placeholder` blurhash, `recyclingKey`, `cachePolicy memory-disk`. Optional
"Guardar original en Google Fotos/Drive" = share sheet with the original before compression
(Android only; web downloads the original).

## ADR-24 — Feature flags and phase order

**Decision.** `lib/flags.ts` gains `FEATURE_ALBUM, FEATURE_BUILD, FEATURE_DIY, FEATURE_TRACK,
FEATURE_SHARE` — each flips true in the phase that ships its screen. Phase order A → C → B → D →
E → F → release (Xaviel's priority). Branch `imp-28092026/phase-<n>-<slug>`; merge to `main`
after each report (main auto-deploys; flags keep unfinished features hidden).
