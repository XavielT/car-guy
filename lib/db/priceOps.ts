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
