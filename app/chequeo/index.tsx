import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { T } from '@/components/T';
import { EmptyState, GaugeRing, GhostButton, PrimaryButton, StatusPill, Surface } from '@/components/ui';
import { space } from '@/constants/theme';
import { baseTemplateId, setTemplateEnabled, templatesForVehicle } from '@/lib/db/inspectionOps';
import { inspections as inspectionRepo, vehicles as vehicleRepo } from '@/lib/db/repos';
import type { Inspection, InspectionTemplate } from '@/lib/db/types';
import { todayIso } from '@/lib/domain/dates';
import { isDue, latestRun, weeklyStreak } from '@/lib/domain/inspections';
import { dateLabel } from '@/lib/format';
import { es } from '@/lib/i18n/es';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * The habit screen.
 *
 * "Para hoy" comes first and is the only thing with a big button, because the
 * app's job is to turn a two-minute check into something you do without
 * deciding to. The streak sits next to it for the same reason.
 */
export default function ChequeoScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { activeVehicle, data, refresh } = useStore();

  const [templates, setTemplates] = useState<InspectionTemplate[]>([]);
  const [runs, setRuns] = useState<Inspection[]>([]);

  const vehicleId = activeVehicle?.id;

  useEffect(() => {
    if (!vehicleId) return;
    let cancelled = false;
    (async () => {
      const [history, vehicle] = await Promise.all([
        inspectionRepo.list(vehicleId, { orderBy: 'occurred_at', direction: 'DESC', limit: 60 }),
        vehicleRepo.getById(vehicleId),
      ]);
      // A motorcycle gets T-CLOCS, a diesel gets the water separator; neither
      // should be asked about the other's checklist. Edited templates arrive as
      // this vehicle's own copy.
      const mine = vehicle ? await templatesForVehicle(vehicle) : [];
      if (cancelled) return;
      setTemplates(mine);
      setRuns(history);
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [vehicleId, data]);

  if (!activeVehicle) return null;

  const today = todayIso();
  const mine = templates;
  const enabled = mine.filter((t) => t.isEnabled);
  // A vehicle's copy of a seeded template inherits the runs done before it was
  // edited — editing the list must not reset the streak or make it due again.
  const runsFor = (templateId: string) =>
    runs.filter((r) => baseTemplateId(r.templateId) === baseTemplateId(templateId));
  const due = enabled.filter((t) => isDue(t.cadence, runsFor(t.id), today));

  const weekly = enabled.find((t) => t.cadence === 'semanal');
  const streak = weekly ? weeklyStreak(runsFor(weekly.id), today) : 0;
  const nameOf = (templateId: string) =>
    mine.find((t) => baseTemplateId(t.id) === baseTemplateId(templateId))?.name ?? '';

  const toggle = (template: InspectionTemplate) =>
    void setTemplateEnabled(template.id, activeVehicle.id, !template.isEnabled).then(refresh);

  return (
    // The stack header already says "Chequeo" and sits under the status bar,
    // so no in-page title and no top inset here.
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg.base }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.pad}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <T face="eyebrow" style={[styles.eyebrow, { color: theme.accent }]}>
              {es.check.todayTitle}
              <T face="kana" style={[styles.kana, { color: theme.text.muted }]}>
                {' 点検'}
              </T>
            </T>
            {due.length === 0 ? (
              <T face="body" style={{ color: theme.text.secondary, fontSize: 14 }}>
                {es.check.nothingDue}
              </T>
            ) : null}
          </View>
          {streak > 0 ? (
            <GaugeRing
              progress={Math.min(1, streak / 4)}
              size={84}
              value={String(streak)}
              label={es.check.streakLabel(streak)}
              color={theme.status.ok}
            />
          ) : null}
        </View>

        {due.map((template) => (
          <Surface key={template.id} style={{ marginBottom: space.md }}>
            <T face="display" style={{ color: theme.text.primary, fontSize: 22, textTransform: 'uppercase' }}>
              {template.name}
            </T>
            <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginTop: 2, marginBottom: space.md }}>
              {es.check.cadences[template.cadence]} ·{' '}
              {latestRun(runsFor(template.id))
                ? es.check.lastRun(dateLabel(latestRun(runsFor(template.id))!.occurredAt))
                : es.check.never}
            </T>
            <PrimaryButton
              label={es.check.start}
              onPress={() =>
                router.push({ pathname: '/chequeo/[templateId]/run', params: { templateId: template.id } })
              }
            />
          </Surface>
        ))}

        <T face="eyebrow" accessibilityRole="header" style={[styles.section, { color: theme.text.muted }]}>
          {es.check.templates}
        </T>
        {mine.map((template) => (
          <View key={template.id} style={[styles.templateRow, { borderColor: theme.line }]}>
            <Pressable
              onPress={() =>
                template.isEnabled
                  ? router.push({ pathname: '/chequeo/[templateId]/run', params: { templateId: template.id } })
                  : undefined
              }
              disabled={!template.isEnabled}
              accessibilityRole="button"
              style={{ flex: 1, opacity: template.isEnabled ? 1 : 0.5 }}>
              <T face="semibold" style={{ color: theme.text.primary, fontSize: 14 }}>
                {template.name}
              </T>
              <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginTop: 2 }}>
                {es.check.cadences[template.cadence]}
                {template.isEnabled ? '' : ` · ${es.check.disabled}`}
              </T>
            </Pressable>
            <Pressable
              onPress={() => toggle(template)}
              accessibilityRole="switch"
              accessibilityState={{ checked: template.isEnabled }}
              accessibilityLabel={`${template.name}: ${template.isEnabled ? es.check.turnOff : es.check.turnOn}`}
              hitSlop={8}>
              <T face="title" style={[styles.action, { color: theme.text.secondary }]}>
                {template.isEnabled ? es.check.turnOff : es.check.turnOn}
              </T>
            </Pressable>
            <Pressable
              onPress={() => router.push({ pathname: '/chequeo/plantillas/[id]', params: { id: template.id } })}
              accessibilityRole="button"
              accessibilityLabel={`${es.check.edit} ${template.name}`}
              hitSlop={8}>
              <T face="title" style={[styles.action, { color: theme.accent }]}>
                {es.check.edit}
              </T>
            </Pressable>
          </View>
        ))}

        {runs.length ? (
          <>
            <T face="eyebrow" accessibilityRole="header" style={[styles.section, { color: theme.text.muted }]}>
              {es.check.recent}
            </T>
            {runs.slice(0, 8).map((run) => (
              <Pressable
                key={run.id}
                onPress={() => router.push({ pathname: '/inspeccion/[id]', params: { id: run.id } })}
                accessibilityRole="button"
                style={[styles.runRow, { borderColor: theme.line }]}>
                <View style={{ flex: 1 }}>
                  <T face="semibold" style={{ color: theme.text.primary, fontSize: 13 }}>
                    {nameOf(run.templateId) || es.check.title}
                  </T>
                  <T face="mono" style={{ color: theme.text.muted, fontSize: 12, marginTop: 2 }}>
                    {dateLabel(run.occurredAt)}
                  </T>
                </View>
                <StatusPill
                  status={run.status === 'ok' ? 'ok' : run.status === 'con_avisos' ? 'proximo' : 'urgente'}
                  label={run.status === 'ok' ? es.check.resultAllGood : run.status === 'con_avisos' ? es.check.withWarnings : es.check.withFails}
                />
              </Pressable>
            ))}
          </>
        ) : null}

        {mine.length === 0 ? (
          <EmptyState icon="clipboard-outline" message={es.check.nothingDue} />
        ) : null}

        <View style={{ height: space.lg }} />
        <GhostButton label={es.check.guide} onPress={() => router.push('/chequeo/guia')} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  pad: { padding: space.gutter, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.md },
  eyebrow: { fontSize: 12, marginBottom: 6 },
  kana: { fontSize: 10, letterSpacing: 0, textTransform: 'none' },
  section: { fontSize: 12, marginTop: space.xxl, marginBottom: space.xs },
  action: { fontSize: 13, letterSpacing: 0.9, textTransform: 'uppercase' },
  templateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: 1,
  },
  runRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: 1,
  },
});
