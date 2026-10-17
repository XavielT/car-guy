# Architecture decisions — IMP 16102026 (ADR-59 … ADR-64)

Numbering continues from ADR-58 (`docs/imp-01102026/00-context/03-architecture-decisions.md`), confirmed in phase 0.
ADR-59 and ADR-64 are written in full (phase 2), ADR-60 in phase 3, ADR-62 in phase 4; 61, 63 are the BRIEF's proposals, each written when its phase builds it.

## ADR-59 — Permissions: one registry, always explained first, re-read on return
**Status:** implemented in phase 2.

**Context.** Permissions were asked from ~12 unconnected places (`docs/imp-16102026/permissions-inventory.md`), three of them in cold (location when a trip starts, photos when Importar opens, the camera not at all). A refusal produced passive text ("Sin permiso de ubicación") — even for someone who had never been asked — and no way out. On the web the expo-location shim answers `canAskAgain: true` to every refusal, and collapses the position errors 2 and 3 into "denied".

**Decision.**
1. `lib/permissions/` is the only code that touches a system permission API: `impl.ts` (Android: expo-location, expo-notifications, expo-image-picker, expo-media-library, the MIUI battery module, intent launcher) and `impl.web.ts` (Permissions API with fallback, geolocation error codes 1/2/3, `storage.persist`). `__tests__/permissions/architecture.test.ts` fails if a screen or lib file calls `get/request…PermissionsAsync`, `Linking.openSettings`, `navigator.permissions`, `hasServicesEnabledAsync` or `presentPermissionsPicker` outside it.
2. One vocabulary: `granted · undetermined · denied_can_ask · denied_blocked · services_off · unavailable · unknown` (+ details `approximate`, `limited`, `needs_foreground`). Pure mapping in `map.ts` (a web refusal is always `denied_blocked`; "never asked" is never a refusal).
3. Nothing is asked in cold: a request goes through `usePermissionRequest(id).ensure()` — the **primer** sheet explains why, "Permitir" shows the system dialog, "Ahora no" asks nothing; blocked → steps (Android: + "Abrir ajustes"; iPhone/web: numbered steps + "Ya la activé"). The Android 11+ background permission is a two-step flow whose primer carries Play's prominent disclosure.
4. The registry re-reads on `AppState` `active` and on `visibilitychange`; the watch of the user's position follows the permission (starts when it is granted, stops when it is taken away).
5. Components: `PermissionPrimerSheet`, `PermissionStepsSheet`, `PermissionGate`, `PermissionChip`, `PermissionBanner`, `PermissionRow`; the screen **Más → Permisos y acceso** (`app/permisos.tsx`) and the welcome's last step list every permission that exists on the platform.

**Consequences.** Android permissions that arrive implicitly through library manifests are still not declared in `app.json` (phase 6 decides, with the merged manifest in hand). Changing declared permissions is native → APK; the registry itself is JS → OTA.

## ADR-64 — Map without a position: a fallback camera and a way out, never a passive notice
**Status:** implemented in phase 2 (the button and offline map shipped in 2.5.2).

**Decision.** The drive map always has a camera: the last good position saved in the local setting `last_fix` (written at most every 30 s; "hace X" shown) → the median of where recent trips started → Santo Domingo (18.4861, −69.9312), never a house or other personal place (`lib/map/fallbackCamera.ts`). The notice over the map is always actionable (`gpsNotice`): the registry's chip for a permission problem, "Reintentar" for a failed read (with its reason: no signal / too slow — codes 1/2/3), "Buscando GPS…" with "Reintentar" after 15 s. "Centrar en mí" is always visible (disabled without a position). An approximate fix moves the map (greyed, ±N m); without map tiles it shows the coordinates and a retry.

## ADR-60 — One SelectField for every choice of a value
**Status:** implemented in phase 3.

**Context.** The app had ~104 ways to choose a value on screen: 90 lines of `Chip` (rows that wrap, scroll sideways or fill the form), 29 of `Segmented`, and ten hand-made `Pressable` radios — the same choice (fuel, vehicle status, visibility) drawn differently from one screen to the next, and a list of 13 body types taking half a screen (`docs/imp-16102026/picker-inventory.md`).

**Decision.**
1. A choice of a value is a `SelectField` (`components/pickers/SelectField.tsx`): a `PickerField` that shows the current value and opens a `SelectSheet` with the options. The sheet **closes when one is chosen**; the scrim, ✕/back and Esc close it without changing the value. Two options or thirty, a form or the settings — the options are never laid out on the screen.
2. The sheet is the existing `SearchSheet` (search above 8 options, "Otro…" with its text field via `other`, the chosen one marked ✔ and in view), the colour grid for `variant="swatch"`, and toggles that stay open with "Listo" for `MultiSelectField`. `allowNone` adds a first "Ninguno" (`null`) row. `SelectOption.value` may be a string, a number or `null`.
3. A yes/no is not a choice between named options: it is a `ToggleRow` (a Switch with its words) — "Pasajero", "Tanque lleno", "Solo reserva", "Mapa en línea"…
4. A list filter is a `FilterBar` pill "Tipo: Todos ▾" that opens the same sheet; the first option is "Todos"; with any filter on, a counter and "Limpiar" appear. The state lives in the screen.
5. Navigation is not a value and keeps its tabs: Ficha/Memoria, Modificaciones/Specs/Wishlist, Amigos/Seguidores…, Entrar/Crear cuenta, Línea de tiempo/Cuadrícula. `__tests__/pickers/no-inline-selectors.test.ts` fails if a screen renders `Chip` or `Segmented` outside that named list (each entry carries its reason, and the list cannot rot).

**Consequences.** One interaction to learn; forms get shorter (no wrapping chip walls). Choosing something that used to be one tap on a visible chip is now two taps (open, choose) — the price of consistency, accepted in BRIEF §3 for choices with more than a couple of options and for the sake of one pattern for the rest. Touch targets stay ≥ 44 pt (PickerField 56, rows 48, pills 44).

## ADR-62 — One registry of functions feeds the hub, the search, the shortcuts, the telltales and the tips
**Status:** implemented in phase 4.

**Context.** OBD lived two taps down a 33-row list in Más, with no shortcut and no telltale; 19 functions were hidden (≥ 3 taps or a single path, `docs/imp-16102026/feature-map.md`); the vehicle's tab strip cut "Pista, Viajes, Docs" off the screen with no hint that it scrolls.

**Decision.**
1. `lib/features/registry.ts` is the list of what the app can do: `FeatureDef` = id, icon, href (`[id]` = the active vehicle), section, `needsVehicle`/`passVehicle`, the `app/` folders it `covers`, keywords in es **and** en, and where it surfaces (`featured`, `shortcut`, `telltale`). Titles and one-line descriptions live in the dictionaries (`t.features.items`).
2. **Guard:** `__tests__/features/registry.test.ts` walks `app/` and fails when a screen is neither covered by a feature nor named in `INTERNAL_ROUTES` with its reason; it also fails when an id lacks its es/en title and description.
3. **Hub "Herramientas"** (`app/herramientas.tsx`): search on top, the four featured functions (OBD, reparación, echada, viaje), then a card per function by section with its badge (OBD codes pending, a missing permission). Entry: first row of Más and two buttons in Inicio's header (the hub, and the magnifier that opens it with the search focused). The tab bar is unchanged (CONDUCIR + 4).
4. **Search** (`lib/features/search.ts`): accent-folded, every word must mean something (title, keyword or description), a slip of one or two letters is forgiven, es and en keywords always both searched.
5. **Vehicle:** a shortcut row (the registry's `shortcut` functions) over the tabs; the tab strip is an `EdgeScroll` (fade on the side with more, the active tab centred) plus an "all sections" button that opens a `SelectSheet`.
6. **Telltales:** the lamp → function map is the registry's (`LAMP_TELLTALE`, `featureForTelltale`); a long press says what a tap does; a new CHECK lamp is off unless a saved OBD code is unresolved.
7. **Home nudge:** one card at a time — the two-step pointer to Herramientas, OBD's "¿Se prendió una luz?", then a function never used (`DISCOVER_ORDER`); each is dismissible and local-only (`settings`: `tools_tour_done`, `obd_notice_dismissed`, `feature_used`, `discover_dismissed`).

**Consequences.** A function added to the registry shows up in the hub and the search by itself, and a screen added without registering fails a test. A telltale now opens the *action* (log an oil change) rather than the reminders list; reminders remain one tap from "Pendientes" and two from the hub.

## ADR-61, ADR-63 (proposed in the BRIEF; written when built)
- **61** A repair stays a `ServiceRecord` with `kind='reparacion'` (phase 5).
- **63** Round-trip test of every field of a form through SQLite and sync (phase 1: vehicle; it already found the purchase-date drift).
