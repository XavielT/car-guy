import { Pressable, StyleSheet, View } from 'react-native';

import { radius, space } from '@/constants/theme';
import { es } from '@/lib/i18n/es';
import { useTheme } from '@/lib/theme/useTheme';
import { T } from '../T';
import { StatusPill, type Status } from './StatusPill';

export type Telltale = { status: Status; label: string; onPress?: () => void };

/**
 * The home screen's hero: what the car currently reads, and what it needs.
 *
 * It replaces the fuel price board because the odometer is the number every
 * other number in Car Guy hangs off — the next oil change, the predicted due
 * dates, cost per km. Digits are grouped in threes and set in the mono face so
 * they line up like a real instrument cluster and do not jump as they change.
 */
export function OdometerHero({
  vehicleName,
  odometerKm,
  daysSinceReading,
  telltales,
  onPressOdometer,
  onPressTelltales,
}: {
  vehicleName: string;
  odometerKm: number | null;
  daysSinceReading: number | null;
  telltales: Telltale[];
  onPressOdometer: () => void;
  onPressTelltales?: () => void;
}) {
  const { theme } = useTheme();

  const caption =
    daysSinceReading == null
      ? es.home.odometerTapHint
      : daysSinceReading <= 0
        ? es.home.updatedToday
        : daysSinceReading === 1
          ? es.home.updatedYesterday
          : es.home.updatedDaysAgo(daysSinceReading);

  return (
    <View style={[styles.card, { backgroundColor: theme.bg.surface, borderColor: theme.line }]}>
      <T face="medium" style={[styles.vehicle, { color: theme.text.secondary }]}>
        {vehicleName}
      </T>

      <Pressable
        onPress={onPressOdometer}
        accessibilityRole="button"
        accessibilityLabel={es.odometerSheet.title}
        style={styles.odoRow}>
        <T face="monoBold" style={[styles.odo, { color: theme.text.primary }]}>
          {odometerKm == null ? '—' : groupDigits(Math.round(odometerKm))}
        </T>
        <T face="mono" style={[styles.unit, { color: theme.text.secondary }]}>
          {odometerKm == null ? es.home.odometerEmpty : es.home.odometerUnit}
        </T>
      </Pressable>

      <T face="body" style={[styles.caption, { color: theme.text.muted }]}>
        {caption}
      </T>

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
    </View>
  );
}

/** Thin separators every three digits: 51 676 rather than 51676. */
function groupDigits(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radius.card,
    padding: space.xl,
    marginBottom: space.lg,
  },
  vehicle: { fontSize: 14, marginBottom: space.sm },
  odoRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  odo: { fontSize: 44, letterSpacing: -0.5 },
  unit: { fontSize: 15 },
  caption: { fontSize: 12, marginTop: 4 },
  telltales: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.lg },
});
