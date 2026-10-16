# Architecture decisions — IMP 16102026 (ADR-59 … ADR-64)

Numbering continues from ADR-58 (`docs/imp-01102026/00-context/03-architecture-decisions.md`), confirmed in phase 0.
ADR-59 and ADR-64 are written in full (phase 2); 60–63 are the BRIEF's proposals, each written when its phase builds it.

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

## ADR-60 … ADR-63 (proposed in the BRIEF; written when built)
- **60** One `SelectField` for every choice of a value (phase 3).
- **61** A repair stays a `ServiceRecord` with `kind='reparacion'` (phase 5).
- **62** One registry of functions feeds the hub, search, shortcuts, telltales and tips (phase 4).
- **63** Round-trip test of every field of a form through SQLite and sync (phase 1: vehicle; it already found the purchase-date drift).
