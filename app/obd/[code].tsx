import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { DtcCard, DtcEventRow, DtcLogSheet } from '@/components/diy/DtcPieces';
import { T } from '@/components/T';
import { PrimaryButton } from '@/components/ui';
import { space } from '@/constants/theme';
import { listDtcEvents } from '@/lib/db/diyQueries';
import type { VehicleDtcEvent } from '@/lib/db/types';
import { lookup, normalizeCode } from '@/lib/domain/dtc';
import { es } from '@/lib/i18n/es';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

/** One code: its description and every time it showed up. */
export default function ObdCodeScreen() {
  const { code: raw, vehicleId } = useLocalSearchParams<{ code: string; vehicleId?: string }>();
  const { theme } = useTheme();
  const { data } = useStore();
  const code = normalizeCode(raw ?? '') ?? (raw ?? '').toUpperCase();
  const [events, setEvents] = useState<VehicleDtcEvent[]>([]);
  const [logging, setLogging] = useState(false);

  const load = useCallback(async () => {
    setEvents(await listDtcEvents({ code, ...(vehicleId ? { vehicleId } : {}) }));
  }, [code, vehicleId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const names = Object.fromEntries(data.vehicles.map((v) => [v.id, v.name]));
  return (
    <ScrollView style={{ backgroundColor: theme.bg.base }} contentContainerStyle={styles.pad}>
      <DtcCard dtc={lookup(code)} code={code} />
      <PrimaryButton label={es.obd.log} onPress={() => setLogging(true)} />
      <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11, marginTop: space.lg, marginBottom: space.sm }}>
        {es.obd.events}
      </T>
      {!events.length ? (
        <T face="body" style={{ color: theme.text.muted, fontSize: 13 }}>
          {es.obd.noEvents}
        </T>
      ) : null}
      {events.map((e) => (
        <DtcEventRow key={e.id} event={e} vehicleName={names[e.vehicleId]} onChanged={() => void load()} />
      ))}
      <DtcLogSheet
        visible={logging}
        code={code}
        vehicleId={vehicleId}
        onClose={() => setLogging(false)}
        onSaved={() => {
          setLogging(false);
          void load();
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 48 },
});
