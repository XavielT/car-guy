# Manual checklist — only Xaviel can do these

## Before Phase 0
- [ ] `mv ~/dev2/tu-gasolina-rd ~/dev2/car-guy` (no session open) — pending since cycle 2.
- [ ] Redmi on USB with 2.4.2, Viajes → Ajustes = Automático, permiso "todo el tiempo". Leave it
      for the diagnostics; a 2-minute walk with the phone in your pocket is part of it.

## Phase 1
- [ ] **First, on the Redmi (Phase 0 found none of these set):** Viajes → Ajustes → Automático → follow the
      steps — location **"Permitir todo el tiempo"** + precise, MIUI **Inicio automático** on, battery
      **"Sin restricciones"** ("Permitir en segundo plano" opens it). The red "Automático no está grabando"
      card on Inicio disappears when all is set, and Ajustes shows "Último punto GPS recibido: hace …".
- [ ] Install 2.4.3 over 2.4.2 (backup first). **Drive with the Redmi** (10+ min, app in the
      background, screen off): the trip must appear by itself. If not, Viajes → Ajustes → "Exportar
      diagnóstico de viajes" and send the JSON.
- [ ] iPhone: delete the old PWA, open car-guy.vercel.app, "Añadir a inicio", open it, and confirm
      the banner about iPhone limits; at night check that the dot is at your house.
- [ ] Say whether the DS3's reserve light comes on with 0 or 1 square (the form will ask).

## Phase 2
- [ ] Approve `sql/033`, `034`, `035` and the `--shared` `036_realtime_policies.shared.sql`
      (extensions pg_trgm/unaccent, schema carguy_private, realtime.messages policies scoped to
      `carguy:junte:`). Do not change the Realtime "Allow public access" setting.

## Phase 4
- [ ] Approve `eas update:configure` and the new native build.
- [ ] Decide the support link: make a **US$1 test payment to your PayPal.me** from another account
      and confirm the money arrives and can be withdrawn in DR; if not, type bank-transfer details
      into Admin → Apoyar (they go to app_config, never to the repo). Until then the screen says "Pronto".
- [ ] Rotate the service-role key in Supabase and update Vercel (`SUPABASE_SERVICE_ROLE_KEY`) and
      `.env.supabase` — pending since cycle 4.

## Phase 5
- [ ] Pick your @handle; create a second throwaway account (you type the passwords) for the
      follow/friends test; set a privacy zone at home.

## Phase 6
- [ ] Two phones, two accounts: create a junte, join with the other, turn "En vivo" on both, walk
      apart 100 m — both dots must move. The iPhone PWA must stay open to publish.
- [ ] Backup → install 2.5.0 over 2.4.3 → then wait for the OTA 2.5.1 banner on the next two opens.
- [ ] Read the legal texts (still owed) — the social features add a line on handles and live location.

## Still true
- Web search for Claude is disabled at the org level (Admin settings → Capabilities).
- Play Store / App Store: not now. Ads: not now (AdMob needs a store listing).
