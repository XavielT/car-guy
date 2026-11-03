/**
 * Price table and cost maths (IMP 03112026, `docs/imp-03112026/models-and-prices.md`, fetched 2026-11-03).
 * USD per 1,000,000 tokens. An unknown model is priced at the most expensive entry so a typo in a model secret can
 * only over-count spend, never hide it. Editing prices is a code change here, in ONE place (SGC duplicated them in
 * five files).
 */
export type Price = { input: number; output: number; inputLong?: number; outputLong?: number };

/** Haiku 5.5 bills a higher rate when the prompt exceeds this many input tokens. */
export const LONG_PROMPT_TOKENS = 100_000;

export const PRICE_PER_MTOK: Record<string, Price> = {
  'claude-fable-5-1': { input: 10, output: 50 },
  'claude-opus-5-5': { input: 4, output: 20 },
  'claude-sonnet-5-5': { input: 2, output: 10 },
  'claude-sonnet-5': { input: 2, output: 10 },
  'claude-haiku-5-5': { input: 0.1, output: 0.5, inputLong: 0.5, outputLong: 2.5 },
  'claude-haiku-4-5-20251001': { input: 1, output: 5 },
};

const MOST_EXPENSIVE: Price = { input: 10, output: 50 };

export function priceFor(model: string): Price {
  return PRICE_PER_MTOK[model] ?? MOST_EXPENSIVE;
}

/** Cost in USD, rounded up to the 6 decimals `ai_usage.cost_usd` stores. */
export function costUsd(model: string, inputTokens: number, outputTokens: number): number {
  const p = priceFor(model);
  const long = inputTokens > LONG_PROMPT_TOKENS;
  const inRate = long && p.inputLong != null ? p.inputLong : p.input;
  const outRate = long && p.outputLong != null ? p.outputLong : p.output;
  const usd = (Math.max(0, inputTokens) * inRate + Math.max(0, outputTokens) * outRate) / 1_000_000;
  return Math.ceil(usd * 1_000_000) / 1_000_000;
}

/**
 * Speech-to-text has no tokens: it bills by audio minute. We do not decode the clip, so the duration is estimated from
 * its size (phone voice codecs run ~12 kB/s), capped at the 30 s the app records. USD per minute from SGC's
 * docs/PROPUESTA-TRANSCRIPCION-VOZ.md (OpenAI gpt-4o-mini-transcribe ~0.003, Groq whisper-large-v3-turbo ~0.0007).
 * An estimate that errs high keeps the daily cap honest.
 */
export const STT_USD_PER_MIN: Record<string, number> = { openai: 0.006, groq: 0.002 };
export const STT_BYTES_PER_SEC = 8_000;

export function sttCostUsd(provider: string, bytes: number): number {
  const seconds = Math.min(30, Math.max(1, bytes / STT_BYTES_PER_SEC));
  const rate = STT_USD_PER_MIN[provider] ?? STT_USD_PER_MIN.openai;
  return Math.ceil((seconds / 60) * rate * 1_000_000) / 1_000_000;
}
