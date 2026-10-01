import { enqueue, getDb, now } from './client';
import { fuelPrices } from './repos';
import type { FuelPrice, FuelPriceRef } from './types';
import { currentBoard, parseWeekLabel, referencePricesFromBoard, type BoardEntry, type FuelPriceRefRow, type FuelPriceRow } from '../domain/fuelPrices';
import { id as newId } from '../format';
import type { ReferencePrices, Settings } from '../types';

/**
 * Fuel prices since v8 (note 1): the person's own rows in `fuel_price`, the
 * MICM cache in `fuel_price_ref`, and the board that picks the newest of each.
 * The store still hands screens `settings.referencePrices` / `priceWeekLabel`
 * (the 2.0 shape), now derived from the board.
 */

export async function listFuelPriceRefs(): Promise<FuelPriceRef[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Record<string, unknown>>('SELECT * FROM fuel_price_ref ORDER BY week_start DESC');
  return rows.map((r) => ({
    id: r.id as string,
    fuelType: r.fuel_type as string,
    price: r.price as number,
    weekStart: r.week_start as string,
    weekEnd: r.week_end as string,
    pdfUrl: (r.pdf_url as string | null) ?? null,
    importedAt: r.imported_at as string,
    stale: r.stale === 1,
  }));
}

export async function priceBoard(): Promise<BoardEntry[]> {
  const [own, refs] = await Promise.all([fuelPrices.list(), listFuelPriceRefs()]);
  return currentBoard(own as unknown as FuelPriceRow[], refs as unknown as FuelPriceRefRow[]);
}

/** The board in the store's 2.0 shape. */
export async function referencePricesNow(): Promise<Pick<Settings, 'referencePrices' | 'priceWeekLabel'>> {
  return referencePricesFromBoard(await priceBoard());
}

/**
 * What "Precios de referencia" saves: one `fuel_price` row per fuel whose price
 * changed — every fuel when the week label changed — dated by the label and
 * keeping it in the note. A second save for the same fuel and date edits that
 * row instead of stacking another.
 */
export async function savePriceBoard(prices: ReferencePrices, label: string, previous: Pick<Settings, 'referencePrices' | 'priceWeekLabel'>): Promise<number> {
  const validFrom = parseWeekLabel(label);
  const labelChanged = label !== previous.priceWeekLabel;
  const own = (await fuelPrices.list()) as FuelPrice[];
  let written = 0;
  await enqueue(async (db) => {
    for (const [fuelType, price] of Object.entries(prices)) {
      if (!Number.isFinite(price) || price <= 0) continue;
      const before = previous.referencePrices[fuelType as keyof ReferencePrices];
      if (!labelChanged && before === price) continue;
      const same = own.find((r) => r.fuelType === fuelType && r.validFrom === validFrom && !r.deletedAt);
      const stamp = now();
      await fuelPrices.upsert(
        {
          id: same?.id ?? newId(),
          fuelType,
          price,
          validFrom,
          source: same?.source ?? 'manual',
          station: same?.station ?? '',
          note: label,
          createdAt: same?.createdAt ?? stamp,
        },
        db,
      );
      written += 1;
    }
  });
  return written;
}

/** Everything the Precios screens read: the person's rows, the MICM cache, and the board over both. */
export async function priceData(): Promise<{ own: FuelPriceRow[]; refs: FuelPriceRefRow[]; board: BoardEntry[] }> {
  const [own, refs] = await Promise.all([fuelPrices.list(), listFuelPriceRefs()]);
  const ownRows = own as unknown as FuelPriceRow[];
  const refRows = refs as unknown as FuelPriceRefRow[];
  return { own: ownRows, refs: refRows, board: currentBoard(ownRows, refRows) };
}

export type FuelPriceDraft = Pick<FuelPrice, 'fuelType' | 'price' | 'validFrom' | 'source' | 'station' | 'note'>;

/** Precios → Nuevo / Editar. `id` given = edit that row; a station only sticks for estación/recibo. */
export async function saveFuelPrice(draft: FuelPriceDraft, rowId?: string): Promise<string> {
  const keepStation = draft.source === 'estacion' || draft.source === 'recibo';
  const existing = rowId ? ((await fuelPrices.getById(rowId)) as FuelPrice | null) : null;
  const saved = await fuelPrices.upsert({
    id: existing?.id ?? newId(),
    fuelType: draft.fuelType,
    price: draft.price,
    validFrom: draft.validFrom.slice(0, 10),
    source: draft.source,
    station: keepStation ? draft.station.trim() : '',
    note: draft.note.trim(),
    createdAt: existing?.createdAt ?? now(),
  });
  return saved.id;
}

export async function getFuelPrice(rowId: string): Promise<FuelPrice | null> {
  return (await fuelPrices.getById(rowId)) as FuelPrice | null;
}

export async function deleteFuelPrice(rowId: string): Promise<void> {
  await fuelPrices.softDelete(rowId);
}

/** Writes MICM rows into the local cache (the dev seed; the launch pull has its own copy of this upsert). */
export async function upsertFuelPriceRefs(rows: readonly FuelPriceRef[]): Promise<void> {
  await enqueue(async (db) => {
    for (const r of rows) {
      await db.runAsync(
        `INSERT INTO fuel_price_ref (id, fuel_type, price, week_start, week_end, pdf_url, imported_at, stale)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET price = excluded.price, week_end = excluded.week_end, pdf_url = excluded.pdf_url,
           imported_at = excluded.imported_at, stale = excluded.stale`,
        [r.id, r.fuelType, r.price, r.weekStart, r.weekEnd, r.pdfUrl, r.importedAt, r.stale ? 1 : 0] as never,
      );
    }
  });
}
