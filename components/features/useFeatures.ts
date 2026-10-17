import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import { listDtcEvents } from '@/lib/db/diyQueries';
import { featureHref, type FeatureDef } from '@/lib/features/registry';
import { t } from '@/lib/i18n';
import { markFeatureUsed } from '@/lib/features/usage';
import { isMissing } from '@/lib/permissions/map';
import { usePermissions } from '@/lib/permissions/store';
import type { PermissionId } from '@/lib/permissions/types';
import { useStore } from '@/lib/store';

/** How many OBD codes of this vehicle are still unresolved (the CHECK telltale and the hub badge read it). */
export function useOpenDtcCount(vehicleId: string | null | undefined): number | null {
  const [count, setCount] = useState<number | null>(null);
  useFocusEffect(
    useCallback(() => {
      let live = true;
      if (!vehicleId) {
        setCount(0);
        return;
      }
      void listDtcEvents({ vehicleId })
        .then((rows) => live && setCount(rows.filter((r) => !r.clearedAt).length))
        .catch(() => live && setCount(0));
      return () => {
        live = false;
      };
    }, [vehicleId]),
  );
  return count;
}

const PERMISSION_IDS: PermissionId[] = ['location_foreground', 'notifications', 'photos'];

/** The badge a feature wears in the hub, or null. */
export function useFeatureBadges(vehicleId: string | null | undefined) {
  const codes = useOpenDtcCount(vehicleId);
  const states = usePermissions(PERMISSION_IDS);
  const loading = codes === null;
  const badgeOf = useCallback(
    (def: FeatureDef): { text: string; warn: boolean } | null => {
      if (def.id === 'obd' && codes) return { text: t.features.badgeCodes(codes), warn: true };
      if (def.permission) {
        const s = states[def.permission];
        if (s && isMissing(s.status)) return { text: t.features.permissionBadge, warn: true };
      }
      return null;
    },
    [codes, states],
  );
  return useMemo(() => ({ loading, badgeOf }), [loading, badgeOf]);
}

/**
 * Opens a function from anywhere (hub, search, shortcuts, Descubre): a function that belongs to a car goes to the
 * active one; with no car at all it says so instead of opening an empty form.
 */
export function useOpenFeature() {
  const router = useRouter();
  const { activeVehicle } = useStore();
  const [needsCar, setNeedsCar] = useState<FeatureDef | null>(null);
  const open = useCallback(
    (def: FeatureDef) => {
      if (def.needsVehicle && !activeVehicle) {
        setNeedsCar(def);
        return;
      }
      void markFeatureUsed(def.id);
      router.push(featureHref(def, activeVehicle?.id ?? null) as never);
    },
    [router, activeVehicle],
  );
  return { open, needsCar, clearNeedsCar: () => setNeedsCar(null) };
}
