# State of the repo — 2026-10-01, after v2.4.2

PROMPT-00 re-audits and records corrections in PROGRESS.md.

| | |
|---|---|
| Version | **2.4.2** (versionCode ≥ 15), `main`; folder still `~/dev2/tu-gasolina-rd` |
| Local schema | **v9** (v8 = cycle-4 tables; v9 = share memory summary) |
| Cloud | `carguy` at **sql/032**; `SUPABASE_SERVICE_ROLE_KEY` in Vercel (deletion + MICM importer) — **rotation pending**; `verify-x-core` 38 checks |
| Platforms in use | Redmi Note 10 Pro (APK, MIUI 14) **and** Xaviel's iPhone as a **Safari Home-Screen PWA** (the screenshots of 2026-10-01 are iOS) |
| Tests | ~1,500+ |

## Code facts this cycle touches

| Area | Today |
|---|---|
| Gauge | `components/fuel/GaugePicker.tsx` (arc, 9 stops E…F, "Solo la luz de reserva"), `fuel_log.gauge_before_eighths/gauge_after_eighths/in_reserve`, `vehicle.reserve_volume_l` (form field since 2.4.2), `lib/domain/partialEconomy.ts` (bands ±C/16 + nonlinK) |
| Vehicle form | pickers v2 (cycle 3), units, statuses, photos; no gauge type |
| Trips | `lib/trips/*` (auto.ts arms the background task on foreground when mode = auto; MIUI module; `liveStore`), `components/map/*` (MapLibre native + web), `app/conducir.tsx`; user marker = course arrow (no avatar); web = manual only |
| Location on web | `expo-location` web shim → `navigator.geolocation`; no freshness filter on the first fix |
| PWA | `public/sw.js` `carguy-v4`: `skipWaiting` + `clients.claim`, no precache, **cache-first for the shell** (index.html can go stale after a deploy); `/c/` and `/api/` bypass |
| Inicio header | `Hanko char="改"` (42 px) → `t.routes.account` (opens Cuenta) — the "logo" of note 9 |
| Cuenta | `lastSyncAt ? dateLabel(lastSyncAt)` — date only |
| Garage | `app/(tabs)/garaje.tsx` (31 KB): Portadas/Cuadrícula/Lista, status badge `tone: 'outline'` drawn over the cover photo (unreadable on busy photos — note 15) |
| Mods | `components/build/BuildTab.tsx` → `+ Agregar mod` (GhostButton inside the Build tab only); `mod_category` seeds (motor, suspensión, frenos, ruedas, escape, exterior, interior…? — verify), costs RD$/USD with rate |
| Services | `service_type` seeds by category motor/frenos/gomas/fluidos/filtros/electrico/suspension/carroceria/otro — "carroceria" exists as a category; no "pintura completa" type |
| Events | `event_type` incl. `pintura`? — no: `MilestoneKind` has `pintura`; `event_type` list (cycle 4) = hito, accidente, dano_menor, averia, sobrecalentamiento, robo, multa, viaje_largo, junte, otro |
| Welcome | `app/bienvenida/*` 6 slides (idioma, nombre/avatar, primer carro, qué puedes hacer, permisos, cuenta) + tips; no odometer explanation |
| Profiles | `carguy.profiles`: role, display_name, avatar_id, avatar_path, locale (+ deletion_requested_at); no handle/bio/public flag |
| Updates | none (no expo-updates); `/api/apk` + `/instalar` exist; `lib/release/apk.ts` |
| Admin | `app/admin/*` (users, activity, comments); no usage meter |
| Money | nothing |
| i18n | `es.ts` + `en.ts` typed; `useT()`/`t()`; parity test |
| Flags | all features true; add `FEATURE_GAUGE_SEGMENTS`, `FEATURE_OTA`, `FEATURE_SUPPORT`, `FEATURE_SOCIAL`, `FEATURE_JUNTES`, `FEATURE_JUNTE_CHAT` |

## Carried from NEXT.md (keep)

Public page in the owner's language (`vehicle_share.locale`); Xaviel's read of the legal texts;
his real drive on the Redmi (street check); Play Store checklist; MapTiler fallback key; MICM
parser status; **service-role key rotation**.
