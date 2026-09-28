import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import { palette, space } from '@/constants/theme';
import type { ClusterReading } from '@/lib/domain/cluster';
import { es } from '@/lib/i18n/es';
import { T } from '../T';
import { CarbonFrame } from './CarbonFrame';
import { ClusterHero } from './ClusterHero';
import { StatusPill, type Status } from './StatusPill';

export type Telltale = { status: Status; label: string; onPress?: () => void };

/**
 * The v2.0 home hero's API over the new ClusterHero (IMP 28092026).
 *
 * A thin wrapper so app/(tabs)/index.tsx keeps compiling while Phase 2 rebuilds
 * Inicio around ClusterHero + TelltaleRow; delete it with its last call site.
 * The pills stay under the dial until then.
 */
export function OdometerHero({
  vehicleName,
  odometerKm,
  daysSinceReading,
  telltales,
  reading = null,
  onPressOdometer,
  onPressTelltales,
}: {
  vehicleName: string;
  odometerKm: number | null;
  daysSinceReading: number | null;
  telltales: Telltale[];
  reading?: ClusterReading | null;
  onPressOdometer: () => void;
  onPressTelltales?: () => void;
}) {
  const { width } = useWindowDimensions();
  const ink = palette.dark;

  const caption =
    daysSinceReading == null
      ? es.home.odometerTapHint
      : daysSinceReading <= 0
        ? es.home.updatedToday
        : daysSinceReading === 1
          ? es.home.updatedYesterday
          : es.home.updatedDaysAgo(daysSinceReading);

  return (
    <ClusterHero
      odometerKm={odometerKm}
      reading={reading}
      caption={caption}
      // Gutter 20 + card padding 16, each side; capped for desktop.
      size={Math.min(340, Math.max(240, width - 72))}
      onPress={onPressTelltales}
      onPressOdometer={onPressOdometer}
      header={
        <CarbonFrame style={styles.header}>
          <View style={[styles.namePlate, { backgroundColor: ink.bg.surface }]}>
            <T face="title" style={{ color: ink.text.secondary, fontSize: 15, textTransform: 'uppercase', letterSpacing: 1 }}>
              {vehicleName}
            </T>
          </View>
        </CarbonFrame>
      }>
      {/*
        Each pill is its own tap target rather than one strip-wide button: a
        task goes to the task, a reminder to the reminder list, and nesting one
        button inside another is invalid HTML on web.
      */}
      <View style={styles.telltales}>
        {telltales.length === 0 ? (
          <StatusPill status="ok" label={es.home.allGood} />
        ) : (
          telltales.slice(0, 4).map((t) => {
            const onPress = t.onPress ?? onPressTelltales;
            return onPress ? (
              <Pressable key={t.label} onPress={onPress} accessibilityRole="button">
                <StatusPill status={t.status} label={t.label} />
              </Pressable>
            ) : (
              <StatusPill key={t.label} status={t.status} label={t.label} />
            );
          })
        )}
      </View>
    </ClusterHero>
  );
}

const styles = StyleSheet.create({
  // Carbon is trim: it frames the name plate, the text sits on its own panel.
  header: { marginHorizontal: -space.lg, marginTop: -space.lg, marginBottom: space.md, padding: 6, paddingHorizontal: space.lg },
  namePlate: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  telltales: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.lg, justifyContent: 'center' },
});
