# Manual checklist — what only Xaviel can do (IMP 03112026)

- [ ] **Rotate** the Anthropic key and the Google Maps key (they were printed in the session that wrote this package). Then run `node tools/set-ai-secrets.mjs` again (or update the two secrets in x-core). No code change.
- [ ] Optional: create a Car Guy–named Anthropic key in the same workspace so spend is separable; put it in `C:\dev2\car-guy` as a local file outside git and re-run the secrets tool.
- [ ] In Google Cloud Console: confirm the Maps server key has **Places API (New)** enabled and is restricted by API (not by referrer) since it is called from Supabase.
- [ ] Give Claude Code real photos for evals (drop in `evals/ai/real/`, gitignored): 5 fuel receipts, 3 odometer/cluster photos, 3 shop invoices, matrícula, seguro, marbete, licencia, a dashboard with warning lights.
- [ ] Phone checks on the Redmi (APK): mic permission flow, dictate a fill-up, scan a receipt, scan a matrícula, OBD explanation, Car Health card.
- [ ] iPhone PWA: mic permission (Safari asks per session? — **not verified**, record what you see), photo capture, voice audio format, no push expected (ADR-48).
- [ ] Laptop: open the web at full screen and 1024 px; side rail, shortcuts (`/`, `Ctrl+K`, `?`), paste a receipt image with Ctrl+V, drag a PDF, print preview of Libro, install as an app in Chrome/Edge.
- [ ] Admin → Uso y costos: check the AI cost panel, lower a cap to 0 and confirm the app shows the message, flip the kill switch.
- [ ] Decide when to publish the 2.7.0 APK (GitHub Releases) after PROMPT-08's release steps.
- [ ] Still open from earlier cycles (unchanged): FCM key in expo.dev, live junte with two devices, a real drive with the Redmi.

## Round 2 (P5–P9)
- [ ] **Redmi, swiped-away drive**: run the "Activar viajes automáticos" wizard until all green; swipe the app away, lock the phone, drive from home. Expect an automatic trip starting within ~60 s / 400 m of leaving, no split at traffic lights. Repeat after a reboot. If it fails, export the "Estado de la detección" timeline and send it back (it carries the system's reason).
- [ ] **Redmi**: pair the car's Bluetooth in the wizard and confirm it picks the right vehicle.
- [ ] **iPhone**: create the Shortcuts automation from `/instalar` (Bluetooth/CarPlay → Open URL), connect to the car, confirm Car Guy opens and records. (Remember: the screen must stay on; this is not background detection.)
- [ ] **Calibration drive** (`docs/CALIBRATION-DRIVE.md`): steady 60/80/100 km/h with dash photos or a second phone running Maps; enter the factor; check live needle vs the dash; do one fill-up-to-fill-up odometer check.
- [ ] Look at one real trip: top speed equals the live max you saw; average and distance are plausible; the route colours make sense.
- [ ] "Por dónde manejas": lines are thin and stylised in light and dark map styles; tell me if you want them thinner or thicker (one constant).
- [ ] Recaps: open last month and this year, swipe through, share a card to WhatsApp/Instagram; confirm no plate, odometer or home address appears; try with "Mostrar gastos" on.
- [ ] **Cold-start test (3 people, `docs/imp-03112026/COLD-START-TEST.md`)**: fresh install, five tasks, silent observation. Send me the findings.
- [ ] Hoy: you (yourself) open the app cold — do you know where to start? Tell me what still confuses you.
- [ ] **Fuel Express on both phones**: dashboard photo + receipt photo → Confirmar; also try it in airplane mode at the pump and confirm it asks you later; give me 5 real pairs for `evals/ai/real/`.
- [ ] Decide whether to cut **Release A** (trips/speed/recaps/UX) before the AI work.
