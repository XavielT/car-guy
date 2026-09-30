import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { DtcCard, DtcEventRow, DtcLogSheet } from '@/components/diy/DtcPieces';
import { Field } from '@/components/Field';
import { T } from '@/components/T';
import { GhostButton, PrimaryButton } from '@/components/ui';
import { space } from '@/constants/theme';
import { listDtcEvents } from '@/lib/db/diyQueries';
import type { VehicleDtcEvent } from '@/lib/db/types';
import { lookup, normalizeCode } from '@/lib/domain/dtc';
import { t } from '@/lib/i18n';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * OBD codes (IMP 28092026 Phase 5): type a code, read it in Spanish (the
 * bundled table), log it against a car; below, the codes logged so far.
 */
export default function ObdScreen() {
  const { vehicleId, add } = useLocalSearchParams<{ vehicleId?: string; add?: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const { data } = useStore();
  const [query, setQuery] = useState('');
  const [events, setEvents] = useState<VehicleDtcEvent[]>([]);
  const [logging, setLogging] = useState(false);

  const load = useCallback(async () => {
    setEvents(await listDtcEvents(vehicleId ? { vehicleId } : {}));
  }, [vehicleId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const code = normalizeCode(query);
  const dtc = code ? lookup(code) : null;
  const names = Object.fromEntries(data.vehicles.map((v) => [v.id, v.name]));

  return (
    <ScrollView style={{ backgroundColor: theme.bg.base }} contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
      <T face="eyebrow" style={{ color: theme.accent, fontSize: 11 }}>
        {t.obd.eyebrow}
      </T>
      <T face="display" accessibilityRole="header" style={{ color: theme.text.primary, fontSize: 30, textTransform: 'uppercase', marginBottom: space.md }}>
        {t.obd.title}
      </T>
      <Field label={t.obd.search} placeholder={t.obd.searchPlaceholder} value={query} onChangeText={setQuery} autoCapitalize="characters" autoFocus={add === '1'} />
      {code ? (
        <>
          <DtcCard dtc={dtc} code={code} />
          <PrimaryButton label={t.obd.log} onPress={() => setLogging(true)} />
          <GhostButton label={code} onPress={() => router.push({ pathname: '/obd/[code]', params: { code, ...(vehicleId ? { vehicleId } : {}) } })} />
        </>
      ) : null}

      <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11, marginTop: space.lg, marginBottom: space.sm }}>
        {t.obd.events}
      </T>
      {!events.length ? (
        <T face="body" style={{ color: theme.text.muted, fontSize: 13 }}>
          {t.obd.noEvents}
        </T>
      ) : null}
      {events.map((e) => (
        <DtcEventRow key={e.id} event={e} vehicleName={names[e.vehicleId]} onChanged={() => void load()} />
      ))}

      {code ? (
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
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 48 },
});
