# PROMPT 06 — Garaje v2, animated launch, Novedades y versiones, comentarios, "lo que me ha costado"

**Depends on:** Phase 3 (covers) · **Branch:** `imp-29092026/phase-6-garage-feedback` · **ADRs:** 35, 36 · **Size:** L
**Goal:** G5 — the app talks back; G3 — the garage looks like a garage.

> **Before running:** approve `node tools/apply-sql.mjs sql/020_feedback.sql` (read it first:
> anon insert through an RPC with a rate limit; admin = your email) and its `--shared` storage
> statements (bucket `carguy-feedback`, listed in the prompt). No account is created for you; the
> admin view is verified by you signing in.
>
> **How to run:** `cd` to the repo folder, `claude`, paste below the line.

---

```
Phase 6 of IMP 29092026: Garaje v2 (note 14), animated launch (note 7), Novedades y versiones
(note 5), Enviar comentario + admin inbox (note 6), "Lo que me ha costado" (note 8, Cifras half).

Read first:
- docs/imp-29092026/02-specs/03-screens.md "Phase 6" (all five blocks)
- docs/imp-29092026/02-specs/02-cloud-v3.md §020 (SQL given) and ADR-35, ADR-36
- docs/imp-29092026/01-research/03-bugs-env-feedback-apk-splash.md §3 (changelog build step,
  expo-constants/expo-application in SDK 57), §4 (feedback table, RPC, device info, outbox), §6
  (splash overlay pattern + component sketch)
- docs/imp-28092026/01-research/04-mockups/Garaje.dc.html and 05-design-jdm.md; the new mockup
  docs/imp-29092026/01-research/05-mockups/GarajeV2.dc.html (and Viaje.dc.html, Viajes.dc.html for Phase 5)
- app/(tabs)/garaje.tsx, lib/db/garageQueries.ts, lib/domain/garage.ts, app/_layout.tsx,
  assets/images/splash-icon.png (geometry to replicate), components/ui/ClusterHero.tsx (arc
  maths to reuse), lib/motion/gaugeSweep.ts (the cluster sweep must NOT replay after the
  overlay — one sweep per launch), app/(tabs)/mas.tsx, app/(tabs)/cifras.tsx, lib/domain/stats.ts
  (existing TCO), lib/domain/costs.ts spec in 01-data-model-v6.md §2, CHANGELOG.md format,
  package.json scripts (prebuild hooks: where `postinstall` runs patch-package)

Branch: imp-29092026/phase-6-garage-feedback

1. GARAJE v2 (note 14): three view modes (Portadas · Cuadrícula · Lista) with the cover photo on
   every card (expo-image, recyclingKey, blurhash placeholder), status line, badges, km, overdue
   count; "Ordenar" mode with drag handles (Reanimated + gesture-handler list on native; on web
   long-press is unreliable — use up/down arrows in Ordenar mode) and "Fijar arriba"; layout
   persisted in setting.garage_layout (synced, so the phone and the web agree); filters as today;
   Ex section always last. Performance: 20 cards scroll at 60 fps on the Redmi. FEATURE_GARAGE_V2
   → true.
2. ANIMATED LAUNCH (note 7, ADR-36): components/LaunchOverlay.tsx (SVG arc + red end segment +
   needle + LCD, geometry from splash-icon.png: arc radius/thickness/angles measured from the
   PNG — write them down in the component header), Reanimated: needle 0→100 over 700 ms
   Easing.out(cubic) + 120 ms settle, arc strokeDashoffset in sync, red segment lights at 85 %,
   LcdDigits 000→100, hold 200 ms, fade 250 ms, unmount. Mount it in app/_layout.tsx above
   everything, call SplashScreen.hide() (or hideAsync) in its onLayout so the static splash hands
   over without a flash (test on the Redmi: no white frame, no double icon). Reduced motion:
   final frame + fade. Web: same overlay on first paint (it is the PWA's launch). gaugeSweep:
   mark the session as swept when the overlay ran, so the cluster does not sweep again. Total
   ≤ 1.2 s; fonts are loaded before the overlay animates (it can show the PNG frame until then).
   FEATURE_LAUNCH_ANIM → true.
3. NOVEDADES Y VERSIONES (note 5): tools/build-changelog.mjs parses CHANGELOG.md into
   lib/changelog.generated.ts (array of { version, date, sections: {title, items[]}[] }); runs in
   `prebuild`/`prestart`/`prebuild:web` scripts and is committed (so builds without the script
   still work; a test checks the generated file matches CHANGELOG.md). app/versiones.tsx: current
   version card (Application.nativeApplicationVersion ?? Constants.expoConfig.version, build,
   extra.gitSha, "Buscar actualización" → on Android opens /instalar on the web or the GitHub
   releases page; on web shows the /api/apk version when Phase 7 exists, else the releases link),
   then the version list. Novedades sheet once per new version (setting last_seen_version; not
   on first install). Más row "Novedades y versiones" with a dot when unseen.
4. ENVIAR COMENTARIO (note 6): sql/020_feedback.sql as given (apply; verify-x-core 24–27 and
   local-rls checks added first); --shared: create bucket carguy-feedback (private, 2 MB,
   image/jpeg) + insert policy for anon/authenticated on that bucket + select policy for the
   admin email only. app/comentario.tsx per 03-screens.md: kind, message, optional email,
   optional screenshot (compressPhoto to 1200 px then upload to carguy-feedback/<device_id>/
   <uuid>.jpg after the RPC succeeded; on upload failure keep the row without screenshot), "Lo
   que se envía" collapsible (app version/build/sha, platform/OS, Device.modelName, current
   route, flags, db version, sync state, last 20 diagnostics entries from Phase 1's ring buffer —
   never tokens/emails/plates). device_id: uuid in AsyncStorage. Offline outbox (AsyncStorage)
   flushed on launch. Entry points: Más row, a "Reportar" link inside AlertHost error alerts, the
   versiones screen. rate_limited → friendly copy. FEATURE_FEEDBACK → true.
5. COMENTARIOS RECIBIDOS (admin): app/admin/comentarios.tsx visible only when the session email
   lower-cases to tecnologia@constructorasd.com (constant in lib/cloud/admin.ts — the same
   predicate as the SQL); list (kind, status, version, device, date), detail with diagnostics and
   the screenshot via createSignedUrl, mark seen/done, admin note. Verified live only by Xaviel;
   verified locally by local-rls with a shimmed JWT email claim.
6. LO QUE ME HA COSTADO (note 8): lib/domain/costs.ts ownershipCost() per §2 (purchase + mods
   installed/removed − mods sold + service records + parts + fuel + expenses + track spend +
   inventory bought for the car), per category, per km over the odometer span, "desde <purchase
   or first record>". Cifras card per vehicle + garage total; the PDF report and CSV export gain
   the block; the public dossier shows it only if "costos" is enabled (it already has that
   switch). Reconcile with the existing TCO (Phase 0 audit (d)): one function, one number.
7. STRINGS; TESTS: garage layout reducer (reorder/pin/mode), changelog parser (fixture with
   headings, nested lists, dates), costs (a seeded vehicle with every category), overlay timings
   (pure schedule function), feedback payload builder (redaction: no email/plate/token strings),
   outbox flush idempotence.

VERIFY web + Android: Garaje in the three modes with the seed's four cars + reorder + pin (after
sync the web shows the same order); cold start on the Redmi: overlay sweeps, no flash, the
cluster does not sweep twice; Más → Novedades y versiones lists 2.1.3 → 2.2.0-dev; send a
comment signed out with a screenshot → row appears (verify-x-core 24), sixth in an hour →
friendly error; Xaviel signs in → Comentarios recibidos shows it; Cifras "Lo que me ha costado"
on the Trueno equals the seed's sum (test). Screenshots docs/qa/imp-29092026-phase-6-*.png.
Report block; notes closed: 5, 6, 7, 8 (Cifras half), 14.
```
