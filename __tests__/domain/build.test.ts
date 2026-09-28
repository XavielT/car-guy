import {
  cleanSpecs,
  currentSpecs,
  foreignToDop,
  formatSpec,
  investedByCategory,
  investedTotal,
  modBadge,
  modTotalDop,
  netInvested,
  parseTags,
  specValues,
  wishlistToModDraft,
  wishlistTotalDop,
} from '@/lib/domain/build';
import type { Mod, WishlistItem } from '@/lib/db/types';
import { compareSizes, dotAge, offsetDelta, parseTireSize, parseWheelSpec, revsPerKm, tireDiameterMm } from '@/lib/domain/tires';

const mod = (over: Partial<Mod>): Mod =>
  ({
    id: 'm',
    vehicleId: 'v',
    categoryId: 'otro',
    name: 'Mod',
    status: 'instalado',
    installedAt: null,
    costPartDop: 0,
    costLaborDop: 0,
    costShippingDop: 0,
    costCustomsDop: 0,
    affectsSpecs: true,
    specEffects: '{}',
    tags: '[]',
    soldPriceDop: null,
    serviceRecordId: null,
    ...over,
  }) as Mod;

// The AE85 seed (lib/dev/garage.ts).
const AE85_STOCK = { engine_code: '3A-U', wheel_f: '13x5', wheel_r: '13x5' };
const AE85_MODS = [
  mod({ id: 'dev_mod_swap', name: 'Swap 4A-GE 20V', installedAt: '2025-08-15T12:00:00.000Z', specEffects: JSON.stringify({ engine_code: '4A-GE 20V', hp: 160 }), tags: '["SWAP"]' }),
  mod({ id: 'dev_mod_ecu', name: 'ECU tuneada', installedAt: '2025-08-15T12:00:00.000Z', specEffects: JSON.stringify({ ecu: 'tuneada (pops and bangs)' }) }),
  mod({ id: 'dev_mod_aros', name: 'Aros 15x8 ET0', installedAt: '2025-03-01T12:00:00.000Z', specEffects: JSON.stringify({ wheel_f: '15x8 ET0', wheel_r: '15x8 ET0' }) }),
];

describe('currentSpecs — the AE85 seed', () => {
  const specs = currentSpecs(AE85_STOCK, AE85_MODS);
  it('derives 3A-U → 4A-GE 20V and 13x5 → 15x8 ET0 with the mod as source', () => {
    expect(specs.engine_code).toEqual({ value: '4A-GE 20V', stock: '3A-U', source: { kind: 'mod', modId: 'dev_mod_swap', modName: 'Swap 4A-GE 20V' } });
    expect(specs.wheel_f).toMatchObject({ value: '15x8 ET0', stock: '13x5', source: { kind: 'mod', modId: 'dev_mod_aros' } });
    expect(specs.hp).toMatchObject({ value: 160, stock: null });
  });
  it('a removed mod stops counting; the stock comes back', () => {
    const removed = currentSpecs(AE85_STOCK, AE85_MODS.map((m) => (m.id === 'dev_mod_aros' ? { ...m, status: 'quitado' as const } : m)));
    expect(removed.wheel_f).toEqual({ value: '13x5', stock: '13x5', source: { kind: 'stock' } });
  });
  it('a later mod beats an earlier one; an override beats both', () => {
    const later = mod({ id: 'm2', name: 'Aros 16', installedAt: '2026-01-01T12:00:00.000Z', specEffects: JSON.stringify({ wheel_f: '16x8 ET10' }) });
    expect(currentSpecs(AE85_STOCK, [...AE85_MODS, later]).wheel_f.value).toBe('16x8 ET10');
    const over = currentSpecs(AE85_STOCK, [...AE85_MODS, later], { wheel_f: '15x9 ET-5' });
    expect(over.wheel_f).toEqual({ value: '15x9 ET-5', stock: '13x5', source: { kind: 'override' } });
  });
  it('planned mods and mods that do not affect the ficha are ignored', () => {
    const planned = mod({ id: 'p', status: 'planeado', specEffects: JSON.stringify({ hp: 999 }) });
    const cosmetic = mod({ id: 'c', affectsSpecs: false, specEffects: JSON.stringify({ hp: 1 }) });
    expect(currentSpecs(AE85_STOCK, [...AE85_MODS, planned, cosmetic]).hp.value).toBe(160);
  });
  it('specValues flattens for a snapshot', () => {
    expect(specValues(specs)).toMatchObject({ engine_code: '4A-GE 20V', hp: 160, ecu: 'tuneada (pops and bangs)' });
  });
});

describe('cleanSpecs — the spec_effects contract', () => {
  it('keeps known keys, coerces numbers, drops unknown and empty', () => {
    expect(cleanSpecs({ hp: '160', engine_code: ' 4A-GE ', hpp: 5, ecu: '', torque_nm: 'mucho' })).toEqual({
      specs: { hp: 160, engine_code: '4A-GE' },
      dropped: ['hpp', 'torque_nm'],
    });
  });
  it('formatSpec', () => {
    expect(formatSpec('hp', 160)).toBe('160 hp');
    expect(formatSpec('engine_code', '4A-GE 20V')).toBe('4A-GE 20V');
    expect(formatSpec('ecu', null)).toBe('—');
  });
});

describe('money', () => {
  const mods = [
    mod({ categoryId: 'motor', costPartDop: 70000, costLaborDop: 15000 }),
    mod({ categoryId: 'enfriamiento', costPartDop: 12558, costShippingDop: 250, costCustomsDop: 6400, status: 'quitado' }),
    mod({ categoryId: 'ruedas', costPartDop: 64000, status: 'vendido', soldPriceDop: 40000 }),
    mod({ categoryId: 'suspension', costPartDop: 60000, status: 'planeado' }),
  ];
  it('modTotalDop is parts + labour + shipping + customs', () => expect(modTotalDop(mods[1])).toBe(19208));
  it('invested counts installed and removed, not planned', () => {
    expect(investedTotal(mods)).toBe(85000 + 19208 + 64000);
    expect(investedByCategory(mods)).toEqual({ motor: 85000, enfriamiento: 19208, ruedas: 64000 });
  });
  it('net subtracts what selling parts brought back', () => expect(netInvested(mods)).toBe(85000 + 19208 + 64000 - 40000));
  it('the FX helper: USD 210 × 59.8', () => {
    expect(foreignToDop(210, 59.8)).toBe(12558);
    expect(foreignToDop(210, null)).toBeNull();
    expect(foreignToDop(210, 0)).toBeNull();
  });
});

describe('wishlist', () => {
  const w = {
    id: 'dev_wish_coilovers',
    vehicleId: 'dev_ae85',
    categoryId: 'suspension',
    name: 'Coilovers BC Racing BR',
    brand: 'BC Racing',
    partNumber: 'BR-C12',
    priority: 1,
    estPriceForeign: 1050,
    currency: 'USD',
    estShippingDop: 3000,
    estCustomsDop: 12000,
    estTotalDop: null,
    url: 'https://example.com/bc',
    vendor: 'eBay',
    targetDate: null,
    status: 'ahorrando',
    convertedModId: null,
    notes: '',
  } as unknown as WishlistItem;
  it('landed estimate in RD$', () => expect(wishlistTotalDop(w, 60)).toBe(1050 * 60 + 3000 + 12000));
  it('converts to an installed mod draft carrying the estimate', () => {
    expect(wishlistToModDraft(w, 60)).toMatchObject({
      fromWishlistId: 'dev_wish_coilovers',
      name: 'Coilovers BC Racing BR',
      brand: 'BC Racing',
      partNumber: 'BR-C12',
      categoryId: 'suspension',
      vendor: 'eBay',
      vendorUrl: 'https://example.com/bc',
      status: 'instalado',
      priceForeign: 1050,
      currency: 'USD',
      fxRateToDop: 60,
      costPartDop: 63000,
      costShippingDop: 3000,
      costCustomsDop: 12000,
    });
  });
});

describe('tags', () => {
  it('reads tags and picks the first badge', () => {
    expect(parseTags('["SWAP","drift"]')).toEqual(['SWAP', 'drift']);
    expect(parseTags('nope')).toEqual([]);
    expect(modBadge(['pops and bangs', 'drift'])).toEqual({ label: 'DRIFT', tone: 'amber' });
    expect(modBadge(['nada'])).toBeNull();
  });
});

describe('tires', () => {
  it('parses modern, bias and old sizes; partial never throws', () => {
    expect(parseTireSize('195/50R15 82V')).toEqual({ width: 195, aspect: 50, aspectAssumed: false, construction: 'R', rim: 15, load: '82', speed: 'V' });
    expect(parseTireSize('195/50 ZR15')).toMatchObject({ construction: 'ZR', rim: 15, load: null });
    expect(parseTireSize('185/60-14')).toMatchObject({ width: 185, aspect: 60, construction: 'D', rim: 14 });
    expect(parseTireSize('165SR13')).toMatchObject({ width: 165, aspect: 82, aspectAssumed: true, speed: 'S', rim: 13 });
    expect(parseTireSize('205 algo')).toMatchObject({ width: 205, aspect: null, rim: null });
    expect(parseTireSize('')).toMatchObject({ width: null });
    expect(parseTireSize(null)).toMatchObject({ width: null });
  });
  it('diameter, revs and the speedo', () => {
    const stock = parseTireSize('165SR13');
    const now = parseTireSize('195/50R15');
    expect(tireDiameterMm(now)).toBeCloseTo(576, 0);
    expect(revsPerKm(now)).toBeCloseTo(552.6, 0);
    const cmp = compareSizes(stock, now)!;
    // 165/82R13 is 600.8 mm, 195/50R15 576 mm: 4 % smaller, so the speedo reads high.
    expect(cmp.diffPct).toBeCloseTo(-4.13, 1);
    expect(cmp.speedoErrorPct).toBeCloseTo(4.13, 1);
    expect(cmp.realAt100).toBeCloseTo(95.9, 1);
    expect(compareSizes(parseTireSize('205'), now)).toBeNull();
  });
  it('DOT age with the six-year flag', () => {
    const today = new Date(2026, 8, 28);
    const d = dotAge('DOT XXXX 2323', today);
    expect(d).toMatchObject({ week: 23, year: 2023, flag: false });
    expect('ageYears' in d! && d.ageYears).toBeCloseTo(3.3, 1);
    expect(dotAge('0419', today)).toMatchObject({ year: 2019, flag: true });
    expect(dotAge('238', today)).toEqual({ legacy: true, flag: true });
    expect(dotAge('9999', today)).toBeNull();
    expect(dotAge(null, today)).toBeNull();
  });
  it('offset delta and wheel specs', () => {
    // 13x5 ET+35 → 15x8 ET0: the face comes out 73 mm, the inside moves in 3 mm.
    expect(offsetDelta({ widthIn: 5, offsetMm: 35 }, { widthIn: 8, offsetMm: 0 })).toEqual({ pokeMm: 73, insetMm: 3 });
    expect(parseWheelSpec('15x8 ET0')).toEqual({ widthIn: 8, diamIn: 15, offsetMm: 0 });
    expect(parseWheelSpec('7Jx17 ET42')).toEqual({ widthIn: 7, diamIn: 17, offsetMm: 42 });
    expect(parseWheelSpec('15x9 -5')).toEqual({ widthIn: 9, diamIn: 15, offsetMm: -5 });
    expect(parseWheelSpec('')).toEqual({ widthIn: null, diamIn: null, offsetMm: null });
  });
});
