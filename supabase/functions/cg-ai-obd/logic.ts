/**
 * cg-ai-obd handler (SPEC-D §D1). Validated input in, ONE reasoning-model call with a forced tool, validated answer out
 * (rules in ./obd.ts, the safety floor in ./safety.ts). Stateless: the app caches the answer in `ai_insights` (sql/043).
 */
import { AiCallError } from '../_shared/anthropic.ts';
import { modelReason } from '../_shared/env.ts';
import type { Handler } from '../_shared/handler.ts';
import { SYSTEM, normalizeObd, obdTool, parseObdInput, userMessage } from './obd.ts';

export const obdHandler: Handler = async (ctx) => {
  const input = parseObdInput(ctx.body);
  if (!input) throw new AiCallError('bad_input');

  const r = await ctx.call({
    model: modelReason(ctx.env),
    system: SYSTEM,
    messages: [{ role: 'user', content: userMessage(input) }],
    tool: obdTool() as never,
    maxTokens: 1800,
  });

  const out = normalizeObd(r.toolInput, input);
  if (!out) throw new AiCallError('unreadable', r.usage);
  return { body: { ...out }, usage: r.usage };
};
