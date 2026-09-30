/**
 * The seeded catalogue in English (ADR-39, Part A step 4): every seed has an
 * English entry, an untouched seed row reads in English, an edited row reads
 * as the user typed it, and Spanish stays Spanish.
 */
import { LAMP_SOURCES } from '@/lib/domain/garage';
import { SPEC_FIELDS, SPEC_GROUPS, specFieldLabel } from '@/lib/domain/build';
import { INSPECTION_TEMPLATES, LEGAL_REMINDERS, MOD_CATEGORIES, SERVICE_TYPES, VENUES } from '@/lib/domain/catalog';
import { describe as describeDtc, lookup } from '@/lib/domain/dtc';
import { FLUID_KINDS } from '@/lib/domain/fluids';
import { oilSummary, OIL_TYPE_LABEL } from '@/lib/domain/oil';
import { bodyTypes, colors, fluids, oil } from '@/lib/domain/refdata';
import { FICHA_FIELDS, FICHA_SECTIONS, fichaText, SPEC_PRESETS } from '@/lib/domain/specPresets';
import { describeChanges, diffSheets, SHEET_FIELDS } from '@/lib/domain/track';
import { statusBadgeLabel, VEHICLE_STATUSES } from '@/lib/domain/vehicleStatus';
import { __setLanguageForTests } from '@/lib/i18n';
import { CATALOG_EN, catalogLabel, catalogText, dtcText, refLabel, refNote, seedSpanish } from '@/lib/i18n/catalog';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: async () => null, setItem: async () => {} },
}));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'es' }] }));

afterEach(() => __setLanguageForTests('es'));

/** Proper nouns and brand/standard names that are the same in both languages. */
const PROPER = /Autódromo de las Américas|Santo Domingo Este|Citroën/g;
/** The same small Spanish-word test as tools/i18n-literals.mjs. */
const SPANISH = /[áéíóúñ¿¡]|\b(el|la|los|las|del|para|con|una|que|por|sin|tu|tus|más|carga|gomas|vehículo|guardar|borrar|usada|nuevo|nueva|revisar|aceite|motor|frenos|chequeo|otro)\b/i;
const looksSpanish = (s: string) => SPANISH.test(s.replace(PROPER, ''));

const en = (kind: string, id: string, field: string) => CATALOG_EN[kind]?.[id]?.[field];

describe('every seed has English', () => {
  // Each check: [kind, id, field, spanish]. A seed added without an English entry fails here.
  const cases: [string, string, string, string][] = [];
  for (const s of SERVICE_TYPES) {
    cases.push(['serviceType', s.id, 'name', s.name]);
    if (s.notes) cases.push(['serviceType', s.id, 'notes', s.notes]);
  }
  for (const r of LEGAL_REMINDERS) {
    cases.push(['legalReminder', r.kind, 'title', r.title]);
    cases.push(['legalReminder', r.kind, 'notes', r.notes]);
  }
  for (const tpl of INSPECTION_TEMPLATES) {
    cases.push(['inspectionTemplate', tpl.id, 'name', tpl.name]);
    tpl.items.forEach((item, i) => {
      const id = `${tpl.id}__${i}`;
      cases.push(['checkItem', id, 'groupName', item.group], ['checkItem', id, 'label', item.label], ['checkItem', id, 'how', item.how]);
      if (item.warning) cases.push(['checkItem', id, 'warning', item.warning]);
    });
  }
  for (const c of MOD_CATEGORIES) cases.push(['modCategory', c.id, 'name', c.name]);
  for (const v of VENUES) cases.push(['venue', v.id, 'name', v.name], ['venue', v.id, 'city', v.city]);
  for (const f of FLUID_KINDS) cases.push(['fluid', f.kind, 'label', f.label], ['fluid', f.kind, 'how', f.how]);
  for (const f of FICHA_FIELDS) cases.push(['fichaField', f.key, 'label', f.label]);
  for (const s of FICHA_SECTIONS) cases.push(['fichaSection', s.key, 'label', s.label]);
  for (const p of SPEC_PRESETS) cases.push(['specPreset', p.id, 'sources', p.sources.join(' · ')]);
  for (const f of SPEC_FIELDS) {
    cases.push(['specField', f.key, 'label', f.label]);
    if (f.headline) cases.push(['specField', f.key, 'headline', f.headline]);
  }
  for (const g of SPEC_GROUPS) cases.push(['specGroup', g.key, 'label', g.label]);
  for (const f of SHEET_FIELDS) cases.push(['sheetField', f.key, 'label', f.label]);
  for (const [k, v] of Object.entries(OIL_TYPE_LABEL)) cases.push(['oilType', k, 'label', v]);
  for (const l of LAMP_SOURCES) cases.push(['lamp', l.icon, 'label', l.label]);
  for (const s of VEHICLE_STATUSES) {
    const es = statusBadgeLabel(s);
    if (es && es !== 'EX') cases.push(['statusBadge', s, 'label', es]);
  }

  it.each(cases)('%s %s .%s', (kind, id, field, spanish) => {
    const text = en(kind, id, field);
    expect(typeof text).toBe('string');
    expect(text!.trim()).not.toBe('');
    expect(looksSpanish(text!)).toBe(false);
    // Either it was translated or it is a name that reads the same in both.
    if (text === spanish) expect(looksSpanish(spanish)).toBe(false);
  });

  it('presets with a Spanish label have an English one', () => {
    for (const p of SPEC_PRESETS) if (looksSpanish(p.label)) expect(en('specPreset', p.id, 'label')).toBeTruthy();
  });

  it('no stray entries: every English key is a seed', () => {
    const seeds = seedSpanish();
    for (const id of Object.keys(CATALOG_EN.checkItem)) expect(seeds.checkItem[id]).toBeDefined();
    for (const id of Object.keys(CATALOG_EN.serviceType)) expect(seeds.serviceType[id]).toBeDefined();
    for (const id of Object.keys(CATALOG_EN.modCategory)) expect(seeds.modCategory[id]).toBeDefined();
    for (const id of Object.keys(CATALOG_EN.inspectionTemplate)) expect(seeds.inspectionTemplate[id]).toBeDefined();
  });

  it('no English entry is left in Spanish anywhere in the file', () => {
    const walk = (v: unknown, path: string): void => {
      if (typeof v === 'string') {
        if (looksSpanish(v)) throw new Error(`${path}: ${v}`);
      } else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`);
    };
    expect(() => walk(CATALOG_EN, 'en')).not.toThrow();
  });

  it('every refdata item has an `en` label (and `noteEn` when it has a note), not Spanish', () => {
    const items = [
      ...bodyTypes(),
      ...(['exterior', 'interior', 'material', 'finish'] as const).flatMap((k) => colors(k)),
      ...(['grade', 'type', 'flag', 'spec', 'brand'] as const).flatMap((k) => oil(k)),
      ...(['atf', 'cvt', 'gear', 'coolant', 'coolant-mix', 'brake', 'steering'] as const).flatMap((k) => fluids(k)),
    ];
    expect(items.length).toBeGreaterThan(150);
    for (const item of items) {
      expect(item.en).toBeTruthy();
      expect(looksSpanish(item.en)).toBe(false);
      const note = (item as { note?: string; noteEn?: string }).note;
      if (note) expect(looksSpanish((item as { noteEn?: string }).noteEn ?? 'falta')).toBe(false);
    }
  });
});

describe('catalogLabel', () => {
  const oilType = { id: 'aceite_motor', name: 'Aceite de motor y filtro' };

  it('English for an untouched seed row', () => {
    __setLanguageForTests('en');
    expect(catalogLabel('serviceType', oilType)).toBe('Engine oil and filter');
    expect(catalogLabel('modCategory', { id: 'forzada', name: 'Inducción forzada' })).toBe('Forced induction');
    expect(catalogLabel('inspectionTemplate', { id: 'carro_semanal', name: 'Chequeo semanal' })).toBe('Weekly check');
  });

  it("the user's value for an edited row, in either language", () => {
    __setLanguageForTests('en');
    expect(catalogLabel('serviceType', { id: 'aceite_motor', name: 'Aceite Mobil 1 (mío)' })).toBe('Aceite Mobil 1 (mío)');
    expect(catalogLabel('serviceType', { id: 'uuid-1234', name: 'Aceite de motor y filtro' })).toBe('Aceite de motor y filtro');
    __setLanguageForTests('es');
    expect(catalogLabel('serviceType', { id: 'aceite_motor', name: 'Aceite Mobil 1 (mío)' })).toBe('Aceite Mobil 1 (mío)');
  });

  it('Spanish in Spanish', () => {
    expect(catalogLabel('serviceType', oilType)).toBe('Aceite de motor y filtro');
    expect(catalogLabel('checkItem', { id: 'carro_diario__0', label: 'Fugas debajo del carro' }, 'label')).toBe('Fugas debajo del carro');
  });

  it("check items, including a vehicle's own copy, field by field", () => {
    __setLanguageForTests('en');
    const item = { id: 'carro_semanal__0@veh-1', groupName: 'Fluidos', label: 'Refrigerante', how: 'lo edité', warning: '' };
    expect(catalogLabel('checkItem', item, 'label')).toBe('Coolant');
    expect(catalogLabel('checkItem', item, 'groupName')).toBe('Fluids');
    expect(catalogLabel('checkItem', item, 'how')).toBe('lo edité');
    expect(catalogLabel('checkItem', item, 'warning')).toBe('');
    expect(catalogLabel('inspectionTemplate', { id: 'carro_diario@veh-1', name: 'Chequeo diario' })).toBe('Daily check');
  });

  it('seeded reminders by service type or legal kind; a user-titled one stays', () => {
    __setLanguageForTests('en');
    const seeded = { id: 'r1', serviceTypeId: 'bateria', legalKind: null, title: 'Batería', notes: 'Con este calor, 2–3 años es lo típico' };
    expect(catalogLabel('reminder', seeded, 'title')).toBe('Battery');
    expect(catalogLabel('reminder', seeded, 'notes')).toBe('In this heat, 2–3 years is typical');
    expect(catalogLabel('reminder', { id: 'r2', serviceTypeId: null, legalKind: 'marbete', title: 'Marbete', notes: 'La ventana abre a finales de octubre y cierra el 31 de enero.' }, 'notes')).toMatch(/January 31/);
    expect(catalogLabel('reminder', { id: 'r3', serviceTypeId: 'bateria', legalKind: null, title: 'Revisar batería y bornes' }, 'title')).toBe('Revisar batería y bornes');
  });

  it('null row → empty string', () => {
    expect(catalogLabel('serviceType', null)).toBe('');
  });
});

describe('in-code constants', () => {
  it('catalogText and the domain helpers follow the language', () => {
    expect(catalogText('lamp', 'oil', 'label', 'Aceite')).toBe('Aceite');
    expect(specFieldLabel(SPEC_FIELDS[0])).toBe('Motor');
    expect(statusBadgeLabel('en_taller')).toBe('EN TALLER');
    __setLanguageForTests('en');
    expect(catalogText('lamp', 'oil', 'label', 'Aceite')).toBe('Oil');
    expect(catalogText('lamp', 'nope', 'label', 'Algo')).toBe('Algo');
    expect(specFieldLabel(SPEC_FIELDS[0])).toBe('Engine');
    expect(statusBadgeLabel('en_taller')).toBe('IN THE SHOP');
    expect(statusBadgeLabel('vendido')).toBe('EX');
    expect(statusBadgeLabel('activo')).toBeNull();
    expect(oilSummary({ oilViscosity: '5W-30', oilType: 'sintetico' })).toBe('5W-30 synthetic');
  });

  it('the setup-sheet note and the ficha text', () => {
    __setLanguageForTests('en');
    const changes = () => diffSheets({ psiColdRl: 40, psiColdRr: 40, hydro: false }, { psiColdRl: 42, psiColdRr: 42, hydro: true });
    expect(describeChanges(changes())).toEqual(['RL/RR 40 → 42', 'Hydraulic handbrake no → yes']);
    const text = fichaText({ name: 'AE86', chassisCode: 'AE86' }, { bolt_pattern: '4x100' });
    expect(text).toContain('SPEC SHEET · AE86');
    expect(text).toContain('Chassis: AE86');
    expect(text).toContain('TIRES AND WHEELS');
    expect(text).toContain('- Bolt pattern: 4x100');
    __setLanguageForTests('es');
    expect(describeChanges(changes())).toEqual(['TI/TD 40 → 42', 'Freno de mano hidráulico no → sí']);
  });
});

describe('refLabel', () => {
  const white = colors('exterior').find((c) => c.id === 'blanco')!;
  it('Spanish in Spanish, English in English', () => {
    expect(refLabel(white)).toBe('Blanco');
    __setLanguageForTests('en');
    expect(refLabel(white)).toBe('White');
    expect(refLabel({ es: 'Algo' })).toBe('Algo');
  });
  it('notes too', () => {
    const iat = fluids('coolant').find((f) => f.id === 'iat')!;
    expect(refNote(iat)).toBe('Suele ser verde');
    __setLanguageForTests('en');
    expect(refNote(iat)).toBe('Usually green');
    expect(refNote({})).toBeNull();
  });
});

describe('DTC', () => {
  it("English reads the table's original wording; the generic messages translate", () => {
    const row = lookup('P0301')!;
    expect(dtcText(row)).toBe(row.descEs);
    expect(describeDtc('P1999')).toBe('Código específico del fabricante');
    __setLanguageForTests('en');
    expect(dtcText(row)).toBe(row.descEn);
    expect(describeDtc('P0301')).toBe(row.descEn);
    expect(describeDtc('P1999')).toBe('Manufacturer-specific code');
    expect(describeDtc('P0999')).toBe(lookup('P0999') ? lookup('P0999')!.descEn : 'Code not in the table');
    expect(dtcText({ descEs: 'Falla', descEn: '' })).toBe('Falla (description in Spanish)');
    expect(dtcText(null)).toBeNull();
  });
});
