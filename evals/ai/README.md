# AI evals (IMP 03112026, SPEC-B §B8)

What they are for: a number you can compare before and after changing a prompt, a model or a validator. What they are
**not**: proof that the app reads *your* receipts well. The bundled photos are rendered by `make-fixtures.mjs`, clean
and well lit. Treat their score as a **floor**. The real number comes from `real/` (your own photos).

## Run

```bash
SMOKE_EMAIL=<test account> SMOKE_PASSWORD=<password> node evals/ai/run.mjs --only read
SMOKE_EMAIL=<test account> SMOKE_PASSWORD=<password> node evals/ai/run.mjs --only intent   # another hour, see below
node evals/ai/run.mjs --real                                                                # adds evals/ai/real/
```

- Calls the **deployed** `cg-ai-read` and `cg-ai-intent` as the test account, so it needs AI consent turned on for
  that account (Cuenta > Privacidad). It never changes consent, caps or the kill switch.
- Costs a few US cents for the whole set. The per-hour limit is 30 calls and the full set is ~39 (11 read + 28 intent),
  so run the two halves in different hours or raise `ai_limit_user_hour` first. A limit, a cap or the kill switch stops the
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

## Not covered here

- **Voice.** There is no audio fixture: speech-to-text needs recordings of real voices, and `STT_API_KEY` is not set
  yet. Record a few sentences into `real/` when it is.
- **Cost per call** is read from `ai_usage` (`admin_ai_usage` RPC, Cuenta > Admin > Uso de IA), not from this script.

## Browser check (mocked network)

`e2e/ai-web.mjs` drives the **web build** in Chromium with a fake signed-in session and **canned** AI answers: capture →
the request that would be sent → prefill and "IA" marks → the normal Save, for the fill-up, repair invoice, odometer,
Fuel Express (including the duplicate guard and the offline queue: photos taken offline wait, are read once when the connection is back, and are confirmed in one tap) and dictation (typed, and spoken through Chromium's fake microphone so
`expo-audio` really records). It proves the **app side**. It does **not** prove the model reads anything (the answers are
written in the script). 27 checks.

```bash
# a dev server (the seed route is __DEV__ only) with the public cloud config, so the app thinks cloud is configured
EXPO_PUBLIC_SUPABASE_URL=… EXPO_PUBLIC_SUPABASE_ANON_KEY=… npx expo start --web --port 8100
PLAYWRIGHT_CORE=/path/to/node_modules/playwright-core [CHROMIUM_PATH=/path/to/chrome] node evals/ai/e2e/ai-web.mjs [out-dir]
```

Restart the dev server after editing app code: a long-running Metro here served stale modules once. Screenshots go to
`out-dir` (gitignored).
