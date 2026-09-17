import {
  countsOf,
  describeCounts,
  LegacyImportError,
  mapLegacy,
  unwrapLegacy,
} from '@/lib/import/tucombustible';

/**
 * jest-expo has no SQLite, so these exercise the pure mapping. The transactional
 * wrapper around it is verified by importing the real backup in the running app
 * and comparing counts (see the Phase 2 report).
 */

// Imported rather than read off disk: no node types in the app's tsconfig, and
// this way a malformed fixture fails the build instead of the test run.
import backup from '../../docs/imp-17092026/fixtures/tu-combustible-rd-backup.sample.json';

describe('unwrapLegacy', () => {
  it('accepts the wrapped v1 envelope', () => {
    expect(unwrapLegacy(backup).vehicles).toHaveLength(2);
  });

  it('accepts raw AppData, which older exports produced', () => {
    expect(unwrapLegacy(backup.data).fillups).toHaveLength(12);
  });

  it('rejects anything else with a message in Spanish', () => {
    expect(() => unwrapLegacy(null)).toThrow(LegacyImportError);
    expect(() => unwrapLegacy({ hello: 'world' })).toThrow(/no parece un respaldo/);
    expect(() => unwrapLegacy('{}')).toThrow(/no es un JSON válido|no parece un respaldo/);
  });

  it('tolerates a backup with only some collections', () => {
    const partial = unwrapLegacy({ vehicles: backup.data.vehicles });
    expect(partial.fillups).toEqual([]);
    expect(partial.reminders).toEqual([]);
  });
});

describe('mapLegacy', () => {
  const mapped = mapLegacy(backup);

  it('keeps every row and every id exactly as it was', () => {
    expect(mapped.vehicles).toHaveLength(2);
    expect(mapped.fuelLogs).toHaveLength(12);
    const ids = mapped.fuelLogs.map((f) => f.id);
    expect(ids).toEqual(backup.data.fillups.map((f: { id: string }) => f.id));
  });

  it('does not re-key the non-UUID legacy ids', () => {
    // Xaviel's real data is entirely of this shape, which is why the id columns
    // are TEXT and not uuid (ADR-03).
    const fallbackIds = mapped.fuelLogs.filter((f) => String(f.id).startsWith('id_'));
    expect(fallbackIds.length).toBeGreaterThan(0);
  });

  it('creates one odometer reading per fill-up, keyed off the source id', () => {
    const fromFuel = mapped.odometerReadings.filter((o) => o.source === 'fuel');
    expect(fromFuel).toHaveLength(12);
    expect(fromFuel[0].id).toBe(`odo_${mapped.fuelLogs[0].id}`);
    expect(fromFuel[0].valueKm).toBe(mapped.fuelLogs[0].odometerKm);
  });

  it('routes maintenance and repair to service records, the rest to expenses', () => {
    // The fixture has one maintenance, one repair, one insurance and one tax.
    expect(mapped.serviceRecords).toHaveLength(2);
    expect(mapped.serviceRecords.map((r) => r.kind).sort()).toEqual(['mantenimiento', 'reparacion']);
    expect(mapped.expenses).toHaveLength(2);
    expect(mapped.expenses.map((e) => e.category).sort()).toEqual(['impuesto', 'seguro']);
  });

  it('carries the legacy description into the service record title', () => {
    const oil = mapped.serviceRecords.find((r) => r.kind === 'mantenimiento')!;
    expect(oil.title).toContain('aceite');
    expect(oil.totalDop).toBe(4500);
  });

  it('gives a service record with an odometer its own reading', () => {
    const fromService = mapped.odometerReadings.filter((o) => o.source === 'service');
    // Only the maintenance and repair rows in the fixture carry an odometer.
    expect(fromService).toHaveLength(2);
  });

  it('derives the reminder metric from which fields are set', () => {
    const byTitle = Object.fromEntries(mapped.reminders.map((r) => [r.title, r]));
    expect(byTitle['Cambio de aceite'].metric).toBe('km');
    expect(byTitle['Marbete 2027'].metric).toBe('date');
    expect(byTitle['Rotación de gomas'].metric).toBe('both');
  });

  it('disables a reminder that was already completed', () => {
    const done = mapped.reminders.find((r) => r.title === 'Rotación de gomas')!;
    expect(done.isEnabled).toBe(false);
    expect(done.lastCompletedAt).toBeTruthy();

    const pending = mapped.reminders.find((r) => r.title === 'Cambio de aceite')!;
    expect(pending.isEnabled).toBe(true);
  });

  it('moves settings across under their new keys', () => {
    const keys = mapped.settings.map((s) => s.key);
    expect(keys).toContain('active_vehicle_id');
    expect(keys).toContain('reference_prices');
    expect(keys).toContain('price_week_label');
  });

  it('sets updated_at from the legacy createdAt, since v1 had no updatedAt', () => {
    for (const row of [...mapped.vehicles, ...mapped.fuelLogs, ...mapped.expenses]) {
      expect(row.updatedAt).toBe(row.createdAt);
    }
  });

  it('marks nothing as deleted', () => {
    const all = [...mapped.vehicles, ...mapped.fuelLogs, ...mapped.expenses, ...mapped.reminders];
    expect(all.every((r) => r.deletedAt === null)).toBe(true);
  });

  it('is deterministic — mapping twice gives the same rows', () => {
    expect(mapLegacy(backup)).toEqual(mapped);
  });
});

describe('counts', () => {
  it('matches the array lengths in the file', () => {
    const counts = countsOf(mapLegacy(backup));
    expect(counts.vehicles).toBe(backup.data.vehicles.length);
    expect(counts.fuelLogs).toBe(backup.data.fillups.length);
    expect(counts.serviceRecords + counts.expenses).toBe(backup.data.expenses.length);
    expect(counts.reminders).toBe(backup.data.reminders.length);
  });

  it('reads as a Spanish sentence', () => {
    expect(
      describeCounts({ vehicles: 1, fuelLogs: 4, serviceRecords: 0, expenses: 0, reminders: 0 }),
    ).toBe('1 vehículo, 4 cargas');
    expect(
      describeCounts({ vehicles: 2, fuelLogs: 12, serviceRecords: 2, expenses: 2, reminders: 3 }),
    ).toBe('2 vehículos, 12 cargas, 2 mantenimientos, 2 gastos, 3 recordatorios');
  });
});
