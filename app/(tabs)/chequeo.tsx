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
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg.base }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.pad}>
        <T face="display" style={[styles.h, { color: theme.text.primary }]}>
          {es.check.title}
        </T>

        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <T face="medium" style={[styles.eyebrow, { color: theme.text.muted }]}>
              {es.check.todayTitle.toUpperCase()}
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
              label={es.check.streak}
              color={theme.status.ok}
            />
          ) : null}
        </View>

        {due.map((template) => (
          <Surface key={template.id} style={{ marginBottom: space.md }}>
            <T face="title" style={{ color: theme.text.primary, fontSize: 18 }}>
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

        <T face="title" style={[styles.section, { color: theme.text.primary }]}>
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
              <T face="body" style={{ color: theme.text.secondary, fontSize: 13 }}>
                {template.isEnabled ? es.check.turnOff : es.check.turnOn}
              </T>
            </Pressable>
            <Pressable
              onPress={() => router.push({ pathname: '/chequeo/plantillas/[id]', params: { id: template.id } })}
              accessibilityRole="button"
              accessibilityLabel={`${es.check.edit} ${template.name}`}
              hitSlop={8}>
              <T face="body" style={{ color: theme.accent, fontSize: 13 }}>
                {es.check.edit}
              </T>
            </Pressable>
          </View>
        ))}

        {runs.length ? (
          <>
            <T face="title" style={[styles.section, { color: theme.text.primary }]}>
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
                  <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginTop: 2 }}>
                    {dateLabel(run.occurredAt)}
                  </T>
                </View>
                <StatusPill
                  status={run.status === 'ok' ? 'ok' : 'urgente'}
                  label={run.status === 'ok' ? es.check.resultAllGood : es.check.withFails}
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
  h: { fontSize: 34, marginBottom: space.lg },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.md },
  eyebrow: { fontSize: 11, letterSpacing: 0.9, marginBottom: 6 },
  section: { fontSize: 20, marginTop: space.xl, marginBottom: space.sm },
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
