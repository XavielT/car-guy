import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { migrationV2 } from '@/lib/db/migrationV2';
import { SPEC_FIELDS } from '@/lib/domain/build';
import { formatPhone, normalizePhone, telLink, whatsappLink } from '@/lib/domain/contacts';
import { describe as describeDtc, lookup } from '@/lib/domain/dtc';
import { fluidForItem, isTirePressureItem } from '@/lib/domain/fluids';
import { applyPreset, FICHA_FIELDS, fichaText, presetsFor, SPEC_PRESETS } from '@/lib/domain/specPresets';
import { checkVin, decodeVin, mapVpic, vpicErrorCode } from '@/lib/domain/vpic';

const fixture = (name: string) => JSON.parse(readFileSync(join(__dirname, '..', 'fixtures', name), 'utf8'));

describe('presets', () => {
  // The specsheet's columns, read from migration v2's own DDL.
  const ddl = migrationV2().find((s) => s.includes('CREATE TABLE vehicle_specsheet'))!;
  const columns = new Set([...ddl.matchAll(/\b([a-z_0-9]+) (?:REAL|TEXT|INTEGER)\b/g)].map((m) => m[1]));

  it('every ficha field is a real specsheet column', () => {
    for (const f of FICHA_FIELDS) expect([f.key, columns.has(f.key)]).toEqual([f.key, true]);
  });
  it('every preset parses: known keys, typed values, the caveat and a source', () => {
    const numeric = new Set(FICHA_FIELDS.filter((f) => f.kind === 'number').map((f) => f.key));
    const stockKeys = new Set(SPEC_FIELDS.map((f) => f.key));
    expect(new Set(SPEC_PRESETS.map((p) => p.id)).size).toBe(SPEC_PRESETS.length);
    for (const p of SPEC_PRESETS) {
      expect(p.caveat).toBe('Verifica con el manual de tu carro');
      expect(p.sources.length).toBeGreaterThan(0);
      for (const [k, v] of Object.entries(p.values)) {
        expect([p.id, k, columns.has(k)]).toEqual([p.id, k, true]);
        expect([p.id, k, typeof v]).toEqual([p.id, k, numeric.has(k) ? 'number' : 'string']);
      }
      for (const k of Object.keys(p.stock ?? {})) expect([p.id, k, stockKeys.has(k)]).toEqual([p.id, k, true]);
    }
  });
  it('the seed ids exist', () => {
    expect(SPEC_PRESETS.map((p) => p.id)).toEqual(expect.arrayContaining(['ae85_3au', 'ds3_sa_ep6']));
  });
  it('matches by chassis + engine, then chassis, then make + model', () => {
    expect(presetsFor({ chassisCode: 'AE85', engineCode: '4A-GE 20V' }).map((p) => p.id).slice(0, 2)).toEqual(['ae85_3au', 'engine_4age20v']);
    expect(presetsFor({ chassisCode: 'S13', engineCode: 'SR20DET' })[0].id).toBe('s13_sr20det');
    expect(presetsFor({ make: 'Citroën', model: 'DS3' }).map((p) => p.id)).toEqual(expect.arrayContaining(['ds3_sa_ep6', 'ds3_sa_thp']));
    expect(presetsFor({ make: 'Tesla', model: 'Model 3' })).toEqual([]);
  });
  it('fills only empty fields and marks them PRESET', () => {
    const ds3 = SPEC_PRESETS.find((p) => p.id === 'ds3_sa_ep6')!;
    const out = applyPreset(ds3, { bolt_pattern: '4x108', fuel_tank_l: null, brake_fluid: 'DOT 5.1' }, { bolt_pattern: 'user', brake_fluid: 'user' });
    expect(out.values).toEqual({ center_bore_mm: 65.1, lug_thread: 'M12x1.25', fuel_tank_l: 50, oil_spec: 'PSA B71 2290' });
    expect(out.sources).toEqual({ bolt_pattern: 'user', brake_fluid: 'user', center_bore_mm: 'preset', lug_thread: 'preset', fuel_tank_l: 'preset', oil_spec: 'preset' });
  });
  it('the shop text is plain and carries the caveat', () => {
    const t = fichaText({ name: 'DS3', year: 2015, make: 'Citroën', model: 'DS3', engineCode: 'EP6' }, { bolt_pattern: '4x108', lug_torque_nm: 100, oil_grade: null }, [{ item: 'Tuercas de rueda', valueNm: 100 }]);
    expect(t).toBe(
      ['FICHA · DS3 · 2015 Citroën DS3', 'Motor: EP6', '', 'GOMAS Y AROS', '- Patrón de tornillos: 4x108', '- Apriete de tuercas: 100 Nm', '', 'TORQUES', '- Tuercas de rueda: 100 Nm', '', '(Verifica con el manual de tu carro)'].join('\n'),
    );
    expect(t).not.toMatch(/[|*#]/);
  });
});

describe('vPIC', () => {
  it('parses the leading integer of ErrorCode', () => {
    expect(vpicErrorCode('0 - VIN decoded clean')).toBe(0);
    expect(vpicErrorCode('1,7 - Check digit…')).toBe(1);
    expect(vpicErrorCode('')).toBeNull();
  });
  it('maps a recorded US decode', () => {
    expect(mapVpic(fixture('vpic-1HGCM82633A004352.json'))).toEqual({
      ok: true,
      decoded: { make: 'HONDA', model: 'Accord', year: 2003, cylinders: 6, displacementCc: 2999, fuel: 'Gasoline', transmission: 'automatica', drivetrain: null, engineModel: 'J30A4' },
    });
  });
  it('an EU VIN it cannot decode is an honest failure', () => {
    expect(mapVpic(fixture('vpic-eu-ds3.json'))).toMatchObject({ ok: false, reason: 'not_decoded' });
    expect(mapVpic({})).toEqual({ ok: false, reason: 'not_decoded' });
  });
  it('a timeout never throws', async () => {
    const hang = ((_: string, opts: { signal: AbortSignal }) =>
      new Promise((_r, reject) => opts.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))))) as unknown as typeof fetch;
    await expect(decodeVin('1HGCM82633A004352', hang, 20)).resolves.toEqual({ ok: false, reason: 'timeout' });
    const down = (async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    await expect(decodeVin('1HGCM82633A004352', down)).resolves.toEqual({ ok: false, reason: 'network' });
  });
  it('a JDM frame number is not a VIN', () => {
    expect(checkVin('AE85-5012345')).toEqual({ ok: false, reason: 'frame' });
    expect(checkVin('')).toEqual({ ok: false, reason: 'empty' });
    expect(checkVin('1HGCM82633A00435')).toEqual({ ok: false, reason: 'length' });
    expect(checkVin('1HGCM82633A00435O')).toEqual({ ok: false, reason: 'chars' });
    expect(checkVin(' 1hgcm82633a004352 ')).toEqual({ ok: true, vin: '1HGCM82633A004352' });
  });
});

describe('contacts', () => {
  it('normalises DR numbers with the country code', () => {
    expect(normalizePhone('(809) 555-1234')).toBe('18095551234');
    expect(normalizePhone('829.555.1234')).toBe('18295551234');
    expect(normalizePhone('+1 849 555 1234')).toBe('18495551234');
    expect(normalizePhone('555-12')).toBeNull();
  });
  it('builds WhatsApp and tel links', () => {
    expect(whatsappLink('809-555-1234')).toBe('https://wa.me/18095551234');
    expect(whatsappLink('809-555-1234', 'Hola, ¿tienes el filtro?')).toBe('https://wa.me/18095551234?text=Hola%2C%20%C2%BFtienes%20el%20filtro%3F');
    expect(telLink('8095551234')).toBe('tel:+18095551234');
    expect(whatsappLink('')).toBeNull();
    expect(formatPhone('8095551234')).toBe('(809) 555-1234');
  });
});

describe('dtc and fluids', () => {
  it('looks up P0301 in Spanish and flags manufacturer codes', () => {
    const d = lookup('p0301');
    expect(d?.code).toBe('P0301');
    expect(d?.descEs).toMatch(/cilindro 1/i);
    expect(d?.isGeneric).toBe(true);
    // Manufacturer range: the table's text is generic, so the screen adds the note.
    expect(lookup('P1300')?.isGeneric).toBe(false);
    expect(describeDtc('P1999')).toMatch(/fabricante/i);
  });
  it('maps check items to fluid cards', () => {
    expect(fluidForItem('Refrigerante')).toBe('coolant');
    expect(fluidForItem('Aceite de motor')).toBe('aceite');
    expect(fluidForItem('Líquido de frenos')).toBe('frenos');
    expect(fluidForItem('Luces')).toBeNull();
    expect(isTirePressureItem('Presión de gomas (incluida la de repuesto)')).toBe(true);
  });
});
