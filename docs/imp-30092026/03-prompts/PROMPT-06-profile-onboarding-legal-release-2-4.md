# PROMPT 06 — Perfil y avatares, bienvenida, legal, eliminar cuenta; release 2.4.0 "Tōge"

**Depends on:** Phases 1–5 merged · **Branch:** `imp-30092026/phase-6-people-release` · **ADRs:** 47 · **Size:** L
**Goal:** G5; release.

> **Before running:** approve `sql/028_delete_account.sql` (read it); a Vercel env
> `SUPABASE_SERVICE_ROLE_KEY` for `api/eliminar-cuenta.ts` only (the prompt asks; if you decline,
> deletion of the auth user stays a manual admin step and the app says so); Redmi for the
> upgrade test; backup before installing 2.4.0. Read the legal drafts before the release — they
> are not legal advice.
>
> **How to run:** `cd` to the repo folder, `claude`, paste below the line.

---

```
Phase 6 of IMP 30092026: profile picture + avatars, the welcome tutorial with tips, legal pages +
acceptance + account deletion, regression, release 2.4.0 "Tōge". Notes 10, 11, 15.

Read first:
- docs/imp-30092026/01-research/02-i18n-skeleton-onboarding-avatars-legal.md §3 (onboarding:
  FlatList pager, Stack.Protected gate, skip, tips), §4 (avatars: SVG registry, crop, fallback;
  trademark checklist), §5 (legal outlines ES/EN, prominent disclosure, data safety, account
  deletion in-app + web, Ley 172-13, age statement, the "not legal advice" caveat)
- docs/imp-30092026/02-specs/03-screens.md "Phase 6"; 02-cloud-v4.md §028; ADR-47
- app/onboarding.tsx (first vehicle), app/cuenta.tsx, lib/cloud/auth.ts, app/(tabs)/mas.tsx,
  lib/media/index.ts (compressPhoto), app/admin/*, lib/legal/index.ts (Phase 2 stub),
  api/apk.ts (function pattern), tools/release-apk.sh, CHANGELOG.md, README.md, docs/NEXT.md

Branch: imp-30092026/phase-6-people-release

1. AVATARS + PROFILE (note 10): assets/avatars/*.svg — 16 in-house drawings in the amber/red
   palette on #121212: helmets (3 styles), generic car silhouettes (coupe, hatch, kei, pickup,
   wagon — no real model, no badges), a wheel, a turbo, a checkered flag, kanji 改 / 走 / 峠 on
   discs, a wrench+spanner, a tire with smoke. Trademark checklist in the PR. SVGR → components;
   registry with ids + labels (both languages); <Avatar size src avatarId name/> with photo →
   avatar → initials fallback. Profile screen: grid + Tomar foto / Elegir foto → square crop
   (expo-image-manipulator crop) → compressPhoto 512 px → local file; signed in: upload to
   carguy-media/<uid>/avatar.jpg (existing bucket, owner path) + profiles.avatar_path; display
   name. Avatar in Más header, member lists, admin lists (initials fallback). Anonymous users keep
   it local; on sign-in it uploads.
2. BIENVENIDA (note 11): app/bienvenida/index.tsx (FlatList pager, 6 slides per 03-screens.md,
   skip on every slide, dots, JDM art with the existing components — no new illustrations beyond
   the avatars); gate: `onboarded_version` unset → /bienvenida (Stack.Protected or Redirect on
   SDK 57); the "primer carro" slide reuses the vehicle form (or "después"); the permissions slide
   explains only (asks in context later) and doubles as the prominent disclosure for background
   location (exact wording from research §5); the account slide reuses Cuenta. Existing users
   (2.3.x → 2.4.0) do NOT see the welcome (onboarded_version backfilled by migration? — v8 has
   no such column: set it in the 2.4.0 upgrade path from app version detection: if vehicles > 0
   at first 2.4.0 launch → mark onboarded). First-visit tips: TipCard on Viajes, Build, Pista,
   Álbum, Eventos, Conducir (tips_seen); Más → Ayuda: "Ver la bienvenida otra vez", "Consejos".
3. LEGAL (note 15, ADR-47): content/legal/{terminos,privacidad,eliminar-cuenta}.{es,en}.md drafted
   from research §5 outlines, Car Guy specifics filled in (data list: location incl. background,
   photos, vehicle data incl. optional plate/VIN, trips, feedback with device info; storage:
   Supabase (region — read it from the project settings and write it), Vercel, GitHub for APKs,
   OpenFreeMap/OSM tile requests expose IP; retention; deletion; third parties; age 18+ to create
   an account; Ley 172-13 rights and the contact e-mail; the GPS/odometer/speed disclaimer and the
   safety notice for drive mode; the visible "no es asesoría legal" line in the docs folder, NOT
   on the public page). LEGAL_VERSION '2026-10'. Web routes /terminos, /privacidad,
   /eliminar-cuenta (static, both languages by ?lang or the app language, version + date, plain
   readable typography); in-app Más → Legal renders the same Markdown (a tiny renderer or
   react-native-markdown-display — check web support; else pre-render to JSX). Acceptance sheet
   on first launch after 2.4.0 and at signup (legal_acceptance row; blocks only the cloud features
   until accepted? — no: blocks nothing except account creation; local use needs no account and
   the terms are shown + accepted once — record it). tools/smoke-legal.mjs: the three pages 200
   with the version string.
4. ELIMINAR CUENTA: sql/028 (RPC deletes carguy data + objects, marks profile), api/eliminar-cuenta.ts
   (service role, deletes the auth user for the calling JWT's uid after the RPC succeeded; refuses
   non-Car-Guy accounts), Cuenta → Eliminar cuenta (type ELIMINAR, confirm, local wipe via
   lib/db/reset.ts, then RPC, then the function; success screen). Admin panel: "Cuentas por
   eliminar" list (profiles with deletion_requested_at and an auth user still present) with a
   button when the function is not configured. local-rls: user A deletes → A's rows gone, B intact.
   verify-x-core: RPC refuses a Music Hub-only account.
5. REGRESSION + UPGRADE: canaries + one flow per phase (fill-up detail, English switch, a skeleton,
   drive mode + map, an event, a fact, tires card, prices, avatar, welcome on a fresh install,
   legal sheet, account deletion on a throwaway account). Upgrade 2.3.1 → 2.4.0 on the Redmi with
   Xaviel's data (backup): garage intact, prices migrated, no welcome shown, legal sheet shown
   once, language follows the phone.
6. RELEASE 2.4.0 "Tōge": versions; CHANGELOG (Spanish, by block: Idioma, Modo conducir y mapa,
   Eventos, Mi carro de memoria, Gomas, Precios, Perfil y bienvenida, Legal, Arreglos); README;
   docs/NEXT.md rewritten (carried: real drive result, Play Store checklist now that legal exists,
   MapTiler fallback key, MICM parser status, Music Hub sign-in check); `bash tools/release-apk.sh
   --publish`; merge, tag, push; smoke-public-page, smoke-apk, smoke-legal; portfolio text mention
   of English + map (edit ~/dev2/xaviel-web-v2 card description, push).
7. PROGRESS.md: Phase 6 report, Final state, the note table all ✅ (or the honest exception).

Report block; Notes closed: 10, 11, 15.
```
