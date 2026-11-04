# AI evals (IMP 03112026, SPEC-B §B8)

What they are for: a number you can compare before and after changing a prompt, a model or a validator. What they are
**not**: proof that the app reads *your* receipts well. The bundled photos are rendered by `make-fixtures.mjs`, clean
and well lit. Treat their score as a **floor**. The real number comes from `real/` (your own photos).

## Run

```bash
SMOKE_EMAIL=<test account> SMOKE_PASSWORD=<password> node evals/ai/run.mjs --only read
SMOKE_EMAIL=<test account> SMOKE_PASSWORD=<password> node evals/ai/run.mjs --only documents # PROMPT-03: 8 papers, with the privacy check
node evals/ai/run.mjs --only obd       # PROMPT-04: 25 OBD cases, safety floor, RD$-only, cost per explanation
node evals/ai/run.mjs --only intent   # another hour, see below
node evals/ai/run.mjs --real                                                                # adds evals/ai/real/
```

- Calls the **deployed** `cg-ai-read` and `cg-ai-intent` as the test account, so it needs AI consent turned on for
  that account (Cuenta > Privacidad). It never changes consent, caps or the kill switch.
- Costs a few US cents for the whole set. The per-hour limit is 30 calls and the full set is ~72 (11 read + 8 documents + 25 obd +
  28 intent), so run the parts in different hours or raise `ai_limit_user_hour` first. A limit, a cap or the kill switch stops the
  run and the report says **PARTIAL**; the numbers then cover only what ran.
- Exit code `1` when critical-field accuracy (or intent target accuracy) is below `--bar` (default 0.90) or when false
  fills exceed 10 %. Results are written to `results/<time>.json` (gitignored).

## What is measured

| Number | Meaning |
|---|---|
| accuracy | fields that are in the photo and came back right (numbers within 0.2 %, text folded for case/accents) |
| critical | the same, only for the fields a wrong value would hurt most (total, gallons, price, date, odometer, RNC) |
| confident-only | accuracy among values the model was ≥ 0.6 sure of, i.e. what the form shows **without** an "unsure" mark |
| false fills | a field that is **not** in the photo but came back with confidence ≥ 0.6 (the error that looks right) |
| leaks (documents) | any string a case lists as `forbidden` (a fake cédula, owner name, address) that appears ANYWHERE in the response. One leak fails the run |
| intent target | the closed-list destination of a sentence (fuel, service, expense…), with the car rules |

The scoring rules live in `score.cjs` and are pinned by `__tests__/ai/evals-score.test.ts`. The fixtures are checked
against the real field lists by `__tests__/ai/evals-fixtures.test.ts`, so a typo cannot silently skew a score.

## Your own photos (`real/`, never committed)

`real/` is gitignored. Put photos there with a `manifest.json` of the same shape as `fixtures/manifest.json`
(`images` are paths relative to `real/`). Use JPEGs; strip nothing, the app re-encodes anyway. Do **not** put photos
with a visible plate, cédula or card number in anything that gets committed.

## Regenerate the synthetic photos

```bash
PLAYWRIGHT_CORE=/path/to/node_modules/playwright-core [CHROMIUM_PATH=/path/to/chrome] node evals/ai/make-fixtures.mjs
```

## Documents (`documents.json`, PROMPT-03)

Eight synthetic Dominican-style papers (matrícula, seguro, marbete, licencia, revisión, garantía, a VIN sticker, a JDM chassis
plate) carrying FAKE personal data on purpose. Besides accuracy, each case lists `forbidden` strings: the run FAILS if any
appears in a response, whatever the accuracy. For your own real papers put them in `real/` and **do not** commit them: a
real matrícula has a real cédula, name and address. A real photo needs a `forbidden` list of the real values to prove the
filter on it; keep that list out of git too.

## OBD (`obd.json`, PROMPT-04)

25 cases for `cg-ai-obd`: generic codes, safety systems (brakes, airbag, overheating, oil pressure, comms), mixed lists, JDM codes,
a code repeated after a recent repair, history that must be cited, a freeze-frame, and a prompt-injection attempt hidden in the
history. Each case lists the `can_drive` answers that PASS. Every case is also checked for a valid shape, **RD$ only** (a dollar or
euro anywhere fails), **no invented part numbers**, and at least one cause. A case marked `safety` that comes back "yes" fails the
run whatever the pass rate (and `__tests__/ai/evals-fixtures.test.ts` ties each flag to the safety table the function really
uses). After the run it reads **your own** `ai_usage` rows for `cg-ai-obd` and prints the average **cost per explanation**.
Synthetic cars and histories; a floor, not a claim about your car.

## Insights (`insights.json`, PROMPT-05)

10 fact sets for `cg-ai-insights`, **generated from the real engine**: `node --experimental-strip-types evals/ai/make-insights.mjs` (Node 22; `predict.ts` imports nothing). `__tests__/ai/insights-fixtures.test.ts` fails if the engine's output drifts from the stored facts, so regenerate then. Run with `--only insights`: it reports passed/total (every `mustCover` act-level fact cited, no insight without a fact or citing an unknown one, ≤5), the **template fallback rate** (how often the server's number check replaced the model's wording) and cost per call. Not run live yet.

## Not covered here

- **Voice.** There is no audio fixture: speech-to-text needs recordings of real voices, and `STT_API_KEY` is not set
  yet. Record a few sentences into `real/` when it is.
- **Cost per call** is read from `ai_usage` (`admin_ai_usage` RPC, Cuenta > Admin > Uso de IA), not from this script.

## Browser check (mocked network)

`e2e/ai-web.mjs` drives the **web build** in Chromium with a fake signed-in session and **canned** AI answers: capture →
the request that would be sent → prefill and "IA" marks → the normal Save, for the fill-up, repair invoice, odometer,
Fuel Express (including the duplicate guard and the offline queue: photos taken offline wait, are read once when the connection is back, and are confirmed in one tap) and dictation (typed, and spoken through Chromium's fake microphone so
`expo-audio` really records). It proves the **app side**. It does **not** prove the model reads anything (the answers are
written in the script). 50 checks (H: vehicle from a matrícula with vPIC and its conflict, a seguro that moves the reminder, the wrong-car
guard; I: price vs the person's own history, the warranty watcher, "explain for my car" with cache and Refresh, a safety code, scanner
text parsed offline and explained together, repair → closing the loop, warning-light photo, scanner screenshot, offline).

```bash
# a dev server (the seed route is __DEV__ only) with the public cloud config, so the app thinks cloud is configured
EXPO_PUBLIC_SUPABASE_URL=… EXPO_PUBLIC_SUPABASE_ANON_KEY=… npx expo start --web --port 8100
PLAYWRIGHT_CORE=/path/to/node_modules/playwright-core [CHROMIUM_PATH=/path/to/chrome] node evals/ai/e2e/ai-web.mjs [out-dir]
```

Restart the dev server after editing app code: a long-running Metro here served stale modules once. Screenshots go to
`out-dir` (gitignored).

## Smart search (SPEC-G §G1)
`fixtures/intents.json` now carries 30 es-DO questions (`query-01`..`query-30`): each expects `target: query`, a `query_kind` from the closed list, the keyword and, when the phrase names one, the period. `--only intent` scores them with the rest. The answers themselves (numbers, dates) are computed on the device and unit-tested in `__tests__/domain/smartQuery.test.ts`, so the live run only measures whether the model classified the question.
