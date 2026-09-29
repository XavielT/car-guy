# Manual checklist — only Xaviel can do these

## Before Phase 0
- [ ] With no Claude session open in the folder: `mv ~/dev2/tu-gasolina-rd ~/dev2/car-guy`.
- [ ] If you still have Wheelz screenshots to share: paste them into the Claude conversation or
      drop them in `docs/imp-29092026/01-research/wheelz/` and add a line to
      `04-wheelz-observed.md` — PROMPT-05 reads that section.

## Phase 1 (hotfix 2.1.3)
- [ ] `.env.local` has `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (public
      values). Approve `eas env:create` when it prompts.
- [ ] Redmi on USB. Developer options → "Don't keep activities" — toggle it when the prompt asks.
- [ ] After the APK installs over 2.1.2: **sign in with your own account from that APK** (you type
      the password). Confirm the garage is intact.
- [ ] Optional: re-share the app to friends with the new link
      `https://github.com/XavielT/car-guy/releases/latest/download/car-guy.apk`.

## Phase 2
- [ ] Approve `sql/018_schema_v3.sql` and `sql/019_rls_v3.sql` (additive, `carguy` only).
- [ ] Do not sync from a 2.1.x device after this phase until 2.2 is on it (the gate from 2.1.3
      protects you, but keep it in mind).

## Phase 5
- [ ] Install the preview build (new native modules). When the app asks: allow location "Mientras
      usas la app", then for Automático "Permitir todo el tiempo" in Android settings; on the Redmi
      also Autostart + battery "Sin restricciones" + lock the app in Recents (the app shows the
      checklist).
- [ ] **Drive.** Part A: start a manual trip, drive 10+ minutes with at least one traffic light,
      stop it. Part B: leave automatic on, drive without touching the phone, include a stop at a
      colmado (< 4 min) and the final parking. Send Claude Code the trip list screenshot and say
      whether the traffic-light stop split the trip and how the battery looked at night.
- [ ] Set your redline km/h per car in Viajes → Ajustes if 120 is not what you want.

## Phase 6
- [ ] Read `sql/020_feedback.sql` (anonymous inserts through a rate-limited function; admin = your
      email) and approve it plus the `--shared` bucket statements listed in the prompt.
- [ ] Sign in on the web or the phone and open Más → Comentarios recibidos to confirm the admin
      view (Claude Code cannot sign in as you).
- [ ] Cold-start the app on the Redmi twice and say whether the launch animation shows a flash.

## Phase 7
- [ ] Backup: Más → Datos → Respaldo JSON before installing 2.2.0 over 2.1.3.
- [ ] If Phase 0 found the portfolio card missing live: approve `vercel --prod` in
      `~/dev2/xaviel-web-v2`.
- [ ] From the phone's Chrome: car-guy.vercel.app → Instalar → download → install. Tell Claude Code
      the exact warnings Android showed so the explainer copy matches.
- [ ] Decide when to delete the old Vercel project `tu-combustible-rd`; keystore backup off the
      machine if not yet done (docs/NEXT.md).

## Still true from earlier cycles
- Web search is disabled for Claude at the org level (Admin settings → Capabilities); enabling it
  lets the next research round verify the "unverified (from knowledge)" items in 01-research.
