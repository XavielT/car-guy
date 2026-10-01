import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { priceData } from '@/lib/db/priceOps';
import type { BoardEntry, FuelPriceRefRow, FuelPriceRow } from '@/lib/domain/fuelPrices';
import { useStore } from '@/lib/store';

export type PriceData = { own: FuelPriceRow[]; refs: FuelPriceRefRow[]; board: BoardEntry[] };

const EMPTY: PriceData = { own: [], refs: [], board: [] };

/**
 * The person's price rows, the MICM cache and the board (lib/db/priceOps.ts
 * priceData). Re-read when the screen gets focus and whenever the store
 * reloads (a save anywhere, a sync, the launch MICM pull).
 */
export function usePriceData(): PriceData & { loaded: boolean; reload: () => Promise<void> } {
  const { data } = useStore();
  const [state, setState] = useState<PriceData>(EMPTY);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    try {
      setState(await priceData());
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload, data]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  return { ...state, loaded, reload };
}
