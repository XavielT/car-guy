/**
 * cg-ai-read (IMP 03112026 SPEC-B §B1/§B7): photos in, validated typed fields out. The request pipeline (JWT, kill
 * switch, consent, limits, usage row) is `_shared/handler.ts`; this file is only the dispatcher:
 *
 *   body { kind, images: [{ data: base64, mime }] }
 *     → kind must be in the registry (kinds.ts) → images validated (count per kind, mime, size)
 *     → ONE vision call with a forced tool whose schema is generated from the kind
 *     → normalizeRead(): ranges, formats, enums; a value that fails becomes null (the person types it)
 *     → { kind, fields: { name: { value, confidence } }, items?, per_image? }
 *
 * Nothing is stored: the photos live only in this request. `readable=false` or nothing readable = `unreadable`
 * (the tokens were spent, so the usage row is written ok=false by the pipeline). The function never returns the
 * model's text, only the validated fields.
 */
import { AiCallError } from '../_shared/anthropic.ts';
import { modelVision } from '../_shared/env.ts';
import type { Handler } from '../_shared/handler.ts';
import { MAX_IMAGES, validateImages, type ImageIn } from '../_shared/images.ts';
import { KINDS, TOOL_NAME, normalizeRead, toolFor } from './kinds.ts';

export const readHandler: Handler = async (ctx) => {
  const body = (ctx.body ?? {}) as { kind?: unknown; images?: unknown };
  const kind = typeof body.kind === 'string' ? body.kind : '';
  const def = KINDS[kind];
  if (!def) throw new AiCallError('bad_input');

  const problem = validateImages(body.images);
  if (problem) throw new AiCallError('bad_input');
  const images = body.images as ImageIn[];
  if (images.length > Math.min(def.maxImages, MAX_IMAGES)) throw new AiCallError('bad_input');

  const content: Array<Record<string, unknown>> = [];
  images.forEach((im, i) => {
    const hint = def.perImage ? `Foto ${i + 1} de ${images.length}.` : def.imageHints[Math.min(i, def.imageHints.length - 1)];
    content.push({ type: 'text', text: hint });
    content.push({ type: 'image', source: { type: 'base64', media_type: im.mime, data: im.data } });
  });
  content.push({ type: 'text', text: `Lee lo que se ve y responde llamando a la herramienta ${TOOL_NAME}. No inventes nada que no se vea.` });

  const result = await ctx.call({
    model: modelVision(ctx.env),
    system: def.system,
    messages: [{ role: 'user', content: content as never }],
    tool: toolFor(def) as never,
    maxTokens: def.items ? 2048 : 1024,
  });

  const read = normalizeRead(kind, result.toolInput);
  if (!read) throw new AiCallError('unreadable', result.usage);
  return { body: { ...read }, usage: result.usage };
};
