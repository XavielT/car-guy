import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_PRICE_WEEK, DEFAULT_REFERENCE_PRICES } from './fuel';
import type { AppData } from './types';

const KEY = 'tu-combustible-rd/v1';

export const EMPTY_DATA: AppData = {
  vehicles: [],
  fillups: [],
  settings: {
    activeVehicleId: null,
    referencePrices: { ...DEFAULT_REFERENCE_PRICES },
    priceWeekLabel: DEFAULT_PRICE_WEEK,
  },
};

export async function loadData(): Promise<AppData> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return structuredClone(EMPTY_DATA);
  try {
    const parsed = JSON.parse(raw) as AppData;
    return {
      vehicles: parsed.vehicles ?? [],
      fillups: parsed.fillups ?? [],
      settings: {
        ...EMPTY_DATA.settings,
        ...parsed.settings,
        referencePrices: {
          ...DEFAULT_REFERENCE_PRICES,
          ...parsed.settings?.referencePrices,
        },
      },
    };
  } catch {
    return structuredClone(EMPTY_DATA);
  }
}

export async function saveData(data: AppData): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(data));
}
