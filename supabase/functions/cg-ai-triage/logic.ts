/** cg-ai-triage handler (SPEC-E §E6). Admin only (serveAi option). ONE small-model call; returns a draft, writes nothing. */
import { AiCallError } from '../_shared/anthropic.ts';
import { modelVision } from '../_shared/env.ts';
import type { Handler } from '../_shared/handler.ts';
import { SYSTEM, normalizeTriage, parseTriageInput, triageTool, userMessage } from './triage.ts';

export const triageHandler: Handler = async (ctx) => {
  const input = parseTriageInput(ctx.body);
  if (!input) throw new AiCallError('bad_input');
  const r = await ctx.call({
    model: modelVision(ctx.env),
    system: SYSTEM,
    messages: [{ role: 'user', content: userMessage(input) }],
    tool: triageTool() as never,
    maxTokens: 700,
  });
  const draft = normalizeTriage(r.toolInput, input);
  if (!draft) throw new AiCallError('unreadable', r.usage);
  return { body: { ...draft }, usage: r.usage };
};
