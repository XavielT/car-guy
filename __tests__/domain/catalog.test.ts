import { INSPECTION_TEMPLATES, SERVICE_TYPES } from '@/lib/domain/catalog';
import { addMonths, daysBetween, nextJanuary31 } from '@/lib/domain/dates';

/**
 * The catalog is seeded data whose ids become foreign keys in user rows on the
 * first install, so these tests guard the properties that would corrupt data if
 * they ever slipped: unique ids, and reminders that can actually come due.
 */

describe('SERVICE_TYPES', () => {
  it('has unique ids', () => {
    const ids = SERVICE_TYPES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every seeded reminder at least one interval to count from', () => {
    for (const type of SERVICE_TYPES) {
      if (type.seedReminder === false) continue;
      const hasInterval = type.km != null || type.months != null;
      expect(`${type.id}:${hasInterval}`).toBe(`${type.id}:true`);
    }
  });

  it('only seeds diesel-specific services for diesel', () => {
    const separator = SERVICE_TYPES.find((t) => t.id === 'separador_agua');
    expect(separator?.seedReminder).toBe('diesel');
    expect(separator?.appliesTo).toBe('diesel');
  });

  it('shortens the fuel filter interval for diesel', () => {
    const filter = SERVICE_TYPES.find((t) => t.id === 'filtro_combustible');
    expect(filter?.km).toBe(40000);
    expect(filter?.dieselOverride).toEqual({ km: 15000, months: 12 });
  });
});

describe('INSPECTION_TEMPLATES', () => {
  it('has unique template ids and non-empty item lists', () => {
    const ids = INSPECTION_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const template of INSPECTION_TEMPLATES) {
      expect(`${template.id}:${template.items.length > 0}`).toBe(`${template.id}:true`);
    }
  });

  it('marks the items that must only be checked cold', () => {
    const weekly = INSPECTION_TEMPLATES.find((t) => t.id === 'carro_semanal')!;
    const coolant = weekly.items.find((i) => i.label === 'Refrigerante')!;
    expect(coolant.coldEngine).toBe(true);
    // The incident this whole app came from — the wording has to stay explicit.
    expect(coolant.how).toContain('motor frío');
    expect(coolant.how).toContain('Nunca abras el tapón del radiador caliente');
  });

  it('covers the cadences the product promises', () => {
    const cadences = INSPECTION_TEMPLATES.map((t) => t.cadence);
    expect(cadences).toContain('diaria');
    expect(cadences).toContain('semanal');
    expect(cadences).toContain('mensual');
  });

  it('points failing items at a service type where one exists', () => {
    const weekly = INSPECTION_TEMPLATES.find((t) => t.id === 'carro_semanal')!;
    const serviceIds = new Set(SERVICE_TYPES.map((t) => t.id));
    for (const item of weekly.items) {
      if (!item.serviceTypeId) continue;
      expect(`${item.label}:${serviceIds.has(item.serviceTypeId)}`).toBe(`${item.label}:true`);
    }
  });
});

describe('dates', () => {
  it('clamps the day when adding months', () => {
    // 31 January + 1 month is February's last day, not 3 March.
    const jan31 = new Date(2026, 0, 31, 12).toISOString();
    expect(new Date(addMonths(jan31, 1)).getMonth()).toBe(1);
    expect(new Date(addMonths(jan31, 1)).getDate()).toBe(28);
  });

  it('counts whole days regardless of the time of day', () => {
    const a = new Date(2026, 0, 1, 12).toISOString();
    const b = new Date(2026, 0, 31, 12).toISOString();
    expect(daysBetween(a, b)).toBe(30);
    expect(daysBetween(b, a)).toBe(-30);
  });

  it('finds the marbete deadline, including on the day itself', () => {
    const dec = new Date(2026, 11, 1, 12).toISOString();
    expect(new Date(nextJanuary31(dec)).getFullYear()).toBe(2027);

    const onTheDay = new Date(2026, 0, 31, 12).toISOString();
    expect(new Date(nextJanuary31(onTheDay)).getFullYear()).toBe(2026);

    const february = new Date(2026, 1, 1, 12).toISOString();
    expect(new Date(nextJanuary31(february)).getFullYear()).toBe(2027);
  });
});
