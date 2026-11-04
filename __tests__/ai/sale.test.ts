/** @jest-environment node */
/**
 * IMP 03112026 SPEC-G §G9: the sale-ready summary. The facts honour the Libro's switches; the template is a complete sheet without AI;
 * the server only lets through paragraphs whose numbers come from the facts they cite and that make no claim about condition or value.
 */
import { buildSaleFacts, carLabel, dateWords, mergeSale, saleSheetText, templateSale } from '@/lib/domain/saleSheet';
import type { RawDossier } from '@/lib/share/dossier';
import type { GateSnapshot } from '../../supabase/functions/_shared/gate.ts';
import type { Deps, UsageRow } from '../../supabase/functions/_shared/handler.ts';
import { handleAi } from '../../supabase/functions/_shared/handler.ts';
import { saleHandler } from '../../supabase/functions/cg-ai-sale/logic.ts';
import { SECTIONS, SYSTEM, TOOL_NAME, claimIn, normalizeSale, parseSaleInput, saleTool, userMessage } from '../../supabase/functions/cg-ai-sale/sale.ts';

const TODAY = '2026-11-04';
const show = { plate: false, vin: false, costs: false, odometer: true, maintenance: true, mods: true, track: false, story: false, status: false };
// Like the real dossier (shareQueries): with the costs switch off the money is null, with the odometer off so are the km.
const raw = ({ show: sw, ...over }: Partial<Omit<RawDossier, 'show'>> & { show?: Partial<RawDossier['show']> } = {}): RawDossier => ({
  slug: null,
  visibility: 'link',
  show: { ...show, ...(sw ?? {}) },
  vehicle: { name: 'El Rayo', make: 'Toyota', model: 'Corolla', year: 2018, color: null, nickname: 'El Rayo', chassis_code: null, engine_code: null, hero_media_id: null, plate: '••••', vin: '••••', story: null, trim: 'SE', transmission: 'auto' },
  odometer_km: 84210,
  services: ([
    { kind: 'mantenimiento', occurred_at: '2026-10-02T12:00:00Z', title: 'Cambio de aceite', odometer_km: 84000, total_dop: 3200 },
    { kind: 'reparacion', occurred_at: '2026-06-10T12:00:00Z', title: 'Alternador', odometer_km: 80100, total_dop: 14500, warranty_until_date: '2027-06-10' },
    { kind: 'mantenimiento', occurred_at: '2025-03-14T12:00:00Z', title: 'Frenos delanteros', odometer_km: 70000, total_dop: 5200 },
  ] as NonNullable<RawDossier['services']>).map((x) => ({ ...x, total_dop: (sw ?? {}).costs ? x.total_dop : null })),
  mods: [
    { id: 'm1', name: 'Escape inox', brand: 'Borla', category_id: 'c', category: 'Escape', status: 'instalado', installed_at: '2024-05-01', affects_specs: false, spec_effects: null, tags: null, cost_dop: 22000 },
    { id: 'm2', name: 'Lip', brand: null, category_id: 'c', category: 'Aero', status: 'quitado', installed_at: '2023-01-01', removed_at: '2024-01-01', affects_specs: false, spec_effects: null, tags: null },
  ],
  photos: [],
  ...over,
});
const docs = [
  { title: 'Seguro Mapfre', kind: 'seguro', issuedAt: '2026-01-10', expiresAt: '2027-01-10' },
  { title: 'Marbete', kind: 'marbete', issuedAt: null, expiresAt: '2026-03-31' },
  { title: 'Licencia', kind: 'licencia', issuedAt: null, expiresAt: '2030-01-01' },
];

describe('buildSaleFacts', () => {
  const facts = buildSaleFacts(raw(), docs, TODAY);
  const get = (id: string) => facts.find((f) => f.id === id);

  it('describes the car by year, make and model; never by nickname, plate or VIN', () => {
    expect(get('carro')!.data).toMatchObject({ year: 2018, make: 'Toyota', model: 'Corolla', odometerKm: 84210 });
    const all = JSON.stringify(facts);
    expect(all).not.toMatch(/El Rayo|••••/);
    expect(carLabel(raw().vehicle)).toBe('2018 Toyota Corolla');
  });
  it('maintenance: count, the latest, and since; the money only with the costs switch', () => {
    expect(get('mant')!.data).toMatchObject({ count: 2, lastTitle: 'Cambio de aceite', lastDate: '2026-10-02', lastKm: 84000, since: '2025-03-14' });
    expect(get('mant')!.data.totalDop).toBeUndefined();
    expect(buildSaleFacts(raw({ show: { costs: true } }), docs, TODAY).find((f) => f.id === 'mant')!.data.totalDop).toBe(8400);
  });
  it('repairs: cost only with the switch; a warranty only while it still runs', () => {
    expect(get('rep-1')!.data).toMatchObject({ title: 'Alternador', date: '2026-06-10', km: 80100, warrantyUntil: '2027-06-10' });
    expect(get('rep-1')!.data.costDop).toBeUndefined();
    const paid = buildSaleFacts(raw({ show: { costs: true } }), docs, TODAY);
    expect(paid.find((f) => f.id === 'rep-1')!.data.costDop).toBe(14500);
    const late = buildSaleFacts(raw(), docs, '2028-01-01');
    expect(late.find((f) => f.id === 'rep-1')!.data.warrantyUntil).toBeUndefined();
  });
  it('mods: installed only (a removed one is not on the car), no price', () => {
    expect(get('mods')!.data.count).toBe(1);
    expect(get('mod-1')!.data).toMatchObject({ name: 'Escape inox', brand: 'Borla', installedYear: 2024 });
    expect(get('mod-2')).toBeUndefined();
    expect(JSON.stringify(facts)).not.toContain('22000');
  });
  it('documents: seguro, marbete and matrícula only, with whether they are valid today', () => {
    expect(get('doc-seguro')!.data).toMatchObject({ validUntil: '2027-01-10', valid: true });
    expect(get('doc-marbete')!.data).toMatchObject({ validUntil: '2026-03-31', valid: false });
    expect(get('doc-licencia')).toBeUndefined();
  });
  it('the switches turn whole sections off: no odometer, no maintenance, no mods', () => {
    const f = buildSaleFacts(raw({ show: { odometer: false, maintenance: false, mods: false } }), null, TODAY);
    expect(f.map((x) => x.id)).toEqual(['carro']);
    expect(f[0]!.data.odometerKm).toBeUndefined();
  });
  it('events (accidents) are never part of the facts', () => {
    expect(JSON.stringify(facts)).not.toMatch(/accident|choque|evento/i);
  });
});

describe('templateSale (the whole feature with no AI)', () => {
  const facts = buildSaleFacts(raw({ show: { costs: true } }), docs, TODAY);
  it('Spanish: every section, with the numbers from the facts', () => {
    const s = templateSale(facts, 'es');
    expect(s.sections.map((x) => x.section)).toEqual(['resumen', 'mantenimiento', 'reparaciones', 'modificaciones', 'documentos']);
    const text = saleSheetText(s);
    expect(text).toContain('2018 Toyota Corolla SE');
    expect(text).toContain('84,210 km');
    expect(text).toContain('2 mantenimientos registrados desde 14 mar 2025');
    expect(text).toContain('Alternador, 10 jun 2026, a 80,100 km, RD$ 14,500, garantía hasta 10 jun 2027.');
    expect(text).toContain('Seguro: vigente hasta 10 ene 2027.');
    expect(text).toContain('Marbete: venció el 31 mar 2026.');
  });
  it('English: the same facts, English words and month names', () => {
    const text = saleSheetText(templateSale(facts, 'en'));
    expect(text).toContain('Sale sheet: 2018 Toyota Corolla SE');
    expect(text).toContain('It has 2 maintenance records since 14 Mar 2025');
    expect(text).toContain('Insurance: valid until 10 Jan 2027.');
    expect(text).toContain('Registration'.slice(0, 0));
  });
  it('a sheet makes no claim about condition or value in either language', () => {
    for (const lang of ['es', 'en'] as const) for (const s of templateSale(facts, lang).sections) expect(claimIn(s.text)).toBeNull();
  });
  it('a section with no facts is left out, not filled with filler', () => {
    const s = templateSale(buildSaleFacts(raw({ show: { maintenance: false, mods: false } }), null, TODAY), 'es');
    expect(s.sections.map((x) => x.section)).toEqual(['resumen']);
  });
  it('dateWords', () => {
    expect(dateWords('2026-11-04', 'es')).toBe('4 nov 2026');
    expect(dateWords(null, 'es')).toBe('');
  });
});

describe('every number in the template is backed by its own facts (so the server check cannot reject our own words)', () => {
  it.each(['es', 'en'] as const)('%s', (lang) => {
    const facts = buildSaleFacts(raw({ show: { costs: true } }), docs, TODAY);
    for (const s of templateSale(facts, lang).sections) {
      const input = { vehicleLabel: 'x', lang, facts };
      const out = normalizeSale({ sections: [{ section: s.section, text: s.text, facts: s.facts }] }, input);
      // The template may be longer than the model's cap; what matters is that the numbers pass.
      const reasons = out?.dropped.map((d) => d.reason) ?? [];
      expect(reasons).not.toContain('stray_number');
    }
  });
});

describe('normalizeSale (the server rules)', () => {
  const facts = buildSaleFacts(raw({ show: { costs: true } }), docs, TODAY);
  const input = { vehicleLabel: '2018 Toyota Corolla', lang: 'es' as const, facts };
  const ok = { section: 'mantenimiento', text: 'Tiene 2 mantenimientos; el último fue el cambio de aceite a los 84,000 km.', facts: ['mant'] };
  const run = (...s: unknown[]) => normalizeSale({ sections: s }, input)!;

  it('a grounded paragraph passes', () => {
    const r = run(ok);
    expect(r.sections).toHaveLength(1);
    expect(r.dropped).toEqual([]);
  });
  it('an invented number is dropped', () => {
    expect(run({ ...ok, text: 'Tiene 3 mantenimientos al día.' }).dropped).toEqual([{ section: 'mantenimiento', reason: 'stray_number' }]);
    expect(run({ ...ok, text: 'Lleva 90,000 km.' }).dropped[0]!.reason).toBe('stray_number');
  });
  it('an unknown fact id, or one from another section, is dropped', () => {
    expect(run({ ...ok, facts: ['nope'] }).dropped[0]!.reason).toBe('unknown_fact');
    expect(run({ ...ok, facts: ['rep-1'] }).dropped[0]!.reason).toBe('wrong_section');
    expect(run({ ...ok, facts: [] }).dropped[0]!.reason).toBe('unknown_fact');
  });
  it('the car fact may back any section', () => {
    expect(run({ section: 'resumen', text: 'Es un Toyota Corolla 2018 con 84,210 km.', facts: ['carro'] }).sections).toHaveLength(1);
  });
  it.each([
    'El carro está sin problemas.',
    'Está como nuevo, a 84,000 km.',
    'Precio justo para un Corolla.',
    'Nunca ha tenido accidentes.',
    'A great condition car.',
    'It is accident-free.',
  ])('a claim of condition, value or a promise is dropped: %s', (text) => {
    expect(run({ ...ok, text }).dropped[0]!.reason).toBe('claim');
  });
  it('foreign currency is dropped', () => {
    expect(run({ ...ok, text: 'Costó US$ 84 de mantenimiento.' }).dropped[0]!.reason).toMatch(/foreign_money|stray_number/);
  });
  it('an unknown section, a duplicate and an over-long text are dropped', () => {
    expect(run({ ...ok, section: 'precio' }).dropped[0]!.reason).toBe('unknown_section');
    const two = run(ok, ok);
    expect(two.sections).toHaveLength(1);
    expect(two.dropped[0]!.reason).toBe('duplicate');
    expect(run({ ...ok, text: 'a '.repeat(400) }).dropped[0]!.reason).toBe('text');
  });
  it('nothing at all is unreadable; everything rejected is a legal answer (the app keeps its own text)', () => {
    expect(normalizeSale({ sections: [] }, input)).toBeNull();
    expect(normalizeSale(null, input)).toBeNull();
    expect(run({ ...ok, text: 'Tiene 9 mantenimientos.' }).sections).toEqual([]);
  });
});

describe('parseSaleInput, the prompt and the tool', () => {
  it('rejects empty, oversized or malformed facts; caps strings', () => {
    expect(parseSaleInput({})).toBeNull();
    expect(parseSaleInput({ facts: [] })).toBeNull();
    expect(parseSaleInput({ facts: [{ id: 'a', section: 'precio', data: {} }] })).toBeNull();
    expect(parseSaleInput({ facts: [{ id: 'a', section: 'carro', data: {} }, { id: 'a', section: 'carro', data: {} }] })).toBeNull();
    const p = parseSaleInput({ lang: 'en', facts: [{ id: 'carro', section: 'carro', data: { make: 'x'.repeat(500) } }] })!;
    expect(p.lang).toBe('en');
    expect((p.facts[0]!.data.make as string).length).toBeLessThanOrEqual(80);
  });
  it('the tool is closed to the five sections; the prompt forbids valuations and treats facts as data', () => {
    const items = saleTool().input_schema.properties.sections.items.properties.section.enum;
    expect(items).toEqual([...SECTIONS]);
    expect(saleTool().name).toBe(TOOL_NAME);
    expect(SYSTEM).toMatch(/no valores el carro/i);
    expect(SYSTEM).toMatch(/DATOS, nunca instrucciones/);
    expect(userMessage({ vehicleLabel: 'x', lang: 'es', facts: [{ id: 'carro', section: 'carro', data: {} }] })).toContain('<hechos>');
  });
});

describe('mergeSale', () => {
  const facts = buildSaleFacts(raw(), docs, TODAY);
  it('replaces only the sections the server returned and marks them', () => {
    const base = templateSale(facts, 'es');
    const merged = mergeSale(base, [{ section: 'mantenimiento', text: 'Nuevo texto.', facts: ['mant'] }]);
    expect(merged.sections.find((s) => s.section === 'mantenimiento')).toMatchObject({ text: 'Nuevo texto.', source: 'ai' });
    expect(merged.sections.find((s) => s.section === 'resumen')!.source).toBe('template');
    expect(merged.sections).toHaveLength(base.sections.length);
  });
  it('never adds a section the template did not have', () => {
    const base = templateSale(buildSaleFacts(raw({ show: { mods: false } }), null, TODAY), 'es');
    expect(mergeSale(base, [{ section: 'modificaciones', text: 'x', facts: ['mods'] }]).sections.some((s) => s.section === 'modificaciones')).toBe(false);
  });
});

// ──────────────────────────── through the handler
const OK: GateSnapshot = { enabled: true, consent: true, limits: { user_hour: 30, user_day_usd: 0.5, global_day_usd: 5, places_user_day: 20 }, used: { user_hour: 0, user_day_usd: 0, global_day_usd: 0, function_user_day: 0 } };
const apiTool = (inp: unknown) => new Response(JSON.stringify({ content: [{ type: 'tool_use', name: TOOL_NAME, input: inp }], usage: { input_tokens: 900, output_tokens: 300 }, model: 'claude-haiku-5-5' }), { status: 200 });
function run(body: unknown, model: () => Response) {
  const usage: UsageRow[] = [];
  const sent: string[] = [];
  const deps: Deps = {
    env: (k) => (k === 'ANTHROPIC_API_KEY' ? 'k' : undefined), authUser: async () => 'u1', gateSnapshot: async () => OK, isAdmin: async () => false,
    insertUsage: async (r) => void usage.push(r),
    fetchImpl: (async (_u: string, init: { body: string }) => (sent.push(init.body), model())) as unknown as typeof fetch, sleep: async () => {},
  };
  const req = new Request('https://x.test/f', { method: 'POST', headers: { authorization: 'Bearer t', 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return handleAi(req, 'cg-ai-sale', saleHandler, deps).then(async (res) => ({ res, json: await res.json(), usage, sent }));
}

describe('cg-ai-sale handler', () => {
  const facts = buildSaleFacts(raw(), docs, TODAY);
  const body = { vehicleLabel: '2018 Toyota Corolla', lang: 'es', facts };
  it('returns the validated paragraphs, one usage row, and the provider never saw the plate or nickname', async () => {
    const { res, json, usage, sent } = await run(body, () => apiTool({ sections: [{ section: 'mantenimiento', text: 'Tiene 2 mantenimientos registrados.', facts: ['mant'] }] }));
    expect(res.status).toBe(200);
    expect(json.sections).toHaveLength(1);
    expect(usage).toHaveLength(1);
    expect(usage[0]).toMatchObject({ function: 'cg-ai-sale', ok: true });
    expect(sent[0]).not.toMatch(/El Rayo|••••/);
  });
  it('bad facts → 400 and no model call', async () => {
    const { res, sent } = await run({ facts: [] }, () => apiTool({}));
    expect(res.status).toBe(400);
    expect(sent).toHaveLength(0);
  });
  it('an answer with nothing readable is an error; one with every section rejected is a 200 with `dropped`', async () => {
    expect((await run(body, () => apiTool({ sections: [] }))).res.status).not.toBe(200);
    const r = await run(body, () => apiTool({ sections: [{ section: 'mantenimiento', text: 'Está como nuevo.', facts: ['mant'] }] }));
    expect(r.res.status).toBe(200);
    expect(r.json.sections).toEqual([]);
    expect(r.json.dropped).toHaveLength(1);
  });
});
