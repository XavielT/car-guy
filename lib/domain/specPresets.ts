/**
 * The ficha técnica (IMP 28092026, 01-data-model-v2.md §2.3, ADR-20).
 *
 * `FICHA_FIELDS` names every service-data column of `vehicle_specsheet` with
 * its section, label and unit — the screen, the presets and the shareable text
 * all read it. `SPEC_PRESETS` are starting points for the garage and common DR
 * cars.
 *
 * The rule for a preset (PROMPT-05): only values that are standard, widely
 * published platform data — bolt pattern, center bore, lug thread, brake fluid
 * type, tank size, engine code. Oil capacities, plug gaps and tire pressures
 * vary by year, market and trim, so they stay **null** rather than a
 * confident-looking guess; the user fills them from the manual or the door
 * sticker. Every preset carries the caveat, every value lands as PRESET (not
 * verified) until the user ticks it.
 */

export type FichaSection = 'motor' | 'fluidos' | 'electrico' | 'ruedas' | 'combustible';

export type FichaField = {
  key: string;
  label: string;
  section: FichaSection;
  kind: 'text' | 'number';
  unit?: string;
};

/** Every service-data column of vehicle_specsheet, in screen order. */
export const FICHA_FIELDS: FichaField[] = [
  { key: 'oil_grade', label: 'Aceite (grado)', section: 'motor', kind: 'text' },
  { key: 'oil_spec', label: 'Aceite (norma)', section: 'motor', kind: 'text' },
  { key: 'oil_capacity_l', label: 'Aceite sin filtro', section: 'motor', kind: 'number', unit: 'L' },
  { key: 'oil_capacity_filter_l', label: 'Aceite con filtro', section: 'motor', kind: 'number', unit: 'L' },
  { key: 'oil_filter_pn', label: 'Filtro de aceite', section: 'motor', kind: 'text' },
  { key: 'coolant_type', label: 'Refrigerante', section: 'fluidos', kind: 'text' },
  { key: 'coolant_capacity_l', label: 'Refrigerante (capacidad)', section: 'fluidos', kind: 'number', unit: 'L' },
  { key: 'trans_oil_spec', label: 'Aceite de caja', section: 'fluidos', kind: 'text' },
  { key: 'trans_oil_l', label: 'Aceite de caja (capacidad)', section: 'fluidos', kind: 'number', unit: 'L' },
  { key: 'diff_oil_spec', label: 'Aceite de diferencial', section: 'fluidos', kind: 'text' },
  { key: 'diff_oil_l', label: 'Diferencial (capacidad)', section: 'fluidos', kind: 'number', unit: 'L' },
  { key: 'brake_fluid', label: 'Líquido de frenos', section: 'fluidos', kind: 'text' },
  { key: 'ps_fluid', label: 'Líquido de dirección', section: 'fluidos', kind: 'text' },
  { key: 'spark_plug_pn', label: 'Bujías', section: 'electrico', kind: 'text' },
  { key: 'plug_gap_mm', label: 'Calibración de bujía', section: 'electrico', kind: 'number', unit: 'mm' },
  { key: 'battery_spec', label: 'Batería', section: 'electrico', kind: 'text' },
  { key: 'tire_size_oem_f', label: 'Gomas de fábrica delante', section: 'ruedas', kind: 'text' },
  { key: 'tire_size_oem_r', label: 'Gomas de fábrica detrás', section: 'ruedas', kind: 'text' },
  { key: 'psi_oem_f', label: 'Presión delante', section: 'ruedas', kind: 'number', unit: 'psi' },
  { key: 'psi_oem_r', label: 'Presión detrás', section: 'ruedas', kind: 'number', unit: 'psi' },
  { key: 'bolt_pattern', label: 'Patrón de tornillos', section: 'ruedas', kind: 'text' },
  { key: 'center_bore_mm', label: 'Centro del aro', section: 'ruedas', kind: 'number', unit: 'mm' },
  { key: 'lug_thread', label: 'Rosca de tuercas', section: 'ruedas', kind: 'text' },
  { key: 'lug_torque_nm', label: 'Apriete de tuercas', section: 'ruedas', kind: 'number', unit: 'Nm' },
  { key: 'fuel_tank_l', label: 'Tanque', section: 'combustible', kind: 'number', unit: 'L' },
  { key: 'fuel_octane', label: 'Octanaje', section: 'combustible', kind: 'number' },
];

export const FICHA_SECTIONS: { key: FichaSection; label: string }[] = [
  { key: 'motor', label: 'Motor' },
  { key: 'fluidos', label: 'Fluidos' },
  { key: 'electrico', label: 'Encendido y eléctrico' },
  { key: 'ruedas', label: 'Gomas y aros' },
  { key: 'combustible', label: 'Combustible' },
];

const FICHA_KEYS = new Set(FICHA_FIELDS.map((f) => f.key));

export type FichaValues = Partial<Record<string, string | number | null>>;

export type SpecPreset = {
  id: string;
  label: string;
  /** What the user types or the vehicle carries, lower-cased, for the picker's match. */
  match: { chassisCodes?: string[]; engineCodes?: string[]; makes?: string[]; models?: string[] };
  /** Service data (vehicle_specsheet columns). */
  values: FichaValues;
  /** Build-sheet stock values (lib/domain/build.ts SPEC_FIELDS keys), when the engine is certain. */
  stock?: { engine_code?: string; displacement_cc?: number };
  sources: string[];
  caveat: string;
};

const CAVEAT = 'Verifica con el manual de tu carro';

// Platform facts shared by several presets.
const TOYOTA_4x100 = { bolt_pattern: '4x100', center_bore_mm: 54.1, lug_thread: 'M12x1.5' };
const HONDA_4x100 = { bolt_pattern: '4x100', center_bore_mm: 56.1, lug_thread: 'M12x1.5' };
const PSA_4x108 = { bolt_pattern: '4x108', center_bore_mm: 65.1, lug_thread: 'M12x1.25', brake_fluid: 'DOT 4' };

export const SPEC_PRESETS: SpecPreset[] = [
  {
    id: 'ae85_3au',
    label: 'Toyota AE85 (3A-U)',
    match: { chassisCodes: ['ae85'], engineCodes: ['3a-u', '3au'] },
    values: { ...TOYOTA_4x100, lug_torque_nm: 103, brake_fluid: 'DOT 3', fuel_tank_l: 50 },
    stock: { engine_code: '3A-U', displacement_cc: 1452 },
    sources: ['Datos de plataforma AE85/AE86 (Toyota)'],
    caveat: CAVEAT,
  },
  {
    id: 'ae86_4age16',
    label: 'Toyota AE86 (4A-GE 16V)',
    match: { chassisCodes: ['ae86'], engineCodes: ['4a-ge 16v', '4age 16v'] },
    values: { ...TOYOTA_4x100, lug_torque_nm: 103, brake_fluid: 'DOT 3', fuel_tank_l: 50, tire_size_oem_f: '185/70R13', tire_size_oem_r: '185/70R13' },
    stock: { engine_code: '4A-GE 16V', displacement_cc: 1587 },
    sources: ['Datos de plataforma AE86 (Toyota)'],
    caveat: CAVEAT,
  },
  {
    id: 'engine_4age20v',
    label: 'Motor 4A-GE 20V (swap)',
    match: { engineCodes: ['4a-ge 20v', '4age 20v', '4age20v', 'blacktop', 'silvertop'] },
    // An engine preset: only the engine. The car keeps its own chassis data.
    values: {},
    stock: { engine_code: '4A-GE 20V', displacement_cc: 1587 },
    sources: ['Código de motor Toyota'],
    caveat: CAVEAT,
  },
  {
    id: 's13_sr20det',
    label: 'Nissan S13 (SR20DET)',
    match: { chassisCodes: ['s13', 'rps13', 'ps13'], engineCodes: ['sr20det', 'sr20'] },
    values: { bolt_pattern: '4x114.3', center_bore_mm: 66.1, lug_thread: 'M12x1.25', brake_fluid: 'DOT 3' },
    stock: { engine_code: 'SR20DET', displacement_cc: 1998 },
    sources: ['Datos de plataforma S13 (Nissan)'],
    caveat: CAVEAT,
  },
  {
    id: 's13_ka24de',
    label: 'Nissan S13 (KA24DE)',
    match: { chassisCodes: ['s13'], engineCodes: ['ka24de', 'ka24'] },
    values: { bolt_pattern: '4x114.3', center_bore_mm: 66.1, lug_thread: 'M12x1.25', brake_fluid: 'DOT 3' },
    stock: { engine_code: 'KA24DE', displacement_cc: 2389 },
    sources: ['Datos de plataforma S13 (Nissan)'],
    caveat: CAVEAT,
  },
  {
    id: 's14_sr20det',
    label: 'Nissan S14 (SR20DET)',
    match: { chassisCodes: ['s14'], engineCodes: ['sr20det'] },
    values: { bolt_pattern: '5x114.3', center_bore_mm: 66.1, lug_thread: 'M12x1.25', brake_fluid: 'DOT 3' },
    stock: { engine_code: 'SR20DET', displacement_cc: 1998 },
    sources: ['Datos de plataforma S14 (Nissan)'],
    caveat: CAVEAT,
  },
  {
    id: 'civic_eg_ek_d16',
    label: 'Honda Civic EG/EK (D16)',
    match: { chassisCodes: ['eg', 'ek', 'eg6', 'ek4', 'ek9'], engineCodes: ['d16', 'd16y8', 'd16z6', 'd16y7'] },
    values: { ...HONDA_4x100, lug_torque_nm: 108, brake_fluid: 'DOT 3', fuel_tank_l: 45 },
    stock: { engine_code: 'D16', displacement_cc: 1590 },
    sources: ['Datos de plataforma Civic EG/EK (Honda)'],
    caveat: CAVEAT,
  },
  {
    id: 'civic_eg_ek_b16',
    label: 'Honda Civic EG/EK (B16)',
    match: { chassisCodes: ['eg', 'ek', 'eg6', 'ek4', 'ek9'], engineCodes: ['b16', 'b16a', 'b16b'] },
    values: { ...HONDA_4x100, lug_torque_nm: 108, brake_fluid: 'DOT 3', fuel_tank_l: 45 },
    stock: { engine_code: 'B16', displacement_cc: 1595 },
    sources: ['Datos de plataforma Civic EG/EK (Honda)'],
    caveat: CAVEAT,
  },
  {
    id: 'c3_a51_tu5jp4',
    label: 'Citroën C3 (TU5JP4 1.6)',
    match: { chassisCodes: ['a51', 'fc'], engineCodes: ['tu5jp4', 'tu5'], makes: ['citroen', 'citroën'], models: ['c3'] },
    values: { ...PSA_4x108, fuel_tank_l: 47 },
    stock: { engine_code: 'TU5JP4', displacement_cc: 1587 },
    sources: ['Datos de plataforma PSA (C3 primera generación)'],
    caveat: CAVEAT,
  },
  {
    id: 'ds3_sa_ep6',
    label: 'Citroën DS3 (EP6 1.6 VTi)',
    match: { chassisCodes: ['sa'], engineCodes: ['ep6', 'ep6c', 'vti'], makes: ['citroen', 'citroën', 'ds'], models: ['ds3'] },
    values: { ...PSA_4x108, fuel_tank_l: 50, oil_spec: 'PSA B71 2290' },
    stock: { engine_code: 'EP6', displacement_cc: 1598 },
    sources: ['Datos de plataforma PSA (DS3)', 'Norma de aceite PSA para el EP6'],
    caveat: CAVEAT,
  },
  {
    id: 'ds3_sa_thp',
    label: 'Citroën DS3 (EP6 1.6 THP)',
    match: { chassisCodes: ['sa'], engineCodes: ['thp', 'ep6dt', 'ep6cdt'], makes: ['citroen', 'citroën', 'ds'], models: ['ds3'] },
    values: { ...PSA_4x108, fuel_tank_l: 50, oil_spec: 'PSA B71 2290' },
    stock: { engine_code: 'EP6 THP', displacement_cc: 1598 },
    sources: ['Datos de plataforma PSA (DS3)', 'Norma de aceite PSA para el EP6'],
    caveat: CAVEAT,
  },
  {
    id: 'corolla_e120',
    label: 'Toyota Corolla E120',
    match: { chassisCodes: ['e120', 'ze121', 'nze121'], makes: ['toyota'], models: ['corolla'] },
    values: { bolt_pattern: '5x100', center_bore_mm: 54.1, lug_thread: 'M12x1.5', lug_torque_nm: 103, brake_fluid: 'DOT 3' },
    sources: ['Datos de plataforma Corolla E120 (Toyota)'],
    caveat: CAVEAT,
  },
  {
    id: 'corolla_e150',
    label: 'Toyota Corolla E150',
    match: { chassisCodes: ['e150', 'zre151', 'zre152'], makes: ['toyota'], models: ['corolla'] },
    // The bolt pattern changed by market for this generation: left for the user.
    values: { lug_thread: 'M12x1.5', brake_fluid: 'DOT 3' },
    sources: ['Datos de plataforma Corolla E150 (Toyota)'],
    caveat: CAVEAT,
  },
  {
    id: 'hilux_n70',
    label: 'Toyota Hilux N70',
    match: { chassisCodes: ['n70', 'kun25', 'kun26', 'ggn25'], makes: ['toyota'], models: ['hilux'] },
    values: { bolt_pattern: '6x139.7', center_bore_mm: 106.1, lug_thread: 'M12x1.5', brake_fluid: 'DOT 3' },
    sources: ['Datos de plataforma Hilux N70 (Toyota)'],
    caveat: CAVEAT,
  },
  {
    id: 'yaris',
    label: 'Toyota Yaris',
    match: { makes: ['toyota'], models: ['yaris'] },
    values: { ...TOYOTA_4x100, lug_torque_nm: 103, brake_fluid: 'DOT 3' },
    sources: ['Datos de plataforma Yaris (Toyota)'],
    caveat: CAVEAT,
  },
];

const norm = (s: string | null | undefined) => (s ?? '').toLowerCase().trim();

/**
 * The presets that fit a vehicle, best first: chassis + engine, then chassis,
 * then engine, then make + model. The picker shows these on top and the rest
 * below — a swapped car wants its chassis preset *and* its engine preset.
 */
export function presetsFor(v: { chassisCode?: string | null; engineCode?: string | null; make?: string | null; model?: string | null }): SpecPreset[] {
  const chassis = norm(v.chassisCode);
  const engine = norm(v.engineCode);
  const make = norm(v.make);
  const model = norm(v.model);
  const scored = SPEC_PRESETS.map((p) => {
    let score = 0;
    if (chassis && p.match.chassisCodes?.some((c) => c === chassis)) score += 4;
    // Spaces and dashes do not matter ("4A-GE 20V" = "4age20v"); a family code matches its variants ("d16" ⊂ "d16y8").
    const squash = (x: string) => x.replace(/[\s-]/g, '');
    if (engine && p.match.engineCodes?.some((e) => squash(engine).includes(squash(e)))) score += 2;
    if (make && model && p.match.makes?.includes(make) && p.match.models?.some((m) => model.includes(m))) score += 1;
    return { p, score };
  });
  return scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score).map((s) => s.p);
}

/**
 * Applies a preset without overwriting what the user already has: only empty
 * fields take the preset's value, each marked `preset` in field_sources (and
 * not verified). Returns the columns to write and what changed.
 */
export function applyPreset(
  preset: SpecPreset,
  current: FichaValues,
  sources: Record<string, string>,
): { values: FichaValues; sources: Record<string, string>; filled: string[] } {
  const values: FichaValues = {};
  const nextSources = { ...sources };
  const filled: string[] = [];
  for (const [key, value] of Object.entries(preset.values)) {
    if (!FICHA_KEYS.has(key) || value == null) continue;
    const have = current[key];
    if (have != null && have !== '') continue;
    values[key] = value;
    nextSources[key] = 'preset';
    filled.push(key);
  }
  return { values, sources: nextSources, filled };
}

/** "4x100", "103 Nm", "—". */
export function formatFicha(key: string, value: string | number | null | undefined): string {
  if (value == null || value === '') return '—';
  const f = FICHA_FIELDS.find((x) => x.key === key);
  return f?.unit ? `${value} ${f.unit}` : String(value);
}

/**
 * "Ficha lista para el taller": a plain-text block that survives WhatsApp
 * (no tables, no markdown), only the fields with a value, and the caveat.
 */
export function fichaText(
  vehicle: { name: string; year?: number | null; make?: string | null; model?: string | null; chassisCode?: string | null; engineCode?: string | null; vin?: string | null; chassisNumber?: string | null },
  values: FichaValues,
  torques: { item: string; valueNm: number; stage?: string | null }[] = [],
): string {
  const head = [vehicle.name, [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ')].filter(Boolean).join(' · ');
  const ids = [
    vehicle.chassisCode ? `Chasis: ${vehicle.chassisCode}` : null,
    vehicle.engineCode ? `Motor: ${vehicle.engineCode}` : null,
    vehicle.vin ? `VIN: ${vehicle.vin}` : null,
    vehicle.chassisNumber ? `N.º de chasis: ${vehicle.chassisNumber}` : null,
  ].filter((x): x is string => Boolean(x));
  const lines: string[] = [`FICHA · ${head}`, ...ids];
  for (const s of FICHA_SECTIONS) {
    const rows = FICHA_FIELDS.filter((f) => f.section === s.key && values[f.key] != null && values[f.key] !== '');
    if (!rows.length) continue;
    lines.push('', s.label.toUpperCase());
    for (const f of rows) lines.push(`- ${f.label}: ${formatFicha(f.key, values[f.key])}`);
  }
  if (torques.length) {
    lines.push('', 'TORQUES');
    for (const t of torques) lines.push(`- ${t.item}: ${t.valueNm} Nm${t.stage ? ` (${t.stage})` : ''}`);
  }
  lines.push('', `(${CAVEAT})`);
  return lines.join('\n');
}
