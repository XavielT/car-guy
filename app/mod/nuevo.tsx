import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ModForm } from '@/components/build/ModForm';
import { lastFxRate } from '@/lib/db/buildQueries';
import { inventory as inventoryRepo, wishlist as wishlistRepo } from '@/lib/db/repos';
import type { Mod } from '@/lib/db/types';
import { wishlistToModDraft } from '@/lib/domain/build';
import { es } from '@/lib/i18n/es';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * New mod. `fromWishlist` = "Convertir a mod" (prefilled from the item);
 * `fromInventory` = "Usar en un mod" (name, brand, part and cost from the
 * shelf, and the item is marked as used by it).
 */
export default function NewModScreen() {
  const { vehicleId, fromWishlist, fromInventory } = useLocalSearchParams<{ vehicleId?: string; fromWishlist?: string; fromInventory?: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const { activeVehicle, refresh } = useStore();
  const target = vehicleId ?? activeVehicle?.id;
  const [draft, setDraft] = useState<(Partial<Mod> & { fromWishlistId?: string }) | null | undefined>(fromWishlist || fromInventory ? undefined : null);

  useEffect(() => {
    void (async () => {
      if (fromWishlist) {
        const w = await wishlistRepo.getById(fromWishlist);
        setDraft(w ? wishlistToModDraft(w, await lastFxRate()) : null);
      } else if (fromInventory) {
        const i = await inventoryRepo.getById(fromInventory);
        setDraft(i ? { name: i.name, brand: i.brand, partNumber: i.partNumber, costPartDop: i.costDop ?? 0, status: 'instalado' } : null);
      }
    })();
  }, [fromWishlist, fromInventory]);

  if (!target || draft === undefined) return null;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <ModForm
        vehicleId={target}
        draft={draft ?? undefined}
        onDone={async () => {
          if (fromInventory && draft?.name) {
            const i = await inventoryRepo.getById(fromInventory);
            if (i) await inventoryRepo.upsert({ id: i.id, notes: [i.notes, es.inventory.usedIn(draft.name)].filter(Boolean).join('\n') });
          }
          refresh();
          router.back();
        }}
      />
    </SafeAreaView>
  );
}
