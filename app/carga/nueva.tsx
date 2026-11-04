import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FillUpForm } from '@/components/FillUpForm';
import { FillUpReviewSheet } from '@/components/FillUpReviewSheet';
import type { DraftPhoto } from '@/lib/ai/draft';
import { recordReportable } from '@/lib/diagnostics';
import { storePhoto } from '@/lib/media';
import { evaluateFillUp, type SaveResult } from '@/lib/fillUpSave';
import { Alert } from '@/lib/alert';
import { t } from '@/lib/i18n';
import { defaultFuelForNewLoad, useOdometerHint, useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

type Result = SaveResult & { id: string; receipt: boolean };

export default function CargarScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { activeVehicle, vehicleFillups, upsertFillUp } = useStore();
  const lastOdo = useOdometerHint();
  const { data } = useStore();
  const [result, setResult] = useState<Result | null>(null);

  // Note 8: after a save this screen is left for the fill-up's detail — the form
  // never stays up holding the values it just saved (no re-key on focus).
  const openSaved = (fillId: string, receipt = false) => router.replace({ pathname: '/carga/[id]', params: receipt ? { id: fillId, saved: '1', recibo: '1' } : { id: fillId, saved: '1' } });

  if (!activeVehicle) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <View style={{ flex: 1 }}>
        <FillUpForm
          key={activeVehicle.id}
          vehicleId={activeVehicle.id}
          defaultFuel={defaultFuelForNewLoad(activeVehicle)}
          lastOdo={lastOdo}
          submitLabel={t.fuel.save}
          onSubmit={(draft, extras) => {
            // The duplicate check and the review are shared with Fuel Express (lib/fillUpSave.ts): one save path.
            const evaluation = evaluateFillUp(draft, { allFillups: data.fillups, vehicleFillups, vehicle: activeVehicle });
            if (evaluation.duplicate) {
              const dup = evaluation.duplicate;
              Alert.alert(t.fuel.duplicateTitle, t.fuel.duplicateBody, [
                { text: t.common.cancel, style: 'cancel' },
                { text: t.fuel.duplicateOpen, onPress: () => openSaved(dup.id) },
              ]);
              return false;
            }
            const savedId = upsertFillUp(draft);
            // The photos the AI read stay with the record (IMP 03112026 ADR-67). Best effort: a photo that fails to store never undoes a saved fill-up.
            attachPhotos(savedId, activeVehicle.id, extras?.photos);
            impact();
            setResult({ id: savedId, receipt: Boolean(extras?.photos.some((p) => p.role === 'invoice')), ...evaluation.result });
          }}
        />
      </View>

      <FillUpReviewSheet
        visible={result != null}
        review={result?.review ?? null}
        fuelType={result?.fuelType ?? activeVehicle.defaultFuelType}
        volumeUnit={activeVehicle.detail?.volumeUnit}
        economyUnit={activeVehicle.detail?.economyUnit}
        missedPrevious={result?.missedPrevious ?? false}
        estimate={result?.estimate ?? null}
        perFillLine={result?.perFillLine ?? null}
        onClose={() => {
          const savedId = result?.id;
          const receipt = result?.receipt ?? false;
          setResult(null);
          if (savedId) openSaved(savedId, receipt);
        }}
        onSeeHistory={() => {
          setResult(null);
          router.replace('/(tabs)/historial');
        }}
      />
    </SafeAreaView>
  );
}

/** The receipt / dashboard photos of an AI read, stored as media of the new fill-up (owner `fuel_log`). */
function attachPhotos(fillUpId: string, vehicleId: string, photos: DraftPhoto[] | undefined) {
  for (const photo of photos ?? []) {
    void storePhoto({ uri: photo.uri, width: null, takenAt: new Date().toISOString() }, { ownerTable: 'fuel_log', ownerId: fillUpId, vehicleId }).catch((e) => recordReportable('ai-photo-attach', e));
  }
}

/** Light tap on save. Native only — the web build must not reach for haptics. */
function impact() {
  if (Platform.OS === 'web') return;
  void import('expo-haptics')
    .then((H) => H.impactAsync(H.ImpactFeedbackStyle.Light))
    .catch(() => {});
}
