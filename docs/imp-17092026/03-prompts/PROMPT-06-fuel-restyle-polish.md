# PROMPT 06 — Fuel section restyle + identity pass on every legacy screen

**Depends on:** Phase 5 · **Branch:** `imp-17092026/phase-6-identity-pass` · **ADRs:** 13, 14
**Goal:** G5 preserved and G8 (identity) completed. Note 5 (*registrar combustible*) keeps every
behaviour; the app looks like one product on every screen.

> **How to run:** `cd /home/xaviel/dev2/tu-gasolina-rd && claude`, paste below the line.

---

```
Phase 6 of IMP 17092026: finish the visual identity across the app and remove the legacy theme alias.

Read first:
- docs/imp-17092026/00-context/05-design-identity.md  (the spec; "What stays from the old identity")
- docs/imp-17092026/04-tracking/PROGRESS.md → Phase 1 notes: list of screens still using the
  `colors` alias; whether Syne/Figtree/IBM Plex were removed
- docs/imp-17092026/00-context/04-conventions.md
- lib/i18n/es.ts (Phase 3+), components/ui/*

Branch: imp-17092026/phase-6-identity-pass

Requirements:

1. FUEL SCREENS with the new identity, behaviour unchanged:
   - app/carga/nueva.tsx + components/FillUpForm.tsx: tokens, DateField (Phase 3), station chips,
     the "two of three" calc box in mono, full/partial segmented; ADD the `missed_previous` toggle
     ("Se me olvidó registrar una carga anterior") — when set, computeEconomy must start a new
     chain at this fill-up (extend lib/domain/economy.ts with a test; a missed flag behaves like
     the first full tank: baseline, no economy point). Review alert → replace Alert with a result
     Sheet using StatusPill (low → vencido colour, great → ok, normal → neutral) and the same lines.
   - app/carga/[id].tsx edit: same form.
   - PriceBoard: restyled (dark panel, mono digits text.primary, accent eyebrow) on
     app/precios.tsx; keep editing behaviour.
   - Historial fuel rows already use RecordRow (Phase 4) — verify the km/gal tag and partial label.
   - Cifras: this phase only restyles the existing tiles/bars with tokens; Phase 7 rebuilds it.

2. REMAINING LEGACY SCREENS: app/(tabs)/mas.tsx (sections per screens spec: Garaje · Mantenimiento ·
   Combustible · Documentos · Cuenta (placeholder card "Próximamente" until Phase 8) · Datos ·
   Apariencia · Notificaciones · Acerca de), app/onboarding.tsx (welcome copy, two big actions,
   mark), app/+not-found.tsx, any screen still importing `colors` from constants/theme.ts.

3. REMOVE THE ALIAS: delete the `colors` compatibility export; every screen uses useTheme().
   Remove @expo-google-fonts/syne, figtree, ibm-plex-mono from package.json if no import remains.
   Every user-facing string in the app goes through lib/i18n/es.ts (grep for JSX text literals with
   accents/Spanish words outside es.ts; move them). Keep the file organised by screen.

4. LIGHT MODE PASS: switch to light in Más → Apariencia and walk every screen; fix contrast issues
   against the light tokens (status pills on light bg, PriceBoard remains dark by design — that is
   allowed, it is a "panel").

5. ACCESSIBILITY: accessibilityLabel on icon-only buttons, ≥ 44 px targets, StatusPill always has
   text, `accessibilityRole` on segmented controls.

6. app/dev/tokens.tsx updated with every ui component; docs/qa/phase-6-* screenshots of all tabs
   in dark and light. tsc/lint/test/build green. Fuel flow verified (create full, partial, edit,
   delete; km/gal identical; missed_previous chain break). Report, merge, push.
```

---

## Acceptance criteria

- [ ] No `colors` alias; no Syne/Figtree/Plex; `useTheme()` everywhere.
- [ ] Fuel forms/history/prices restyled, behaviour identical (tests still green) + `missed_previous` implemented and tested.
- [ ] Más reorganised per spec; onboarding and not-found restyled.
- [ ] All strings in `lib/i18n/es.ts`.
- [ ] Light mode verified on every screen; a11y pass done.
- [ ] Screenshots for all tabs in both schemes; lint/tsc/test/build green.

## Watch for

- `missed_previous` changes economy output only when set — tests must show existing fixtures are unaffected.
- The PriceBoard staying dark in light mode is intentional; text on it must still pass contrast.
- Don't restyle by copy-paste: promote repeated patterns into `components/ui` (e.g. `SectionHeader`, `KeyValueRow`).
