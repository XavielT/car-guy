# PROMPT 06 — Juntes: invitar, mapa en vivo, después del paseo, chat (apagado); release 2.5.0 "Nakama"

**Depends on:** Phase 5 · **Branch:** `imp-01102026/phase-6-juntes-release` · **ADRs:** 57 · **Size:** L
**Goal:** G4 (part 2); release.

> **Before running:** sql/035 + 036.shared applied (Phase 2); two phones (Redmi + the iPhone PWA,
> or a second Android) with two accounts for the live test; Redmi for the upgrade test (backup).
>
> **How to run:** `cd` to the repo folder, `claude`, paste below the line.

---

```
Phase 6 of IMP 01102026: rutas con amigos. Note 13. Then regression and release 2.5.0.

Read first:
- docs/imp-01102026/01-research/02-social-follows-live-location-juntes.md §3, §4, §5 (channel
  design, adaptive interval, kick, REST broadcast from the background task, junte model, chat later)
- ADR-57; 02-screens.md "Phase 6"; 01-data-model-v10.md §3
- lib/junte/* stubs, lib/trips/task.ts (background publish), components/map/LiveMap.*,
  app/conducir.tsx, app/invitacion/[code].tsx (invite pattern), lib/share/members.ts

Branch: imp-01102026/phase-6-juntes-release

1. JUNTES: list (próximos · en vivo · pasados), Nuevo junte (título, fecha/hora, punto de
   encuentro pin + label, visibilidad, code/link/QR), Junte screen (members with avatars/status,
   Voy, "En vivo" switch with the explanation sheet, live map, re-centre/fit-all, time left),
   Después (all trip_shares of members coloured per member, km each, photos grid linked to the
   junte, auto "Guardar como evento" junte on each member's car, Compartir resumen image). Deep
   link carguy://junte/<code> + web /j/<code> (function with OG + "abre en la app / instala").
2. LIVE: Realtime private channel carguy:junte:<id>; Presence for online members (avatar_id,
   handle); Broadcast positions {lat, lng, heading, ts, avatar_id} at T = max(4 s, n²/60) only
   while the member's "En vivo" is on and within the live window; never persisted; kick event
   obeyed; setAuth after token refresh; Android background task publishes via the REST broadcast
   endpoint when the app is backgrounded (only while a trip is recording or the switch is on);
   iPhone PWA publishes only in the foreground (banner). No speeds shown for others, ever.
3. CHAT (flag off): junte_message list + input, report/delete/block; FEATURE_JUNTE_CHAT stays
   false in the release; a note in NEXT.md: needs push notifications (FCM credentials) first.
4. PRIVACY: others' routes after the junte come only from trip_share (trimmed); the live dot is
   the only raw position ever shown and only to members during the window.
5. REGRESSION + UPGRADE: canaries + one flow per phase of this cycle; iPhone PWA fresh install →
   banners, manual trip; Redmi 2.4.3 → 2.5.0 (backup): garage intact, gauge for the DS3 set, OTA
   channel visible, profile with handle, a junte between the two accounts shows both dots live
   (one may be the iPhone in the foreground).
6. RELEASE 2.5.0 "Nakama": versions (native change → APK path), CHANGELOG (es: Comunidad, Juntes,
   Medidor por cuadros, Actualizaciones, Apoyar, iPhone, Arreglos), README, docs/NEXT.md (carried:
   chat + push, iOS native, key rotation, Play checklist with the new Data safety items — follows,
   live location; MapTiler key; MICM), `bash tools/release-apk.sh --publish`; then a JS-only 2.5.1
   with `--ota` to prove the updater (a visible copy fix) — this is the acceptance for note 6.
7. PROGRESS.md: Phase 6 report, Final state, the note table all ✅ (or the honest exception).

Report block; Notes closed: 13 (chat as a later stage, as agreed).
```
