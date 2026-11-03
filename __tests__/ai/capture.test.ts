/**
 * IMP 03112026 SPEC-B §B2/§B3/§B7: the pure client logic behind photo and voice capture: read result → form fields,
 * the deterministic sanity checks, the draft store, and intent → route (30 es-DO sentences, table-driven).
 */
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

import { DRAFT_TTL_MS, clearAiDraft, peekAiDraft, setAiDraft, takeAiDraft, withoutMark } from '@/lib/ai/draft';
import { fuelPrefillFrom, fuelTypeFromText, mergeFuelPrefills, toVehiclePrice, toVehicleVolume } from '@/lib/ai/fuelMap';
import { intentToRoute, needsVehicleChoice, type IntentResult } from '@/lib/ai/intentRoute';
import type { ReadResult } from '@/lib/ai/read';
import { OLD_DATE_DAYS, firstFlagByField, fuelSanity, MI_TO_KM, type SanityContext, type SanityInput } from '@/lib/domain/fuelSanity';

const fld = (value: string | number | null, confidence = 0.9) => ({ value, confidence });
const read = (kind: ReadResult['kind'], fields: Record<string, ReturnType<typeof fld>>): ReadResult => ({ ok: true, kind, fields, model: 'm' });

describe('fuelTypeFromText', () => {
  it.each([
    ['Gasolina Premium', 'premium'], ['PREMIUM', 'premium'], ['Gasolina Regular', 'regular'], ['regular', 'regular'], ['GASOLINA', 'regular'],
    ['Diesel Regular', 'gasoil_regular'], ['GASOIL ÓPTIMO', 'gasoil_optimo'], ['diesel optimo', 'gasoil_optimo'],
    ['GLP', 'glp'], ['Gas Natural', 'gnv'], ['', null], ['lavado', null], [null, null],
  ])('%j → %j', (text, want) => {
    expect(fuelTypeFromText(text as string | null)).toBe(want);
  });
});

describe('fuelPrefillFrom', () => {
  const receipt = read('fuel_receipt', {
    total: fld(2583), gallons: fld(7.51), unit_price: fld(343.8), product: fld('Gasolina Premium'), station: fld('Texaco'),
    date: fld('2026-10-30'), ncf: fld('B0200000123'),
  });
  it('fills the form strings and marks each AI field with its confidence', () => {
    const { prefill, marks } = fuelPrefillFrom(receipt);
    expect(prefill).toMatchObject({ vol: '7.51', price: '343.8', total: '2583', fuel: 'premium', station: 'Texaco', date: '2026-10-30', ncf: 'B0200000123' });
    expect(marks).toMatchObject({ vol: 0.9, price: 0.9, total: 0.9, fuel: 0.9, station: 0.9, date: 0.9 });
    expect(prefill.odo).toBeUndefined();
  });
  it('only fills what was read: null fields leave the form alone', () => {
    const { prefill, marks } = fuelPrefillFrom(read('fuel_receipt', { total: fld(1200), gallons: fld(null, 0), unit_price: fld(null, 0) }));
    expect(Object.keys(prefill)).toEqual(['total']);
    expect(Object.keys(marks)).toEqual(['total']);
  });
  it('a litre vehicle gets litres and RD$/litre (the receipt is in gallons)', () => {
    const { prefill } = fuelPrefillFrom(receipt, 'l');
    expect(Number(prefill.vol)).toBeCloseTo(7.51 * 3.785411784, 2);
    expect(Number(prefill.price)).toBeCloseTo(343.8 / 3.785411784, 2);
    expect(toVehicleVolume(10, 'gal')).toBe(10);
    expect(toVehiclePrice(100, 'gal')).toBe(100);
  });
  it('a dashboard: odometer, miles flag and the gauge hint', () => {
    const { prefill, marks } = fuelPrefillFrom(read('odometer', { odometer: fld(52830.4, 0.55), unit: fld('mi'), fuel_level: fld(0.25, 0.3) }));
    expect(prefill).toMatchObject({ odo: '52830', odoUnitMi: true, fuelLevel: 0.25 });
    expect(marks.odo).toBe(0.55);
  });
  it('the pump display is only the fallback for gallons and total', () => {
    const { prefill, marks } = fuelPrefillFrom(read('fuel_express', { pump_gallons: fld(8), pump_amount: fld(2750, 0.7) }));
    expect(prefill).toMatchObject({ vol: '8', total: '2750' });
    expect(marks.total).toBe(0.7);
    const both = fuelPrefillFrom(read('fuel_express', { gallons: fld(7.5), pump_gallons: fld(8) }));
    expect(both.prefill.vol).toBe('7.5');
  });
});

describe('mergeFuelPrefills — two photos, one object', () => {
  it('combines a receipt and a dashboard', () => {
    const a = fuelPrefillFrom(read('fuel_receipt', { total: fld(2583), gallons: fld(7.5), unit_price: fld(344.4) }));
    const b = fuelPrefillFrom(read('odometer', { odometer: fld(52830), unit: fld('km') }));
    const m = mergeFuelPrefills([a, b]);
    expect(m.prefill).toMatchObject({ total: '2583', vol: '7.5', price: '344.4', odo: '52830' });
  });
  it('a field read twice keeps the more confident reading', () => {
    const a = fuelPrefillFrom(read('fuel_receipt', { total: fld(2583, 0.5) }));
    const b = fuelPrefillFrom(read('fuel_express', { total: fld(2538, 0.95) }));
    expect(mergeFuelPrefills([a, b]).prefill.total).toBe('2538');
    expect(mergeFuelPrefills([b, a]).prefill.total).toBe('2538');
  });
});

describe('fuelSanity — deterministic, never a model opinion', () => {
  const ctx: SanityContext = { lastOdometerKm: 84300, tankVolume: 14, referencePrice: 340, today: '2026-11-03' };
  const ok: SanityInput = { odometerKm: 84830, volume: 7.5, pricePerUnit: 344, total: 2580, date: '2026-11-02' };
  it('a clean fill-up raises nothing', () => {
    expect(fuelSanity(ok, ctx)).toEqual([]);
  });
  it('odometer below the last reading', () => {
    const f = fuelSanity({ ...ok, odometerKm: 84030 }, ctx);
    expect(f).toEqual([{ code: 'odo_below_last', field: 'odo', detail: { last: 84300, read: 84030 } }]);
  });
  it('a dashboard in miles: offers the conversion, then checks the converted value', () => {
    const f = fuelSanity({ ...ok, odometerKm: 52000, odoUnitMi: true }, { ...ctx, lastOdometerKm: 80000 });
    expect(f[0]).toEqual({ code: 'odo_miles', field: 'odo', detail: { read: 52000, km: Math.round(52000 * MI_TO_KM) } });
    expect(f.some((x) => x.code === 'odo_below_last')).toBe(false); // 83,688 km ≥ 80,000
    const low = fuelSanity({ ...ok, odometerKm: 40000, odoUnitMi: true }, { ...ctx, lastOdometerKm: 80000 });
    expect(low.map((x) => x.code)).toEqual(['odo_miles', 'odo_below_last']);
  });
  it('gallons × price vs total: ≤ 3 % is rounding, above it asks', () => {
    expect(fuelSanity({ ...ok, total: 2580 * 1.029 }, ctx)).toEqual([]);
    const f = fuelSanity({ ...ok, total: 2580 * 1.05 }, ctx);
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ code: 'total_mismatch', field: 'total', detail: { expected: 2580 } });
  });
  it('dates: older than 7 days, or in the future', () => {
    expect(fuelSanity({ ...ok, date: '2026-10-27' }, ctx)).toEqual([]); // exactly 7 days
    expect(fuelSanity({ ...ok, date: '2026-10-26' }, ctx)[0]).toMatchObject({ code: 'date_old', detail: { days: OLD_DATE_DAYS + 1 } });
    expect(fuelSanity({ ...ok, date: '2026-11-05' }, ctx)[0]).toMatchObject({ code: 'date_future', detail: { days: 2 } });
  });
  it('more than the tank (5 % slack)', () => {
    expect(fuelSanity({ ...ok, volume: 14.5, total: 14.5 * 344 }, ctx)).toEqual([]);
    expect(fuelSanity({ ...ok, volume: 20, total: 20 * 344 }, ctx)[0]).toMatchObject({ code: 'vol_over_tank' });
  });
  it('an implausible unit price against the reference (a misread digit)', () => {
    const f = fuelSanity({ ...ok, pricePerUnit: 3438, total: 7.5 * 3438 }, ctx);
    expect(f[0]).toMatchObject({ code: 'price_band', detail: { price: 3438, reference: 340 } });
    expect(fuelSanity({ ...ok, pricePerUnit: 34.4, total: 7.5 * 34.4 }, ctx)[0].code).toBe('price_band');
  });
  it('no context, no flag: unknown tank / reference / last odometer never invent a problem', () => {
    expect(fuelSanity({ ...ok, odometerKm: 10, volume: 999, pricePerUnit: 9999, total: 999 * 9999 }, { lastOdometerKm: null, tankVolume: null, referencePrice: null, today: '2026-11-03' })).toEqual([]);
  });
  it('missing inputs are skipped, not failed', () => {
    expect(fuelSanity({ odometerKm: null, volume: null, pricePerUnit: null, total: null, date: null }, ctx)).toEqual([]);
  });
  it('firstFlagByField keeps one question per field', () => {
    const f = fuelSanity({ ...ok, odometerKm: 40000, odoUnitMi: true }, { ...ctx, lastOdometerKm: 80000 });
    expect(Object.keys(firstFlagByField(f))).toEqual(['odo']);
    expect(firstFlagByField(f).odo?.code).toBe('odo_miles');
  });
});

describe('draft store', () => {
  beforeEach(() => clearAiDraft());
  const base = { form: 'fuel' as const, prefill: { vol: '7' }, marks: { vol: 0.9 }, photos: [], source: 'photo' as const, vehicleId: 'v1' };
  it('set → peek keeps it, take consumes it once', () => {
    setAiDraft(base);
    expect(peekAiDraft('fuel')).not.toBeNull();
    expect(takeAiDraft('fuel')?.prefill).toEqual({ vol: '7' });
    expect(takeAiDraft('fuel')).toBeNull();
  });
  it('drafts are per form', () => {
    setAiDraft(base);
    expect(takeAiDraft('expense')).toBeNull();
    expect(peekAiDraft('fuel')).not.toBeNull();
  });
  it('a stale draft is not applied', () => {
    setAiDraft({ ...base, createdAt: 1000 });
    expect(takeAiDraft('fuel', 1000 + DRAFT_TTL_MS + 1)).toBeNull();
    expect(peekAiDraft('fuel')).toBeNull();
  });
  it('editing a field removes its mark and leaves the others', () => {
    expect(withoutMark({ vol: 0.9, total: 0.5 }, 'vol')).toEqual({ total: 0.5 });
    const same = { vol: 0.9 };
    expect(withoutMark(same, 'nothing')).toBe(same);
  });
});

// ------------------------------------------------------------------------------------- intent → route
const intent = (target: IntentResult['target'], fields: Record<string, ReturnType<typeof fld>> = {}, extra: Partial<IntentResult> = {}): IntentResult => ({
  ok: true, target, target_confidence: 0.95, fields, vehicle: null, choices: null, model: 'm', ...extra,
});
const href = (id: string) => ({ cifras: '/cifras', precios: '/precios', obd: '/obd', garaje: '/(tabs)/garaje' } as Record<string, string>)[id] ?? null;

type Case = [sentence: string, result: IntentResult, route: string, params: Record<string, string>, draftForm: string | null, expectPrefill?: Record<string, unknown>];
const CASES: Case[] = [
  ['eché 12 galones de premium a 2,150 en el Shell, 84,300 km', intent('fuel', { gallons: fld(12), unit_price: fld(2150), product: fld('premium'), station: fld('Shell'), odometer: fld(84300) }), '/carga/nueva', {}, 'fuel', { vol: '12', price: '2150', fuel: 'premium', station: 'Shell', odo: '84300' }],
  ['le eché 500 pesos de regular', intent('fuel', { total: fld(500), product: fld('regular') }), '/carga/nueva', {}, 'fuel', { total: '500', fuel: 'regular' }],
  ['llené el tanque de diesel, 3,100 pesos', intent('fuel', { total: fld(3100), product: fld('diesel') }), '/carga/nueva', {}, 'fuel', { total: '3100', fuel: 'gasoil_regular' }],
  ['cargué gasolina ayer en el Texaco', intent('fuel', { station: fld('Texaco'), date: fld('2026-11-02') }), '/carga/nueva', {}, 'fuel', { station: 'Texaco', date: '2026-11-02' }],
  ['eché 8 galones', intent('fuel', { gallons: fld(8) }), '/carga/nueva', {}, 'fuel', { vol: '8' }],
  ['cambié aceite y filtro con Taller Pérez, 3,800 pesos', intent('service', { title: fld('Aceite y filtro'), shop: fld('Taller Pérez'), total: fld(3800) }), '/servicio/nuevo', {}, 'service', { title: 'Aceite y filtro', shop: 'Taller Pérez', total: '3800' }],
  ['le hice el servicio de los 5,000 km', intent('service', { title: fld('Servicio de 5,000 km') }), '/servicio/nuevo', {}, 'service', { title: 'Servicio de 5,000 km' }],
  ['cambié las bujías hoy a los 84,300', intent('service', { title: fld('Bujías'), odometer: fld(84300) }), '/servicio/nuevo', {}, 'service', { title: 'Bujías', odometer: '84300' }],
  ['alineación y balanceo en la gomera de Juan por 1,500', intent('service', { title: fld('Alineación y balanceo'), shop: fld('gomera de Juan'), total: fld(1500) }), '/servicio/nuevo', {}, 'service', { shop: 'gomera de Juan' }],
  ['me pusieron los frenos nuevos en la gomera de Juan, 9 mil', intent('repair', { title: fld('Frenos nuevos'), shop: fld('gomera de Juan'), total: fld(9000), system: fld('frenos') }), '/servicio/nuevo', { kind: 'reparacion' }, 'repair', { total: '9000', system: 'frenos' }],
  ['cambié el alternador por 4,500', intent('repair', { title: fld('Alternador'), total: fld(4500) }), '/servicio/nuevo', { kind: 'reparacion' }, 'repair', { title: 'Alternador' }],
  ['arreglé la suspensión delantera', intent('repair', { description: fld('Suspensión delantera'), system: fld('suspensión') }), '/servicio/nuevo', { kind: 'reparacion' }, 'repair', { system: 'suspensión' }],
  ['pagué 200 de peaje', intent('expense', { category: fld('peaje'), total: fld(200) }), '/gasto/nuevo', {}, 'expense', { category: 'peaje', amount: '200' }],
  ['parqueo 150 pesos en la Zona Colonial', intent('expense', { category: fld('parqueo'), total: fld(150), description: fld('Zona Colonial') }), '/gasto/nuevo', {}, 'expense', { category: 'parqueo', amount: '150' }],
  ['lavé el carro, 400', intent('expense', { category: fld('lavado'), total: fld(400) }), '/gasto/nuevo', {}, 'expense', { category: 'lavado' }],
  ['pagué el seguro, 18,500', intent('expense', { category: fld('seguro'), total: fld(18500) }), '/gasto/nuevo', {}, 'expense', { amount: '18500' }],
  ['me pusieron una multa de 2,000', intent('expense', { category: fld('multa'), total: fld(2000) }), '/gasto/nuevo', {}, 'expense', { category: 'multa' }],
  ['pagué el marbete', intent('expense', { category: fld('marbete') }), '/gasto/nuevo', {}, 'expense', { category: 'marbete' }],
  ['el carro tiene 84,500 kilómetros', intent('odometer', { odometer: fld(84500) }), '/odometro', {}, 'odometer', { value: '84500' }],
  ['actualiza el kilometraje a 90 mil', intent('odometer', { odometer: fld(90000) }), '/odometro', {}, 'odometer', { value: '90000' }],
  ['recuérdame el marbete el 15 de diciembre', intent('reminder', { title: fld('Marbete'), due_date: fld('2026-12-15') }), '/recordatorio/nuevo', {}, 'reminder', { title: 'Marbete', dueDate: '2026-12-15' }],
  ['avísame cuando se venza el seguro', intent('reminder', { title: fld('Seguro') }), '/recordatorio/nuevo', {}, 'reminder', { title: 'Seguro' }],
  ['tengo que cambiar las gomas', intent('task', { title: fld('Cambiar las gomas') }), '/tarea/nueva', {}, 'task', { title: 'Cambiar las gomas' }],
  ['pendiente: revisar el aire acondicionado', intent('task', { description: fld('Revisar el aire acondicionado') }), '/tarea/nueva', {}, 'task', { title: 'Revisar el aire acondicionado' }],
  ['me chocaron en la Churchill', intent('event', { title: fld('Choque en la Churchill'), description: fld('Me chocaron en la Churchill') }), '/evento/nuevo', {}, 'event', { title: 'Choque en la Churchill' }],
  ['hoy cumplí un año con el carro', intent('event', { title: fld('Un año con el carro'), date: fld('2026-11-03') }), '/evento/nuevo', {}, 'event', { date: '2026-11-03' }],
  ['me salió el P0301', intent('obd', { dtc_code: fld('P0301') }), '/obd/[code]', { code: 'P0301' }, null],
  ['se prendió la luz del motor', intent('obd'), '/obd', {}, null],
  ['llévame a cifras', intent('navigate', { navigate_to: fld('cifras') }), '/cifras', {}, null],
  ['abre los precios de combustible', intent('navigate', { navigate_to: fld('precios') }), '/precios', {}, null],
];

describe('intentToRoute — 30 es-DO sentences', () => {
  it('has 30 cases', () => expect(CASES).toHaveLength(30));
  // Every row has 6 entries: a row with fewer makes Jest pass a `done` callback as the last argument and wait for it.
  it.each(CASES.map((c) => [c[0], c[1], c[2], c[3], c[4], c[5] ?? null] as const))('"%s"', (_sentence, result, route, params, draftForm, expectPrefill) => {
    const r = intentToRoute(result, { featureHref: href })!;
    expect(r.pathname).toBe(route);
    expect(r.params).toEqual(params);
    expect(r.draft?.form ?? null).toBe(draftForm);
    if (expectPrefill) expect(r.draft!.prefill).toMatchObject(expectPrefill);
    // every prefilled value is a string the form's inputs can hold; every mark is a confidence
    if (r.draft) {
      for (const [k, v] of Object.entries(r.draft.prefill)) expect([typeof v, k]).toEqual([expect.stringMatching(/string/), k]);
      for (const m of Object.values(r.draft.marks)) expect(m).toBeGreaterThanOrEqual(0);
    }
  });
  it('navigate to something the app did not list goes nowhere; an unknown target is null', () => {
    expect(intentToRoute(intent('navigate', { navigate_to: fld('admin') }), { featureHref: href })).toBeNull();
    expect(intentToRoute(intent('navigate'), { featureHref: href })).toBeNull();
    expect(intentToRoute({ ...intent('fuel'), target: 'chat' as never })).toBeNull();
  });
  it('a litre vehicle converts the spoken gallons', () => {
    const r = intentToRoute(intent('fuel', { gallons: fld(10), unit_price: fld(340) }), { volumeUnit: 'l' })!;
    expect(Number(r.draft!.prefill.vol)).toBeCloseTo(37.854, 2);
    expect(Number(r.draft!.prefill.price)).toBeCloseTo(89.82, 1);
  });
  it('several possible cars need a choice, one does not', () => {
    expect(needsVehicleChoice(intent('fuel', {}, { choices: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] }))).toBe(true);
    expect(needsVehicleChoice(intent('fuel', {}, { vehicle: { id: 'a', name: 'A' } }))).toBe(false);
  });
});
