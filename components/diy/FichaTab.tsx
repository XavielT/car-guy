import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { T } from '@/components/T';
import { GhostButton, PrimaryButton } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { listDtcEvents, readFicha, type Ficha } from '@/lib/db/diyQueries';
import type { VehicleDtcEvent } from '@/lib/db/types';
import { FICHA_FIELDS, formatFicha } from '@/lib/domain/specPresets';
import { t } from '@/lib/i18n';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

/** Always shown on the hub's Ficha tab when filled: what a shop asks for first. */
const HEADLINE = ['oil_grade', 'oil_capacity_filter_l', 'bolt_pattern', 'lug_torque_nm', 'psi_oem_f', 'fuel_tank_l'];

/** The hub's Ficha tab: the headline values, open OBD codes, and the ways in. */
export function FichaTab({ vehicleId, version }: { vehicleId: string; version: number }) {
  const router = useRouter();
  const { theme } = useTheme();
  const { data } = useStore();
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [events, setEvents] = useState<VehicleDtcEvent[]>([]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([readFicha(vehicleId), listDtcEvents({ vehicleId })]).then(([f, e]) => {
      if (cancelled) return;
      setFicha(f);
      setEvents(e);
    });
    return () => {
      cancelled = true;
    };
  }, [vehicleId, version, data]);

  if (!ficha) return null;
  const rows = FICHA_FIELDS.filter((f) => HEADLINE.includes(f.key));
  const open = events.filter((e) => !e.clearedAt).length;

  return (
    <View style={{ gap: space.sm }}>
      <View style={[styles.card, { backgroundColor: theme.bg.surface, borderColor: theme.lineStrong }]}>
        {rows.map((f) => (
          <View key={f.key} style={styles.row}>
            <T face="body" style={{ color: theme.text.secondary, fontSize: 13, flex: 1 }}>
              {f.label}
            </T>
            <T face="mono" style={{ color: ficha.values[f.key] != null ? theme.text.primary : theme.text.muted, fontSize: 13 }}>
              {formatFicha(f.key, ficha.values[f.key])}
            </T>
          </View>
        ))}
      </View>
      <T face="mono" style={{ color: open ? theme.statusText.urgente : theme.text.muted, fontSize: 12 }}>
        {t.ficha.obdOpen(open)}
      </T>
      <PrimaryButton label={t.ficha.open} onPress={() => router.push({ pathname: '/vehiculo/[id]/ficha', params: { id: vehicleId } })} />
      <View style={styles.pair}>
        <GhostButton label={t.ficha.fluids} onPress={() => router.push({ pathname: '/vehiculo/[id]/fluidos', params: { id: vehicleId } })} style={{ flex: 1 }} />
        <GhostButton label={t.ficha.obdAll} onPress={() => router.push({ pathname: '/obd', params: { vehicleId } })} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.button, padding: space.md, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  pair: { flexDirection: 'row', gap: space.sm },
});
