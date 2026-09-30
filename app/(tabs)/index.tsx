import { useKeepAwake } from 'expo-keep-awake';
import { useIsFocused, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SyncPill } from '@/components/SyncPill';
import { T } from '@/components/T';
import {
  Badge,
  ClusterHero,
  Hanko,
  QuickActions,
  Surface,
  TelltaleRow,
  type BadgeTone,
  type Lamp,
  type Status,
} from '@/components/ui';
import { palette, radius, space } from '@/constants/theme';
import { clusterReading } from '@/lib/domain/cluster';
import { useSession } from '@/lib/cloud/auth';
import { FEATURE_BUILD, FEATURE_SYNC, FEATURE_TRACK, FEATURE_TRIPS } from '@/lib/flags';
import { SpeedCluster } from '@/components/ui/SpeedCluster';
import { Alert } from '@/lib/alert';
import { startManualTrip, stopTrip } from '@/lib/trips/live';
import { useLiveTrip } from '@/lib/trips/liveStore';
import { tripsKeepAwake, tripsMode, type TripsMode } from '@/lib/trips/settings';
import { garageFacts, lastWeeklyCheck, type GarageFacts } from '@/lib/db/garageQueries';
import { lampStates, toKatakana, vehicleBadges } from '@/lib/domain/garage';
import {
  odometerNow,
  odometer as odometerRepo,
  settings as settingsRepo,
  tasks as taskRepo,
  vehicles as vehicleRepo,
} from '@/lib/db/repos';
import { attentionReminders, evaluatedReminders, type EvaluatedReminder } from '@/lib/db/reminderQueries';
import type { Task } from '@/lib/db/types';
import { daysBetween, todayIso } from '@/lib/domain/dates';
import { currentMarbeteNudge, marbeteTierLabel } from '@/lib/domain/legal-dr';
import { mergeAttention, STATUS_LABEL } from '@/lib/domain/reminders';
import { economyLabel } from '@/lib/fuel';
import { fuelCfgFor, latestKnown, partialEconomy, weightedAverage } from '@/lib/domain/partialEconomy';
import { statusBadgeLabel } from '@/lib/domain/vehicleStatus';
import { km as fmtKm, kmPerUnit, money, volume as fmtVolume } from '@/lib/format';
import { es } from '@/lib/i18n/es';
import { inMonth, latestEconomyInsight, sumSpend } from '@/lib/math';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * Inicio — the cluster (IMP 28092026, Main.dc.html): what the car reads, which
 * lamps are lit, the two things it is waiting on, then the four things you came
 * to do.
 *
 * The MICM price board that used to be the hero moved to Más → Precios: it is
 * reference information about fuel prices, not a statement about *this* vehicle,
 * and the odometer is what everything else in Car Guy is computed from.
 */
/** Remembers that the account card was dismissed, so it never returns. */
const ACCOUNT_CARD_KEY = 'account_card_dismissed';

export default function HomeScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { activeVehicle, vehicleFillups, vehicleExpenses, data, setActiveVehicle } = useStore();

  const [odometerKm, setOdometerKm] = useState<number | null>(null);
  // ADR-30: the number on the LCD may be a trip's GPS estimate (shown with "≈").
  const [odometerEstimated, setOdometerEstimated] = useState(false);
  // Viajes (Phase 5A): the live trip, the device's trip mode, keep-awake, a short notice.
  const live = useLiveTrip();
  const [tripsModeNow, setTripsModeNow] = useState<TripsMode>('manual');
  const [keepAwake, setKeepAwake] = useState(true);
  const [tripNotice, setTripNotice] = useState<string | null>(null);
  const [tripBusy, setTripBusy] = useState(false);
  const focused = useIsFocused();
  useEffect(() => {
    if (!FEATURE_TRIPS) return;
    void tripsMode().then(setTripsModeNow);
    void tripsKeepAwake().then(setKeepAwake);
  }, [focused]);
  const [daysSince, setDaysSince] = useState<number | null>(null);
  const [monthKm, setMonthKm] = useState<number>(0);
  const [attention, setAttention] = useState<EvaluatedReminder[]>([]);
  // Every reminder, not just the due ones: the cluster's needle reads the
  // nearest interval even when the car is all green.
  const [allReminders, setAllReminders] = useState<EvaluatedReminder[]>([]);
  const [openTasks, setOpenTasks] = useState<Task[]>([]);
  const [modelYear, setModelYear] = useState<number | null>(null);
  const [weekly, setWeekly] = useState<{ lastAt: string | null; lastHadFailures: boolean } | null>(null);
  const [facts, setFacts] = useState<GarageFacts | null>(null);
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();

  // The account nudge: shown once the garage has something worth protecting,
  // dismissible for good. `null` means "not read from storage yet", which keeps
  // the card from flashing in on every launch before the setting arrives.
  const { session, configured } = useSession();
  const [accountCardHidden, setAccountCardHidden] = useState<boolean | null>(null);

  useEffect(() => {
    settingsRepo
      .get<boolean>(ACCOUNT_CARD_KEY, false)
      .then(setAccountCardHidden)
      .catch(() => setAccountCardHidden(true));
  }, []);

  const vehicleId = activeVehicle?.id;

  // Reads the odometer straight from the repos rather than the legacy store
  // shape, which has no notion of readings. Cancelled on unmount so a slow query
  // cannot set state on a screen that is gone.
  useEffect(() => {
    if (!vehicleId) return;
    let cancelled = false;

    (async () => {
      const [odo, readings, vehicle] = await Promise.all([
        odometerNow(vehicleId),
        odometerRepo.list(vehicleId, { orderBy: 'occurred_at', direction: 'DESC' }),
        vehicleRepo.getById(vehicleId),
      ]);
      if (cancelled) return;

      setOdometerKm(odo.km);
      setOdometerEstimated(odo.estimated);
      setModelYear(vehicle?.year ?? null);
      setDaysSince(readings[0] ? daysBetween(readings[0].occurredAt, todayIso()) : null);

      // Distance this month = newest reading minus the last one from before the
      // month started. Readings, not fill-ups: a service visit or a manual entry
      // moves the odometer too.
      const now = new Date(todayIso());
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 12).toISOString();
      const values = readings.filter((r) => r.occurredAt >= monthStart).map((r) => r.valueKm);
      if (values.length === 0) {
        setMonthKm(0);
        return;
      }
      const before = readings.find((r) => r.occurredAt < monthStart);
      const start = before?.valueKm ?? Math.min(...values);
      setMonthKm(Math.max(0, Math.max(...values) - start));
    })().catch(() => {});

    // The telltales now come from the real engine rather than the simple date
    // comparison Phase 3 used as a placeholder. Asked for more than four so
    // the merge with tasks below has something to rank.
    evaluatedReminders(vehicleId)
      .then((rows) => {
        if (!cancelled) setAllReminders(rows);
      })
      .catch(() => {});

    lastWeeklyCheck(vehicleId)
      .then((w) => {
        if (!cancelled) setWeekly(w);
      })
      .catch(() => {});

    garageFacts(vehicleId)
      .then((f) => {
        if (!cancelled) setFacts(f);
      })
      .catch(() => {});

    attentionReminders(vehicleId, 8)
      .then((rows) => {
        if (!cancelled) setAttention(rows);
      })
      .catch(() => {});

    // Open tasks belong on the same strip as the reminders: both are "the car
    // is waiting on you", and a note you wrote and never see again is a note
    // you may as well not have written.
    taskRepo
      .listWhere({ vehicleId })
      .then((rows) => {
        if (!cancelled) setOpenTasks(rows.filter((t) => t.status !== 'hecha').sort(byPriority));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [vehicleId, data]);

  if (!activeVehicle) return null;

  const now = new Date(todayIso());
  const monthLogs = vehicleFillups.filter((f) => inMonth(f.occurredAt, now.getFullYear(), now.getMonth()));
  const monthExpenses = vehicleExpenses.filter((e) =>
    inMonth(e.occurredAt, now.getFullYear(), now.getMonth()),
  );
  const monthSpend = sumSpend(monthLogs) + monthExpenses.reduce((total, e) => total + e.amountDop, 0);

  // Note 4: measured tanks plus the gauge estimates (research 02 §1). The
  // insight stays on measured tanks only — never an alarm on an estimate.
  const includeEstimates = Boolean(data.settings.includeEstimates);
  const partial = partialEconomy(vehicleFillups, fuelCfgFor(activeVehicle.detail), { includeEstimates });
  const last = latestKnown(partial.series);
  const lastEstimated = last?.status === 'estimated';
  const insight = latestEconomyInsight(vehicleFillups);
  const avg = partial.average;

  // Pendientes: one list, worst first across reminders and tasks (see
  // `mergeAttention`) — a critical task from a failed check outranks an
  // overdue oil change. Two rows on Inicio; the rest is a tap away.
  const pending: Pending[] = mergeAttention(attention, openTasks, 2).map((entry) =>
    entry.kind === 'reminder'
      ? {
          key: entry.item.reminder.id,
          status: entry.item.status.status === 'sin_datos' ? 'proximo' : entry.item.status.status,
          title: entry.item.reminder.title,
          countdown: countdown(entry.item.status),
          onPress: () => router.push({ pathname: '/recordatorio/[id]', params: { id: entry.item.reminder.id } }),
        }
      : {
          key: entry.item.id,
          status: TASK_STATUS[entry.item.priority],
          title: entry.item.title,
          countdown: es.home.taskCountdown,
          onPress: () => router.push({ pathname: '/tarea/[id]', params: { id: entry.item.id } }),
        },
  );

  const lamps: Lamp[] = lampStates(allReminders, weekly).map((l) => ({
    icon: l.icon,
    status: l.state,
    label: l.label,
    onPress: l.icon === 'checklist' ? () => router.push('/chequeo') : () => router.push('/recordatorios'),
  }));

  const notify = (text: string) => {
    setTripNotice(text);
    setTimeout(() => setTripNotice(null), 4000);
  };
  const beginTrip = async () => {
    setTripBusy(true);
    const result = await startManualTrip(activeVehicle.id);
    setTripBusy(false);
    if (result.ok) return;
    if (result.reason === 'permission') {
      Alert.alert(es.trips.title, es.trips.permissionDenied, [
        { text: es.common.cancel, style: 'cancel' },
        { text: es.trips.openSettings, onPress: () => void Linking.openSettings() },
      ]);
    } else if (result.reason !== 'busy') notify(es.trips.needPermission);
  };
  const finishTrip = async () => {
    const result = await stopTrip();
    if (result.kind === 'discarded') {
      notify(
        result.reason === 'duration'
          ? es.trips.discardedBrief(Math.max(1, Math.round(result.durationS / 60)))
          : es.trips.discardedShort(Math.round(result.distanceM)),
      );
    }
    else if (result.kind === 'saved') notify(es.trips.saved((result.distanceM / 1000).toFixed(1)));
  };

  const detail = activeVehicle.detail;
  const badges = detail ? vehicleBadges(detail, facts ?? { installedMods: 0 }) : [];

  const marbeteNotice = currentMarbeteNudge(todayIso());
  const marbeteTier = marbeteNotice ? marbeteTierLabel(modelYear, todayIso()) : null;
  const monthEconomy = partial.series.filter(
    (p) => inMonth(p.occurredAt, now.getFullYear(), now.getMonth()) && (p.status !== 'estimated' || includeEstimates),
  );
  const monthAvg = weightedAverage(monthEconomy) ?? avg;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg.base }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.pad}>
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <View style={styles.brandRow}>
              <T face="eyebrow" style={{ color: theme.accent, fontSize: 12 }}>
                {es.home.eyebrow}
              </T>
              <T face="kana" style={{ color: theme.text.muted, fontSize: 10 }}>
                車
              </T>
            </View>
            <T face="display" style={[styles.brand, { color: theme.text.primary }]}>
              {es.home.title}
            </T>
          </View>
          {/* Signed in only: without an account there is nothing to be in step with. */}
          {FEATURE_SYNC && session ? <SyncPill /> : null}
          <Pressable
            onPress={() => router.push('/cuenta')}
            accessibilityRole="button"
            accessibilityLabel={es.routes.account}
            hitSlop={8}>
            <Hanko char="改" size={42} accessibilityLabel={es.routes.account} />
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.switcher}>
          {data.vehicles.filter((v) => !v.isArchived).map((v) => {
            const on = v.id === activeVehicle.id;
            const kana = toKatakana(v.detail?.nickname);
            // v6: any non-active status on the chip (PROYECTO, EN TALLER, ACCIDENTADO…).
            const statusTag = v.detail && v.detail.status !== 'activo' ? statusBadgeLabel(v.detail.status) : null;
            return (
              <Pressable
                key={v.id}
                onPress={() => setActiveVehicle(v.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={[v.name, v.detail?.nickname, v.detail && statusTag ? es.vehicleStatus[v.detail.status] : null].filter(Boolean).join(', ')}
                style={[
                  styles.chip,
                  { backgroundColor: on ? theme.accentFill : theme.bg.surface, borderColor: on ? theme.accentFill : theme.lineStrong },
                ]}>
                <T face="title" style={[styles.chipLabel, { color: on ? theme.accentFillInk : theme.text.secondary }]}>
                  {v.name.toUpperCase()}
                </T>
                {kana ? (
                  <T face="kana" style={{ color: on ? theme.accentFillInk : theme.text.muted, fontSize: 10, marginLeft: 6 }}>
                    {kana}
                  </T>
                ) : null}
                {statusTag ? (
                  <T face="title" style={[styles.chipLabel, { color: on ? theme.accentFillInk : theme.statusText.urgente }]}>
                    {' · '}
                    {statusTag}
                  </T>
                ) : null}
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => router.push('/vehiculo/nuevo')}
            accessibilityRole="button"
            style={[styles.chip, { backgroundColor: theme.bg.raised, borderColor: theme.line }]}>
            <T face="title" style={[styles.chipLabel, { color: theme.text.secondary }]}>
              {es.home.addVehicle}
            </T>
          </Pressable>
        </ScrollView>

        {tripNotice ? (
          <Surface style={{ marginBottom: space.md }}>
            <T face="body" accessibilityRole="alert" style={{ color: theme.text.secondary, fontSize: 14 }}>
              {tripNotice}
            </T>
          </Surface>
        ) : null}

        {FEATURE_TRIPS && live && live.vehicleId === activeVehicle.id ? (
          <Animated.View key="speed" entering={reduced ? undefined : FadeIn.duration(300)} exiting={reduced ? undefined : FadeOut.duration(300)}>
            {keepAwake && focused && Platform.OS !== 'web' ? <KeepScreenOn /> : null}
            <SpeedCluster
              limitKmh={activeVehicle.detail?.limitKmh ?? 120}
              size={Math.min(340, Math.max(240, width - 72))}
              onStop={() => void finishTrip()}
            />
          </Animated.View>
        ) : (
        <Animated.View key="odo" entering={reduced ? undefined : FadeIn.duration(300)}>
        <ClusterHero
          odometerKm={odometerKm}
          reading={clusterReading(allReminders)}
          caption={odometerEstimated ? es.trips.odometerEstimated : odometerCaption(daysSince)}
          size={Math.min(340, Math.max(240, width - 72))}
          onPress={() => router.push('/recordatorios')}
          onPressOdometer={() => router.push('/odometro')}
          header={
            <View style={styles.heroHeader}>
              <T face="title" numberOfLines={1} style={{ color: palette.dark.text.secondary, fontSize: 15, letterSpacing: 1, flexShrink: 1 }}>
                {activeVehicle.name.toUpperCase()}
              </T>
              {badges.slice(0, 2).map((b) => (
                <Badge key={b.label} label={b.label} tone={b.tone} />
              ))}
            </View>
          }>
          <View style={{ marginTop: space.md }}>
            <TelltaleRow lamps={lamps} />
          </View>
        </ClusterHero>
        </Animated.View>
        )}

        {FEATURE_TRIPS && tripsModeNow !== 'off' && !live ? (
          <Pressable
            onPress={() => void beginTrip()}
            disabled={tripBusy}
            accessibilityRole="button"
            style={[styles.pendingRow, { backgroundColor: theme.bg.surface, borderColor: theme.lineStrong, borderLeftColor: theme.accent }]}>
            <View style={{ flex: 1 }}>
              <T face="semibold" style={{ color: theme.text.primary, fontSize: 15 }}>
                {es.trips.start}
              </T>
              <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginTop: 2 }}>
                {tripsModeNow === 'auto' ? es.trips.startHintAuto : es.trips.startHint}
              </T>
            </View>
          </Pressable>
        ) : null}

        {pending.length ? (
          <View style={styles.pending}>
            {pending.map((p) => (
              <Pressable
                key={p.key}
                onPress={p.onPress}
                accessibilityRole="button"
                accessibilityLabel={`${STATUS_LABEL[p.status]}: ${p.title}, ${p.countdown}`}
                style={[styles.pendingRow, { backgroundColor: theme.bg.surface, borderColor: theme.lineStrong, borderLeftColor: theme.status[p.status] }]}>
                <Badge label={STATUS_LABEL[p.status].toUpperCase()} tone={BADGE_TONE[p.status]} />
                <T face="medium" numberOfLines={1} style={{ color: theme.text.primary, fontSize: 15, flex: 1 }}>
                  {p.title}
                </T>
                <T face="mono" style={{ color: theme.statusText[p.status], fontSize: 12 }}>
                  {p.countdown}
                </T>
              </Pressable>
            ))}
          </View>
        ) : null}

        {marbeteNotice ? (
          <Pressable
            onPress={() => router.push('/recordatorios')}
            accessibilityRole="button"
            accessibilityLabel={`${es.documents.kinds.marbete}: ${marbeteNotice.message}`}
            style={[styles.banner, { backgroundColor: theme.statusBg.proximo, borderColor: theme.status.proximo }]}>
            <T face="semibold" style={{ color: theme.statusText.proximo, fontSize: 13 }}>
              {es.documents.kinds.marbete}
            </T>
            <T face="body" style={{ color: theme.text.secondary, fontSize: 13, marginTop: 2 }}>
              {marbeteNotice.message}
            </T>
            {marbeteTier ? (
              <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginTop: 4 }}>
                {marbeteTier}
              </T>
            ) : null}
          </Pressable>
        ) : null}

        {configured && !session && accountCardHidden === false ? (
          <Surface style={styles.accountCard}>
            <T face="semibold" style={{ color: theme.text.primary, fontSize: 15 }}>
              {es.account.onboardingTitle}
            </T>
            <T
              face="body"
              style={{ color: theme.text.secondary, fontSize: 13, marginTop: 4, lineHeight: 19 }}>
              {es.account.onboardingBody}
            </T>
            <View style={styles.accountActions}>
              <Pressable
                onPress={() => router.push('/cuenta')}
                accessibilityRole="button"
                style={[styles.accountPrimary, { backgroundColor: theme.accentFill }]}>
                <T face="semibold" style={{ color: theme.accentFillInk, fontSize: 13 }}>
                  {es.account.onboardingAction}
                </T>
              </Pressable>
              <Pressable
                onPress={() => {
                  setAccountCardHidden(true);
                  void settingsRepo.set(ACCOUNT_CARD_KEY, true);
                }}
                accessibilityRole="button"
                style={styles.accountDismiss}>
                <T face="semibold" style={{ color: theme.text.secondary, fontSize: 13 }}>
                  {es.account.onboardingDismiss}
                </T>
              </Pressable>
            </View>
          </Surface>
        ) : null}

        <QuickActions
          actions={[
            { label: es.quickActions.fuel, icon: 'flash-outline', onPress: () => router.push('/carga/nueva') },
            { label: es.quickActions.check, icon: 'clipboard-outline', onPress: () => router.push('/chequeo') },
            // BUILD and PISTA take these slots once their phases ship (ADR-24).
            FEATURE_BUILD
              ? { label: es.quickActions.build, icon: 'construct-outline', onPress: () => router.push({ pathname: '/vehiculo/[id]', params: { id: activeVehicle.id, tab: 'build' } }) }
              : { label: es.quickActions.service, icon: 'construct-outline', onPress: () => router.push('/servicio/nuevo') },
            FEATURE_TRACK
              ? { label: es.quickActions.track, icon: 'speedometer-outline', onPress: () => router.push({ pathname: '/pista', params: { vehicleId: activeVehicle.id } }) }
              : { label: es.quickActions.expense, icon: 'cash-outline', onPress: () => router.push('/gasto/nuevo') },
          ]}
        />

        <View style={[styles.monthStrip, { backgroundColor: theme.bg.surface, borderColor: theme.lineStrong }]}>
          <View style={styles.brandRow}>
            <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11 }}>
              {es.home.monthStrip}
            </T>
            <T face="kana" style={{ color: theme.text.muted, fontSize: 9 }}>
              記録
            </T>
          </View>
          <View style={styles.monthRow}>
            <MonthStat label={es.home.monthSpend} value={money(monthSpend)} wide />
            <MonthStat label={es.home.monthKm} value={fmtKm(Math.round(monthKm))} />
            <MonthStat
              label={es.home.monthEconomy}
              value={monthAvg != null ? kmPerUnit(monthAvg, activeVehicle.defaultFuelType, activeVehicle.detail?.volumeUnit) : '—'}
            />
          </View>
          <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginTop: space.sm }}>
            {es.home.monthFillupsLine(monthLogs.length)}
          </T>
        </View>

        {insight ? (
          <Surface style={{ marginBottom: space.md }}>
            <T face="semibold" style={{ color: theme.accent, fontSize: 15 }}>
              {insight.status === 'low'
                ? es.home.insightLow
                : insight.status === 'great'
                  ? es.home.insightGreat
                  : es.home.insightNormal}
            </T>
            <T face="body" style={[styles.alertText, { color: theme.text.secondary }]}>
              {insight.status === 'low'
                ? es.home.insightLowBody(Math.abs(insight.differencePercent).toFixed(0))
                : insight.status === 'great'
                  ? es.home.insightGreatBody(insight.differencePercent.toFixed(0))
                  : es.home.insightNormalBody}
            </T>
          </Surface>
        ) : null}

        <Surface>
          <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11 }}>
            {es.home.lastTank}
          </T>
          <T face="monoBold" style={[styles.statVal, { color: lastEstimated ? theme.text.muted : theme.text.primary }]}>
            {last ? `${lastEstimated ? '≈ ' : ''}${kmPerUnit(last.kmPerUnit, activeVehicle.defaultFuelType, activeVehicle.detail?.volumeUnit)}` : '—'}
          </T>
          <T face="body" style={[styles.statHint, { color: theme.text.muted }]}>
            {last
              ? es.home.lastTankHint(
                  fmtKm(last.distanceKm),
                  fmtVolume(last.volume, activeVehicle.defaultFuelType, activeVehicle.detail?.volumeUnit),
                )
              : avg == null
                ? es.home.averageEmpty(economyLabel(activeVehicle.defaultFuelType, activeVehicle.detail?.volumeUnit))
                : es.home.lastTankEmpty}
          </T>
        </Surface>
      </ScrollView>
    </SafeAreaView>
  );
}

/** `wide` for the money column: "RD$ 3,806.40" should not wrap under its currency. */
function MonthStat({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.monthStat, wide && { flex: 1.4 }]}>
      <T face="monoBold" numberOfLines={1} style={{ color: theme.text.primary, fontSize: value.length > 12 ? 14 : 16 }}>
        {value}
      </T>
      <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginTop: 2 }}>
        {label}
      </T>
    </View>
  );
}

/** Critical first, then normal, then the nice-to-haves. */
function byPriority(a: Task, b: Task): number {
  const rank = { critica: 0, normal: 1, baja: 2 };
  return rank[a.priority] - rank[b.priority];
}

type Pending = { key: string; status: Status; title: string; countdown: string; onPress: () => void };

/** The mono countdown on a Pendientes row: "1,250 km", "−320 km", "12 d", "−3 d". */
function countdown(status: EvaluatedReminder['status']): string {
  if (status.status === 'sin_datos') return es.home.noDataShort;
  const byKm = status.dueKm != null && (status.dueDays == null || status.dueKm / 50 < status.dueDays);
  if (byKm) return `${status.dueKm! < 0 ? '−' : ''}${fmtKm(Math.abs(Math.round(status.dueKm!)))}`;
  if (status.dueDays != null) return `${status.dueDays < 0 ? '−' : ''}${Math.abs(status.dueDays)} d`;
  return STATUS_LABEL[status.status];
}

/** expo-keep-awake's hook, mounted only while the speed cluster is up and Inicio is focused. */
function KeepScreenOn() {
  useKeepAwake('car-guy-trip');
  return null;
}

function odometerCaption(daysSince: number | null): string {
  if (daysSince == null) return es.home.odometerTapHint;
  if (daysSince <= 0) return es.home.updatedToday;
  if (daysSince === 1) return es.home.updatedYesterday;
  return es.home.updatedDaysAgo(daysSince);
}

/** Priority reads as urgency, same vocabulary as the reminders. */
const TASK_STATUS: Record<Task['priority'], Status> = {
  critica: 'vencido',
  normal: 'proximo',
  baja: 'ok',
};

const BADGE_TONE: Record<Status, BadgeTone> = { vencido: 'red', urgente: 'amber', proximo: 'amber', ok: 'green' };

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  accountCard: { marginBottom: space.md },
  accountActions: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.md },
  accountPrimary: {
    paddingHorizontal: space.lg,
    minHeight: 40,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountDismiss: {
    paddingHorizontal: space.md,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  safe: { flex: 1 },
  pad: { padding: space.gutter, paddingBottom: 40 },
  brandRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  brand: { fontSize: 34, marginTop: 2, marginBottom: space.md, textTransform: 'uppercase' },
  switcher: { marginBottom: space.lg },
  chip: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md + 2,
    paddingVertical: space.sm,
    borderRadius: radius.tag,
    marginRight: space.sm,
    borderWidth: 1,
  },
  chipLabel: { fontSize: 14, letterSpacing: 0.8 },
  heroHeader: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.sm },
  pending: { gap: space.sm, marginBottom: space.lg },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: 10,
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderLeftWidth: 3,
    borderRadius: radius.input,
    minHeight: 48,
  },
  monthStrip: {
    borderWidth: 1,
    borderRadius: radius.card,
    padding: space.lg,
    marginTop: space.lg,
    marginBottom: space.md,
  },
  monthRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.md },
  monthStat: { flex: 1 },
  banner: { borderWidth: 1, borderRadius: radius.input, padding: space.md, marginBottom: space.lg },
  alertText: { fontSize: 13, lineHeight: 19, marginTop: 5 },
  statVal: { fontSize: 22, marginTop: space.sm },
  statHint: { fontSize: 12, marginTop: 6 },
});
