import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { T } from '@/components/T';
import { KeyValueRow, PrimaryButton, SectionHeader, Segmented, Surface } from '@/components/ui';
import { space } from '@/constants/theme';
import { Alert } from '@/lib/alert';
import { history } from '@/lib/db/repos';
import { vehicleStats, type VehicleStats } from '@/lib/db/statsQueries';
import type { HistoryEntry } from '@/lib/db/types';
import { todayIso } from '@/lib/domain/dates';
import { computeEconomy } from '@/lib/domain/economy';
import type { PeriodKey } from '@/lib/domain/stats';
import { dateLabel, km, money } from '@/lib/format';
import { es } from '@/lib/i18n/es';
import { printReport } from '@/lib/report/print';
import { reportHtml } from '@/lib/report/html';
import { photoDataUri } from '@/lib/report/photo';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

const PERIODS: PeriodKey[] = ['mes', 'trimestre', 'ano', 'todo'];

/**
 * The PDF report: pick a period, see what will be in it, generate.
 *
 * There is no live preview of the HTML. Rendering it would mean a WebView on
 * native and `dangerouslySetInnerHTML` on web — two implementations of a
 * picture of a document the user is one tap from actually seeing. The summary
 * below says what the report contains, which is the part worth checking before
 * printing.
 */
export default function ReporteScreen() {
  const { period: initialPeriod } = useLocalSearchParams<{ period?: string }>();
  const { theme } = useTheme();
  const { activeVehicle, vehicleFillups } = useStore();

  const [period, setPeriod] = useState<PeriodKey>(
    PERIODS.includes(initialPeriod as PeriodKey) ? (initialPeriod as PeriodKey) : 'trimestre',
  );
  const [stats, setStats] = useState<VehicleStats | null>(null);
  const [rows, setRows] = useState<HistoryEntry[]>([]);
  const [busy, setBusy] = useState(false);

  const vehicleId = activeVehicle?.id;

  useEffect(() => {
    if (!vehicleId) return;
    let cancelled = false;

    (async () => {
      const result = await vehicleStats(vehicleId, period);
      if (cancelled || !result) return;
      const feed = await history.feed(vehicleId, {
        from: result.period.from ?? undefined,
        to: result.period.to,
      });
      if (cancelled) return;
      setStats(result);
      setRows(feed);
    })().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [vehicleId, period]);

  async function generate() {
    if (!stats) return;
    setBusy(true);
    try {
      const html = reportHtml({
        stats,
        history: rows,
        economy: computeEconomy(vehicleFillups),
        photoDataUri: await photoDataUri(stats.vehicle.photoMediaId),
        generatedAt: todayIso(),
      });

      const result = await printReport(html);
      if (result === 'shared') {
        Alert.alert(es.report.sharedTitle, es.report.sharedBody);
      } else if (result === 'unavailable') {
        Alert.alert(es.report.unavailableTitle, es.report.unavailableBody);
      }
      // 'printed' opens the browser's own dialog — saying so on top of it would
      // be talking over the thing the user is already looking at.
    } catch (error) {
      Alert.alert(
        es.report.unavailableTitle,
        es.report.failed(error instanceof Error ? error.message : String(error)),
      );
    } finally {
      setBusy(false);
    }
  }

  if (!activeVehicle) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.pad}>
        <T face="display" style={[styles.h, { color: theme.text.primary }]}>
          {es.report.title}
        </T>
        <T face="body" style={[styles.sub, { color: theme.text.secondary }]}>
          {es.report.subtitle}
        </T>

        <SectionHeader title={es.report.period} style={styles.firstSection} />
        <Segmented<PeriodKey>
          options={PERIODS.map((key) => ({ key, label: es.stats.periods[key] }))}
          value={period}
          onChange={setPeriod}
        />

        {stats ? (
          <Surface style={styles.summary}>
            <T face="medium" style={[styles.eyebrow, { color: theme.text.muted }]}>
              {stats.vehicle.name.toUpperCase()}
            </T>
            <T face="body" style={[styles.range, { color: theme.text.secondary }]}>
              {stats.period.from
                ? `${dateLabel(stats.period.from)} — ${dateLabel(stats.period.to)}`
                : es.stats.periodHint.todo}
            </T>

            <View style={[styles.rule, { backgroundColor: theme.line }]} />

            <KeyValueRow label={es.stats.spend} value={money(stats.kpis.spend)} big />
            <KeyValueRow
              label={es.stats.distance}
              value={stats.kpis.distanceKm > 0 ? km(stats.kpis.distanceKm) : '—'}
            />
            <KeyValueRow
              label={es.stats.costPerKm}
              value={stats.kpis.costPerKm != null ? money(stats.kpis.costPerKm) : '—'}
            />
            <KeyValueRow label={es.report.historyTitle} value={es.report.rows(rows.length)} />
          </Surface>
        ) : (
          <View style={styles.loading}>
            <ActivityIndicator color={theme.accent} />
          </View>
        )}

        {Platform.OS === 'web' ? (
          <T face="body" style={[styles.hint, { color: theme.text.muted }]}>
            {es.report.webHint}
          </T>
        ) : null}

        <PrimaryButton
          label={busy ? es.report.generating : es.report.generate}
          onPress={generate}
          disabled={busy || !stats}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 40 },
  h: { fontSize: 30 },
  sub: { marginTop: 6, lineHeight: 22 },
  firstSection: { marginTop: space.lg },
  summary: { marginTop: space.lg, marginBottom: space.lg },
  eyebrow: { fontSize: 11, letterSpacing: 0.9 },
  range: { fontSize: 13, marginTop: 4 },
  rule: { height: 1, marginVertical: space.md },
  loading: { paddingVertical: space.xxxl, alignItems: 'center' },
  hint: { fontSize: 12, lineHeight: 18, marginBottom: space.md },
});
