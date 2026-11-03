/**
 * cg-ai-intent handler (SPEC-B §B3). One utterance in, one pre-fill out; the rules are in ./intents.ts.
 * The text is wrapped as DATA in the prompt (prompt-injection guard), the target list is closed, and the reply holds
 * only validated fields: the model's own words never reach the client.
 */
import { AiCallError } from '../_shared/anthropic.ts';
import { modelVision } from '../_shared/env.ts';
import type { Handler } from '../_shared/handler.ts';
import { SYSTEM, intentTool, normalizeIntent, parseIntentInput, userMessage } from './intents.ts';

export const intentHandler: Handler = async (ctx) => {
  const input = parseIntentInput(ctx.body);
  if (!input) throw new AiCallError('bad_input');

  const r = await ctx.call({
    model: modelVision(ctx.env),
    system: SYSTEM,
    messages: [{ role: 'user', content: userMessage(input.text, input.ctx) }],
    tool: intentTool() as never,
    maxTokens: 700,
  });

  const out = normalizeIntent(r.toolInput, input.ctx);
  if (!out) throw new AiCallError('unreadable', r.usage);
  return { body: { ...out }, usage: r.usage };
};
