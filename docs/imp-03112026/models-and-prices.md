# Anthropic models and prices (docs fetched 2026-11-03)

Sources: https://platform.claude.com/docs/en/about-claude/models/overview , https://platform.claude.com/docs/en/about-claude/pricing , https://platform.claude.com/docs/en/build-with-claude/vision (no dated stamps shown; fetched today).

## Valid API ids today
Current: `claude-fable-5-1` ($10/$50), `claude-opus-5-5` ($4/$20), `claude-sonnet-5-5` ($2/$10), `claude-haiku-5-5` ($0.10/$0.50 for prompts <=100k tokens; $0.50/$2.50 above 100k). All 1M context, 128K max output, all accept images. The environment's id list is CONFIRMED correct.
Legacy but still available: `claude-sonnet-5` ($2/$10) and `claude-haiku-4-5-20251001` ($1/$5), plus Opus 5/4.x, Fable 5. So BOTH fallback defaults still exist and both accept images (vision page supportedModels lists them). Retirement dates: current 5.5 models "not sooner than" Sep-Oct 2027; legacy retirement dates not read (see model-deprecations page).

## Recommended defaults
- `CG_MODEL_VISION` = `claude-haiku-5-5` (fastest, 20x cheaper input than Haiku 4.5, vision-capable). Keep `claude-haiku-4-5-20251001` as documented fallback.
- `CG_MODEL_REASON` = `claude-sonnet-5-5` (same $2/$10 as `claude-sonnet-5`, newer). Fallback `claude-sonnet-5`.
Note: Haiku 5.5 / Sonnet 5.5 use adaptive thinking; Sonnet 5.5 rejects `thinking: {type: "disabled"}` (use between_tools or effort). Set `effort` explicitly if latency matters (Haiku default medium, Sonnet high).

## Images
- Tokens = ceil(width/28) x ceil(height/28) (28x28 patches). Cost = tokens x model input price. Claude 4.7+ (incl. all 5.x): max long edge 2,576 px, max 4,784 tokens; older (e.g. Haiku 4.5, Sonnet 4.6): 1,568 px / 1,568 tokens. Larger images are downscaled. Example: 1000x1000 = 1,296 tokens.
- Limits: 10 MB per image base64 on Claude API (5 MB on Bedrock), 8000x8000 px max; >20 images per request -> each side <= 3,000 px; up to 600 images (100 for 200k-context models); request cap 128 MB; JPEG/PNG/GIF/WebP.
- Tip: resize photos to ~1568 px long edge client-side: ~1,500 tokens/image, ~$0.00015 on Haiku 5.5.

## cost.ts
```ts
// USD per 1M tokens. Source: platform.claude.com pricing, 2026-11-03.
// Haiku 5.5 has a long-prompt tier (>100k input tokens).
export const PRICE_PER_MTOK: Record<string, { input: number; output: number; inputLong?: number; outputLong?: number }> = {
  'claude-fable-5-1':           { input: 10,   output: 50 },
  'claude-opus-5-5':            { input: 4,    output: 20 },
  'claude-sonnet-5-5':          { input: 2,    output: 10 },
  'claude-sonnet-5':            { input: 2,    output: 10 },
  'claude-haiku-5-5':           { input: 0.10, output: 0.50, inputLong: 0.50, outputLong: 2.50 },
  'claude-haiku-4-5-20251001':  { input: 1,    output: 5 },
};
// Batch API = 50% off. Cache reads: Haiku5.5 $0.01, Sonnet5.5 $0.10, Haiku4.5 $0.10 per MTok.
```

## Azure Speech STT
Official pricing page (https://azure.microsoft.com/en-us/pricing/details/cognitive-services/speech-services/) rendered the price as "$- per hour" (JS-loaded); NOT retrievable. Free tier F0: 5 audio hours/month real-time transcription (shared with custom). Historical standard real-time STT list price was about $1.00/audio hour (from memory, UNVERIFIED) - confirm in the Azure pricing calculator. Limits page (updated 2026-10-23): real-time/short-audio default 100 concurrent requests per S0 resource, F0 1.
