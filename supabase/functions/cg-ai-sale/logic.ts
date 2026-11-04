/**
 * cg-ai-sale handler (SPEC-G §G9). Facts in, at most five validated paragraphs out; the rules are in ./sale.ts. ONE call to the
 * small model: the job is wording, not reasoning. Stateless: the app builds its own complete text first and only replaces a
 * section with the model's when the server returned it.
 */
import { AiCallError } from '../_shared/anthropic.ts';
import { modelVision } from '../_shared/env.ts';
import type { Handler } from '../_shared/handler.ts';
import { SYSTEM, normalizeSale, parseSaleInput, saleTool, userMessage } from './sale.ts';

export const saleHandler: Handler = async (ctx) => {
  const input = parseSaleInput(ctx.body);
  if (!input) throw new AiCallError('bad_input');

  const r = await ctx.call({
    model: modelVision(ctx.env),
    system: SYSTEM,
    messages: [{ role: 'user', content: userMessage(input) }],
    tool: saleTool() as never,
    maxTokens: 1200,
  });

  const out = normalizeSale(r.toolInput, input);
  if (!out) throw new AiCallError('unreadable', r.usage);
  return { body: { ...out }, usage: r.usage };
};
