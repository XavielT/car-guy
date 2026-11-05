import { useKeepAwake } from 'expo-keep-awake';
import Ionicons from '@expo/vector-icons/Ionicons';
import { CarHealth } from '@/components/ai/CarHealth';
import { DictateSheet } from '@/components/ai/DictateSheet';
import { QueueNotice } from '@/components/ai/QueueNotice';
import { HomeNudge } from '@/components/features/HomeNudge';
import { useOpenDtcCount, useOpenFeature } from '@/components/features/useFeatures';
import { activeFeatures, featureForTelltale, LAMP_TELLTALE } from '@/lib/features/registry';
import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TabsClusterSkeleton } from '@/components/skeletons/TabsInicioSkeleton';
import { SyncPill } from '@/components/SyncPill';
import { usePermissionRequest } from '@/components/permissions/usePermissionRequest';
import { T } from '@/components/T';
import {
  Badge,
  BigActions,
  ClusterHero,
  Collapsible,
  NextStepCard,
  type BigActionDef,
  Surface,
  TelltaleRow,
  type BadgeTone,
  type Lamp,
  type Status,
} from '@/components/ui';
import { palette, radius, space } from '@/constants/theme';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { clusterReading } from '@/lib/domain/cluster';
import { useSession } from '@/lib/cloud/auth';
import { FEATURE_SYNC, FEATURE_TRIPS } from '@/lib/flags';
import { SpeedCluster } from '@/components/ui/SpeedCluster';
import { startManualTrip, stopTrip } from '@/lib/trips/live';
import { useLiveTrip } from '@/lib/trips/liveStore';
import { useProfile } from '@/lib/profile';
import { Avatar } from '@/components/Avatar';
import { FeatureSetSheet } from '@/components/features/FeatureSetSheet';
import { FirstSteps, type FirstStep } from '@/components/features/FirstSteps';
import { nextStep, type NextStep } from '@/lib/domain/nextStep';
import { loadRecapInput } from '@/lib/db/recapQueries';
import { buildRecap, recapReady } from '@/lib/domain/recap';
import { recapTitle } from '@/lib/recap/copy';
import { FEATURE_OFFER_DISMISSED_KEY, FIRST_STEPS_HIDDEN_KEY, readFlag, readSnoozed, setFlag, snoozeStep } from '@/lib/domain/nextStepStore';
import { includesTopic, shouldOfferSet, suggestTopics } from '@/lib/features/featureSet';
import { useFeatureSet } from '@/lib/features/featureSetStore';
import { readUsedAt } from '@/lib/features/usage';
import { TipCard } from '@/components/TipCard';
import { AutoBlockedCard } from '@/components/trips/TripPieces';
import { UpdateBanner } from '@/components/updates/UpdateBanner';
import { useInstallOffer } from '@/lib/release/useInstallOffer';
import { tripsKeepAwake, tripsMode, type TripsMode } from '@/lib/trips/settings';
import { garageFacts, lastWeeklyCheck, type GarageFacts } from '@/lib/db/garageQueries';
import { lampStates, toKatakana, vehicleBadges } from '@/lib/domain/garage';
import {
  odometerNow,
  documents as documentRepo,
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
import { tankNow } from '@/lib/domain/gaugeVehicle';
import { FEATURE_GAUGE_SEGMENTS } from '@/lib/flagsV10';
import { statusBadgeLabel } from '@/lib/domain/vehicleStatus';
import { km as fmtKm, kmPerUnit, money, volume as fmtVolume } from '@/lib/format';
import { t } from '@/lib/i18n';
import { catalogLabel } from '@/lib/i18n/catalog';
import { inMonth, latestEconomyInsight, sumSpend } from '@/lib/math';
import { useStore } from '@/lib/store';
import { DashCol, DashCols } from '@/components/layout/DashCols';
import { useLayout } from '@/lib/theme/useLayout';
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
  const profile = useProfile();
  const { theme } = useTheme();
  const { activeVehicle, vehicleFillups, vehicleExpenses, data, setActiveVehicle } = useStore();

  // IMP 03112026 (ADR-67): one sentence, spoken or typed, opens the right form pre-filled.
  // The PWA's "Dictar" shortcut (manifest) opens Inicio with ?dictar=1, so the sheet starts open in that case.
  const { dictar } = useLocalSearchParams<{ dictar?: string }>();
  const [dictateOpen, setDictateOpen] = useState(dictar === '1');
  const [odometerKm, setOdometerKm] = useState<number | null>(null);
  // ADR-30: the number on the LCD may be a trip's GPS estimate (shown with "≈").
  const [odometerEstimated, setOdometerEstimated] = useState(false);
  // Viajes (Phase 5A): the live trip, the device's trip mode, keep-awake, a short notice.
  const live = useLiveTrip();
  const installOffer = useInstallOffer();
  const [tripsModeNow, setTripsModeNow] = useState<TripsMode>('manual');
  const [keepAwake, setKeepAwake] = useState(true);
  const [tripNotice, setTripNotice] = useState<string | null>(null);
  const location = usePermissionRequest('location_foreground');
  const openDtc = useOpenDtcCount(activeVehicle?.id);
  const { open: openFeature } = useOpenFeature();
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
  // The cluster is the part of Inicio that waits on queries (odometer,
  // reminders, the weekly check); everything else is the store's, already in
  // memory. False until the first read answers — later reloads keep the last
  // reading on screen instead of flashing the outline (ADR-40).
  const [clusterLoaded, setClusterLoaded] = useState(false);
  const showClusterSkeleton = useDelayedLoading(!clusterLoaded);
  const { width } = useWindowDimensions();
  // SPEC-F: from 1024 px the dashboard has two columns (the cluster on the left, everything else on the right); a phone is untouched.
  const { wide } = useLayout();
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

  // Hoy (SPEC-K §K1): what the next-step card needs, all local.
  const { set: featureSet } = useFeatureSet();
  const [snoozed, setSnoozed] = useState<Record<string, number>>({});
  const [usedAt, setUsedAt] = useState<Record<string, number>>({});
  const [stepFlags, setStepFlags] = useState({ firstStepsHidden: false, offerDismissed: false });
  const [expiringDoc, setExpiringDoc] = useState<{ id: string; title: string; daysLeft: number } | null>(null);
  // SPEC-J §J1: the recap that just closed (days 1–14), only if it has something to show.
  const [recapNow, setRecapNow] = useState<{ id: string; label: string } | null>(null);
  const [setOpen, setSetOpen] = useState(false);
  // "Now" for the snooze check: read when Hoy gains focus, never during render.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    void Promise.all([readSnoozed(), readUsedAt(), readFlag(FIRST_STEPS_HIDDEN_KEY), readFlag(FEATURE_OFFER_DISMISSED_KEY)]).then(([sn, ua, fh, od]) => {
      setNowMs(Date.now());
      setSnoozed(sn);
      setUsedAt(ua);
      setStepFlags({ firstStepsHidden: fh, offerDismissed: od });
    });
  }, [focused]);

  useEffect(() => {
    let live = true;
    const ready = recapReady(todayIso());
    const cars = data.vehicles.map((v) => ({ id: v.id, name: v.name, photoMediaId: null }));
    void (ready.length ? loadRecapInput(cars, data.fillups) : Promise.resolve(null)).then((input) => {
      if (!live) return;
      if (!input) return setRecapNow(null);
      const hit = ready.map((p) => buildRecap(input, p, { kind: 'all' }, todayIso())).find((r) => !r.thin);
      setRecapNow(hit ? { id: hit.id, label: recapTitle(hit).toLowerCase() } : null);
    });
    return () => {
      live = false;
    };
  }, [data]);

  const vehicleId = activeVehicle?.id;

  // Reads the odometer straight from the repos rather than the legacy store
  // shape, which has no notion of readings. Cancelled on unmount so a slow query
  // cannot set state on a screen that is gone.
  useEffect(() => {
    if (!vehicleId) return;
    let cancelled = false;

    const odometerRead = (async () => {
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
    const remindersRead = evaluatedReminders(vehicleId)
      .then((rows) => {
        if (!cancelled) setAllReminders(rows);
      })
      .catch(() => {});

    const weeklyRead = lastWeeklyCheck(vehicleId)
      .then((w) => {
        if (!cancelled) setWeekly(w);
      })
      .catch(() => {});

    // The three reads the cluster card is drawn from: once they answered, it is real.
    void Promise.all([odometerRead, remindersRead, weeklyRead]).then(() => {
      if (!cancelled) setClusterLoaded(true);
    });

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

    documentRepo
      .listWhere({ vehicleId })
      .then((rows) => {
        if (cancelled) return;
        const today = todayIso();
        const dated = rows.filter((d) => d.expiresAt).map((d) => ({ id: d.id, title: d.title, daysLeft: daysBetween(today, d.expiresAt as string) }));
        dated.sort((a, b) => a.daysLeft - b.daysLeft);
        setExpiringDoc(dated[0] ?? null);
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
          title: catalogLabel('reminder', entry.item.reminder, 'title'),
          countdown: countdown(entry.item.status),
          onPress: () => router.push({ pathname: '/recordatorio/[id]', params: { id: entry.item.reminder.id } }),
        }
      : {
          key: entry.item.id,
          status: TASK_STATUS[entry.item.priority],
          title: entry.item.title,
          countdown: t.home.taskCountdown,
          onPress: () => router.push({ pathname: '/tarea/[id]', params: { id: entry.item.id } }),
          // X7: a task is a Pendiente; one tap opens the repair form with it loaded and closing on save.
          onResolve: () => router.push({ pathname: '/servicio/nuevo', params: { kind: 'reparacion', title: entry.item.title, resolve: `task:${entry.item.id}`, vehicleId: entry.item.vehicleId } }),
        },
  );

  // What a lamp opens comes from the registry (ADR-62); a long press says what that is.
  const lampTarget = (icon: string) => {
    const tt = LAMP_TELLTALE[icon];
    const def = tt ? featureForTelltale(tt) : undefined;
    return def ? { onPress: () => openFeature(def), hint: t.features.telltale.hint[tt as keyof typeof t.features.telltale.hint] } : { onPress: () => router.push('/recordatorios') };
  };
  const lamps: Lamp[] = lampStates(allReminders, weekly).map((l) => ({
    icon: l.icon,
    status: l.state,
    label: l.label,
    ...lampTarget(l.icon),
  }));
  // CHECK (SPEC-C §5): off unless a saved OBD code is still unresolved — then amber, and it opens the diagnostics.
  lamps.unshift({
    icon: 'engine',
    status: openDtc ? 'proximo' : 'off',
    label: t.features.telltale.check,
    ...lampTarget('engine'),
  });
  // IMP 01102026 Phase 3 (research 03 §4): the fuel lamp — amber at ≤ 2 squares / 2/8 / 20 %, red at the reserve.
  const tank = FEATURE_GAUGE_SEGMENTS && activeVehicle.detail ? tankNow(activeVehicle.detail, vehicleFillups, odometerKm) : null;
  if (tank) {
    lamps.push({
      icon: 'fuel',
      status: tank.telltale === 'red' ? 'vencido' : tank.telltale === 'amber' ? 'proximo' : 'off',
      label: t.gauge.tank,
      ...lampTarget('fuel'),
    });
  }

  const notify = (text: string) => {
    setTripNotice(text);
    setTimeout(() => setTripNotice(null), 4000);
  };
  const beginTrip = async () => {
    // Explain first, then ask (or show how, if it is blocked): never the system dialog in cold (ADR-59).
    if (!(await location.ensure())) return;
    const result = await startManualTrip(activeVehicle.id);
    if (result.ok) return;
    if (result.reason !== 'busy') notify(t.trips.needPermission);
  };
  const finishTrip = async () => {
    const result = await stopTrip();
    if (result.kind === 'discarded') {
      notify(
        result.reason === 'duration'
          ? t.trips.discardedBrief(Math.max(1, Math.round(result.durationS / 60)))
          : t.trips.discardedShort(Math.round(result.distanceM)),
      );
    }
    else if (result.kind === 'saved') notify(t.trips.saved((result.distanceM / 1000).toFixed(1)));
  };

  const detail = activeVehicle.detail;
  const badges = detail ? vehicleBadges(detail, facts ?? { installedMods: 0 }) : [];

  const marbeteNotice = currentMarbeteNudge(todayIso());
  const marbeteTier = marbeteNotice ? marbeteTierLabel(modelYear, todayIso()) : null;
  const monthEconomy = partial.series.filter(
    (p) => inMonth(p.occurredAt, now.getFullYear(), now.getMonth()) && (p.status !== 'estimated' || includeEstimates),
  );
  const monthAvg = weightedAverage(monthEconomy) ?? avg;

  // ---- Hoy: the ONE next step, the (≤ 4) big actions, the first steps.
  const lastFill = vehicleFillups.reduce<string | null>((m, f2) => (m == null || f2.occurredAt > m ? f2.occurredAt : m), null);
  const firstOverdue = allReminders.find((r) => r.status.status === 'vencido');
  const stepsDone = { vehicle: true, fillup: vehicleFillups.length > 0, trips: !FEATURE_TRIPS || tripsModeNow === 'auto' };
  const firstStepsActive = !stepFlags.firstStepsHidden && !(stepsDone.fillup && stepsDone.trips);
  const firstRunPick = firstStepsActive ? (!stepsDone.fillup ? ('fillup' as const) : !stepsDone.trips ? ('trips' as const) : null) : null;
  const activity: import('@/lib/features/ids').FeatureId[] = [];
  if (vehicleFillups.some((f2) => daysBetween(f2.occurredAt, todayIso()) <= 60)) activity.push('fuel');
  if (vehicleExpenses.some((e) => daysBetween(e.occurredAt, todayIso()) <= 60)) activity.push('expense');
  const suggestion = suggestTopics(activeFeatures(), usedAt, activity, nowMs);
  const topAction = (usedAt.trip ?? 0) > (usedAt.fuel ?? 0) && (usedAt.trip ?? 0) > (usedAt.service ?? 0) ? ('trip' as const) : (usedAt.service ?? 0) > (usedAt.fuel ?? 0) ? ('service' as const) : ('fuel' as const);
  const step: NextStep = nextStep({
    now: nowMs,
    hasVehicle: true,
    overdue: firstOverdue
      ? {
          id: firstOverdue.reminder.id,
          title: catalogLabel('reminder', firstOverdue.reminder, 'title'),
          daysOverdue: firstOverdue.status.dueDays != null && firstOverdue.status.dueDays < 0 ? Math.abs(firstOverdue.status.dueDays) : null,
          legal: firstOverdue.reminder.legalKind != null,
        }
      : null,
    document: expiringDoc,
    fillupCount: vehicleFillups.length,
    daysSinceFillup: lastFill ? daysBetween(lastFill, todayIso()) : null,
    daysSinceOdometer: daysSince,
    recap: recapNow,
    detection: null, // SPEC-H detection health (PROMPT-09); AutoBlockedCard still says it, below.
    firstRun: firstRunPick,
    offerFeatureSet: shouldOfferSet(featureSet, suggestion, stepFlags.offerDismissed),
    topAction,
    snoozed,
  });
  const laterStep = async () => setSnoozed(await snoozeStep(step.key));
  const stepView = (() => {
    const go = (href: Parameters<typeof router.push>[0]) => () => router.push(href);
    switch (step.kind) {
      case 'addVehicle':
        return { title: t.hoy.step.addVehicle.title, body: t.hoy.step.addVehicle.body, cta: t.hoy.step.addVehicle.cta, onAction: go('/vehiculo/nuevo'), tone: 'accent' as const, icon: 'car-outline' as const, later: false };
      case 'overdue':
        return { title: t.hoy.step.overdueTitle(step.title, step.daysOverdue), body: step.legal ? t.hoy.step.overdueLegal : t.hoy.step.overdueBody, cta: t.hoy.step.overdueCta, onAction: go({ pathname: '/recordatorio/[id]', params: { id: step.id } }), tone: 'urgent' as const, icon: 'alert-circle-outline' as const, later: true };
      case 'document':
        return { title: t.hoy.step.documentTitle(step.title, step.daysLeft), body: t.hoy.step.documentBody, cta: t.hoy.step.documentCta, onAction: go({ pathname: '/documento/[id]', params: { id: step.id } }), tone: step.daysLeft < 0 ? ('urgent' as const) : ('warn' as const), icon: 'document-text-outline' as const, later: true };
      case 'fuel':
        return { title: step.neverLogged ? t.hoy.step.fuelNever : t.hoy.step.fuelLate(step.days ?? 0), body: step.neverLogged ? t.hoy.step.fuelNeverBody : t.hoy.step.fuelLateBody, cta: t.hoy.step.fuelCta, onAction: go('/carga/nueva'), tone: 'accent' as const, icon: 'flash-outline' as const, later: true };
      case 'odometer':
        return { title: t.hoy.step.odometerTitle, body: t.hoy.step.odometerBody(step.days ?? 0), cta: t.hoy.step.odometerCta, onAction: go('/odometro'), tone: 'accent' as const, icon: 'speedometer-outline' as const, later: true };
      case 'recap':
        return { title: t.hoy.step.recapTitle(step.label), body: t.hoy.step.recapBody, cta: t.hoy.step.recapCta, onAction: go({ pathname: '/resumen/[period]', params: { period: step.id } } as never), tone: 'accent' as const, icon: 'stats-chart-outline' as const, later: true };
      case 'detection':
        return { title: t.hoy.step.detectionTitle, body: step.message, cta: t.hoy.step.detectionCta, onAction: go('/viajes/permisos'), tone: 'warn' as const, icon: 'navigate-outline' as const, later: true };
      case 'firstRun':
        return step.item === 'trips'
          ? { title: t.hoy.step.tripsTitle, body: t.hoy.step.tripsBody, cta: t.hoy.step.tripsCta, onAction: go('/viajes/ajustes'), tone: 'accent' as const, icon: 'navigate-outline' as const, later: true }
          : { title: t.hoy.step.fuelNever, body: t.hoy.step.fuelNeverBody, cta: t.hoy.step.fuelCta, onAction: go('/carga/nueva'), tone: 'accent' as const, icon: 'flash-outline' as const, later: true };
      case 'featureSet':
        return { title: t.hoy.step.featureSetTitle, body: t.hoy.step.featureSetBody, cta: t.hoy.step.featureSetCta, onAction: () => setSetOpen(true), tone: 'accent' as const, icon: 'options-outline' as const, later: true };
      default:
        return step.action === 'trip'
          ? { title: t.hoy.step.topTripTitle, body: t.hoy.step.topTripBody, cta: t.hoy.actions.trip, onAction: () => void beginTrip(), tone: 'accent' as const, icon: 'navigate-outline' as const, later: false }
          : step.action === 'service'
            ? { title: t.hoy.step.topServiceTitle, body: t.hoy.step.topServiceBody, cta: t.hoy.actions.service, onAction: go('/servicio/nuevo'), tone: 'accent' as const, icon: 'construct-outline' as const, later: false }
            : { title: t.hoy.step.topFuelTitle, body: t.hoy.step.topFuelBody, cta: t.hoy.actions.fuel, onAction: go('/carga/nueva'), tone: 'accent' as const, icon: 'flash-outline' as const, later: false };
    }
  })();
  const liveHere = Boolean(FEATURE_TRIPS && live && live.vehicleId === activeVehicle.id);
  // At most four: the two daily jobs, the third most common, and "everything else". A topic the person turned off drops its action.
  const bigActions: BigActionDef[] = [];
  if (includesTopic(featureSet, 'fuel_expenses')) bigActions.push({ id: 'fuel', label: t.hoy.actions.fuel, icon: 'flash-outline', onPress: () => router.push('/carga/nueva') });
  if (FEATURE_TRIPS && includesTopic(featureSet, 'trips'))
    bigActions.push(
      liveHere
        ? { id: 'trip', label: t.hoy.actions.tripLive, icon: 'navigate', onPress: () => router.push('/conducir') }
        : { id: 'trip', label: t.hoy.actions.trip, icon: 'navigate-outline', onPress: () => (tripsModeNow === 'off' ? router.push('/viajes/ajustes') : void beginTrip()) },
    );
  if (includesTopic(featureSet, 'maintenance')) bigActions.push({ id: 'service', label: t.hoy.actions.service, icon: 'construct-outline', onPress: () => router.push('/servicio/nuevo') });
  bigActions.push({ id: 'more', label: t.hoy.actions.more, icon: 'apps-outline', onPress: () => router.navigate('/(tabs)/mas') });
  const firstSteps: FirstStep[] = [
    { id: 'vehicle', done: true, onPress: () => router.push('/vehiculo/nuevo') },
    { id: 'fillup', done: stepsDone.fillup, onPress: () => router.push('/carga/nueva') },
    ...(FEATURE_TRIPS ? ([{ id: 'trips', done: stepsDone.trips, onPress: () => router.push('/viajes/ajustes') }] as FirstStep[]) : []),
  ];
  const activityCount = pending.length + (marbeteNotice ? 1 : 0);

  // On a phone the next step and the big actions come BEFORE the cluster (the answer to "what do I do now?" must be above the fold);
  // on a wide screen they are the right column; during a live trip the speed cluster stays first.
  const topBlock = (
    <>
        {/* System status, shown only when there is something to say. */}
        <UpdateBanner />
        {FEATURE_TRIPS && tripsModeNow === 'auto' ? <AutoBlockedCard /> : null}

        <NextStepCard
          eyebrow={t.hoy.nextStep}
          title={stepView.title}
          body={stepView.body}
          actionLabel={stepView.cta}
          onAction={stepView.onAction}
          laterLabel={stepView.later ? t.hoy.later : undefined}
          onLater={stepView.later ? () => void laterStep() : undefined}
          icon={stepView.icon}
          tone={stepView.tone}
        />

        <BigActions actions={bigActions} />

    </>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg.base }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.pad}>
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <T face="display" accessibilityRole="header" style={[styles.brand, { color: theme.text.primary }]}>
              {t.hoy.title}
            </T>
          </View>
          {FEATURE_SYNC && session ? <SyncPill /> : null}
          <Pressable
            onPress={() => setDictateOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t.ai.voice.title}
            hitSlop={4}
            style={[styles.headerBtn, { borderColor: theme.lineStrong, backgroundColor: theme.bg.surface }]}>
            <Ionicons name="mic-outline" size={20} color={theme.accent} />
          </Pressable>
          <Pressable
            onPress={() => router.push({ pathname: '/mas', params: { focus: 'search' } })}
            accessibilityRole="button"
            accessibilityLabel={t.features.openSearch}
            hitSlop={4}
            style={[styles.headerBtn, { borderColor: theme.lineStrong, backgroundColor: theme.bg.surface }]}>
            <Ionicons name="search-outline" size={20} color={theme.accent} />
          </Pressable>
          <Pressable
            onPress={() => router.push('/cuenta')}
            accessibilityRole="button"
            accessibilityLabel={t.routes.account}
            hitSlop={8}>
            <Avatar size={36} photoUri={profile.photoUri} avatarId={profile.avatarId} name={profile.displayName} decorative />
          </Pressable>
        </View>

        <QueueNotice />

        {data.vehicles.filter((v) => !v.isArchived).length > 1 ? (
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
                accessibilityLabel={[v.name, v.detail?.nickname, v.detail && statusTag ? t.vehicleStatus[v.detail.status] : null].filter(Boolean).join(', ')}
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
        </ScrollView>
        ) : null}

        {!wide && !liveHere ? topBlock : null}

        <DashCols wide={wide}>
        <DashCol wide={wide} side="left">
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
        ) : !clusterLoaded || showClusterSkeleton ? (
          // Before the first read: the cluster's outline after 150 ms, and
          // until then its footprint, so nothing below it moves (ADR-40).
          showClusterSkeleton ? (
            <TabsClusterSkeleton />
          ) : (
            <View style={{ height: Math.min(340, Math.max(240, width - 72)) * 0.9 + 170, marginBottom: space.lg }} />
          )
        ) : (
        <Animated.View key="odo" entering={reduced ? undefined : FadeIn.duration(300)}>
        <ClusterHero
          odometerKm={odometerKm}
          reading={clusterReading(allReminders)}
          caption={odometerEstimated ? t.trips.odometerEstimated : odometerCaption(daysSince)}
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
        </DashCol>
        <DashCol wide={wide} side="right">

        {wide || liveHere ? topBlock : null}

        <Pressable
          onPress={() => router.push('/cifras')}
          accessibilityRole="button"
          accessibilityLabel={`${t.hoy.summary}. ${t.hoy.summaryOpen}`}
          style={[styles.monthStrip, { backgroundColor: theme.bg.surface, borderColor: theme.lineStrong, marginTop: 0 }]}>
          <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11 }}>
            {t.hoy.summary}
          </T>
          <View style={styles.monthRow}>
            <MonthStat label={t.home.monthSpend} value={money(monthSpend)} wide />
            <MonthStat label={t.home.monthKm} value={fmtKm(Math.round(monthKm))} />
            <MonthStat
              label={t.home.monthEconomy}
              value={monthAvg != null ? kmPerUnit(monthAvg, activeVehicle.defaultFuelType, activeVehicle.detail?.volumeUnit, activeVehicle.detail?.economyUnit) : '—'}
            />
          </View>
        </Pressable>

        <Collapsible id="hoy-activity" title={t.hoy.activity} count={activityCount || undefined} hint={t.hoy.activityHint} defaultOpen={firstStepsActive && !stepsDone.fillup}>
        {firstStepsActive ? (
          <FirstSteps
            steps={firstSteps}
            onDismiss={() => {
              setStepFlags((f2) => ({ ...f2, firstStepsHidden: true }));
              void setFlag(FIRST_STEPS_HIDDEN_KEY);
            }}
          />
        ) : null}
        {installOffer ? (
          <Pressable
            onPress={() => router.push('/instalar')}
            accessibilityRole="link"
            style={[styles.pendingRow, { backgroundColor: theme.bg.surface, borderColor: theme.lineStrong, borderLeftColor: theme.accent, marginBottom: space.sm }]}>
            <T face="semibold" style={{ color: theme.text.primary, fontSize: 15 }}>
              {t.install.pill}
            </T>
          </Pressable>
        ) : null}

        {/* Note 10: how this odometer rises — once, until "Entendido". */}
        <TipCard id="odometer" />

        {pending.length ? (
          <View style={styles.pending}>
            {pending.map((p) => (
              <View key={p.key}>
              <Pressable
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
              {p.onResolve ? (
                <Pressable onPress={p.onResolve} accessibilityRole="button" style={styles.resolveLink}>
                  <T face="semibold" style={{ color: theme.accent, fontSize: 12 }}>
                    {t.repair.resolveWith}
                  </T>
                </Pressable>
              ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {marbeteNotice ? (
          <Pressable
            onPress={() => router.push('/recordatorios')}
            accessibilityRole="button"
            accessibilityLabel={`${t.documents.kinds.marbete}: ${marbeteNotice.message}`}
            style={[styles.banner, { backgroundColor: theme.statusBg.proximo, borderColor: theme.status.proximo }]}>
            <T face="semibold" style={{ color: theme.statusText.proximo, fontSize: 13 }}>
              {t.documents.kinds.marbete}
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
              {t.account.onboardingTitle}
            </T>
            <T
              face="body"
              style={{ color: theme.text.secondary, fontSize: 13, marginTop: 4, lineHeight: 19 }}>
              {t.account.onboardingBody}
            </T>
            <View style={styles.accountActions}>
              <Pressable
                onPress={() => router.push('/cuenta')}
                accessibilityRole="button"
                style={[styles.accountPrimary, { backgroundColor: theme.accentFill }]}>
                <T face="semibold" style={{ color: theme.accentFillInk, fontSize: 13 }}>
                  {t.account.onboardingAction}
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
                  {t.account.onboardingDismiss}
                </T>
              </Pressable>
            </View>
          </Surface>
        ) : null}

        <CarHealth vehicle={activeVehicle} fillups={vehicleFillups} />
        <HomeNudge hasVehicle fillups={vehicleFillups.length} />

        {insight ? (
          <Surface style={{ marginBottom: space.md }}>
            <T face="semibold" style={{ color: theme.accent, fontSize: 15 }}>
              {insight.status === 'low'
                ? t.home.insightLow
                : insight.status === 'great'
                  ? t.home.insightGreat
                  : t.home.insightNormal}
            </T>
            <T face="body" style={[styles.alertText, { color: theme.text.secondary }]}>
              {insight.status === 'low'
                ? t.home.insightLowBody(Math.abs(insight.differencePercent).toFixed(0))
                : insight.status === 'great'
                  ? t.home.insightGreatBody(insight.differencePercent.toFixed(0))
                  : t.home.insightNormalBody}
            </T>
          </Surface>
        ) : null}

        {/* Note 8: the last tank opens its fill-up's detail. */}
        <Pressable
          disabled={!last}
          onPress={() => last && router.push({ pathname: '/carga/[id]', params: { id: last.fillUpId } })}
          accessibilityRole={last ? 'button' : undefined}>
        <Surface>
          <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11 }}>
            {t.home.lastTank}
          </T>
          <T face="monoBold" style={[styles.statVal, { color: lastEstimated ? theme.text.muted : theme.text.primary }]}>
            {last ? `${lastEstimated ? '≈ ' : ''}${kmPerUnit(last.kmPerUnit, activeVehicle.defaultFuelType, activeVehicle.detail?.volumeUnit, activeVehicle.detail?.economyUnit)}` : '—'}
          </T>
          <T face="body" style={[styles.statHint, { color: theme.text.muted }]}>
            {last
              ? t.home.lastTankHint(
                  fmtKm(last.distanceKm),
                  fmtVolume(last.volume, activeVehicle.defaultFuelType, activeVehicle.detail?.volumeUnit),
                )
              : avg == null
                ? t.home.averageEmpty(economyLabel(activeVehicle.defaultFuelType, activeVehicle.detail?.volumeUnit))
                : t.home.lastTankEmpty}
          </T>
        </Surface>
        </Pressable>
        </Collapsible>
        </DashCol>
        </DashCols>
      </ScrollView>
      {location.sheet}
      <DictateSheet visible={dictateOpen} onClose={() => setDictateOpen(false)} />
      <FeatureSetSheet
        visible={setOpen}
        suggested={suggestion}
        onClose={() => {
          setSetOpen(false);
          setStepFlags((f2) => ({ ...f2, offerDismissed: true }));
          void setFlag(FEATURE_OFFER_DISMISSED_KEY);
        }}
      />
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

type Pending = { key: string; status: Status; title: string; countdown: string; onPress: () => void; onResolve?: () => void };

/** The mono countdown on a Pendientes row: "1,250 km", "−320 km", "12 d", "−3 d". */
function countdown(status: EvaluatedReminder['status']): string {
  if (status.status === 'sin_datos') return t.home.noDataShort;
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
  if (daysSince == null) return t.home.odometerTapHint;
  if (daysSince <= 0) return t.home.updatedToday;
  if (daysSince === 1) return t.home.updatedYesterday;
  return t.home.updatedDaysAgo(daysSince);
}

/** Priority reads as urgency, same vocabulary as the reminders. */
const TASK_STATUS: Record<Task['priority'], Status> = {
  critica: 'vencido',
  normal: 'proximo',
  baja: 'ok',
};

const BADGE_TONE: Record<Status, BadgeTone> = { vencido: 'red', urgente: 'amber', proximo: 'amber', ok: 'green' };

const styles = StyleSheet.create({
  headerBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
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
  installPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginRight: space.sm },
  heroHeader: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.sm },
  pending: { gap: space.sm, marginBottom: space.lg },
  resolveLink: { minHeight: 44, justifyContent: 'center', paddingHorizontal: space.md },
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
