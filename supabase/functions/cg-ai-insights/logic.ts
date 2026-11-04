/**
 * cg-ai-insights handler (SPEC-E §E2). Facts in, at most 5 validated insights out; the rules are in ./insights.ts. ONE call to the
 * small model, because the job is wording, not reasoning: every number is the engine's and the server re-checks it. Stateless: the
 * app caches the answer in `ai_insights` (sql/043) by the facts' hash, so an unchanged car costs nothing.
 */
import { AiCallError } from '../_shared/anthropic.ts';
import { modelVision } from '../_shared/env.ts';
import type { Handler } from '../_shared/handler.ts';
import { SYSTEM, insightsTool, normalizeInsights, parseInsightsInput, userMessage } from './insights.ts';

export const insightsHandler: Handler = async (ctx) => {
  const input = parseInsightsInput(ctx.body);
  if (!input) throw new AiCallError('bad_input');

  const r = await ctx.call({
    model: modelVision(ctx.env),
    system: SYSTEM,
    messages: [{ role: 'user', content: userMessage(input) }],
    tool: insightsTool() as never,
    maxTokens: 1400,
  });

  const out = normalizeInsights(r.toolInput, input);
  if (!out) throw new AiCallError('unreadable', r.usage);
  return { body: { ...out }, usage: r.usage };
};
