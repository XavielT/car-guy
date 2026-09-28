# Conventions — IMP 28092026 (inherits `docs/imp-17092026/00-context/04-conventions.md`)

Everything in the previous cycle's conventions still applies (Expo 57 docs first, repos only for
SQL, `deleted_at` tombstones, pure domain in `lib/domain`, strings in `lib/i18n/es.ts`, web +
Android in every change, report block per phase). Additions for this cycle:

1. **Repo path.** After PROMPT-00 the repo lives at `~/dev2/car-guy`. Every prompt starts with
   `cd ~/dev2/car-guy` (or wherever it is — `docs/NEXT.md` says where).
2. **Migration discipline.** Schema v2 is written once (PROMPT-01). Later phases that need a column
   they forgot add **v3, v4…** — never edit an applied migration. Each migration ships with: the
   cloud SQL file, `SYNC_TABLES` + `BOOLEAN_COLUMNS` updates, `npm run types:gen`, and a test that
   a fresh DB migrates 0 → N and that the v2.0.0 backup fixture imports into it.
3. **`x-core` safety.** `node tools/apply-sql.mjs sql/0NN_*.sql` is the only write path; `--shared`
   only for `storage`/`auth`/`public` and only with the statements listed in the prompt. Run
   `node tools/verify-x-core.mjs` and `node tools/verify-sync.mjs` after every SQL change. Music Hub
   must not change (ADR-06).
4. **Design compliance.** Every new screen is checked against `05-design-jdm.md` and the Design
   artifact "Car Guy — JDM Cluster" (six artboards). The rules that bite: red as text is `#FF4D45`;
   texture never under text; one accent + one status colour per screen; kanji small and secondary;
   no idle animation.
5. **Real data, fake accounts.** The dev seed uses Xaviel's real garage (names, engines, mods) but
   never his real plate/VIN/phone. Cloud tests use throwaway accounts (`carguy-test-…`) and
   `sql/999_cleanup_test_users.sql` afterwards.
6. **Feature flags.** A screen reachable from navigation is behind its `FEATURE_*` flag until its
   acceptance criteria are met; the flag flips in the same commit that finishes them.
7. **Performance budget.** Album grid: 60 fps scroll with 500 thumbs on a mid-range Android;
   `expo-image` + `recyclingKey`; no full-size image in a grid. Cluster hero: one SVG, no per-frame
   re-render of the whole screen (Reanimated on the needle only).
8. **Report block** (same as before) plus two lines: *Design check* (which artboard, what deviates)
   and *Flags flipped*.
