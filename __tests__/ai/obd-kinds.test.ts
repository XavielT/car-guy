/** @jest-environment node */
/**
 * IMP 03112026 SPEC-D §D2/§D3: the `dash_lights` and `scanner` kinds of cg-ai-read. The model only NAMES lights from a closed
 * list and reads codes with a strict shape; everything else is the app's deterministic code.
 */
import type { Deps, UsageRow } from '../../supabase/functions/_shared/handler.ts';
import { handleAi } from '../../supabase/functions/_shared/handler.ts';
import type { GateSnapshot } from '../../supabase/functions/_shared/gate.ts';
import { KINDS, TOOL_NAME, normalizeRead, toolFor } from '../../supabase/functions/cg-ai-read/kinds.ts';
import { DASH_LIGHT_VALUES, LIGHT_COLOR_VALUES } from '../../supabase/functions/cg-ai-read/obdKinds.ts';
import { readHandler } from '../../supabase/functions/cg-ai-read/logic.ts';
import { DASH_LIGHTS, LIGHT_COLORS } from '@/lib/domain/dashLights';

const f = (value: unknown, confidence: unknown = 0.9) => ({ value, confidence });
const none = { value: null, confidence: 0 };

describe('the closed lists agree between the function and the app', () => {
  it('lights and colours are identical (a mismatch would drop a light on the floor)', () => {
    expect([...DASH_LIGHT_VALUES]).toEqual([...DASH_LIGHTS]);
    expect([...LIGHT_COLOR_VALUES]).toEqual([...LIGHT_COLORS]);
  });
});

describe('dash_lights', () => {
  it('the forced tool asks for a list of {light, color} and nothing that interprets', () => {
    const t = toolFor(KINDS.dash_lights) as { input_schema: { properties: Record<string, unknown>; required: string[] } };
    expect(t.input_schema.required).toEqual(['readable', 'items']);
    const items = t.input_schema.properties.items as { items: { properties: Record<string, unknown> } };
    expect(Object.keys(items.items.properties).sort()).toEqual(['color', 'light']);
    expect(KINDS.dash_lights.system).toMatch(/NO interpretes/);
  });

  it('keeps recognised lights, drops one the list does not know and one with no light', () => {
    const r = normalizeRead('dash_lights', {
      readable: true,
      items: [
        { light: f('check_engine'), color: f('amber', 0.8) },
        { light: f('oil_pressure'), color: f('red') },
        { light: f('turbo_boost'), color: f('red') },
        { light: none, color: f('red') },
        { light: f('abs'), color: f('purple') },
      ],
    })!;
    expect(r.items!.map((i) => [i.light.value, i.color.value])).toEqual([['check_engine', 'amber'], ['oil_pressure', 'red'], ['abs', null]]);
    expect(r.fields).toEqual({});
  });

  it('no lights at all is unreadable, not an empty success', () => {
    expect(normalizeRead('dash_lights', { readable: true, items: [] })).toBeNull();
    expect(normalizeRead('dash_lights', { readable: false })).toBeNull();
  });

  it('at most 8 lights', () => {
    const many = Array.from({ length: 20 }, () => ({ light: f('check_engine'), color: f('amber') }));
    expect(normalizeRead('dash_lights', { readable: true, items: many })!.items).toHaveLength(8);
  });
});

describe('scanner', () => {
  it('codes are cleaned and strictly shaped; anything else is dropped, never "fixed"', () => {
    const r = normalizeRead('scanner', {
      readable: true,
      rpm: f(2450), coolant_c: f(92), load_pct: f(35), speed_kmh: f(60),
      items: [{ code: f(' p0301 ') }, { code: f('P0420') }, { code: f('P03011') }, { code: f('XYZ') }, { code: f('U0100') }, { code: none }],
    })!;
    expect(r.items!.map((i) => i.code.value)).toEqual(['P0301', 'P0420', 'U0100']);
    expect(r.fields).toMatchObject({ rpm: { value: 2450 }, coolant_c: { value: 92 }, load_pct: { value: 35 }, speed_kmh: { value: 60 } });
  });
  it('out-of-range freeze-frame values become null', () => {
    const r = normalizeRead('scanner', { readable: true, rpm: f(99999), coolant_c: f(999), load_pct: f(250), speed_kmh: f(1000), items: [{ code: f('P0301') }] })!;
    expect(Object.values(r.fields).map((x) => x.value)).toEqual([null, null, null, null]);
  });
  it('freeze-frame values alone (no code) still count as a read', () => {
    expect(normalizeRead('scanner', { readable: true, rpm: f(800), coolant_c: none, load_pct: none, speed_kmh: none, items: [] })).not.toBeNull();
  });
});

// ─────────────────────────────── through the handler ───────────────────────────────
const OK: GateSnapshot = {
  enabled: true, consent: true,
  limits: { user_hour: 30, user_day_usd: 0.5, global_day_usd: 5, places_user_day: 20 },
  used: { user_hour: 0, user_day_usd: 0, global_day_usd: 0, function_user_day: 0 },
};
const img = { data: 'A'.repeat(64), mime: 'image/jpeg' };
const apiTool = (input: unknown) =>
  new Response(JSON.stringify({ content: [{ type: 'tool_use', name: TOOL_NAME, input }], usage: { input_tokens: 1500, output_tokens: 150 }, model: 'claude-haiku-5-5' }), { status: 200 });
function run(body: unknown, model: () => Response) {
  const usage: UsageRow[] = [];
  const deps: Deps = {
    env: (n) => (n === 'ANTHROPIC_API_KEY' ? 'k' : undefined), authUser: async () => 'u1', gateSnapshot: async () => OK, isAdmin: async () => false,
    insertUsage: async (r) => void usage.push(r), fetchImpl: (async () => model()) as unknown as typeof fetch, sleep: async () => {},
  };
  const req = new Request('https://x.test/f', { method: 'POST', headers: { authorization: 'Bearer t', 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return handleAi(req, 'cg-ai-read', readHandler, deps).then(async (res) => ({ res, json: await res.json(), usage }));
}

describe('cg-ai-read handler: OBD kinds', () => {
  it('a warning-light photo: typed items out, ONE vision call, no privacy count (not a personal document)', async () => {
    const { res, json, usage } = await run({ kind: 'dash_lights', images: [img] }, () => apiTool({ readable: true, items: [{ light: f('oil_pressure'), color: f('red') }] }));
    expect(res.status).toBe(200);
    expect(json.items).toHaveLength(1);
    expect(json.privacy_removed).toBeUndefined();
    expect(usage).toHaveLength(1);
  });
  it('a scanner screenshot accepts up to three screens', async () => {
    const three = await run({ kind: 'scanner', images: [img, img, img] }, () => apiTool({ readable: true, rpm: none, coolant_c: none, load_pct: none, speed_kmh: none, items: [{ code: f('P0420') }] }));
    expect(three.res.status).toBe(200);
    const four = await run({ kind: 'scanner', images: [img, img, img, img] }, () => apiTool({}));
    expect(four.res.status).toBe(400);
  });
});
