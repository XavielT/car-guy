# PROMPT 01 — Fix pack 2.4.3: iPhone truth, fresh location, auto-trip fix, header avatar, sync time, garage labels, mods path, paint job, odometer slide

**Depends on:** Phase 0 · **Branch:** `fix/2.4.3-fixpack` (from `main`) · **ADRs:** 48, 49, 50, 58 · **Size:** M–L
**Goal:** G1. Ships the same session. No migration (catalogue seeds only).

> **Before running:** Redmi connected; Phase 0's diagnostics finding in PROGRESS.md; `.env.expo.local`.
> After the release Xaviel drives with the **Redmi** (manual checklist).
>
> **How to run:** `cd` to the repo folder, `claude`, paste below the line.

---

```
Phase 1 of IMP 01102026 — fix pack 2.4.3. Notes 2, 5, 7 (Android fix), 8, 9, 10, 15, 16 (dot),
17, 18. No schema change.

Read first:
- docs/imp-01102026/02-specs/02-screens.md "Phase 1"; ADR-48, 49, 50
- docs/imp-01102026/01-research/01-ios-pwa-updates-ads-costs.md §1 (SW network-first for index.html,
  versioned cache, iOS standalone detection, storage.persist) and §2 (freshness filter code)
- PROGRESS.md "Auto-trip diagnostics" and audit (a)–(i)
- public/sw.js, app/+html.tsx, lib/platform/* (create capabilities.ts), components/map/LiveMap.*,
  lib/trips/live.ts, lib/trips/auto.ts, lib/trips/liveStore.ts, app/(tabs)/index.tsx (Hanko),
  app/cuenta.tsx, app/(tabs)/garaje.tsx, components/ui/Badge.tsx, components/build/ModForm.tsx,
  lib/domain/catalog.ts (mod categories, service types), app/servicio/nuevo.tsx, app/bienvenida/*

Branch: fix/2.4.3-fixpack

1. iPHONE PWA (note 2, ADR-48): sw.js → carguy-v5: network-first for navigations/index.html with
   cache fallback, cache-first for /_expo/static/*, clients.claim; lib/platform/capabilities.ts
   (android-native | web-desktop | web-ios-pwa | web-android | web-ios-safari) from Platform + UA +
   display-mode; the capability banner on Conducir, Viajes → Ajustes and the welcome permissions
   slide for web-ios-* (copy in 02-screens.md); navigator.storage.persist() once after the first
   vehicle; the "two tabs" boot error copy mentions the PWA case. Test on the iPhone: install
   the PWA fresh, deploy, reopen → no blank screen (document the steps Xaviel follows).
2. FRESH LOCATION (note 8, 16 dot; ADR-49): lib/trips/freshness.ts (pure, tested) → the user dot
   draws only on fixes ≤ 15 s old and ≤ 50 m; greyed last dot + "Buscando GPS…" otherwise; web
   watchPosition options enableHighAccuracy/maximumAge 0/timeout 20 s; Android
   getCurrentPositionAsync on open; auto detection never starts on a stale fix. User marker =
   <Avatar> in an amber ring with the course arrow (LiveMap native + web); fallback circle.
3. AUTO-TRIP ON ANDROID (note 7): apply the fix list from Phase 0's finding (typical candidates:
   re-arm on cold start AND on app foreground; verify permission 'always' before arming and send
   the user to permisos otherwise; request POST_NOTIFICATIONS; MIUI autostart card when the op is
   denied; ensure watching-mode fixes arrive with the screen off — if not, switch to the single
   High/2 s/10 m config per ADR-27's fallback). Add "Último fix recibido: hace N min" to Viajes →
   Ajustes so Xaviel can see the service is alive. Emulator GPX + screen-off run must open a trip.
4. HEADER (note 9): Inicio's Hanko 改 → Avatar (36 px) → Cuenta/Perfil; keep 改 on the Build tab
   header as a small seal with accessibilityLabel "modificado".
5. SYNC TIME (note 5): Cuenta → "30 sep 2026 · 3:58 p. m." (Intl dateTime, both locales); the
   sync pill's tooltip/long-press shows the same.
6. GARAGE LABELS (note 15): status chip solid over a scrim per 02-screens.md; audit every label in
   Portadas/Cuadrícula/Lista at 360 px and 390 px (web screenshots in docs/qa/imp-01102026-phase-1-garaje-*.png);
   fix overflow (ellipsis), spacing and the EX section header.
7. MODS PATH (note 17): "+ Mod" on the vehicle hub header; garage card long-press sheet (Agregar
   mod · Nueva echada · Chequeo); no status blocks a mod (audit (g) — remove any); mod categories
   seeded: accesorios, estetica with presets (tapones de válvula, polarizado, radio/pantalla,
   alfombras, emblemas, luces LED, spoiler, calcomanías, cubre volante, bocina); cost: RD$ default,
   "en USD" toggle second; ModForm quick-add from a preset fills name + category.
8. PAINT JOB (note 18): service types pintura_completa + desabollado_pintura (category
   carroceria, no interval); service form "Carrocería y pintura" group; after saving one, a one-tap
   "También guardar como evento (pintura)" creating the milestone linked to the service; before/after
   photos via the existing photo strip. Historial row + album timeline show it.
9. WELCOME (note 10): slide "Tu odómetro" + first-Inicio tip (copy in 02-screens.md); both languages.
10. RELEASE 2.4.3: versions, CHANGELOG (es), `bash tools/release-apk.sh --publish`, install over
    2.4.2 on the Redmi (backup), web deploy; smokes. Then Xaviel's Redmi drive (manual checklist).

VERIFY: Redmi — Automático armed, app backgrounded, screen off, the emulator-style GPX cannot be
replayed on the real phone: Xaviel drives; before that, the walk test (2 min, phone in pocket)
shows fixes in "Último fix recibido". iPhone PWA — banner visible, manual trip works with the
screen on, dot fresh at home at night. Web 360 px — garage labels. Report block; Notes closed:
2, 5, 8, 9, 10, 15, 16 (dot), 17, 18; 7 pending the drive.
```
