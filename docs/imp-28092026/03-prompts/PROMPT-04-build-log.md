# PROMPT 04 — Block B: Build log (mods por sistema), specs stock → actual, wishlist, inventario, gomas

**Depends on:** Phase 3 · **Branch:** `imp-28092026/phase-4-build` · **ADR:** 19 · **Size:** L
**Goal:** G3. The AE85's build has a home.

> **How to run:** `cd ~/dev2/car-guy && claude`, paste below the line.

---

```
Phase 4 of IMP 28092026: the build log.

Read first:
- docs/imp-28092026/02-specs/01-data-model-v2.md §1 (mod, mod_media, vehicle_specsheet,
  spec_snapshot, wishlist_item, inventory_item, wheel_set, tire), §2.2 (build + tires domain)
- docs/imp-28092026/02-specs/03-screens.md (Block B)
- docs/imp-28092026/01-research/02-buildlog-track-community-refdata.md §A (taxonomy, fields,
  complaints, UX to copy)
- docs/imp-28092026/00-context/05-design-jdm.md + 01-research/04-mockups/Build.dc.html
- docs/imp-28092026/04-tracking/PROGRESS.md (Phase 1: mod seed, Phase 3: media roles)

Branch: imp-28092026/phase-4-build

1. DOMAIN: lib/domain/build.ts (currentSpecs with per-field source, modTotalDop, investedByCategory,
   investedTotal/netInvested, wishlist→mod conversion payload) and lib/domain/tires.ts
   (parseTireSize incl. JDM/old formats, diameter/circumference/revsPerKm, compareSizes with
   speedo error, dotAge with ≥6-year flag, offsetDelta). Tests for all, incl. the AE85 seed:
   3A-U → 4A-GE 20V and 13x5 → 15x8 ET0 derived, not stored.
2. BUILD HUB TAB app/vehiculo/[id]/build with segmented MODS · SPECS · WISHLIST · INVENTARIO per
   Build.dc.html: header total invested + count; STOCK → ACTUAL mono card (4 headline fields:
   motor, HP, aros, ECU — tap → SPECS); mods grouped by category with subtotal; rows with thumb,
   name, Badge from tags (SWAP, TUNE, DRIFT…), meta (date · km · installer/vendor · "+ aduana RD$"),
   total, status dot; long-press actions Quitar / Vender / Reinstalar / Reclasificar; wishlist rows
   dashed with AHORRANDO outline pill inline at the end of the list; "+ AGREGAR MOD" amber.
3. MOD FORM app/mod/nuevo|[id]: everything in 03-screens.md Block B. FX helper: the user types a
   foreign price + currency; a "tasa" field defaults to the last used rate (setting
   last_fx_rate_usd); DOP totals are what is stored. "Afecta la ficha" → spec_effects mini-form.
   Photos with roles via the Phase 3 pipeline (mod_media). Saving an installed mod writes an
   odometer reading (source 'mod' — add to OdometerSource) and, if the category maps to a
   service_type (e.g. gomas → cambio_gomas, frenos → pastillas), offers to reset that reminder.
   "Mejora" in the service record form now redirects to this form (keeps the alias).
4. SPECS TAB: table of fields grouped Motor · Chasis · Ruedas · Dimensiones; each row Stock |
   Actual | source chip (STOCK / <mod name> / TÚ); edit stock (JSON via typed form), override a
   field, clear override; "Fijar snapshot"; snapshots list; "Compartir ficha como imagen" — use
   react-native-view-shot (npx expo install react-native-view-shot; verify SDK 57 compat; on web
   it captures via canvas — if it fails on web, hide the button on web and report).
5. WISHLIST: sections by priority; form (category, name, brand, part#, foreign price + currency +
   envío + aduana estimates → total RD$, url, vendor, target date, status); "Convertir a mod"
   prefills the mod form and links converted_mod_id; totals per priority in the header.
6. INVENTARIO: kinds filter; wheel_set cards (specs line "15x8 ET0 · 4x100 · CB 54.1", status,
   "Montar en <vehículo>" → status montado and, if tires linked, positions); tires list (size,
   DOT chip "sem 23/2023 · 3.3 años", heat cycles, position, tread mm) with "Mover a set /
   posición"; parts/fluids/tools rows with qty + location; "Usar en un mod" links inventory to a
   new mod (status stays until removed).
7. HISTORIAL: 'mod' kind rows (green) with "Instalado"/"Quitado" subtitle; filter chip MODS.
   CIFRAS: "Inversión en mods" tile + category in the donut. Vehicle hub Resumen: "N mods · RD$
   invertido" line + top 3 badges.
8. Flags: FEATURE_BUILD = true; Inicio QuickActions shows BUILD.
9. Tests: domain + a screen-level test of currentSpecs source chips with the seed.

VERIFY web + Android with the AE85 seed: add 3 mods (one from a wishlist conversion, one with USD
+ customs, one affecting specs), see STOCK → ACTUAL update, remove one (history keeps it), tire
DOT age, wheel set mount; screenshots docs/qa/phase-4-*. tsc/lint/test/build green; sync round
trip of mods/tires/wishlist between web and Android (verify-sync + manual). Report, merge, push.
```

---

## Acceptance criteria

- [ ] `lib/domain/build.ts` + `tires.ts` with tests; derived specs with sources.
- [ ] Build hub tab per artboard: mods grouped, subtotals, badges, long-press lifecycle, wishlist inline, + button.
- [ ] Mod form complete incl. FX helper, spec effects, photo roles, odometer reading, reminder offer; "Mejora" alias.
- [ ] Specs tab with stock/actual/override/snapshot; share-as-image on Android (web reported).
- [ ] Wishlist with priorities and conversion; Inventario with wheel sets, tires (DOT, cycles), parts.
- [ ] Historial/Cifras/hub integration; `FEATURE_BUILD` on; sync verified.

## Watch for

- `spec_effects` JSON keys are the contract with `currentSpecs()` — define them once in `lib/domain/build.ts` and validate on save.
- Removing a mod must not delete its history; "vendido" stores `sold_price_dop`.
- A tire size string may be missing the load/speed; the parser returns partial results, never throws.
