import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { T } from '@/components/T';
import { OdometerHero, QuickActions, Surface, type Telltale } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { useSession } from '@/lib/cloud/auth';
import {
  currentOdometer as currentOdometerQuery,
  odometer as odometerRepo,
  settings as settingsRepo,
  tasks as taskRepo,
  vehicles as vehicleRepo,
} from '@/lib/db/repos';
import { attentionReminders, type EvaluatedReminder } from '@/lib/db/reminderQueries';
import type { Task } from '@/lib/db/types';
import { daysBetween, todayIso } from '@/lib/domain/dates';
import { currentMarbeteNudge, marbeteTierLabel } from '@/lib/domain/legal-dr';
import { mergeAttention, STATUS_LABEL } from '@/lib/domain/reminders';
import { economyLabel, FUEL_CATALOG } from '@/lib/fuel';
import { kmPerUnit, money } from '@/lib/format';
import { es } from '@/lib/i18n/es';
import { computeEconomy, inMonth, latestEconomyInsight, sumSpend } from '@/lib/math';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * Inicio — what the car reads and what it needs, then the four things you came
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
  const [daysSince, setDaysSince] = useState<number | null>(null);
  const [monthKm, setMonthKm] = useState<number>(0);
  const [attention, setAttention] = useState<EvaluatedReminder[]>([]);
  const [openTasks, setOpenTasks] = useState<Task[]>([]);
  const [modelYear, setModelYear] = useState<number | null>(null);

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
      const [max, readings, vehicle] = await Promise.all([
        currentOdometerQuery(vehicleId),
        odometerRepo.list(vehicleId, { orderBy: 'occurred_at', direction: 'DESC' }),
        vehicleRepo.getById(vehicleId),
      ]);
      if (cancelled) return;

      setOdometerKm(max);
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

  const economy = computeEconomy(vehicleFillups);
  const last = economy[economy.length - 1];
  const insight = latestEconomyInsight(vehicleFillups);
  const avg = economy.length ? economy.reduce((a, p) => a + p.kmPerUnit, 0) / economy.length : null;

  // One strip, worst first across both kinds (see `mergeAttention`): a critical
  // task from a failed check outranks an overdue oil change.
  const telltales: Telltale[] = mergeAttention(attention, openTasks, 4).map((entry) =>
    entry.kind === 'reminder'
      ? {
          status: entry.item.status.status === 'sin_datos' ? ('proximo' as const) : entry.item.status.status,
          label: telltaleLabel(entry.item.reminder.title, entry.item.status),
          onPress: () =>
            router.push({ pathname: '/recordatorio/[id]', params: { id: entry.item.reminder.id } }),
        }
      : {
          status: TASK_STATUS[entry.item.priority],
          label: entry.item.title,
          onPress: () => router.push({ pathname: '/tarea/[id]', params: { id: entry.item.id } }),
        },
  );

  const marbeteNotice = currentMarbeteNudge(todayIso());
  const marbeteTier = marbeteNotice ? marbeteTierLabel(modelYear, todayIso()) : null;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg.base }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.pad}>
        <T face="medium" style={[styles.kicker, { color: theme.accent }]}>
          {es.home.eyebrow}
        </T>
        <T face="display" style={[styles.brand, { color: theme.text.primary }]}>
          {es.home.title}
        </T>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.switcher}>
          {data.vehicles.map((v) => {
            const on = v.id === activeVehicle.id;
            return (
              <Pressable
                key={v.id}
                onPress={() => setActiveVehicle(v.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: v.id === activeVehicle.id }}
                style={[
                  styles.chip,
                  { backgroundColor: on ? theme.accent : theme.bg.raised, borderColor: on ? theme.accent : theme.line },
                ]}>
                <T face="semibold" style={{ color: on ? theme.accentInk : theme.text.primary, fontSize: 13 }}>
                  {v.name}
                </T>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => router.push('/vehiculo/nuevo')}
            accessibilityRole="button"
            style={[styles.chip, { backgroundColor: theme.bg.raised, borderColor: theme.line }]}>
            <T face="semibold" style={{ color: theme.text.secondary, fontSize: 13 }}>
              {es.home.addVehicle}
            </T>
          </Pressable>
        </ScrollView>

        <OdometerHero
          vehicleName={activeVehicle.name}
          odometerKm={odometerKm}
          daysSinceReading={daysSince}
          telltales={telltales}
          onPressOdometer={() => router.push('/odometro')}
          onPressTelltales={() => router.push('/recordatorios')}
        />

        {marbeteNotice ? (
          <Pressable
            onPress={() => router.push('/recordatorios')}
            accessibilityRole="button"
            accessibilityLabel={`${es.documents.kinds.marbete}: ${marbeteNotice.message}`}
            style={[styles.banner, { backgroundColor: theme.statusBg.proximo, borderColor: theme.status.proximo }]}>
            <T face="semibold" style={{ color: theme.status.proximo, fontSize: 13 }}>
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
                style={[styles.accountPrimary, { backgroundColor: theme.accent }]}>
                <T face="semibold" style={{ color: theme.accentInk, fontSize: 13 }}>
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
            { label: es.quickActions.check, icon: 'clipboard-outline', onPress: () => router.push('/(tabs)/chequeo') },
            { label: es.quickActions.service, icon: 'construct-outline', onPress: () => router.push('/servicio/nuevo') },
            { label: es.quickActions.expense, icon: 'cash-outline', onPress: () => router.push('/gasto/nuevo') },
          ]}
        />

        <View style={[styles.monthStrip, { backgroundColor: theme.bg.surface, borderColor: theme.line }]}>
          <T face="medium" style={[styles.eyebrow, { color: theme.text.muted }]}>
            {es.home.monthStrip.toUpperCase()}
          </T>
          <View style={styles.monthRow}>
            <MonthStat label={es.home.monthSpend} value={money(monthSpend)} />
            <MonthStat label={es.home.monthFillups} value={String(monthLogs.length)} />
            <MonthStat label={es.home.monthKm} value={`${Math.round(monthKm)} km`} />
          </View>
        </View>

        {insight ? (
          <Surface style={{ marginBottom: space.md }}>
            <T face="medium" style={{ color: theme.accent, fontSize: 15 }}>
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

        <View style={styles.grid}>
          <Surface>
            <T face="medium" style={[styles.statLabel, { color: theme.text.muted }]}>
              {es.home.lastTank}
            </T>
            <T face="monoBold" style={[styles.statVal, { color: theme.text.primary }]}>
              {last ? kmPerUnit(last.kmPerUnit, activeVehicle.defaultFuelType) : '—'}
            </T>
            <T face="body" style={[styles.statHint, { color: theme.text.muted }]}>
              {last
                ? es.home.lastTankHint(
                    `${last.distanceKm} km`,
                    `${last.volume} ${FUEL_CATALOG[activeVehicle.defaultFuelType].unitLabel}`,
                  )
                : es.home.lastTankEmpty}
            </T>
          </Surface>
          <Surface>
            <T face="medium" style={[styles.statLabel, { color: theme.text.muted }]}>
              {es.home.averageTank}
            </T>
            <T face="monoBold" style={[styles.statVal, { color: theme.text.primary }]}>
              {avg != null ? kmPerUnit(avg, activeVehicle.defaultFuelType) : '—'}
            </T>
            <T face="body" style={[styles.statHint, { color: theme.text.muted }]}>
              {economy.length
                ? es.home.averageHint(economy.length)
                : es.home.averageEmpty(economyLabel(activeVehicle.defaultFuelType))}
            </T>
          </Surface>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MonthStat({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  return (
    <View style={styles.monthStat}>
      <T face="monoBold" style={{ color: theme.text.primary, fontSize: 17 }}>
        {value}
      </T>
      <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginTop: 2 }}>
        {label}
      </T>
    </View>
  );
}

/** "Aceite de motor · faltan 320 km" — short enough for a pill. */
/** Critical first, then normal, then the nice-to-haves. */
function byPriority(a: Task, b: Task): number {
  const rank = { critica: 0, normal: 1, baja: 2 };
  return rank[a.priority] - rank[b.priority];
}

function telltaleLabel(title: string, status: EvaluatedReminder['status']): string {
  if (status.status === 'sin_datos') return `${title} · sin datos`;
  if (status.dueKm != null && status.dueKm < 0) {
    return `${title} · ${Math.abs(Math.round(status.dueKm)).toLocaleString('es-DO')} km pasado`;
  }
  if (status.dueDays != null && status.dueDays < 0) return `${title} · vencido`;
  if (status.dueKm != null && (status.dueDays == null || status.dueKm / 50 < status.dueDays)) {
    return `${title} · faltan ${Math.round(status.dueKm).toLocaleString('es-DO')} km`;
  }
  if (status.dueDays != null) return `${title} · faltan ${status.dueDays} d`;
  return `${title} · ${STATUS_LABEL[status.status]}`;
}

/** Priority reads as urgency on the strip, same vocabulary as the reminders. */
const TASK_STATUS: Record<Task['priority'], Telltale['status']> = {
  critica: 'vencido',
  normal: 'proximo',
  baja: 'ok',
};

const styles = StyleSheet.create({
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
  kicker: { letterSpacing: 2, fontSize: 12 },
  brand: { fontSize: 34, marginTop: 4, marginBottom: space.md },
  switcher: { marginBottom: space.lg },
  chip: {
    paddingHorizontal: space.md + 2,
    paddingVertical: space.sm,
    borderRadius: radius.chip,
    marginRight: space.sm,
    borderWidth: 1,
  },
  monthStrip: {
    borderWidth: 1,
    borderRadius: radius.card,
    padding: space.lg,
    marginTop: space.lg,
    marginBottom: space.md,
  },
  eyebrow: { fontSize: 11, letterSpacing: 0.9, marginBottom: space.md },
  monthRow: { flexDirection: 'row', justifyContent: 'space-between' },
  monthStat: { flex: 1 },
  banner: { borderWidth: 1, borderRadius: radius.input, padding: space.md, marginBottom: space.lg },
  alertText: { fontSize: 13, lineHeight: 19, marginTop: 5 },
  grid: { gap: space.md },
  statLabel: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8 },
  statVal: { fontSize: 22, marginTop: space.sm },
  statHint: { fontSize: 12, marginTop: 6 },
});
