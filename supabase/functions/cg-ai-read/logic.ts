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
import { ABSOLUTE_MAX_IMAGES, validateImages, type ImageIn } from '../_shared/images.ts';
import { KINDS, TOOL_NAME, normalizeRead, toolFor } from './kinds.ts';
import { anyValueLeft, applyPrivacy } from './privacy.ts';
import { CHECK_GUIDE, CHECK_ITEMS, finalizeWorkflow, type CheckItem } from './workflowKinds.ts';

export const readHandler: Handler = async (ctx) => {
  const body = (ctx.body ?? {}) as { kind?: unknown; images?: unknown };
  const kind = typeof body.kind === 'string' ? body.kind : '';
  const def = KINDS[kind];
  if (!def) throw new AiCallError('bad_input');

  const problem = validateImages(body.images, def.maxImages);
  if (problem) throw new AiCallError('bad_input');
  const images = body.images as ImageIn[];
  if (images.length > Math.min(def.maxImages, ABSOLUTE_MAX_IMAGES)) throw new AiCallError('bad_input');

  // check_photo: the item under review is part of the question, from a closed list (never free text into the prompt).
  let itemNote = '';
  if (kind === 'check_photo') {
    const item = (body as { item?: unknown }).item;
    if (typeof item !== 'string' || !(CHECK_ITEMS as readonly string[]).includes(item)) throw new AiCallError('bad_input');
    itemNote = `Elemento que se revisa: ${item}. Qué mirar: ${CHECK_GUIDE[item as CheckItem]}`;
  }

  const content: Array<Record<string, unknown>> = [];
  images.forEach((im, i) => {
    const hint = def.perImage ? `Foto ${i + 1} de ${images.length}.` : def.imageHints[Math.min(i, def.imageHints.length - 1)];
    content.push({ type: 'text', text: hint });
    content.push({ type: 'image', source: { type: 'base64', media_type: im.mime, data: im.data } });
  });
  if (itemNote) content.push({ type: 'text', text: itemNote });
  content.push({ type: 'text', text: `Lee lo que se ve y responde llamando a la herramienta ${TOOL_NAME}. No inventes nada que no se vea.` });

  const result = await ctx.call({
    model: modelVision(ctx.env),
    system: def.system,
    messages: [{ role: 'user', content: content as never }],
    tool: toolFor(def) as never,
    maxTokens: def.items ? 2048 : 1024,
  });

  const parsed = normalizeRead(kind, result.toolInput);
  if (!parsed) throw new AiCallError('unreadable', result.usage);
  // The workflow kinds (check / accident / album) get their hedging and claim filters here, after validation.
  const wf = finalizeWorkflow(kind, parsed);
  const read = wf.read;
  if (def.privacy) {
    // Second wall after the prompt and the schema: personal data never leaves, and only a COUNT of what was removed does.
    const safe = applyPrivacy(read);
    if (!anyValueLeft(safe.read)) throw new AiCallError('unreadable', result.usage);
    return { body: { ...safe.read, privacy_removed: safe.removed, ...(wf.adjusted ? { adjusted: wf.adjusted } : {}) }, usage: result.usage };
  }
  return { body: { ...read, ...(wf.adjusted ? { adjusted: wf.adjusted } : {}) }, usage: result.usage };
};
