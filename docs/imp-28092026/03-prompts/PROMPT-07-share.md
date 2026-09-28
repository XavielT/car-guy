# PROMPT 07 — Block F: Ficha pública por link (OG para WhatsApp), libro del carro PDF, garaje compartido

**Depends on:** Phase 6 (needs mods/track/album data) · **Branch:** `imp-28092026/phase-7-share` · **ADR:** 22 · **Size:** L
**Goal:** G6.

> **Before running (Xaviel):** Vercel project `car-guy` must allow serverless functions (it does by
> default). `--shared` statements in `sql/012` and `sql/013` touch `storage` and RLS — read the
> list in the prompt before approving. Two throwaway accounts will be created and cleaned up.
>
> **How to run:** `cd ~/dev2/car-guy && claude`, paste below the line.

---

```
Phase 7 of IMP 28092026: sharing — public car page, car-book PDF, shared garage.

Read first:
- docs/imp-28092026/02-specs/02-cloud-v2.md §4–6   ← authoritative SQL and sync changes
- docs/imp-28092026/02-specs/01-data-model-v2.md §2.5 and the vehicle_share / vehicle_member tables
- docs/imp-28092026/02-specs/03-screens.md (Block F)
- docs/imp-28092026/01-research/03-expo57-photos-storage-sharing.md §3 (OG tags need a server —
  Vercel function; keep web.output static), §4 (shared garage RLS + sync pitfalls), §5 (pdf-lib)
- docs/imp-28092026/00-context/03-architecture-decisions.md ADR-22
- lib/sync/*, lib/sync/mediaBytes.ts, vercel.json, sql/003_rls.sql, sql/004_storage.sql

Branch: imp-28092026/phase-7-share

PART A — PUBLIC PAGE
1. SQL sql/012_public_share.sql per 02-cloud-v2.md §4: share_enabled + public_slug on vehicle,
   security_invoker views public_vehicle / public_mod / public_service / public_track /
   public_photo (safe columns only, gated by show_* flags), anon select policies, public bucket
   carguy-public with policies (no anon listing). Apply (`--shared` for the storage statements —
   list them in the report). Verify with curl as anon: a shared slug returns rows; an unshared
   vehicle returns none; the bucket cannot be listed.
2. CLIENT lib/share/*: enable (mint slug, copy ≤ 24 favourite photos + hero to
   carguy-public/<slug>/…, set published_at), revoke (delete objects, revoked_at, slug = null),
   publicDossier() builder (domain, tested) reused by the PDF. Screen
   app/vehiculo/[id]/compartir per 03-screens.md: visibility, toggles, photo picker, preview
   (opens https://car-guy.vercel.app/c/<slug>), copy/share link, revoke. Más → Compartir lists
   active links.
3. WEB api/c/[slug].ts (Vercel Node function, TypeScript, no framework): fetch public views with
   the anon key (env SUPABASE_URL / SUPABASE_ANON_KEY set in the Vercel project — record the manual
   step), render a self-contained dark dossier HTML (inline CSS with the JDM tokens; Saira/
   Rajdhani via Google Fonts link; sections in BaT order: hero + nick + badges, story, STOCK →
   ACTUAL, mods by category, maintenance summary (count + last service; costs only if allowed),
   track summary (events, PB), photo grid, footer "Hecho con Car Guy"), OG + Twitter meta with the
   hero image, `Cache-Control: s-maxage=300, stale-while-revalidate=86400`, 404 page for unknown/
   revoked slugs, `noindex` unless visibility = public. vercel.json: rewrite `/c/:slug` →
   `/api/c/:slug` BEFORE the SPA rules; keep the security headers. Test with `vercel dev` locally
   and, after merge, with a real WhatsApp share (Xaviel confirms the preview shows the image).

PART B — CAR BOOK PDF
4. npm i pdf-lib buffer; lib/book/*: page templates (cover, story, specs, mods by category with
   dates/costs toggle, maintenance table, documents list (dates only), track summary, photo pages
   3×3 thumbs, max 60 images, chapter per year beyond that); embedJpg of thumbs; fonts embedded
   (Saira Condensed + Rajdhani TTF from node_modules via expo-asset → bytes; fallback Helvetica);
   progress callback. Screen app/vehiculo/[id]/libro: toggles (reuse share toggles), period,
   photos on/off, generate → share (Android expo-sharing) / download (web Blob). Filename
   car-guy_<slug|nick>_<yyyymmdd>.pdf.

PART C — SHARED GARAGE
5. SQL sql/013_members.sql per §5: vehicle_member, vehicle_invite, is_member(), owner backfill,
   redeem_invite() RPC, RLS swap on every vehicle-scoped table (select is_member; write
   is_member editor; vehicle delete owner only) — generate the policy statements from the table
   list to avoid typos; storage policies accept both `<user_id>/…` and `v/<vehicle_id>/…` layouts
   with member checks; storage_usage_bytes charges vehicle folders to the owner. Apply
   (`--shared` for storage). node tools/verify-x-core.mjs extended (§6).
6. SYNC changes per §5: pull without the client-side user_id filter; membership-grant detection →
   vehicle-scoped full pull; push sends user_id + updated_by; vehicle.garage_role mirror; viewer
   mode (banner + disabled editing); membership removal → purge prompt; new uploads to
   v/<vehicle_id>/; mediaBytes resolves both layouts. tools/verify-sync.mjs gains the two-account
   member scenario. Unit tests for the pull predicate/cursor reset logic.
7. UI app/garaje/miembros (from the hub actions and Más → Cuenta): members with roles, Invitar →
   code + link (carguy://invitacion/<code> and https://car-guy.vercel.app/invitacion/<code> — the
   web route is an expo-router screen that redeems when signed in), role change/remove (owner),
   leave (member). Accept flow app/invitacion/[code].
8. Flags: FEATURE_SHARE = true; hub actions Compartir / Libro / Miembros visible.
9. Cleanup: sql/999_cleanup_test_users.sql extended; tools/cleanup-probe-media.mjs sweeps
   carguy-public test folders.

VERIFY: public link on a phone without the app (dossier renders, hidden sections absent, OG
preview on WhatsApp confirmed by Xaviel); revoke → 404; PDF generated on Android and web with
photos; two-account scenario (A owner, B editor: invite, accept, B sees AE85, B adds a mod, A sees
it, A sets B viewer → B cannot edit, A removes B → B's app purges after prompt); verify-x-core,
verify-sync, tsc/lint/test/build green; screenshots docs/qa/phase-7-*. Report, merge, push.
```

---

## Acceptance criteria

- [ ] Public share SQL applied; anon sees only shared, gated data; bucket not listable.
- [ ] Share screen: enable/revoke/toggles/photos/preview/link; Más lists links.
- [ ] `api/c/[slug]` renders the dossier with OG tags; WhatsApp preview confirmed; 404 on revoke.
- [ ] Car book PDF via pdf-lib on Android and web, ≤ 60 images, toggles respected.
- [ ] Members SQL applied; RLS swapped safely (existing single-user data still visible — verify before/after counts for Xaviel's account); sync adapted; verify-sync two-account scenario passes.
- [ ] Members UI, invite/accept/roles/remove; viewer mode.
- [ ] `FEATURE_SHARE` on; cleanup scripts updated.

## Watch for

- The RLS swap is the riskiest change of the cycle: apply `013` in a transaction, run the before/after row-count check for the owner account inside the same script, and keep the rollback block ready.
- Never expose `user_id`, plate, VIN or costs through a public view unless the flag is on.
- OG crawlers do not run JS — the function must return final HTML.
- pdf-lib needs `Buffer` on RN: `import { Buffer } from 'buffer'; global.Buffer ??= Buffer` in the app entry.
