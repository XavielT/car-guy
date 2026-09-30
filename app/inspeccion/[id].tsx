import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PhotoThumb } from '@/components/album/PhotoThumb';
import { MissingRecord } from '@/components/MissingRecord';
import { RecordCheckSkeleton } from '@/components/skeletons/RecordSkeleton';
import { T } from '@/components/T';
import { BoostRing, GhostButton, Hanko, PrimaryButton, StatusPill, Surface } from '@/components/ui';
import { space } from '@/constants/theme';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { baseTemplateId, inspectionPhotos } from '@/lib/db/inspectionOps';
import {
  inspectionResults as resultRepo,
  inspections as inspectionRepo,
  inspectionTemplates as templateRepo,
  tasks as taskRepo,
} from '@/lib/db/repos';
import type { Inspection, InspectionResult, Task } from '@/lib/db/types';
import { todayIso } from '@/lib/domain/dates';
import { weeklyStreak } from '@/lib/domain/inspections';
import { dateLabel, km as fmtKm } from '@/lib/format';
import { t } from '@/lib/i18n';
import { catalogLabel } from '@/lib/i18n/catalog';
import { offerAfterFirstInspection } from '@/lib/notifications';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * How it went — and, when everything is fine, a little celebration.
 *
 * The one exclamation mark the voice guide allows lives here: finishing a check
 * is the behaviour the whole app is trying to reinforce.
 */
export default function InspeccionScreen() {
  // `fresh` marks the arrival straight from the runner, as opposed to opening
  // a past run from the Historial.
  const { id, fresh, reminders } = useLocalSearchParams<{ id: string; fresh?: string; reminders?: string }>();
  const createdReminders: string[] = (() => {
    try {
      return reminders ? (JSON.parse(reminders) as string[]) : [];
    } catch {
      return [];
    }
  })();
  const router = useRouter();
  const { theme } = useTheme();
  const { data } = useStore();

  const [run, setRun] = useState<Inspection | null | undefined>(undefined);
  const [results, setResults] = useState<InspectionResult[]>([]);
  // Every photo per result id (IMP 29092026 note 3).
  const [photos, setPhotos] = useState<Record<string, string[]>>({});
  const [templateName, setTemplateName] = useState('');
  const [openTasks, setOpenTasks] = useState<Task[]>([]);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const row = await inspectionRepo.getById(id);
      if (cancelled) return;
      if (!row) return setRun(null);
      const [rows, template, tasks, history, byResult] = await Promise.all([
        resultRepo.listWhere({ inspectionId: id }),
        templateRepo.getById(row.templateId),
        taskRepo.list(row.vehicleId),
        inspectionRepo.list(row.vehicleId, { orderBy: 'occurred_at', direction: 'DESC', limit: 60 }),
        inspectionPhotos(id),
      ]);
      if (cancelled) return;
      // A task points at the result it came from. Runs saved before results
      // had stable ids pointed at the inspection itself; both still match.
      const sources = new Set([id, ...rows.map((r) => r.id)]);
      setRun(row);
      setResults(rows);
      setPhotos(byResult);
      setTemplateName(catalogLabel('inspectionTemplate', template));
      setOpenTasks(tasks.filter((t) => t.sourceInspectionResultId && sources.has(t.sourceInspectionResultId)));
      setStreak(
        template?.cadence === 'semanal'
          ? weeklyStreak(
              history.filter((h) => baseTemplateId(h.templateId) === baseTemplateId(row.templateId)),
              todayIso(),
            )
          : 0,
      );
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id, data]);

  // Right after the first check is the moment the offer makes sense: the user
  // has just done the thing the notifications exist to bring back. Asked once.
  useEffect(() => {
    if (fresh !== '1' || !run) return;
    void offerAfterFirstInspection();
  }, [fresh, run]);

  // Haptics are a native-only nicety; the web build must not reach for them.
  useEffect(() => {
    if (Platform.OS === 'web' || fresh !== '1' || !run || run.status !== 'ok') return;
    void import('expo-haptics')
      .then((H) => H.notificationAsync(H.NotificationFeedbackType.Success))
      .catch(() => {});
  }, [fresh, run]);

  // undefined: still loading · null: looked, and it is gone. A refresh keeps the
  // run on screen, so the skeleton only ever covers the first read.
  const showSkeleton = useDelayedLoading(run === undefined);
  if (run === null) return <MissingRecord />;
  if (!run) return showSkeleton ? <RecordCheckSkeleton /> : null;

  const failures = results.filter((r) => r.result === 'falla');
  // ATENCIÓN: its own group, amber — something to keep an eye on, not a failure.
  const warnings = results.filter((r) => r.result === 'atencion');
  const rest = results.filter((r) => r.result !== 'falla' && r.result !== 'atencion');
  const answered = results.filter((r) => r.result !== 'na').length;
  const card = (result: InspectionResult) => (
    <ResultCard
      key={result.id}
      result={result}
      mediaIds={photos[result.id] ?? []}
      onPhoto={(mediaId) => router.push({ pathname: '/foto/[id]', params: { id: mediaId } })}
    />
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.pad}>
        <View style={styles.hero}>
          {/* The one sweep on this screen: it runs once, on arrival. */}
          <BoostRing
            progress={results.length ? answered / results.length : 1}
            size={132}
            animate
            value={failures.length ? String(failures.length) : warnings.length ? String(warnings.length) : '✓'}
            label={
              failures.length
                ? t.check.resultWithFails(failures.length)
                : warnings.length
                  ? t.check.resultWithWarnings(warnings.length)
                  : ''
            }
            color={failures.length ? theme.status.vencido : warnings.length ? theme.status.proximo : theme.status.ok}
          />
        </View>

        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            {/* "Todo al día" is the green telltale; failures read in the red text ink. */}
            <T
              face="display"
              accessibilityRole="header"
              style={[
                styles.h,
                {
                  color: failures.length
                    ? theme.statusText.vencido
                    : warnings.length
                      ? theme.statusText.proximo
                      : theme.statusText.ok,
                },
              ]}>
              {failures.length
                ? t.check.resultWithFails(failures.length)
                : warnings.length
                  ? t.check.resultWithWarnings(warnings.length)
                  : t.check.resultAllGood}
            </T>
            <T face="semibold" style={{ color: theme.text.primary, fontSize: 15, marginTop: 2 }}>
              {templateName}
            </T>
            <T face="mono" style={{ color: theme.text.secondary, fontSize: 12, marginTop: 2 }}>
              {dateLabel(run.occurredAt)}
              {run.odometerKm != null ? ` · ${fmtKm(run.odometerKm)}` : ''}
              {run.durationSec ? ` · ${t.common.minutes(Math.max(1, Math.round(run.durationSec / 60)))}` : ''}
            </T>
          </View>
          {/* The "registrado" stamp (05-design-jdm.md §8). */}
          <Hanko char="車" size={44} shape="square" accessibilityLabel={t.identity.stamped} />
        </View>

        {failures.length === 0 && streak > 1 ? (
          <T face="title" style={{ color: theme.statusText.ok, fontSize: 18, marginBottom: space.lg }}>
            {streak} {t.check.streakLabel(streak)}. {t.check.celebrate}
          </T>
        ) : null}

        {failures.map(card)}

        {warnings.length ? (
          <>
            <T face="eyebrow" accessibilityRole="header" style={[styles.section, { color: theme.statusText.proximo }]}>
              {t.check.resultAttention}
            </T>
            {warnings.map(card)}
          </>
        ) : null}

        {openTasks.length ? (
          <>
            <T face="eyebrow" accessibilityRole="header" style={[styles.section, { color: theme.text.muted }]}>
              {t.check.resultTasks}
            </T>
            {openTasks.map((task) => (
              <GhostButton
                key={task.id}
                label={task.title}
                onPress={() => router.push({ pathname: '/tarea/[id]', params: { id: task.id } })}
              />
            ))}
          </>
        ) : null}

        {createdReminders.length ? (
          <>
            <T face="eyebrow" accessibilityRole="header" style={[styles.section, { color: theme.text.muted }]}>
              {t.check.resultReminders}
            </T>
            {createdReminders.map((title) => (
              <GhostButton key={title} label={title} onPress={() => router.push('/recordatorios')} />
            ))}
          </>
        ) : null}

        {rest.length ? (
          <>
            <T face="eyebrow" accessibilityRole="header" style={[styles.section, { color: theme.text.muted }]}>
              {t.check.resultChecked}
            </T>
            {rest.map(card)}
          </>
        ) : null}

        <View style={{ height: space.lg }} />
        <PrimaryButton label={t.common.back} onPress={() => router.replace('/chequeo')} />
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * One answered item: the verdict, and for a FALLA or an ATENCIÓN what was seen
 * and every photo, as thumbs that open the photo viewer.
 */
function ResultCard({
  result,
  mediaIds,
  onPhoto,
}: {
  result: InspectionResult;
  mediaIds: string[];
  onPhoto: (mediaId: string) => void;
}) {
  const { theme } = useTheme();
  const pill =
    result.result === 'falla'
      ? { status: 'vencido' as const, label: t.check.fail }
      : result.result === 'atencion'
        ? { status: 'proximo' as const, label: t.check.attention }
        : result.result === 'ok'
          ? { status: 'ok' as const, label: t.check.ok }
          : { status: 'neutral' as const, label: t.check.na };
  return (
    <Surface style={{ marginBottom: space.sm }}>
      <View style={styles.row}>
        <T face="semibold" style={{ color: theme.text.primary, fontSize: 15, flex: 1 }}>
          {catalogLabel('checkItem', { id: result.itemId, label: result.labelSnapshot }, 'label')}
        </T>
        <StatusPill status={pill.status} label={pill.label} />
      </View>
      {result.note ? (
        <T face="body" style={{ color: theme.text.secondary, fontSize: 13, marginTop: 6, lineHeight: 19 }}>
          {result.note}
        </T>
      ) : null}
      {mediaIds.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbs}>
          {mediaIds.map((mediaId, i) => (
            <PhotoThumb
              key={mediaId}
              mediaId={mediaId}
              size={96}
              onPress={() => onPhoto(mediaId)}
              accessibilityLabel={t.check.photoOpen(catalogLabel('checkItem', { id: result.itemId, label: result.labelSnapshot }, 'label'), i + 1)}
            />
          ))}
        </ScrollView>
      ) : null}
    </Surface>
  );
}

const styles = StyleSheet.create({
  thumbs: { gap: space.sm, marginTop: space.md },
  pad: { padding: space.gutter, paddingBottom: 40 },
  hero: { alignItems: 'center', marginBottom: space.lg },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.lg },
  h: { fontSize: 30, lineHeight: 32, textTransform: 'uppercase', letterSpacing: 0.3 },
  section: { fontSize: 12, marginTop: space.xl, marginBottom: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
