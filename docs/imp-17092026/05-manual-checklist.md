# Manual checklist — things only Xaviel can do

Claude Code will point at these when it reaches them. Do them when the prompt says "manual".

## Before Phase 2
- [x] **Done 2026-09-17, by Claude Code.** The export was broken on Android (see the Phase 0
      addendum in `04-tracking/PROGRESS.md`); it was fixed, released as v1.1.1, and the real backup
      recovered off the device to `docs/imp-17092026/fixtures/tu-combustible-rd-backup.real.json`
      (gitignored). 1 vehicle, 4 fill-ups, 0 expenses, 0 reminders.
- [ ] Optional: delete the copy left on the phone's SD card at
      `/storage/3931-3532/Download/tu-combustible-rd-2026-09-17.json` — it holds real vehicle data.

## Phase 1 (EAS)
- [ ] `npx eas login` (Expo account). Then Claude Code (or you) runs `npx eas init` in the repo to
      create/link the project for slug `car-guy`. If you skip it now, do it before Phase 5's preview
      build or Phase 10.

## Phase 5 (notifications on a real device)
- [ ] Install the `preview` APK from the EAS build URL in PROGRESS.md and check that the weekly
      check notification arrives (Más → Notificaciones → "Probar notificación", then a real one).

## Phase 8 (Supabase `x-core`) — order matters
1. [ ] Supabase dashboard → `x-core` → Project Settings → API: copy URL + anon key into
       `.env.local` as `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
2. [ ] SQL editor: run `sql/000_inspect.sql`, paste the full output into
       `docs/imp-17092026/04-tracking/x-core-inspect.txt` (gitignored) and tell Claude Code.
3. [ ] After Claude Code writes them, run in order: `sql/001_invite_trigger_app_aware.sql`,
       `002_schema_carguy.sql`, `003_rls.sql`, `004_storage.sql`, `005_lww.sql`.
4. [ ] Project Settings → API → **Exposed schemas**: add `carguy` (keep `public`, `tucombustible`).
5. [ ] Storage: confirm bucket `carguy-media` exists and is private.
6. [ ] Sign in to **Music Hub** once with your normal account (sanity that nothing changed) and try a
       Music Hub signup with a non-invited email → must still be refused.
7. [ ] Optional, later: `sql/006_drop_tucombustible_probe.sql` (drops the empty probe schema from
       imp 11092026 Phase 2).
8. [ ] `npx supabase login` if you want generated types (`npm run types:gen` equivalent).

## Phase 10 (release)
- [ ] `npx eas login`, `npx vercel login`, `gh auth status`.
- [ ] If building locally instead of EAS: after `expo prebuild`, copy the generated release keystore
      to `~/keystores/car-guy/` and note the passwords in your password manager. **Losing it means
      Car Guy can never be updated.**
- [ ] Vercel: after Claude Code creates project `car-guy`, check the Git integration points at the
      repo and production branch `main`. Decide when to delete the old `tu-combustible-rd` project
      (not in this cycle).
- [ ] Install `car-guy-v2.0.0.apk` on your phone; import your backup; keep Tu Combustible RD until
      you have verified the counts, then uninstall it.
- [ ] Portfolio (`xaviel-web-v2`): apply the hand-off note from PROGRESS.md (rename card, new URL,
      new release link) — that is part of `imp 11092026` Phase 4, not this cycle.
