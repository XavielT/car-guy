# Architecture decisions — IMP 17092026 (Car Guy)

Each ADR: context → decision → consequences → how a prompt applies it. Defaults here are final for
this cycle: **Claude Code applies them and reports; it does not stop to re-ask.** If a prompt finds
a hard contradiction with the code, it says so in the report and picks the option closest to the
ADR.

---

## ADR-01 — Transform in place; new app identity

**Context.** Xaviel wants the existing repo transformed (not a new project), but chose a new Android
package (D1). Tu Combustible RD v1.1.0 is installed on his phone and maybe a friend's.

**Decision.** Work in `/home/xaviel/dev2/tu-gasolina-rd`. `app.json`: `name: "Car Guy"`,
`slug: "car-guy"`, `scheme: "carguy"`, `android.package: "com.xaviel.carguy"`, `version: "2.0.0"`,
`versionCode: 1` (new package → new counter; EAS `appVersionSource: remote` will manage it once
`eas init` links the new slug). `package.json` `name: "car-guy"`. DB file `carguy.db`. Web title,
manifest, `finalize-web.mjs` TITLE, README all say Car Guy. Repo renamed to `car-guy` and a new
Vercel project at the **end** (PROMPT-10), so all intermediate builds still deploy to the old URL.

**Consequences.** Existing installs are not upgraded; data comes in through the backup JSON import.
`extra.eas.projectId` in `app.json` (if present after `eas init`) must belong to the new slug or
EAS CLI throws a slug mismatch — PROMPT-01 runs `eas init` fresh (manual step if it needs login).

## ADR-02 — SQLite via `expo-sqlite`, async API only, repository layer

**Context.** One JSON blob cannot hold photos, inspections and years of records; on web AsyncStorage
is `localStorage` (~5 MB). `expo-sqlite ~57.0.3` runs on Android and on web (wa-sqlite worker +
OPFS) with the **async** API needing no COOP/COEP headers; the sync API and Drizzle's driver need
`SharedArrayBuffer` and cross-origin isolation, which fights Safari and Google Fonts.

**Decision.** `expo-sqlite` async API only (`openDatabaseAsync`, `runAsync`, `getAllAsync`,
`withTransactionAsync`, prepared statements). `SQLiteProvider` at the root with `onInit` running
`PRAGMA user_version` migrations written as plain SQL strings in TS (`lib/db/migrations.ts`). A
typed repository per aggregate in `lib/db/repos/*.ts`; screens never write SQL. Settings that are
truly key/value use `expo-sqlite/kv-store`. Metro config adds `wasm` to `assetExts`. All writes go
through a single serialised queue (one `withTransactionAsync` at a time) because
`withExclusiveTransactionAsync` throws on web. No ORM.

**Consequences.** `lib/store.tsx` becomes a thin React layer (hooks that query repos and refresh on
`addDatabaseChangeListener` or after each mutation). `docs/NEXT.md`'s "remove expo-sqlite" is
superseded. Backup export/import must work on web too (Blob download / file input) — OPFS can be
evicted by Safari.

## ADR-03 — Sync-ready records from day one

**Context.** Cloud sync arrives in PROMPT-09 but the schema is written in PROMPT-02. Legacy IDs are
not always UUIDs. Sync needs conflict resolution and tombstones.

**Decision.** Every syncable table has: `id TEXT PRIMARY KEY` (new rows: `crypto.randomUUID()`;
imported rows keep their legacy id verbatim), `vehicle_id TEXT` where applicable, `created_at`,
`updated_at` (ISO, set on every write by the repo, never by the UI), `deleted_at` (soft delete —
repos filter it out; nothing hard-deletes except "Borrar todos los datos"), and `synced_at`
(local-only, NULL = dirty). Cloud tables use `text` ids, `user_id uuid`, the same three timestamps,
last-write-wins on `updated_at`. Money as `REAL` in DOP (2-decimal rounding in the domain layer, as
today). Dates as ISO strings (`TEXT`), consistent with the existing code.

**Consequences.** "Delete" everywhere sets `deleted_at`. Statistics and lists must always exclude
tombstones (repos do it). A `sync_queue` table is *not* needed: dirty rows are found by
`synced_at IS NULL OR updated_at > synced_at`.

## ADR-04 — Domain logic is pure TypeScript, tested with jest-expo

**Context.** Reminder urgency, km/day estimation, brim-to-brim economy, marbete windows and interval
resets are the app's value and the easiest thing to get subtly wrong. Nothing is tested today.

**Decision.** `lib/domain/**` contains only pure TS (no React, no Expo imports): `economy.ts` (moved
from `lib/math.ts`, unchanged), `reminders.ts` (status, next due, prediction), `odometer.ts`
(km/day estimator), `catalog.ts` (default services, intervals, inspection templates, expense
categories, DR legal items), `legal-dr.ts` (marbete window). `jest-expo ~57.0.5` preset; tests in
`__tests__/domain/*.test.ts`. `npm test` must pass in every phase from PROMPT-01 on.
`npx expo lint` (eslint-config-expo flat) is configured in PROMPT-01 and must be clean.

## ADR-05 — Local-first account: optional, never blocking

**Context.** D3: the app works with no account; an account exists so a reinstall or a second device
can restore the data.

**Decision.** Auth = Supabase email + password (`@supabase/supabase-js` v2, `AsyncStorage`/kv-store
session persistence on native, `localStorage` on web, `detectSessionInUrl: false`,
`autoRefreshToken: true`). Anonymous use is the default; "Crear cuenta" lives in *Más → Cuenta*
and in a soft onboarding card. After first sign-in the **local garage is pushed** (nothing is lost);
if the account already has data, both sides merge by id/`updated_at`. Sign-out keeps the local
copy (explicit "Borrar datos locales" is separate). The anon key is in the client (fine; RLS
protects rows). No service-role key ever ships.

## ADR-06 — `x-core`, schema `carguy`, app-aware invite trigger

**Context.** D4. Supabase free tier = 2 projects; Xaviel already uses both (`x autohub`, `x-core`).
`x-core` hosts Music Hub, whose DB trigger `enforce_invite_only` on `auth.users` raises
`P0001 'Sign-ups are invite-only…'` unless the email is in `public.allowed_emails`. The trigger is
what blocked `imp 11092026` Phase 5. Email confirmation is OFF on `x-core`; prod and dev are the
same project.

**Decision.**
1. All Car Guy tables live in **schema `carguy`** (not `public`, not `tucombustible`). Expose it in
   Project Settings → API → *Exposed schemas* (manual step) and use `supabase.schema('carguy')`
   in the client. The empty `tucombustible.schema_check` probe from `imp 11092026` may be dropped
   in PROMPT-08 (it is documented as droppable) — or left; it is harmless.
2. The signup trigger becomes **app-aware**: Car Guy signs up with
   `options.data.app = 'carguy'` (lands in `raw_user_meta_data`). The trigger function is modified
   so that `NEW.raw_user_meta_data->>'app' = 'carguy'` **bypasses the invite check**; every other
   signup (Music Hub, no metadata) behaves exactly as before. The change is one `IF` in the
   function body, applied as a migration with a rollback statement, and **verified both ways**:
   Car Guy signup succeeds; a bare signup with a non-invited email still fails with the same
   message.
3. Car Guy's own `carguy.profiles` row is created by an `AFTER INSERT ON auth.users` trigger
   scoped to `app = 'carguy'`, so Music Hub's `public.profiles` trigger is untouched. If Music
   Hub's `public.profiles` trigger fires for Car Guy users too and that causes a visible side
   effect (a profile row in Music Hub's table), report it; do not silently change Music Hub's
   trigger beyond the `IF` in (2).
4. RLS on every `carguy` table: own rows only (`user_id = auth.uid()`), `authenticated` role only.
   `anon` gets nothing. Storage bucket `carguy-media` (private) with per-user folder policies.

**Consequences.** One shared Auth for all of Xaviel's apps: the same email could exist as a Music
Hub member and a Car Guy user — that is fine and expected. Any future app repeats the pattern
(`app = '<slug>'`). This ADR also unblocks `imp 11092026` Phase 5 conceptually (same trigger change).

## ADR-07 — Reminders: date ∧/∨ odometer, predicted, four states, notifications are a convenience

**Context.** Research (LubeLogger, Fleetio, CarVita): the best reminders support date, odometer, or
both ("whichever first"), reset on completion, and predict the due date from usage. Only CarVita
predicts; that is Car Guy's differentiator. `expo-notifications` is Android/iOS only; local
notifications work in Expo Go; exact alarms are restricted on Android 14+.

**Decision.** Truth lives in SQLite; `lib/domain/reminders.ts` computes for each reminder:
`dueDays`, `dueKm`, `predictedDueDate = min(dueDate, today + dueKm / kmPerDay)`, `status ∈
{ok, proximo, urgente, vencido}` with defaults *próximo* ≤ 30 days or ≤ 10 % of the km interval
(min 300, max 1 000 km), *urgente* ≤ 7 days or ≤ 100 km, *vencido* past either, and `triggeredBy ∈
{fecha, km}`. `kmPerDay` = median of daily rates over the last 90 days of odometer readings (all
sources), fallback 35 km/day until ≥ 2 readings, capped at 400. Completion writes a service record
(or a plain completion) and resets: `next_due_km = completion_km + interval_km`,
`next_due_date = completion_date + interval_months` unless `fixed_interval` (anchored to the
original due date — used for marbete/seguro/licencia). Notifications: channel `mantenimiento`,
`DATE` trigger at 09:00 local on the predicted due date and on the *próximo* threshold day; never
request exact-alarm permission; schedule at most the next 30; re-sync on app foreground. Web: in-app
banners only. No background tasks.

## ADR-08 — Inspections are templates → runs → tasks

**Decision.** `inspection_template` (name, cadence *diaria/semanal/mensual/antes de viaje*, items
grouped: *Fluidos, Gomas, Luces, Frenos y dirección, Exterior, Documentos*; each item has label,
1-line `how`, `warning`, `requiresColdEngine`) and `inspection` runs (date, odometer, per-item
result `ok|falla|na`, note, optional photo, duration). Default templates ship for *carro*,
*jeepeta/camioneta diésel* and *motor* (T-CLOCS-based). A `falla` requires a note and offers
"Crear tarea" (default) or "Crear recordatorio"; the run cannot be submitted with unanswered items.
Streak = consecutive scheduled periods with a completed run; a completed run also writes an
odometer reading. The *refrigerante* item shows the cold-engine rule inline (this is the incident).

## ADR-09 — One record table for service / repair / upgrade

**Decision.** `service_record` with `kind ∈ {mantenimiento, reparacion, mejora}` (LubeLogger's
proven shape: identical fields, different semantics; a record can be re-classified). Many catalog
items per record (`service_record_item`). Non-odometer costs stay in `expense` (seguro, marbete,
multas, peaje, parqueo, lavado, financiamiento, accesorios, grúa, otro). Fuel stays in `fuel_log`.
Every kind appears in the unified *Historial* via a SQL `UNION ALL` view `history_feed`.

## ADR-10 — Media: files on Android, BLOBs on web, compressed once

**Decision.** `expo-image-picker` → `expo-image-manipulator` (max 1600 px, JPEG q 0.75) →
Android: `Paths.document/media/<vehicleId>/<id>.jpg` (store the **relative** path); web: bytes in
`media.blob` (`Uint8Array`) since `expo-file-system` is a stub on web. A `media` table holds
`{id, owner_table, owner_id, kind, mime, rel_path|blob, width, height, size_bytes}`. PDFs via
`expo-document-picker`. Sync uploads media to Storage bucket `carguy-media/<user_id>/<id>` and
downloads lazily. `vercel.json` `Permissions-Policy` → `camera=(self)`.

## ADR-11 — Charts with `react-native-gifted-charts` on the bundled `react-native-svg`

**Decision.** `npx expo install react-native-gifted-charts react-native-svg expo-linear-gradient`.
No Skia/victory-native (wasm payload + expo-router dev constraint on web). Chart data shaping is
pure TS in `lib/domain/stats.ts` so the renderer can change later.

## ADR-12 — Dates: native picker on Android, `<input type="date">` on web

**Decision.** `components/DateField.tsx` (`@react-native-community/datetimepicker 9.1.0`) +
`components/DateField.web.tsx` (`<input type="date">`). Values stay `YYYY-MM-DD` at the edge and
ISO local-noon in the DB (existing convention).

## ADR-13 — Visual identity "Tablero nocturno"

**Decision.** See `05-design-identity.md`. Tokens in `constants/theme.ts` (`palette`, `semantic`,
`fonts`, `radius`, `space`), a `useTheme()` hook honouring system scheme with **dark as default**,
`userInterfaceStyle: "automatic"`. Fonts: Space Grotesk (display), Inter (UI), JetBrains Mono
(numbers). Status colours are part of the identity (ok/próximo/urgente/vencido). Applied to new
screens as they are built; legacy screens restyled in PROMPT-06.

## ADR-14 — Spanish only, strings centralised

**Decision.** UI stays es-DO with DR vocabulary (*gomas, jeepeta, motor, bomba, marbete, taller*).
All user-facing strings go through `lib/i18n/es.ts` (a plain object) from PROMPT-03 onward; legacy
screens are migrated when touched. No i18n library this cycle.

## ADR-15 — Git and release flow

**Decision.** Branch per phase `imp-17092026/phase-<n>-<slug>`, conventional commits, merge to
`main` after the phase report; `main` auto-deploys to Vercel. Android builds only in PROMPT-10
(plus a `preview` APK at the end of PROMPT-05 for a real-device notification test, if EAS is
logged in). Never commit `.env*`; add every new variable to `.env.example`.
