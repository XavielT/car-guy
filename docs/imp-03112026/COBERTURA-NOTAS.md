# COBERTURA-NOTAS — every note → ID → where it lives → status

Check this table against `00-context/NOTAS-ORIGINALES.md`. Status "Planned" = in a prompt with acceptance criteria; PROMPT-08 turns each row into evidence in `VERIFICACION.md`.

| ID | Note / answer | Spec | Prompt (phase) | Status |
|----|---------------|------|----------------|--------|
| P1 | Include and use the Anthropic key, Google Maps key and tokens that SGC / CSD App use, to make Car Guy stronger | SPEC-A, ADR-65/66 | 01 (secrets, gateway), 02–06 (use) | Planned |
| P1a | The "etc." — judge every other credential/token | SPEC-A §A1 | 01 (`docs/KEYS-INVENTORY.md`) | Planned |
| P1b | Decision: reuse the company's keys (not separate) | BRIEF notes 2–3 | 01 (secrets + caps + kill switch + cost admin) | Planned — safeguards added, decision respected |
| P2 | AI in the app, **not** a simple chatbot — inside real workflows | ADR-67/68; SPEC-B…G | 02–06 | Planned |
| P2a | Study workflows/features/modules before deciding | BRIEF; ai-workflow-map | 00 (step 4–5 → `ai-workflow-map.md`) | Planned |
| P2b | Ask questions to take decisions | NOTAS-ORIGINALES (answers) | done in chat 03-nov | Done |
| P2c | AI flow: photo/voice capture | SPEC-B | 02 | Planned |
| P2d | AI flow: vehicle documents | SPEC-C | 03 | Planned |
| P2e | AI flow: OBD diagnosis and repairs | SPEC-D | 04 | Planned |
| P2f | AI flow: prediction and alerts | SPEC-E | 05 | Planned |
| P2g | AI "anywhere else that improves the workflows" | SPEC-G (G1–G9) | 06 | Planned |
| P2h | Where it runs: Edge Functions in x-core | ADR-66; SPEC-A §A3 | 01 | Planned |
| P3 | Remember the SGC and CSD App paths | BRIEF rules; PROMPT-00 step 4 | 00, every prompt header; `C:\dev\SGC`, `C:\dev2\csd-app` read-only | Planned |
| P4 | Open the project on the laptop too | SPEC-F §F5 | 07 (`docs/LAPTOP.md`, `web:desktop`) | Planned |
| P4a | If no website, create it from the app/PWA | SPEC-F intro | Website **already exists** (Expo web + PWA on Vercel) → 07 makes it desktop-grade | Planned |
| P4b | Answer: desktop layout | SPEC-F, ADR-70 | 07 | Planned |
| P5 | Trips don't register when he starts driving; only manual works | SPEC-H, ADR-71 | 09 | Planned |
| P5a | Answer: never starts + only with the app open → OS-level triggers (Activity Recognition, Bluetooth, geofence, boot) | SPEC-H §H3 | 09 steps 3–4 | Planned |
| P5b | Answer: both phones → Android native triggers + iPhone assisted start via Shortcuts (honest limit stated) | SPEC-H §H3, §H6 | 09 steps 3, 8 | Planned |
| P6 | Speed recording not accurate enough | SPEC-I §I1–I3, ADR-72 | 10 steps 1–6, 9 | Planned |
| P6a | Answer: live needle · top speed · average/distance · route map all fail → single SpeedEngine used by all four | SPEC-I §I1 | 10 steps 2–5 | Planned |
| P6b | Heat line of usual routes too thick → thin, stylised route-frequency lines (and slimmer route lines) | SPEC-I §I4 | 10 step 7–8 | Planned |
| P7 | Monthly and yearly recaps (stories + shareable image) | SPEC-J, ADR-74 | 11 | Planned |
| P8 | Easier, understandable; user gets lost; knows where to start | SPEC-K, ADR-73 | 12 (+ nav model reused by 07) | Planned |
| P9 | Fuel: photo of dashboard + photo of receipt → AI fills the form → one Confirm | SPEC-B §B7, ADR-75 | 02 step 3b | Planned |
| — | Reply language = the one he writes in | NOTAS-ORIGINALES | all reports | Planned |

## Round-2 additions (not in the notes)
| ID | Addition | Why | Where |
|----|----------|-----|-------|
| Y8 | "Why didn't it record?" timeline + `ApplicationExitInfo` | Evidence before tuning; MIUI kills are otherwise guesswork | SPEC-H §H1 |
| Y9 | Per-vehicle speed/odometer calibration | The dash over-reads by design; without it the app looks wrong next to the car | SPEC-I §I2 |
| Y10 | Replay harness with ground-truth drives (old vs new table) | Proves accuracy instead of claiming it | SPEC-I §I3 |
| Y11 | Feature set chosen by the person ("¿Para qué usas Car Guy?") | Fewer things on screen without deleting anything | SPEC-K §K3 |
| Y12 | Cold-start test with 3 people | The only real proof for "I don't know where to start" | SPEC-K §K8 |
| Y13 | Share image privacy defaults | Recaps get posted; plate/odometer/places must not leak | SPEC-J §J5 |
| Y14 | Offline queue for Fuel Express | Gas stations have bad signal | SPEC-B §B7 |
| Y15 | Release A (no-AI release first) | Trips/speed/recaps/UX do not depend on keys and fix his daily pain | PLAN, PROMPT-08 |

## Things I added that were not in the notes (remove any you don't want)
| ID | Addition | Why | Where |
|----|----------|-----|-------|
| Y1 | Bundle guard + gitleaks + never-in-app rule | Keys in an APK/web bundle are public | SPEC-A §A2 |
| Y2 | Caps, kill switch, cost screen | Company pays for friends' use | SPEC-A §A4–A5 |
| Y3 | Server-side consent + data/third-parties doc | Photos of matrículas carry personal data | SPEC-A §A5, SPEC-C §C1 |
| Y4 | Microphone via permission registry, `Permissions-Policy`, APK not OTA | Voice needs it | PROMPT-02, 08 |
| Y5 | Google used server-side, lists only | Maps terms | ADR-69, PROMPT-00/06 |
| Y6 | Admin feedback triage | SGC does the same for reports | SPEC-E §E4 |
| Y7 | Evals per AI function | SGC has `evals/`; avoids silent regressions | PROMPT-02…06 |
