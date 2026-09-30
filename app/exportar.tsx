import { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { T } from '@/components/T';
import { GhostButton, PrimaryButton, SectionHeader, Segmented, Surface } from '@/components/ui';
import { space } from '@/constants/theme';
import { Alert } from '@/lib/alert';
import { userMessage } from '@/lib/diagnostics';
import { fuel as fuelRepo, history } from '@/lib/db/repos';
import { fuelCfgFor } from '@/lib/domain/partialEconomy';
import type { FuelLog, HistoryEntry } from '@/lib/db/types';
import { todayIso } from '@/lib/domain/dates';
import { inRange, periodRanges, type PeriodKey } from '@/lib/domain/stats';
import { deliverText } from '@/lib/export/deliver';
import { costsCsv, exportFileName, fuelCsv, historyCsv } from '@/lib/export/csv';
import { garageOwnershipCost } from '@/lib/db/statsQueries';
import type { GarageCost } from '@/lib/domain/costs';
import { money } from '@/lib/format';
import { es } from '@/lib/i18n/es';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

const PERIODS: PeriodKey[] = ['mes', 'trimestre', 'ano', 'todo'];

/**
 * Two CSVs, one period selector.
 *
 * Two files rather than one archive: the history is one row per record and the
 * fuel log is one row per fill-up with fourteen columns. Forcing them into one
 * sheet would leave most cells empty, and zipping them would need a dependency
 * to produce something most people would have to unzip by hand anyway.
 */
export default function ExportarScreen() {
  const { theme } = useTheme();
  const { activeVehicle } = useStore();

  const [period, setPeriod] = useState<PeriodKey>('ano');
  const [rows, setRows] = useState<HistoryEntry[]>([]);
  const [logs, setLogs] = useState<FuelLog[]>([]);
  const [busy, setBusy] = useState(false);
  // Note 8: lifetime and garage-wide, so the period selector does not apply to it.
  const [garage, setGarage] = useState<GarageCost | null>(null);

  useEffect(() => {
    let cancelled = false;
    garageOwnershipCost()
      .then((result) => {
        if (!cancelled) setGarage(result);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const vehicleId = activeVehicle?.id;

  useEffect(() => {
    if (!vehicleId) return;
    let cancelled = false;

    (async () => {
      const range = periodRanges(todayIso())[period];
      const [feed, fuelRows] = await Promise.all([
        history.feed(vehicleId, { from: range.from ?? undefined, to: range.to }),
        fuelRepo.list(vehicleId),
      ]);
      if (cancelled) return;
      setRows(feed);
      setLogs(inRange(fuelRows, range.from, range.to));
    })().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [vehicleId, period]);

  async function run(kind: 'historial' | 'combustible' | 'costos') {
    if (!activeVehicle) return;
    setBusy(true);
    try {
      const content =
        kind === 'historial'
          ? historyCsv(rows)
          : kind === 'costos'
            ? costsCsv(garage ?? (await garageOwnershipCost()))
            : fuelCsv(logs, activeVehicle.detail?.volumeUnit ?? 'gal', fuelCfgFor(activeVehicle.detail));
      // The costs file is the whole garage, so it is not named after one car.
      const name = exportFileName(kind, kind === 'costos' ? 'garaje' : activeVehicle.name, todayIso());
      const result = await deliverText(content, name, 'text/csv', es.export.title);

      // No alert on 'shared': the share sheet is the feedback, and Android does
      // not say whether the user sent the file or cancelled.
      if (result === 'shared') return;
      if (result === 'downloaded') Alert.alert(es.export.doneTitle, es.export.downloadedBody(name));
      else Alert.alert(es.export.doneTitle, es.export.unavailableBody);
    } catch (error) {
      Alert.alert(
        es.export.title,
        userMessage('export', error, es.export.failed),
      );
    } finally {
      setBusy(false);
    }
  }

  if (!activeVehicle) return null;

  const action = Platform.OS === 'web' ? es.export.download : es.export.share;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.pad}>
        <T face="display" style={[styles.h, { color: theme.text.primary }]}>
          {es.export.title}
        </T>
        <T face="body" style={[styles.sub, { color: theme.text.secondary }]}>
          {es.export.subtitle}
        </T>

        <SectionHeader title={es.export.period} style={styles.firstSection} />
        <Segmented<PeriodKey>
          options={PERIODS.map((key) => ({ key, label: es.stats.periods[key] }))}
          value={period}
          onChange={setPeriod}
        />

        <View style={styles.cards}>
          <Surface>
            <T face="title" style={[styles.cardTitle, { color: theme.text.primary }]}>
              {es.export.history}
            </T>
            <T face="body" style={[styles.cardBody, { color: theme.text.secondary }]}>
              {es.export.historyCaption}
            </T>
            <T face="mono" style={[styles.count, { color: theme.text.muted }]}>
              {es.export.rows(rows.length)}
            </T>
            <PrimaryButton label={action} onPress={() => run('historial')} disabled={busy || !rows.length} />
          </Surface>

          <Surface>
            <T face="title" style={[styles.cardTitle, { color: theme.text.primary }]}>
              {es.export.fuel}
            </T>
            <T face="body" style={[styles.cardBody, { color: theme.text.secondary }]}>
              {es.export.fuelCaption}
            </T>
            <T face="mono" style={[styles.count, { color: theme.text.muted }]}>
              {es.export.rows(logs.length)}
            </T>
            <GhostButton label={action} onPress={() => run('combustible')} disabled={busy || !logs.length} />
          </Surface>

          <Surface>
            <T face="title" style={[styles.cardTitle, { color: theme.text.primary }]}>
              {es.costs.csv}
            </T>
            <T face="body" style={[styles.cardBody, { color: theme.text.secondary }]}>
              {es.costs.csvCaption}
            </T>
            <T face="mono" style={[styles.count, { color: theme.text.muted }]}>
              {garage ? money(garage.total) : '—'}
            </T>
            <GhostButton label={action} onPress={() => run('costos')} disabled={busy || !garage?.vehicles.length} />
          </Surface>
        </View>

        <T face="body" style={[styles.hint, { color: theme.text.muted }]}>
          {es.export.encodingHint}
        </T>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 40 },
  h: { fontSize: 30, lineHeight: 32, textTransform: 'uppercase', letterSpacing: 0.3 },
  sub: { marginTop: 6, lineHeight: 22 },
  firstSection: { marginTop: space.lg },
  cards: { marginTop: space.lg, gap: space.md },
  cardTitle: { fontSize: 17, textTransform: 'uppercase', letterSpacing: 0.8 },
  cardBody: { fontSize: 13, marginTop: 4, lineHeight: 19 },
  count: { fontSize: 12, marginTop: space.md, marginBottom: space.md },
  hint: { fontSize: 13, lineHeight: 18, marginTop: space.lg },
});
