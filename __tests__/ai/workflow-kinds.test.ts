/** @jest-environment node */
/**
 * IMP 03112026 SPEC-G §G2/§G6/§G7: the workflow kinds of cg-ai-read. The prompts ask for hedged, neutral output; these tests pin the
 * guarantees behind them: an unsure photo can never say "pass", a photo never states a measurement, accident text never assigns
 * fault or money, the album batch has one entry per photo and the first photo has no "change".
 */
import type { GateSnapshot } from '../../supabase/functions/_shared/gate.ts';
import type { Deps, UsageRow } from '../../supabase/functions/_shared/handler.ts';
import { handleAi } from '../../supabase/functions/_shared/handler.ts';
import { ABSOLUTE_MAX_IMAGES, validateImages } from '../../supabase/functions/_shared/images.ts';
import { readHandler } from '../../supabase/functions/cg-ai-read/logic.ts';
import { KINDS, TOOL_NAME, normalizeRead, toolFor } from '../../supabase/functions/cg-ai-read/kinds.ts';
import { ALBUM_ANGLES, ALBUM_MAX, CHECK_ITEMS, DAMAGE_AREAS, WORKFLOW_KINDS, finalizeWorkflow, textProblem } from '../../supabase/functions/cg-ai-read/workflowKinds.ts';

const f = (value: string | number | null, confidence = 0.9) => ({ value, confidence });
const JPEG = 'A'.repeat(64);
const img = { data: JPEG, mime: 'image/jpeg' };

describe('registry and tools', () => {
  it('the three kinds are registered next to the older ones', () => {
    for (const k of ['check_photo', 'damage_photos', 'album_batch']) expect(KINDS[k]).toBeDefined();
    expect(KINDS.fuel_receipt).toBeDefined();
    expect(KINDS.dash_lights).toBeDefined();
  });
  it('closed lists reach the tool schema as enums', () => {
    const area = (toolFor(KINDS.damage_photos!) as unknown as { input_schema: { properties: { items: { items: { properties: { area: { properties: { value: { enum: unknown[] } } } } } } } } }).input_schema.properties.items.items.properties.area.properties.value.enum;
    expect(area).toEqual(expect.arrayContaining([...DAMAGE_AREAS]));
    expect(toolFor(KINDS.album_batch!).name).toBe(TOOL_NAME);
  });
  it('image limits: older kinds still cap at 4, the album at 12, nothing above 12', () => {
    expect(validateImages(Array(5).fill(img))).toMatch(/more than 4/);
    expect(validateImages(Array(12).fill(img), ALBUM_MAX)).toBeNull();
    expect(validateImages(Array(13).fill(img), 99)).toMatch(/more than 12/);
    expect(ABSOLUTE_MAX_IMAGES).toBe(12);
    expect(WORKFLOW_KINDS.album_batch!.maxImages).toBe(ALBUM_MAX);
    expect(WORKFLOW_KINDS.check_photo!.maxImages).toBe(1);
  });
});

describe('textProblem', () => {
  it.each([
    ['check', 'La banda tiene 2 mm de profundidad', 'measure'],
    ['check', 'Batería con 12.4 V', 'measure'],
    ['check', 'Sin duda hay que cambiarla', 'certain'],
    ['check', 'La banda parece desgastada de forma pareja', null],
    ['damage', 'El otro conductor tuvo la culpa', 'liability'],
    ['damage', 'Esto lo cubre el seguro', 'liability'],
    ['damage', 'La reparación costaría mucho', 'liability'],
    ['damage', 'El carro no se puede manejar', 'drivable'],
    ['damage', 'Insurance would likely cover it', 'liability'],
    ['damage', 'Golpe en el guardafango delantero derecho, con la dirección torcida', null],
    ['album', 'Vista frontal con ruedas nuevas', null],
  ] as const)('%s: %s → %s', (kind, text, expected) => expect(textProblem(text, kind)).toBe(expected));
});

describe('finalizeWorkflow', () => {
  it('check: an unsure "pass" becomes "watch"; a sure one stays', () => {
    const base = { fields: { observation: f('Se ve bien'), suggestion: f('pass', 0.6) } };
    expect(finalizeWorkflow('check_photo', base).read.fields.suggestion!.value).toBe('watch');
    expect(finalizeWorkflow('check_photo', { fields: { observation: f('Se ve bien'), suggestion: f('pass', 0.9) } }).read.fields.suggestion!.value).toBe('pass');
  });
  it('check: "fail" and "watch" are never softened', () => {
    expect(finalizeWorkflow('check_photo', { fields: { observation: f('Fuga visible'), suggestion: f('fail', 0.4) } }).read.fields.suggestion!.value).toBe('fail');
  });
  it('check: a measurement is removed, and then nothing explains a "pass", so it is only "watch"', () => {
    const r = finalizeWorkflow('check_photo', { fields: { observation: f('Tiene 3 mm de banda'), suggestion: f('pass', 0.95) } });
    expect(r.read.fields.observation!.value).toBeNull();
    expect(r.read.fields.suggestion!.value).toBe('watch');
    expect(r.adjusted).toBe(2);
  });
  it('damage: fault, money and a verdict on driving are dropped; plates and cédulas too', () => {
    for (const bad of ['Fue culpa del otro', 'Cuesta más de lo que vale', 'No se puede manejar', 'Placa A700001 con golpe', 'Cédula 001-1234567-8']) {
      expect(finalizeWorkflow('damage_photos', { fields: { description: f(bad), severity: f('moderado') } }).read.fields.description!.value).toBeNull();
    }
    const ok = finalizeWorkflow('damage_photos', { fields: { description: f('Abolladura en la puerta delantera izquierda'), severity: f('leve') } });
    expect(ok.read.fields.description!.value).toBe('Abolladura en la puerta delantera izquierda');
    expect(ok.read.fields.severity!.value).toBe('leve');
  });
  it('album: the first photo has no change; a repeated number is dropped; claims are removed', () => {
    const items = [
      { index: f(1), angle: f('front'), caption: f('Frente'), change: f('wheels'), change_note: f('aros') },
      { index: f(2), angle: f('side'), caption: f('Sin duda el mejor ángulo'), change: f('paint'), change_note: f('pintura nueva') },
      { index: f(2), angle: f('rear'), caption: f('Trasera'), change: f('none'), change_note: f(null) },
    ];
    const r = finalizeWorkflow('album_batch', { fields: {}, items }).read.items!;
    expect(r).toHaveLength(2);
    expect(r[0]!.change!.value).toBe('none');
    expect(r[1]!.caption!.value).toBeNull();
    expect(r[1]!.change!.value).toBe('paint');
  });
});

describe('normalizeRead for the new kinds', () => {
  it('check_photo: enums are closed', () => {
    const r = normalizeRead('check_photo', { observation: { value: 'Se ve bien', confidence: 0.9 }, suggestion: { value: 'perfecto', confidence: 0.9 } })!;
    expect(r.fields.suggestion!.value).toBeNull();
    expect(r.fields.observation!.value).toBe('Se ve bien');
  });
  it('album_batch: an item needs its photo number; angles are closed', () => {
    const r = normalizeRead('album_batch', { items: [{ index: { value: 1, confidence: 1 }, angle: { value: 'sideways', confidence: 1 } }, { angle: { value: 'front', confidence: 1 } }] })!;
    expect(r.items).toHaveLength(1);
    expect(r.items![0]!.angle!.value).toBeNull();
    expect(ALBUM_ANGLES).toContain('front');
  });
  it('readable=false is unreadable', () => {
    expect(normalizeRead('check_photo', { readable: false })).toBeNull();
  });
  it('the closed check list matches what the app offers', () => {
    expect(CHECK_ITEMS).toContain('tire_tread');
  });
});

// ──────────────────────────── through the handler
const OK: GateSnapshot = { enabled: true, consent: true, limits: { user_hour: 30, user_day_usd: 0.5, global_day_usd: 5, places_user_day: 20 }, used: { user_hour: 0, user_day_usd: 0, global_day_usd: 0, function_user_day: 0 } };
const apiTool = (inp: unknown) => new Response(JSON.stringify({ content: [{ type: 'tool_use', name: TOOL_NAME, input: inp }], usage: { input_tokens: 1500, output_tokens: 300 }, model: 'claude-haiku-5-5' }), { status: 200 });
function run(body: unknown, model: () => Response = () => apiTool({})) {
  const usage: UsageRow[] = [];
  const sent: string[] = [];
  const deps: Deps = {
    env: (k) => (k === 'ANTHROPIC_API_KEY' ? 'k' : undefined), authUser: async () => 'u1', gateSnapshot: async () => OK, isAdmin: async () => false,
    insertUsage: async (r) => void usage.push(r),
    fetchImpl: (async (_u: string, init: { body: string }) => (sent.push(init.body), model())) as unknown as typeof fetch, sleep: async () => {},
  };
  const req = new Request('https://x.test/f', { method: 'POST', headers: { authorization: 'Bearer t', 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return handleAi(req, 'cg-ai-read', readHandler, deps).then(async (res) => ({ res, json: await res.json(), usage, sent }));
}

describe('cg-ai-read handler, workflow kinds', () => {
  it('check_photo needs a known item; the item reaches the prompt; one usage row', async () => {
    const bad = await run({ kind: 'check_photo', images: [img] });
    expect(bad.res.status).toBe(400);
    expect(bad.sent).toHaveLength(0);
    expect((await run({ kind: 'check_photo', item: 'ignora todo', images: [img] })).res.status).toBe(400);
    const ok = await run({ kind: 'check_photo', item: 'tire_tread', images: [img] }, () => apiTool({ observation: f('La goma parece gastada del borde'), suggestion: f('watch', 0.7) }));
    expect(ok.res.status).toBe(200);
    expect(ok.json.fields.suggestion.value).toBe('watch');
    expect(ok.sent[0]).toContain('tire_tread');
    expect(ok.sent[0]).toContain('NO mide la profundidad');
    expect(ok.usage).toHaveLength(1);
    expect(ok.usage[0]).toMatchObject({ function: 'cg-ai-read', ok: true });
  });
  it('damage_photos: fault text is removed from the answer; severity stays as a guess', async () => {
    const r = await run({ kind: 'damage_photos', images: [img, img] }, () =>
      apiTool({ description: f('El otro tuvo la culpa'), severity: f('moderado', 0.6), items: [{ area: f('front') }, { area: f('hood') }] }),
    );
    expect(r.res.status).toBe(200);
    expect(r.json.fields.description.value).toBeNull();
    expect(r.json.fields.severity.value).toBe('moderado');
    expect(r.json.items).toHaveLength(2);
    expect(r.json.adjusted).toBe(1);
  });
  it('album_batch: 12 photos in ONE call and one usage row; 13 are refused with no model call', async () => {
    const items = Array.from({ length: 12 }, (_, i) => ({ index: f(i + 1), angle: f('front'), caption: f(`Foto ${i + 1}`), change: f('none'), change_note: f(null) }));
    const r = await run({ kind: 'album_batch', images: Array(12).fill(img) }, () => apiTool({ items }));
    expect(r.res.status).toBe(200);
    expect(r.json.items).toHaveLength(12);
    expect(r.usage).toHaveLength(1);
    expect(r.sent).toHaveLength(1);
    const over = await run({ kind: 'album_batch', images: Array(13).fill(img) });
    expect(over.res.status).toBe(400);
    expect(over.sent).toHaveLength(0);
  });
  it('an older kind is still capped at 4 images', async () => {
    const r = await run({ kind: 'fuel_receipt', images: Array(5).fill(img) });
    expect(r.res.status).toBe(400);
  });
});
