/**
 * cg-ai-ping (SPEC-A §A3, PROMPT-01 step 5): admin only. Calls the vision model with a 5-token prompt through the
 * SAME gateway as every other function, to prove the key, the model id, the gate and the usage row work end to end.
 */
import type { Handler } from '../_shared/handler.ts';
import { modelVision } from '../_shared/env.ts';

export const pingHandler: Handler = async (ctx) => {
  const r = await ctx.call({
    model: modelVision(ctx.env),
    system: 'You are a health check. Reply with the single word: ok',
    messages: [{ role: 'user', content: 'ping' }],
    maxTokens: 5,
  });
  return { body: { pong: r.text.length > 0, text: r.text.slice(0, 20) }, usage: r.usage };
};
