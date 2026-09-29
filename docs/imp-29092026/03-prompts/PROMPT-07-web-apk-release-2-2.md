# PROMPT 07 — Web: APK from the page, portfolio verified; release 2.2.0 "Kaidō"

**Depends on:** Phases 1–6 merged · **Branch:** `imp-29092026/phase-7-release` · **ADRs:** 34 · **Size:** M
**Goal:** G6 — distribution.

> **Before running:** Vercel CLI logged in (`vercel whoami` = xavielt); `gh` logged in; the
> Redmi for the upgrade test over 2.1.3 with your real data (back up first: Más → Datos →
> Respaldo JSON); EAS token in `.env.expo.local`. If the portfolio deploy is missing (Phase 0
> finding), this prompt deploys `xaviel-web-v2` `main` — approve the `vercel --prod` there.
>
> **How to run:** `cd` to the repo folder, `claude`, paste below the line.

---

```
Phase 7 of IMP 29092026: the web offers the APK itself (note 17), the portfolio is verified
(note 9), regression, release 2.2.0 "Kaidō".

Read first:
- docs/imp-29092026/01-research/03-bugs-env-feedback-apk-splash.md §5 (releases/latest/download
  semantics, api/apk.ts with CDN caching, Android UA detection, install flow copy)
- docs/imp-29092026/02-specs/03-screens.md "Phase 7"; ADR-34
- api/c/[slug].ts and vercel.json (function routing pattern, headers), app/+html.tsx (web head),
  tools/smoke-public-page.mjs (pattern for the new smoke), tools/ release script from 2.1.3,
  docs/NEXT.md, CHANGELOG.md, README.md
- ~/dev2/xaviel-web-v2: src/app/pages/home/home.ts (apps[]), src/app/shared/components/app-card/*,
  src/app/shared/i18n/{es,en}.ts, vercel.json; the Phase 0 "Portfolio" finding in PROGRESS.md

Branch: imp-29092026/phase-7-release

1. api/apk.ts: GET → fetch https://api.github.com/repos/XavielT/car-guy/releases/latest (optional
   GITHUB_TOKEN from Vercel env if set — not required for a public repo), pick the asset named
   exactly car-guy.apk, respond { version, publishedAt, url, size, notes } with
   Cache-Control public, max-age=60, s-maxage=600, stale-while-revalidate=3600, stale-if-error=
   86400; 502 with X-Car-Guy-Error on upstream failure (no secrets). vercel.json route + never
   cached by the service worker (/api/ already excluded — confirm). tools/smoke-apk.mjs: 1) /api/
   apk returns a version matching the latest tag, 2) url resolves (HEAD follows to
   objects.githubusercontent.com or similar, 200), 3) /instalar renders the button text.
2. /instalar (app/instalar.tsx, web only; native routes to the store-less message "Ya tienes la
   app"): per 03-screens.md — the button reads the version and size from /api/apk, plain <a
   href> to the stable download URL (fallback to releases/latest/download/car-guy.apk if the API
   fails), the three-step "Instalar apps desconocidas" explainer in Spanish with the exact
   Android wording, a PWA install hint, and a link to the portfolio. Show the "Instalar en
   Android" entry in Más and a small header pill only when Platform.OS === 'web' and the UA is
   Android (userAgentData?.platform === 'Android' || /Android/i.test(userAgent)); never inside
   the native app; never on iOS/desktop (they get the PWA hint instead).
3. PORTFOLIO (note 9): in ~/dev2/xaviel-web-v2 confirm main has the Car Guy card (7a228f1) with
   apkUrl releases/latest; add, if not present, the direct stable link as a second small text
   link "APK directo" (car-guy/releases/latest/download/car-guy.apk) and the es/en description
   mention of "viajes" (2.2). Run its tests (ng test) and build; if Phase 0 found the live site
   without the card, `vercel --prod` from that repo (with Xaviel's approval prompt) and re-check
   https://xaviel-web-v2.vercel.app for "Car Guy". Record the result. Do not touch its admin
   branch.
4. REGRESSION: the canaries (fuel flow, weekly check) + one flow per phase of this cycle (photo
   on new vehicle; pickers; partial with gauge; manual trip + auto trip on the emulator GPX;
   garage reorder; overlay; versiones; comentario; costs) on web and on the Redmi with a preview
   build; upgrade test: install release-apk over 2.1.3 with Xaviel's real data (backup taken) →
   garage intact, liters conversion shows the same km/gal as before on his DS3 (compare with his
   2.1.3 screenshot), sign-in still valid, trips settings default Apagado until he enables them
   (never turn on background location by an update).
5. BACKLOG PASS (docs/NEXT.md §3 carried items): npm audit count; decode-uri-component note;
   anything "Observed, deferred" in this cycle's PROGRESS.md that is < 30 min — do it, else keep.
6. RELEASE 2.2.0: versions; CHANGELOG "2.2.0 — Kaidō (fecha)" in Spanish by block (Viajes,
   Registro de vehículos, Combustible, Garaje, Novedades y comentarios, Arreglos) — Phase 6's
   generator must pick it up (regenerate lib/changelog.generated.ts); README feature list;
   docs/NEXT.md rewritten for the next cycle (what's done, what's carried: real map, heatmap,
   Play Store, inventory used_in_mod_id, MIUI native autostart check); build release-apk
   (universal) + production AAB (not uploaded); tools/check-bundle-env.mjs on the APK; GitHub
   release v2.2.0 with car-guy.apk + car-guy-v2.2.0.apk (+ SHA-256 in the notes); merge to main,
   tag, push; Vercel deploys; tools/smoke-public-page.mjs 6/6 and tools/smoke-apk.mjs 3/3 on
   production; the portfolio link resolves to v2.2.0.
7. PROGRESS.md: Phase 7 report, "Final state", the note table with every ✅ and its phase;
   hand-off notes.

VERIFY (final): from the Redmi's Chrome open car-guy.vercel.app → Instalar → download → install
over the previous version (same cert) → open → overlay → garage intact. Report block; notes
closed: 9, 17.
```
