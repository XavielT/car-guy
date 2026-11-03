/** @jest-environment node */
/**
 * IMP 03112026 SPEC-B §B1/§B7: cg-ai-read's registry, validators and dispatcher, with a fake model (no network).
 */
import type { Deps, UsageRow } from '../../supabase/functions/_shared/handler.ts';
import { handleAi } from '../../supabase/functions/_shared/handler.ts';
import type { GateSnapshot } from '../../supabase/functions/_shared/gate.ts';
import { KINDS, KIND_IDS, TOOL_NAME, normalizeField, normalizeRead, toolFor } from '../../supabase/functions/cg-ai-read/kinds.ts';
import { readHandler } from '../../supabase/functions/cg-ai-read/logic.ts';

const f = (value: unknown, confidence: unknown = 0.9) => ({ value, confidence });

describe('normalizeField — numbers', () => {
  const spec = { type: 'number', desc: '', min: 1, max: 1000 } as const;
  it.each([
    [f(52400.4), null],
    [f(250.5), 250.5],
    [f('2583.00'), null],
    [f('999.5'), 999.5],
    [f('343.8'), 343.8],
    [f(0), null],
    [f(-5), null],
    [f(1001), null],
    [f('abc'), null],
    [f(null), null],
    [f(undefined), null],
    [f(NaN), null],
    [f(Infinity), null],
  ])('%j → %j', (raw, want) => {
    expect(normalizeField(raw, spec).value).toBe(want);
  });
  it('rounds to 3 decimals and keeps confidence in 0..1', () => {
    expect(normalizeField(f(8.123456, 3), spec)).toEqual({ value: 8.123, confidence: 1 });
    expect(normalizeField(f(8, -2), spec).confidence).toBe(0);
    expect(normalizeField(f(8, 'x'), spec).confidence).toBe(0);
  });
  it('a null value always has confidence 0', () => {
    expect(normalizeField(f(null, 0.99), spec)).toEqual({ value: null, confidence: 0 });
  });
});

describe('normalizeField — strings, formats and enums (Dominican formats)', () => {
  const ncf = KINDS.fuel_receipt.fields.ncf;
  const rnc = KINDS.invoice.fields.rnc;
  it.each([
    ['B0100000001', 'B0100000001'],
    ['b01 00000001', 'B0100000001'],
    ['E310000000001', 'E310000000001'],
    ['B01-0000001', null],
    ['12345', null],
    ['', null],
  ])('NCF %j → %j', (raw, want) => {
    expect(normalizeField(f(raw), ncf).value).toBe(want);
  });
  it.each([
    ['1-30-12345-6', '130123456'],
    ['131-23456-789'.replace(/-/g, ''), '13123456789'],
    ['1234', null],
    ['abc', null],
  ])('RNC %j → %j (digits only, 9 or 11)', (raw, want) => {
    expect(normalizeField(f(raw), rnc).value).toBe(want);
  });
  it('dates: real calendar dates only', () => {
    const d = KINDS.fuel_receipt.fields.date;
    expect(normalizeField(f('2026-10-30'), d).value).toBe('2026-10-30');
    for (const bad of ['2026-02-30', '30/10/2026', '1999-01-01', '2026-13-01', 'hoy']) expect(normalizeField(f(bad), d).value).toBeNull();
  });
  it('times: HH:MM, padded', () => {
    const t = KINDS.fuel_receipt.fields.time;
    expect(normalizeField(f('7:05'), t).value).toBe('07:05');
    expect(normalizeField(f('24:00'), t).value).toBeNull();
    expect(normalizeField(f('7pm'), t).value).toBeNull();
  });
  it('enums are case-insensitive and closed', () => {
    const u = KINDS.odometer.fields.unit;
    expect(normalizeField(f('KM'), u).value).toBe('km');
    expect(normalizeField(f('mi'), u).value).toBe('mi');
    expect(normalizeField(f('miles'), u).value).toBeNull();
  });
  it('fraction is 0..1 only; DOT is exactly four digits; long strings are cut', () => {
    expect(normalizeField(f(0.5), KINDS.fuel_express.fields.fuel_level).value).toBe(0.5);
    expect(normalizeField(f(1.5), KINDS.fuel_express.fields.fuel_level).value).toBeNull();
    expect(normalizeField(f('23 21'), KINDS.part_label.fields.dot).value).toBe('2321');
    expect(normalizeField(f('231'), KINDS.part_label.fields.dot).value).toBeNull();
    expect((normalizeField(f('x'.repeat(500)), KINDS.invoice.fields.shop).value as string).length).toBe(80);
  });
});

describe('registry and tool schema', () => {
  it('has every kind SPEC-B needs', () => {
    expect(KIND_IDS.sort()).toEqual(['fuel_express', 'fuel_receipt', 'invoice', 'odometer', 'part_label', 'pump']);
  });
  it.each(KIND_IDS)('%s: the forced tool lists every field with value+confidence and requires readable', (id) => {
    const def = KINDS[id];
    const tool = toolFor(def) as { name: string; input_schema: { properties: Record<string, { properties?: Record<string, unknown> }>; required: string[] } };
    expect(tool.name).toBe(TOOL_NAME);
    expect(tool.input_schema.required).toContain('readable');
    for (const k of Object.keys(def.fields)) {
      expect(tool.input_schema.required).toContain(k);
      expect(Object.keys(tool.input_schema.properties[k].properties ?? {})).toEqual(['value', 'confidence']);
    }
    expect(def.system).toMatch(/herramienta/);
    expect(def.system).toMatch(/NO inventes/);
  });
  it('invoice has line items and fuel_express classifies each image', () => {
    const inv = toolFor(KINDS.invoice) as { input_schema: { properties: Record<string, unknown> } };
    expect(inv.input_schema.properties.items).toBeDefined();
    const fe = toolFor(KINDS.fuel_express) as { input_schema: { properties: Record<string, unknown>; required: string[] } };
    expect(fe.input_schema.required).toContain('per_image');
  });
  it('limits images per kind (express takes up to 4, a dashboard photo 1)', () => {
    expect(KINDS.fuel_express.maxImages).toBe(4);
    expect(KINDS.odometer.maxImages).toBe(1);
  });
});

describe('normalizeRead', () => {
  const receipt = {
    readable: true,
    total: f(2583), gallons: f(7.51), unit_price: f(343.8), product: f('Gasolina Premium'), station: f('Texaco'),
    date: f('2026-10-30'), time: f('18:42'), ncf: f('B0200000123', 0.5), pump: f('3'),
  };
  it('returns typed fields for a good receipt', () => {
    const r = normalizeRead('fuel_receipt', receipt)!;
    expect(r.fields.total).toEqual({ value: 2583, confidence: 0.9 });
    expect(r.fields.ncf.value).toBe('B0200000123');
    expect(r.fields.ncf.confidence).toBe(0.5);
  });
  it('drops a bad field to null but keeps the rest', () => {
    const r = normalizeRead('fuel_receipt', { ...receipt, gallons: f(9999), date: f('31/10/2026') })!;
    expect(r.fields.gallons).toEqual({ value: null, confidence: 0 });
    expect(r.fields.date.value).toBeNull();
    expect(r.fields.total.value).toBe(2583);
  });
  it('readable=false, an unknown kind, junk, or all-null is unreadable (null)', () => {
    expect(normalizeRead('fuel_receipt', { ...receipt, readable: false })).toBeNull();
    expect(normalizeRead('nope', receipt)).toBeNull();
    expect(normalizeRead('fuel_receipt', null)).toBeNull();
    expect(normalizeRead('fuel_receipt', 'text')).toBeNull();
    expect(normalizeRead('fuel_receipt', { readable: true })).toBeNull();
  });
  it('ignores keys the registry does not know (the model cannot add a field)', () => {
    const r = normalizeRead('fuel_receipt', { ...receipt, cedula: f('00112345678'), card_last4: f('1234') })!;
    expect(Object.keys(r.fields).sort()).toEqual(Object.keys(KINDS.fuel_receipt.fields).sort());
    expect(JSON.stringify(r)).not.toContain('00112345678');
  });
  it('invoice items are validated, capped and empty rows dropped', () => {
    const r = normalizeRead('invoice', {
      readable: true, shop: f('Taller Pérez'), rnc: f('130123456'), total: f(3800),
      items: [
        { description: f('Aceite 5W-30 4L'), qty: f(1), unit_price: f(2400), kind: f('part') },
        { description: f('Mano de obra'), qty: f(1), unit_price: f(1400), kind: f('labour') },
        { description: f(null), qty: f(2), unit_price: f(10), kind: f('part') },
        { description: f('Cosa'), qty: f(-1), unit_price: f(5), kind: f('weird') },
      ],
    })!;
    expect(r.items).toHaveLength(3);
    expect(r.items![0].kind.value).toBe('part');
    expect(r.items![2].qty.value).toBeNull();
    expect(r.items![2].kind.value).toBeNull();
  });
  it('fuel_express keeps the per-image classification and merges both photos', () => {
    const r = normalizeRead('fuel_express', {
      readable: true,
      per_image: [{ index: 0, kind: 'receipt', readable: true }, { index: 1, kind: 'dashboard', readable: true }, { index: 2, kind: 'banana', readable: true }],
      odometer: f(52830), unit: f('km'), total: f(2583), gallons: f(7.5), unit_price: f(343.8), fuel_level: f(0.25, 0.4),
    })!;
    expect(r.per_image).toEqual([{ index: 0, kind: 'receipt', readable: true }, { index: 1, kind: 'dashboard', readable: true }]);
    expect(r.fields.odometer.value).toBe(52830);
    expect(r.fields.total.value).toBe(2583);
    expect(r.fields.fuel_level.confidence).toBe(0.4);
  });
});

// ------------------------------------------------------------------------------------------- dispatcher
const OK: GateSnapshot = {
  enabled: true, consent: true,
  limits: { user_hour: 30, user_day_usd: 0.5, global_day_usd: 5, places_user_day: 20 },
  used: { user_hour: 0, user_day_usd: 0, global_day_usd: 0, function_user_day: 0 },
};
const img = { data: 'A'.repeat(64), mime: 'image/jpeg' };
const apiTool = (input: unknown, inTok = 1500, outTok = 200) =>
  new Response(JSON.stringify({ content: [{ type: 'tool_use', name: TOOL_NAME, input }], usage: { input_tokens: inTok, output_tokens: outTok }, model: 'claude-haiku-5-5' }), { status: 200 });

function run(body: unknown, fetchImpl: typeof fetch) {
  const usage: UsageRow[] = [];
  const deps: Deps = {
    env: (n) => (n === 'ANTHROPIC_API_KEY' ? 'k' : undefined),
    authUser: async () => 'u1',
    gateSnapshot: async () => OK,
    isAdmin: async () => false,
    insertUsage: async (r) => void usage.push(r),
    fetchImpl,
    sleep: async () => {},
  };
  const req = new Request('https://x.test/f', { method: 'POST', headers: { authorization: 'Bearer t', 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return handleAi(req, 'cg-ai-read', readHandler, deps).then(async (res) => ({ res, json: await res.json(), usage }));
}

describe('cg-ai-read dispatcher', () => {
  const good = { readable: true, odometer: f(52830), unit: f('km') };

  it('reads an odometer photo: typed fields, one usage row, no raw model text', async () => {
    const fetchImpl = jest.fn(async () => apiTool(good));
    const { res, json, usage } = await run({ kind: 'odometer', images: [img] }, fetchImpl as unknown as typeof fetch);
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.kind).toBe('odometer');
    expect(json.fields.odometer).toEqual({ value: 52830, confidence: 0.9 });
    expect(usage).toHaveLength(1);
    expect(usage[0]).toMatchObject({ function: 'cg-ai-read', ok: true, input_tokens: 1500, output_tokens: 200 });
    const sent = JSON.parse((fetchImpl.mock.calls[0] as unknown as [string, { body: string }])[1].body);
    expect(sent.tool_choice).toEqual({ type: 'tool', name: TOOL_NAME });
    expect(sent.messages[0].content.some((b: { type: string }) => b.type === 'image')).toBe(true);
    expect(sent.model).toBe('claude-haiku-5-5');
  });
  it('a fuel_express call sends all the photos in ONE model call', async () => {
    const fetchImpl = jest.fn(async () => apiTool({ readable: true, odometer: f(1000), unit: f('km'), per_image: [{ index: 0, kind: 'dashboard', readable: true }] }));
    const { json } = await run({ kind: 'fuel_express', images: [img, img] }, fetchImpl as unknown as typeof fetch);
    expect(json.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const sent = JSON.parse((fetchImpl.mock.calls[0] as unknown as [string, { body: string }])[1].body);
    expect(sent.messages[0].content.filter((b: { type: string }) => b.type === 'image')).toHaveLength(2);
  });
  it('unreadable: 422, tokens recorded ok=false, the form is untouched (no fields returned)', async () => {
    const fetchImpl = jest.fn(async () => apiTool({ readable: false }, 900, 20));
    const { res, json, usage } = await run({ kind: 'fuel_receipt', images: [img] }, fetchImpl as unknown as typeof fetch);
    expect(res.status).toBe(422);
    expect(json).toEqual({ ok: false, error: expect.any(String), error_code: 'unreadable' });
    expect(json.fields).toBeUndefined();
    expect(usage[0]).toMatchObject({ ok: false, error_code: 'unreadable', input_tokens: 900 });
  });
  it.each([
    ['unknown kind', { kind: 'cedula', images: [img] }],
    ['no kind', { images: [img] }],
    ['no images', { kind: 'odometer', images: [] }],
    ['too many for the kind', { kind: 'odometer', images: [img, img] }],
    ['five images', { kind: 'fuel_express', images: [img, img, img, img, img] }],
    ['bad mime', { kind: 'odometer', images: [{ data: 'A'.repeat(64), mime: 'application/pdf' }] }],
    ['not base64', { kind: 'odometer', images: [{ data: '!!!! not base64 !!!! not base64', mime: 'image/png' }] }],
  ])('%s → 400 bad_input and NO model call, no usage', async (_n, body) => {
    const fetchImpl = jest.fn();
    const { res, json, usage } = await run(body, fetchImpl as unknown as typeof fetch);
    expect(res.status).toBe(400);
    expect(json.error_code).toBe('bad_input');
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(usage).toHaveLength(0);
  });
  it('a model that returns text instead of the tool is unreadable (with usage)', async () => {
    const fetchImpl = jest.fn(async () => new Response(JSON.stringify({ content: [{ type: 'text', text: 'I see a car' }], usage: { input_tokens: 700, output_tokens: 9 }, model: 'claude-haiku-5-5' }), { status: 200 }));
    const { json, usage } = await run({ kind: 'odometer', images: [img] }, fetchImpl as unknown as typeof fetch);
    expect(json.error_code).toBe('unreadable');
    expect(usage).toHaveLength(1);
  });
  it('the model cannot smuggle a field or a cédula into the response', async () => {
    const fetchImpl = jest.fn(async () => apiTool({ ...good, cedula: f('001-1234567-8'), name: f('Juan') }));
    const { json } = await run({ kind: 'odometer', images: [img] }, fetchImpl as unknown as typeof fetch);
    expect(JSON.stringify(json)).not.toContain('001-1234567-8');
    expect(Object.keys(json.fields).sort()).toEqual(['odometer', 'trip_a', 'trip_b', 'unit']);
  });
});
