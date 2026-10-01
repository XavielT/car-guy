import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { TireBadges } from '@/components/build/TireStatsCard';
import { T } from '@/components/T';
import { SectionHeader, Surface } from '@/components/ui';
import { space } from '@/constants/theme';
import { vehicleTireSummary, type VehicleTireSummary } from '@/lib/db/tireQueries';
import { t } from '@/lib/i18n';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * Cifras → Gomas quemadas (IMP 30092026 note 3, ADR-45): the headline line
 * ("14 gomas · 6 este año"), money and pace, one bar per year, the badges. Tap
 * opens Build → Inventario → Gomas. Renders nothing for a car with no tires.
 */
export function TiresBlock({ vehicleId }: { vehicleId: string }) {
  const router = useRouter();
  const { theme } = useTheme();
  const { data } = useStore();
  const [summary, setSummary] = useState<VehicleTireSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    void vehicleTireSummary(vehicleId)
      .then((s) => !cancelled && setSummary(s))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [vehicleId, data]);

  if (!summary || summary.stats.total === 0) return null;
  const { stats, messages, badges } = summary;
  const [headline, ...rest] = messages;
  // messagesFor's order: headline, money (when priced), pace (when any), next badge, heat warnings.
  // Here only money and pace; the badges row says what is next.
  const lines = rest.slice(0, (stats.pricedCount > 0 && stats.spentDop > 0 ? 1 : 0) + (stats.nextSetInDays != null ? 1 : 0));
  const max = Math.max(1, ...stats.byYear.map((y) => y.count));

  return (
    <View style={{ marginTop: space.md }} testID="cifras-tires">
      <SectionHeader title={t.tiresUi.title} caption={t.tiresUi.cifrasCaption} />
      <Pressable onPress={() => router.push({ pathname: '/vehiculo/[id]/build', params: { id: vehicleId, tab: 'inventario' } })} accessibilityRole="button" accessibilityLabel={`${t.tiresUi.title}: ${headline}`}>
        <Surface>
          <T face="monoBold" style={{ color: theme.text.primary, fontSize: 18 }}>
            {headline}
          </T>
          {lines.map((l) => (
            <T key={l} face="body" style={{ color: theme.text.secondary, fontSize: 13 }}>
              {l}
            </T>
          ))}
          <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11, marginTop: space.md, marginBottom: space.xs }}>
            {t.tiresUi.byYear}
          </T>
          <View style={styles.years}>
            {stats.byYear.map((y) => (
              <View key={y.year} style={styles.year} accessible accessibilityLabel={`${y.year}: ${y.count}`}>
                <T face="mono" style={{ color: theme.text.primary, fontSize: 12 }}>
                  {String(y.count)}
                </T>
                <View style={[styles.barTrack, { backgroundColor: theme.line }]}>
                  <View style={[styles.bar, { height: `${Math.round((y.count / max) * 100)}%`, backgroundColor: theme.accentFill }]} />
                </View>
                <T face="mono" style={{ color: theme.text.muted, fontSize: 11 }}>
                  {String(y.year)}
                </T>
              </View>
            ))}
          </View>
          <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11, marginTop: space.md, marginBottom: space.xs }}>
            {t.tiresUi.badges}
          </T>
          <TireBadges badges={badges} />
        </Surface>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  years: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md },
  year: { alignItems: 'center', gap: 4, minWidth: 36 },
  barTrack: { width: 14, height: 64, borderRadius: 3, justifyContent: 'flex-end', overflow: 'hidden' },
  bar: { width: '100%', borderRadius: 3 },
});
