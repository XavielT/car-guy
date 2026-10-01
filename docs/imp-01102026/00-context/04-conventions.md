# Conventions — IMP 01102026 (inherits the four previous cycles' conventions)

Additions:

1. **Platform truth.** Every feature that depends on background work or native modules declares
   its support in `lib/platform/capabilities.ts` (`android-native`, `web-desktop`, `web-ios-pwa`,
   `web-android`) and the UI reads it; copy never promises what the platform cannot do.
2. **Social tables are cloud-only** unless the row has one owner and is needed offline
   (`privacy_zone`, `trip_share` → synced; `follow`, `block`, `report`, `junte*` → cloud-only with a
   read cache). Other users' data is read only through `security definer` functions with fixed
   column lists; never `select *` on `profiles` for someone else.
3. **Live positions are never written** to any table, log or diagnostics; the broadcast payload is
   `lat, lng, heading, ts, avatar_id` — no speed.
4. **Realtime policies are topic-scoped** (`carguy:` prefix checked before any cast) because
   `realtime.messages` is shared with Music Hub; every such statement is `--shared` and listed in
   the prompt.
5. **OTA discipline.** A release is OTA-eligible only when `expo fingerprint` is unchanged; the
   release script decides, not the developer. OTA releases still bump `version` and the changelog.
6. **Money copy is plain.** "Apoyar" never gates a feature; the premium hanko is thanks, nothing
   more; payment details live in `app_config`, never in code.
7. **Diagnostics before fixes.** For note 7 the Redmi logcat/permission dump goes into PROGRESS.md
   before any constant changes.
8. **Report block** as before + *Notes closed* + *Platforms verified* (Redmi · web desktop · iPhone PWA).
