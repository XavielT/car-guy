import { getDb } from './client';
import type { OilType } from './types';
import { normalizeOil, oilSummary, type OilFields } from '../domain/oil';

/**
 * Reads for the oil block (IMP 29092026 note 16). SQL lives in lib/db
 * (ADR-02); the history_feed view is left alone — Historial asks for the
 * oil lines of the rows it is showing with `oilSummaries`.
 */

type OilRow = {
  service_record_id: string;
  service_type_id: string;
  oil_viscosity: string | null;
  oil_type: string | null;
  oil_spec: string | null;
  oil_brand: string | null;
};

const HAS_OIL = `(i.oil_viscosity IS NOT NULL OR i.oil_type IS NOT NULL OR i.oil_spec IS NOT NULL OR i.oil_brand IS NOT NULL)`;

const toFields = (row: OilRow): OilFields =>
  normalizeOil({
    oilViscosity: row.oil_viscosity,
    oilType: row.oil_type as OilType | null,
    oilSpec: row.oil_spec,
    oilBrand: row.oil_brand,
  });

/**
 * The oil of the newest earlier record of this vehicle for the same service
 * item — "Igual que la última vez". `excludeRecordId` keeps a record being
 * edited from suggesting itself. Null when there is none.
 */
export async function lastOilFor(
  vehicleId: string,
  serviceTypeId: string,
  excludeRecordId?: string | null,
): Promise<OilFields | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<OilRow>(
    `SELECT i.service_record_id, i.service_type_id, i.oil_viscosity, i.oil_type, i.oil_spec, i.oil_brand
       FROM service_record_item i
       JOIN service_record r ON r.id = i.service_record_id
      WHERE r.vehicle_id = ? AND i.service_type_id = ? AND r.id <> ?
        AND i.deleted_at IS NULL AND r.deleted_at IS NULL AND ${HAS_OIL}
      ORDER BY r.occurred_at DESC, r.created_at DESC
      LIMIT 1`,
    [vehicleId, serviceTypeId, excludeRecordId ?? ''],
  );
  return row ? toFields(row) : null;
}

/**
 * record id → "5W-30 sintético · Castrol" for the records that have an oil
 * item. The engine oil wins when a record logged more than one oil.
 */
export async function oilSummaries(recordIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const ids = [...new Set(recordIds)];
  if (!ids.length) return out;
  const db = await getDb();
  const rows: OilRow[] = [];
  // SQLite's default limit is 999 bound parameters; Historial pages by 50.
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500);
    rows.push(
      ...(await db.getAllAsync<OilRow>(
        `SELECT i.service_record_id, i.service_type_id, i.oil_viscosity, i.oil_type, i.oil_spec, i.oil_brand
           FROM service_record_item i
          WHERE i.deleted_at IS NULL AND i.service_record_id IN (${chunk.map(() => '?').join(', ')}) AND ${HAS_OIL}
          ORDER BY CASE WHEN i.service_type_id = 'aceite_motor' THEN 0 ELSE 1 END, i.service_type_id`,
        chunk,
      )),
    );
  }
  for (const row of rows) {
    if (out.has(row.service_record_id)) continue;
    const line = oilSummary(toFields(row));
    if (line) out.set(row.service_record_id, line);
  }
  return out;
}
