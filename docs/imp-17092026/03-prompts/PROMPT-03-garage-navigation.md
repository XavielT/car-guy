# PROMPT 03 — Garage (rich vehicles, photos, odometer) + new navigation

**Depends on:** Phase 2 · **Branch:** `imp-17092026/phase-3-garage` · **ADRs:** 10, 12, 13, 14
**Goal:** G1. Car Guy's information architecture appears: new tabs, home with `OdometerHero` and
`QuickActions`, a real vehicle profile with photo and specs, odometer readings, DR vehicle types.

> **How to run:** `cd /home/xaviel/dev2/tu-gasolina-rd && claude`, paste below the line.

---

```
Phase 3 of IMP 17092026: build the Garage and switch the app to Car Guy's navigation.

Read first:
- CLAUDE.md → AGENTS.md; then the Expo 57 docs for expo-image-picker, expo-image-manipulator,
  expo-file-system (File/Directory/Paths; web is a stub), expo-router (typed routes, Href).
- docs/imp-17092026/02-specs/03-screens-ia.md   ← navigation and screens; authoritative
- docs/imp-17092026/00-context/05-design-identity.md (OdometerHero, QuickActions, StatusPill…)
- docs/imp-17092026/02-specs/01-data-model.md §1 (vehicle, vehicle_spec, odometer_reading, media), §3.1
- docs/imp-17092026/01-research/03-expo57-technical.md §3 (media), §5 (dates), §7
- docs/imp-17092026/00-context/03-architecture-decisions.md (ADR-10, 12, 13, 14)
- docs/imp-17092026/04-tracking/PROGRESS.md (Phase 1–2 notes: repo API, tokens)

Branch: imp-17092026/phase-3-garage

Requirements:

1. NAVIGATION (03-screens-ia.md)
   - Tabs become: Inicio · Chequeo · Historial · Cifras · Más (icons per spec). "Cargar" leaves the
     tab bar: move app/(tabs)/cargar.tsx to app/carga/nueva.tsx (Stack screen, title "Nueva carga");
     QuickActions → Combustible opens it. Chequeo tab: a placeholder screen this phase (title, an
     EmptyState "Los chequeos llegan en la próxima fase") — Phase 5 fills it.
   - app/_layout.tsx: add the new Stack screens with Spanish titles; keep typed routes compiling
     (run `npx expo start` once to regenerate types; commit expo-env.d.ts is gitignored — fine).
   - lib/i18n/es.ts: start the central strings object (ADR-14) and use it for every NEW string in
     this phase; legacy screens keep their inline strings until Phase 6.

2. HOME (app/(tabs)/index.tsx) — rebuild with the identity
   - Vehicle switcher chips (existing behaviour) + trailing "+ Agregar" chip → vehiculo/nuevo.
   - OdometerHero: current odometer (repos.odometer.current(vehicleId)) in JetBrains Mono, unit,
     "actualizado hace N días" caption; tap the number → odometro.tsx sheet to add a manual reading.
     Telltale row: THIS phase shows "Todo al día" or "N recordatorios · ver" computed from the
     legacy reminder rows (due date / km simple comparison); Phase 5 replaces it with the engine.
   - QuickActions 2×2: Combustible (→ carga/nueva), Chequeo (→ Chequeo tab), Mantenimiento
     (→ servicio/nuevo — placeholder route that says "próxima fase" until Phase 4; create the file),
     Gasto (→ gasto/nuevo — same placeholder).
   - "Este mes" strip: gasto total (fuel + service + expense), cargas, km recorridos (from readings).
   - Keep the existing economy insight card and the "Último tanque / Promedio" cards, restyled.
   - Move the PriceBoard (MICM) out of the home into Más → Combustible → "Precios de referencia"
     (precios.tsx already edits them; show the board at the top of that screen).

3. VEHICLE PROFILE
   - components/VehicleForm.tsx → rich form: nombre, tipo (segmented: Carro · Jeepeta · Camioneta ·
     Motor · Camión · Guagua · Otro), marca, modelo, año (numeric), color, placa (uppercase),
     chasis/VIN, combustible (existing FuelPicker), tanque, odómetro actual (initial reading →
     odometer_reading source 'manual'), "¿Aceite sintético?" toggle (affects the seeded aceite_motor
     interval: 10 000/12 instead of 5 000/6), fecha y precio de compra (collapsible "Compra"), foto
     (step 4), notas. Validation: nombre required; año 1950..currentYear+1; odometer ≥ 0.
   - app/vehiculo/nuevo.tsx (modal) replaces app/vehiculo.tsx; app/onboarding.tsx uses the same
     form (keep the "Importar respaldo" action from Phase 2).
   - app/vehiculo/[id].tsx: header (photo or placeholder mark, name, type · year make model, plate
     pill), current odometer + "Agregar lectura", specs list (vehicle_spec CRUD inline: presión de
     gomas, tipo de aceite, batería, bujías, gomas, wipers — offer these as suggestions), summary
     tiles (gasto total, km registrados, cargas, servicios), buttons Editar / Archivar / Quitar
     (soft delete with confirm; archived vehicles hidden from switcher, visible in Más → Garaje).
   - app/vehiculo/[id]/editar.tsx.
   - Más → Garaje section lists all vehicles (active/archived) with quick actions.

4. MEDIA (ADR-10) — lib/media/*
   - npx expo install expo-image-picker expo-image-manipulator (expo-file-system present).
   - `pickPhoto({ camera: boolean })` → picker (mediaTypes ['images'], quality 0.9) → manipulator
     resize width ≤ 1600, JPEG q 0.75 → Android: Paths.document/media/<vehicleId>/<id>.jpg (store
     rel_path); web: bytes → media.blob. `mediaUri(media)` resolves a displayable URI (file uri on
     Android, object URL on web with revoke on unmount via a hook `useMediaUri`). Delete = soft
     delete + file removal on hard reset only.
   - vercel.json Permissions-Policy → camera=(self), microphone=(), geolocation=().
   - Vehicle photo uses it; a generic <PhotoPicker> component is reusable by later phases.

5. DATE FIELD (ADR-12): components/DateField.tsx (npx expo install
   @react-native-community/datetimepicker) + DateField.web.tsx (<input type="date">). Value in/out
   'YYYY-MM-DD'. Use it in VehicleForm (purchase date) and replace the text date in FillUpForm and
   gastos.tsx while you are there (same value format, so no data change).

6. ODOMETER (01-data-model.md §3.1): lib/domain/odometer.ts with currentOdometer(readings) and
   kmPerDay(readings, today) exactly per spec (median over 90 days, fallback 35, cap 400, confidence).
   Tests __tests__/domain/odometer.test.ts (monotone, typo ignored, same-day ignored, fallback,
   confidence states). Forms: odometer default = current; lower value → warning (allow) unless the
   date is earlier than the max reading's date.

7. VERIFY web + Android: create a Jeepeta with photo (camera on Android, file on web), specs,
   odometer; switch vehicles; QuickActions open the right routes; archived vehicle hidden; fuel flow
   still works from Inicio → Combustible; Historial/Cifras unchanged. Screenshots docs/qa/phase-3-*.
   tsc/lint/test/build green. Report, merge, push.
```

---

## Acceptance criteria

- [ ] Five tabs as specified; Cargar reachable via QuickActions; Chequeo placeholder present.
- [ ] Home shows OdometerHero with the current odometer and a telltale row; QuickActions; "Este mes".
- [ ] Vehicle form with type/make/model/year/plate/VIN/fuel/tank/odometer/synthetic toggle/purchase/photo/notes; profile screen with specs CRUD, readings, tiles, archive.
- [ ] Photos: camera + library on Android (files in `Paths.document/media`), file input on web (BLOB), rendered via `useMediaUri`.
- [ ] `DateField` native + web; used in vehicle, fuel and gastos forms.
- [ ] `lib/domain/odometer.ts` with tests; forms default to the current odometer and warn on lower values.
- [ ] `lib/i18n/es.ts` started; all new strings go through it.
- [ ] PriceBoard lives in Más → Precios; fuel flow verified; lint/tsc/test/build green.

## Watch for

- `expo-image-picker` on web must be called from a user gesture (it injects `<input type=file>`).
- Object URLs on web leak unless revoked — the hook handles it.
- Typed routes: dynamic segments need `href={{ pathname: '/vehiculo/[id]', params: { id } }}` or a template literal typed as `Href`.
- Do not implement reminder logic here beyond the simple comparison; Phase 5 owns `lib/domain/reminders.ts`.
- Keep `gastos.tsx` reachable from Más (it is replaced in Phase 4).
