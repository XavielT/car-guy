/**
 * One door to the Anthropic Messages API (IMP 03112026 ADR-65/67, SPEC-A §A3).
 *
 *  · Structured output by FORCED TOOL USE: the model must call `tool` and its `input` is the JSON we parse — no
 *    regex over prose (SGC used match(/\{...\}/)). If the API refuses a forced tool (a model whose adaptive thinking
 *    is incompatible with tool_choice), ONE retry goes with tool_choice 'auto' and an instruction to use the tool.
 *  · 429 / 529 (and a network error) retry with backoff; a 4xx other than that is never retried.
 *  · A 25 s timeout on every attempt (SGC had none).
 *  · Returns tokens and cost so the gateway writes the ai_usage row. The provider's body is NEVER returned or logged
 *    beyond the status (it can echo the request, which may hold a photo or a document).
 * `fetchImpl` and `sleep` are injectable so the tests run without a network.
 */
import { costUsd } from './cost.ts';
import type { AiErrorCode } from './errors.ts';

export const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
export const ANTHROPIC_VERSION = '2023-06-01';
export const CALL_TIMEOUT_MS = 25_000;

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } };
export type Message = { role: 'user' | 'assistant'; content: string | ContentBlock[] };
export type Tool = { name: string; description: string; input_schema: Record<string, unknown> };

export type CallArgs = {
  apiKey: string;
  model: string;
  system: string;
  messages: Message[];
  /** When set, the model must answer by calling this tool and `toolInput` carries its arguments. */
  tool?: Tool;
  maxTokens: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  maxRetries?: number;
};

export type Usage = { model: string; inputTokens: number; outputTokens: number; costUsd: number };
export type CallResult = { text: string; toolInput: unknown | null; usage: Usage };

/** Thrown for every failure; `usage` is set when tokens were spent (a billed but unusable answer still counts). */
export class AiCallError extends Error {
  constructor(public code: AiErrorCode, public usage?: Usage, public status?: number) {
    super(code);
    this.name = 'AiCallError';
  }
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

type ApiOk = {
  content?: Array<{ type: string; text?: string; input?: unknown }>;
  usage?: { input_tokens?: number; output_tokens?: number };
  model?: string;
};

export async function callClaude(a: CallArgs): Promise<CallResult> {
  const f = a.fetchImpl ?? fetch;
  const sleep = a.sleep ?? defaultSleep;
  const maxRetries = a.maxRetries ?? 2;
  let forced = !!a.tool;
  let forcedFallbackUsed = false;

  for (let attempt = 0; ; attempt++) {
    const body: Record<string, unknown> = { model: a.model, max_tokens: a.maxTokens, system: a.system, messages: a.messages };
    if (a.tool) {
      body.tools = [a.tool];
      body.tool_choice = forced ? { type: 'tool', name: a.tool.name } : { type: 'auto' };
      if (!forced) body.system = `${a.system}\n\nAnswer ONLY by calling the tool "${a.tool.name}".`;
    }

    let res: Response;
    try {
      res = await f(ANTHROPIC_URL, {
        method: 'POST',
        headers: { 'x-api-key': a.apiKey, 'anthropic-version': ANTHROPIC_VERSION, 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
      });
    } catch {
      if (attempt < maxRetries) {
        await sleep(500 * 2 ** attempt);
        continue;
      }
      throw new AiCallError('provider_error');
    }

    if ((res.status === 429 || res.status === 529) && attempt < maxRetries) {
      const wait = Number(res.headers.get('retry-after'));
      await sleep(Number.isFinite(wait) && wait > 0 ? Math.min(wait, 10) * 1000 : 500 * 2 ** attempt);
      continue;
    }
    if (res.status === 400 && forced && !forcedFallbackUsed) {
      forced = false; // the model rejected a forced tool: try once with 'auto'
      forcedFallbackUsed = true;
      continue;
    }
    if (!res.ok) throw new AiCallError('provider_error', undefined, res.status);

    const json = (await res.json()) as ApiOk;
    const model = json.model ?? a.model;
    const inTok = json.usage?.input_tokens ?? 0;
    const outTok = json.usage?.output_tokens ?? 0;
    const usage: Usage = { model, inputTokens: inTok, outputTokens: outTok, costUsd: costUsd(model, inTok, outTok) };
    const blocks = json.content ?? [];
    const toolUse = blocks.find((b) => b.type === 'tool_use');
    const text = blocks.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('').trim();
    if (a.tool && (!toolUse || toolUse.input == null)) throw new AiCallError('unreadable', usage);
    return { text, toolInput: toolUse?.input ?? null, usage };
  }
}
