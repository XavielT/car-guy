# Manual checklist — only Xaviel can do these

## Before Phase 0
- [ ] `mv ~/dev2/tu-gasolina-rd ~/dev2/car-guy` with no session open (still pending since cycle 2).
- [ ] Redmi connected (USB or Wi-Fi adb), unlocked, Wheelz open-able. Claude Code will only read:
      screens, scroll, screenshots. If Wheelz asks for anything, it presses Back.
- [ ] Disk: last cycle hit 91 % — free some space before the native build of Phase 4.

## Phase 1
- [ ] When asked, open the trip that showed a straight line → long-press the map → "Exportar
      puntos GPS" → share the .geojson to the laptop (Claude Code tells you where to drop it).
- [ ] Install 2.3.1 over 2.3.0 (backup first) and save a real fill-up: you must land on the
      detail screen; try double-tapping Guardar — no duplicate.

## Phase 2
- [ ] Approve `sql/025_schema_v4.sql` and `sql/026_rls_v4.sql`.

## Phase 3
- [ ] Switch your phone to English once and open the app — it should follow; switch back.

## Phase 4
- [ ] Install the new native build (MapLibre). **Drive** ~10 minutes with Modo conducir open
      (city streets, a couple of turns). Then open the trip: the line must follow the streets on
      the map. If it does not, export the GeoJSON again and send it.
- [ ] Say whether the centre button feels right (size, position) — it is the one thing the mockup
      cannot prove.

## Phase 5
- [ ] Read `sql/027_fuel_price_ref.sql`; approve it, including the two `--shared` role statements —
      or answer "service key" to use the fallback.
- [ ] Mint the importer JWT once (dashboard → Settings → API → JWT secret; the prompt gives the
      exact payload) and set `CARGUY_IMPORTER_JWT` in Vercel (or `SUPABASE_SERVICE_ROLE_KEY` for the
      fallback). Never paste either into the chat.
- [ ] Tell Claude Code your real "what I buy" for the DS3 if you want it seeded for you (oil brand,
      filter, tire size) — or type it in the app after.

## Phase 6
- [ ] Read the three legal drafts (ES) before the release. They are drafts, not legal advice —
      have a lawyer look before Play Store.
- [ ] Approve `sql/028_delete_account.sql`; decide on the Vercel `SUPABASE_SERVICE_ROLE_KEY` for the
      account-deletion function (or keep deletion of the auth user as your manual admin step).
- [ ] Pick your avatar or a photo; run the welcome once on a throwaway install to feel it.
- [ ] Backup → install 2.4.0 over 2.3.1 → confirm garage, prices, language, legal sheet once.

## Still true
- Web search for Claude is disabled at the org level (Admin settings → Capabilities).
- Play Store: not now; the legal pages remove one blocker.
