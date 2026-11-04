/** @jest-environment node */
/**
 * IMP 03112026 SPEC-C §C1 / PROMPT-03: the document and VIN-plate kinds of cg-ai-read, and the PRIVACY post-filter.
 * A fake model is used throughout: this proves what the SERVER lets out, whatever the model says.
 */
import type { Deps, UsageRow } from '../../supabase/functions/_shared/handler.ts';
import { handleAi } from '../../supabase/functions/_shared/handler.ts';
import type { GateSnapshot } from '../../supabase/functions/_shared/gate.ts';
import { KINDS, TOOL_NAME } from '../../supabase/functions/cg-ai-read/kinds.ts';
import { readHandler } from '../../supabase/functions/cg-ai-read/logic.ts';
import { filterField, looksLikeCedula, looksPersonal } from '../../supabase/functions/cg-ai-read/privacy.ts';

const f = (value: unknown, confidence: unknown = 0.9) => ({ value, confidence });
const none = { value: null, confidence: 0 };

const OK: GateSnapshot = {
  enabled: true, consent: true,
  limits: { user_hour: 30, user_day_usd: 0.5, global_day_usd: 5, places_user_day: 20 },
  used: { user_hour: 0, user_day_usd: 0, global_day_usd: 0, function_user_day: 0 },
};
const img = { data: 'A'.repeat(64), mime: 'image/jpeg' };
const apiTool = (input: unknown) =>
  new Response(JSON.stringify({ content: [{ type: 'tool_use', name: TOOL_NAME, input }], usage: { input_tokens: 1500, output_tokens: 200 }, model: 'claude-haiku-5-5' }), { status: 200 });

function run(body: unknown, model: () => Response) {
  const usage: UsageRow[] = [];
  const deps: Deps = {
    env: (n) => (n === 'ANTHROPIC_API_KEY' ? 'k' : undefined),
    authUser: async () => 'u1',
    gateSnapshot: async () => OK,
    isAdmin: async () => false,
    insertUsage: async (r) => void usage.push(r),
    fetchImpl: (async () => model()) as unknown as typeof fetch,
    sleep: async () => {},
  };
  const req = new Request('https://x.test/f', { method: 'POST', headers: { authorization: 'Bearer t', 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return handleAi(req, 'cg-ai-read', readHandler, deps).then(async (res) => ({ res, json: await res.json(), usage }));
}

/** Every field of `document` at null, then the overrides. */
const doc = (over: Record<string, unknown>) => ({ readable: true, ...Object.fromEntries(Object.keys(KINDS.document.fields).map((k) => [k, none])), ...over });

describe('privacy filter (pure)', () => {
  it.each(['001-1234567-8', '00112345678', '001 1234567 8', '001.1234567.8', 'Cédula 001-1234567-8', 'No. 40212345678 emitida'])('%j looks like a cédula', (s) => {
    expect(looksLikeCedula(s)).toBe(true);
  });
  it.each(['A123456', '1HGCM82633A004352', 'AE85-5012345', 'POL2024000123', '2026-11-02', '1234567890', '131234567'])('%j is not a cédula', (s) => {
    expect(looksLikeCedula(s)).toBe(false);
  });
  it.each(['Propietario: Juan Pérez', 'Titular Juan', 'Calle Duarte #5, Sector Los Prados', 'Av. 27 de Febrero', 'juan@mail.com', 'Teléfono 809-555-0147', 'Residencial Las Flores'])('%j reads as personal', (s) => {
    expect(looksPersonal(s)).toBe(true);
  });
  it.each(['Seguros Universal', 'Ley + daños a terceros', 'Toyota', 'Corolla', 'Gris plata', 'Centro de inspección Autopista', 'Batería 24 meses'])('%j is fine', (s) => {
    expect(looksPersonal(s)).toBe(false);
  });
  it('identifier fields only get the cédula rule; prose fields get both', () => {
    expect(filterField('policy_number', { value: 'AV-2024-77', confidence: 0.9 }).removed).toBe(false);
    expect(filterField('policy_number', { value: '00112345678', confidence: 0.9 }).removed).toBe(true);
    expect(filterField('insurer', { value: 'Calle Duarte 5', confidence: 0.9 }).removed).toBe(true);
  });
  it('numbers and nulls pass untouched', () => {
    expect(filterField('year', { value: 2019, confidence: 0.9 })).toEqual({ field: { value: 2019, confidence: 0.9 }, removed: false });
    expect(filterField('plate', { value: null, confidence: 0 }).removed).toBe(false);
  });
});

describe('cg-ai-read: documents', () => {
  it('a matrícula: vehicle and dates come back typed, nothing removed', async () => {
    const { res, json } = await run(
      { kind: 'document', images: [img] },
      () => apiTool(doc({ doc_kind: f('matricula'), plate: f('a 123456'), vin: f('ae85-5012345'), make: f('Toyota'), model: f('Corolla'), year: f(1986), color: f('Blanco'), issued_date: f('2021-03-15'), engine_cc: f(1587), fuel: f('gasolina'), seats: f(5) })),
    );
    expect(res.status).toBe(200);
    expect(json.fields).toMatchObject({ doc_kind: { value: 'matricula' }, plate: { value: 'A123456' }, vin: { value: 'AE85-5012345' }, year: { value: 1986 }, fuel: { value: 'gasolina' } });
    expect(json.privacy_removed).toBe(0);
  });

  it('A FIXTURE WITH A CÉDULA: cédula, owner and address never come back, only a COUNT of what was removed', async () => {
    const { res, json } = await run(
      { kind: 'doc_matricula', images: [img] },
      () =>
        apiTool(
          doc({
            doc_kind: f('matricula'),
            plate: f('A123456'),
            make: f('Toyota'),
            // what a careless model might put in a field that exists:
            doc_number: f('001-1234567-8'),
            color: f('Propietario: Juan Pérez'),
            model: f('Calle Duarte #5, Sector Los Prados'),
            // and fields that do not exist at all:
            cedula: f('001-1234567-8'),
            owner_name: f('Juan Pérez'),
            address: f('Calle Duarte #5'),
          }),
        ),
    );
    expect(res.status).toBe(200);
    const wire = JSON.stringify(json);
    for (const leak of ['001-1234567-8', '00112345678', 'Juan', 'Duarte', 'Prados', 'Propietario']) expect(wire).not.toContain(leak);
    expect(json.fields.plate.value).toBe('A123456');
    expect(json.fields.make.value).toBe('Toyota');
    expect(json.fields.doc_number.value).toBeNull();
    expect(json.privacy_removed).toBe(3);
    for (const k of ['cedula', 'owner_name', 'address', 'name', 'owner']) expect(json.fields[k]).toBeUndefined();
  });

  it('a seguro keeps insurer, policy, coverage, premium and the expiry (the reminder date)', async () => {
    const { json } = await run(
      { kind: 'doc_seguro', images: [img] },
      () => apiTool(doc({ doc_kind: f('seguro'), insurer: f('Seguros Universal'), policy_number: f('pol-2024-000123'), coverage_type: f('Ley + daños'), premium: f(18400), plate: f('A123456'), issued_date: f('2026-01-10'), expires_date: f('2027-01-10') })),
    );
    expect(json.fields).toMatchObject({ insurer: { value: 'Seguros Universal' }, policy_number: { value: 'POL2024000123' }, premium: { value: 18400 }, expires_date: { value: '2027-01-10' } });
    expect(json.privacy_removed).toBe(0);
  });

  it('no kind has a field for personal data, and the licence number is not extracted', () => {
    expect(Object.keys(KINDS.doc_licencia.fields)).not.toContain('license_number');
    expect(Object.keys(KINDS.document.fields)).not.toContain('license_number');
    const names = Object.values(KINDS).flatMap((k) => Object.keys(k.fields));
    for (const forbidden of ['cedula', 'name', 'owner', 'owner_name', 'holder', 'address', 'phone', 'email']) expect(names).not.toContain(forbidden);
  });

  it('every privacy kind forbids personal data in its prompt', () => {
    for (const id of ['document', 'doc_matricula', 'doc_seguro', 'doc_marbete', 'doc_licencia', 'doc_revision', 'doc_garantia', 'vin_plate']) {
      expect(KINDS[id].privacy).toBe(true);
      expect(KINDS[id].system).toMatch(/NUNCA devuelvas c[eé]dula/);
    }
  });

  it('if everything returned was personal, the read is unreadable (422), not an empty success', async () => {
    const { res, json } = await run({ kind: 'vin_plate', images: [img] }, () => apiTool({ readable: true, vin: f('00112345678'), make: f('Calle Duarte 5'), year: none, color: none }));
    expect(res.status).toBe(422);
    expect(json.error_code).toBe('unreadable');
  });

  it('vin_plate: a 17-character VIN and a JDM chassis pass the loose format; garbage does not', async () => {
    const ok = await run({ kind: 'vin_plate', images: [img] }, () => apiTool({ readable: true, vin: f('1hgcm82633a004352'), make: f('Honda'), year: f(2003), color: none }));
    expect(ok.json.fields.vin.value).toBe('1HGCM82633A004352');
    const jdm = await run({ kind: 'vin_plate', images: [img] }, () => apiTool({ readable: true, vin: f('AE85-5012345'), make: none, year: none, color: none }));
    expect(jdm.json.fields.vin.value).toBe('AE85-5012345');
    const bad = await run({ kind: 'vin_plate', images: [img] }, () => apiTool({ readable: true, vin: f('???'), make: f('Honda'), year: none, color: none }));
    expect(bad.json.fields.vin.value).toBeNull();
  });

  it('the filter is for documents only: an invoice keeps its (possibly 11-digit) RNC', async () => {
    const { json } = await run(
      { kind: 'invoice', images: [img] },
      () => apiTool({ readable: true, shop: f('Taller Díaz'), rnc: f('00112345678'), ncf: none, date: none, subtotal: none, itbis: none, total: f(500), warranty_text: none, items: [] }),
    );
    expect(json.fields.rnc.value).toBe('00112345678');
    expect(json.privacy_removed).toBeUndefined();
  });

  it('an unknown doc_kind from the model becomes null (the person picks), never a guess', async () => {
    const { json } = await run({ kind: 'document', images: [img] }, () => apiTool(doc({ doc_kind: f('pasaporte'), plate: f('A123456') })));
    expect(json.fields.doc_kind.value).toBeNull();
  });

  it('a document accepts up to three photos of the same paper, a fourth is refused before any model call', async () => {
    const three = await run({ kind: 'document', images: [img, img, img] }, () => apiTool(doc({ plate: f('A123456') })));
    expect(three.res.status).toBe(200);
    let called = 0;
    const four = await run({ kind: 'document', images: [img, img, img, img] }, () => (called++, apiTool(doc({}))));
    expect(four.res.status).toBe(400);
    expect(called).toBe(0);
  });
});
