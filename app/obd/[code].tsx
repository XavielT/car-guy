import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { DtcCard, DtcEventRow, DtcLogSheet } from '@/components/diy/DtcPieces';
import { ListCardsSkeleton } from '@/components/skeletons/ListCardsSkeleton';
import { T } from '@/components/T';
import { PrimaryButton } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { listDtcEvents } from '@/lib/db/diyQueries';
import type { VehicleDtcEvent } from '@/lib/db/types';
import { lookup, normalizeCode } from '@/lib/domain/dtc';
import { t } from '@/lib/i18n';
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
  // The "no codes logged" line waits for the first read instead of flashing (ADR-40).
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      setEvents(await listDtcEvents({ code, ...(vehicleId ? { vehicleId } : {}) }));
    } finally {
      setLoaded(true);
    }
  }, [code, vehicleId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const showSkeleton = useDelayedLoading(!loaded);

  const names = Object.fromEntries(data.vehicles.map((v) => [v.id, v.name]));
  return (
    <ScrollView style={{ backgroundColor: theme.bg.base }} contentContainerStyle={styles.pad}>
      <DtcCard dtc={lookup(code)} code={code} />
      <PrimaryButton label={t.obd.log} onPress={() => setLogging(true)} />
      <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11, marginTop: space.lg, marginBottom: space.sm }}>
        {t.obd.events}
      </T>
      {showSkeleton ? <ListCardsSkeleton n={3} pad={space.md} r={radius.input} titleWidth="30%" lines={2} /> : null}
      {loaded && !showSkeleton && !events.length ? (
        <T face="body" style={{ color: theme.text.muted, fontSize: 13 }}>
          {t.obd.noEvents}
        </T>
      ) : null}
      {(showSkeleton ? [] : events).map((e) => (
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
