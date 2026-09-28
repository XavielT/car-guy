# PROMPT 06 — Block E: Pista — eventos, sesiones, setup copy-forward, tiempos, consumibles

**Depends on:** Phase 5 · **Branch:** `imp-28092026/phase-6-track` · **ADR:** 21 · **Size:** L
**Goal:** G5 — "de lao'" with data.

> **How to run:** `cd ~/dev2/car-guy && claude`, paste below the line.

---

```
Phase 6 of IMP 28092026: track / drift / drag / junte logging.

Read first:
- docs/imp-28092026/02-specs/01-data-model-v2.md §1 (venue, track_event, track_session,
  setup_sheet, consumable_usage), §2.4
- docs/imp-28092026/02-specs/03-screens.md (Block E)
- docs/imp-28092026/01-research/02-buildlog-track-community-refdata.md §B (minimal pro model,
  copy-forward, corner grid, drift specifics, complaints)
- docs/imp-28092026/00-context/05-design-jdm.md (CornerGrid, Pista artboard) +
  01-research/04-mockups/Pista.dc.html

Branch: imp-28092026/phase-6-track

1. DOMAIN lib/domain/track.ts: copyForward, diffSheets, pressureDeltas, flagRearGrowth(threshold
   8 psi), eventSummary, personalBests, heatCycles, padLife (+ reminder hook via the existing
   engine: when the projected pad thickness crosses 5 mm track / 3 mm street, upsert a
   reminder titled "Pastillas (pista)" metric date with due = next event date or +30 d). Tests.
2. PISTA INDEX app/pista/index (from Inicio QuickActions PISTA, Más → Pista, hub tab Pista):
   upcoming/past event cards (venue, date, discipline Badge, sessions, best lap or runs, gomas
   quemadas), PB strip per venue; "Nuevo evento".
3. EVENT app/pista/evento/nuevo|[id]: vehicle, venue picker (seeded Autódromo de las Américas +
   "Agregar pista": name, city, type), date, discipline chips (TRACK DAY · DRIFT · DRAG · AUTOCROSS
   · JUNTE · PRUEBA), weather chips + temps, condition, odometer start/end (readings source
   'track'), costs (entrada, gasolina, otros), notes, photos/videos (album pipeline, owner
   track_event, so they land in the Álbum timeline as PISTA/JUNTE items); sessions list with
   "Nueva sesión" (copy-forward from the last one).
4. SESSION app/pista/sesion/nueva|[id] per Pista.dc.html: header stats; setup card with CornerGrid
   (cold → hot pairs, delta chips, rear growth > 8 highlighted red with the "normal en drift" note),
   tire sets f/r (from wheel_set/tire), alignment, heights, springs, dampers (clicks + total),
   sway bars, pads/bias; drift extras when discipline = drift; timing block when not drift (laps,
   best/second, sectors, 0-100, ¼ mile + trap, 60 ft) else runs/incidents; feel chips (Subvira ·
   Neutral · Sobrevira · Nervioso · Lento) + rating; notes; "Cambiaste desde la sesión N: …" from
   changed_from_previous; buttons COPIAR A SESIÓN N+1 · COMPARTIR RESUMEN.
5. CONSUMABLES: on the event: "Gomas usadas" (pick tires → +1 heat cycle each), "Goma quemada"
   (retire), "Medir pastillas" (mm f/r → consumable_usage medida_pastilla → padLife). Tire rows in
   Inventario show cycles.
6. DAY SUMMARY: styled card (venue, date, discipline badge, sessions, runs, best lap, gomas
   quemadas, km en pista, RD$) → share as image (react-native-view-shot from Phase 4; on web, if
   capture is unreliable, share as a one-page PDF via the report pipeline) and as text.
7. INTEGRATION: Historial rows kind 'pista' (orange) with discipline subtitle; Cifras "Días de
   pista" tile + track spend category; hub Resumen "N eventos · PB <venue> <lap>"; Álbum timeline
   shows event photos under a PISTA/JUNTE item.
8. Flags: FEATURE_TRACK = true; Inicio QuickActions shows PISTA.
9. Tests: domain + copy-forward diff + summary with the AE85 seed (add a seeded drift event with
   two sessions in app/dev/seed.tsx).

VERIFY web + Android: create a drift event at the Autódromo, session 1 with pressures, session 2
via copy-forward changing rear psi → "Cambiaste…" note + red rear highlight, burn a tire, measure
pads, share the summary; screenshots docs/qa/phase-6-*. tsc/lint/test/build, verify-sync green.
Report, merge, push.
```

---

## Acceptance criteria

- [ ] Domain with tests; pad-life reminder hook.
- [ ] Events + sessions + copy-forward setup sheet per artboard; drift/timed variants.
- [ ] CornerGrid input with cold→hot deltas and rear-growth flag.
- [ ] Consumables: heat cycles, burned tires, pad measurements.
- [ ] Day summary shareable (image on Android; web fallback documented).
- [ ] Historial/Cifras/hub/Álbum integration; `FEATURE_TRACK` on; sync verified.

## Watch for

- Lap times stored in ms; input as `m:ss.mmm`; parse/format helpers tested.
- Copy-forward copies the *sheet*, not the timing/incidents.
- Venue seeded rows are `keyedBy user_id` in sync like catalogues.
