import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { T } from '@/components/T';
import { OdometerHero, QuickActions, Surface, type Telltale } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { currentOdometer as currentOdometerQuery, odometer as odometerRepo } from '@/lib/db/repos';
import { daysBetween, todayIso } from '@/lib/domain/dates';
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
export default function HomeScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { activeVehicle, vehicleFillups, vehicleExpenses, vehicleReminders, data, setActiveVehicle } =
    useStore();

  const [odometerKm, setOdometerKm] = useState<number | null>(null);
  const [daysSince, setDaysSince] = useState<number | null>(null);
  const [monthKm, setMonthKm] = useState<number>(0);

  const vehicleId = activeVehicle?.id;

  // Reads the odometer straight from the repos rather than the legacy store
  // shape, which has no notion of readings. Cancelled on unmount so a slow query
  // cannot set state on a screen that is gone.
  useEffect(() => {
    if (!vehicleId) return;
    let cancelled = false;

    (async () => {
      const [max, readings] = await Promise.all([
        currentOdometerQuery(vehicleId),
        odometerRepo.list(vehicleId, { orderBy: 'occurred_at', direction: 'DESC' }),
      ]);
      if (cancelled) return;

      setOdometerKm(max);
      setDaysSince(readings[0] ? daysBetween(readings[0].occurredAt, todayIso()) : null);

      // Distance this month = newest reading minus the last one from before the
      // month started. Readings, not fill-ups: a service visit or a manual entry
      // moves the odometer too.
      const now = new Date();
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

    return () => {
      cancelled = true;
    };
  }, [vehicleId, data]);

  if (!activeVehicle) return null;

  const now = new Date();
  const monthLogs = vehicleFillups.filter((f) => inMonth(f.occurredAt, now.getFullYear(), now.getMonth()));
  const monthExpenses = vehicleExpenses.filter((e) =>
    inMonth(e.occurredAt, now.getFullYear(), now.getMonth()),
  );
  const monthSpend = sumSpend(monthLogs) + monthExpenses.reduce((total, e) => total + e.amountDop, 0);

  const economy = computeEconomy(vehicleFillups);
  const last = economy[economy.length - 1];
  const insight = latestEconomyInsight(vehicleFillups);
  const avg = economy.length ? economy.reduce((a, p) => a + p.kmPerUnit, 0) / economy.length : null;

  const telltales = buildTelltales(vehicleReminders, odometerKm);

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
        />

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
                ? 'Rendimiento bajo'
                : insight.status === 'great'
                  ? 'Rendimiento excelente'
                  : 'Rendimiento estable'}
            </T>
            <T face="body" style={[styles.alertText, { color: theme.text.secondary }]}>
              {insight.status === 'low'
                ? `Este tanque rindió ${Math.abs(insight.differencePercent).toFixed(0)}% menos que tu promedio anterior.`
                : insight.status === 'great'
                  ? `Este tanque rindió ${insight.differencePercent.toFixed(0)}% más que tu promedio anterior.`
                  : 'Este tanque está dentro de tu rendimiento habitual.'}
            </T>
          </Surface>
        ) : null}

        <View style={styles.grid}>
          <Surface>
            <T face="medium" style={[styles.statLabel, { color: theme.text.muted }]}>
              Último tanque
            </T>
            <T face="monoBold" style={[styles.statVal, { color: theme.text.primary }]}>
              {last ? kmPerUnit(last.kmPerUnit, activeVehicle.defaultFuelType) : '—'}
            </T>
            <T face="body" style={[styles.statHint, { color: theme.text.muted }]}>
              {last
                ? `${last.distanceKm} km con ${last.volume} ${FUEL_CATALOG[activeVehicle.defaultFuelType].unitLabel}`
                : 'Necesitas dos tanques llenos'}
            </T>
          </Surface>
          <Surface>
            <T face="medium" style={[styles.statLabel, { color: theme.text.muted }]}>
              Promedio
            </T>
            <T face="monoBold" style={[styles.statVal, { color: theme.text.primary }]}>
              {avg != null ? kmPerUnit(avg, activeVehicle.defaultFuelType) : '—'}
            </T>
            <T face="body" style={[styles.statHint, { color: theme.text.muted }]}>
              {economy.length
                ? `${economy.length} tanques medidos`
                : `Se mide en ${economyLabel(activeVehicle.defaultFuelType)}`}
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

/**
 * A deliberately simple due check — date passed, or odometer passed.
 *
 * PROMPT-05 replaces this with the real engine (thresholds, predicted dates,
 * snoozing, the four states). Anything cleverer here would only have to be
 * unpicked.
 */
function buildTelltales(
  reminders: { title: string; dueDate: string | null; dueOdometerKm: number | null; completedAt: string | null }[],
  odometerKm: number | null,
): Telltale[] {
  const today = todayIso();
  const out: Telltale[] = [];

  for (const reminder of reminders) {
    if (reminder.completedAt) continue;

    const daysLeft = reminder.dueDate ? daysBetween(today, reminder.dueDate) : null;
    const kmLeft =
      reminder.dueOdometerKm != null && odometerKm != null ? reminder.dueOdometerKm - odometerKm : null;

    const overdue = (daysLeft != null && daysLeft < 0) || (kmLeft != null && kmLeft < 0);
    const soon = (daysLeft != null && daysLeft <= 30) || (kmLeft != null && kmLeft <= 500);
    if (!overdue && !soon) continue;

    const detail =
      kmLeft != null && (daysLeft == null || kmLeft / 50 < daysLeft)
        ? `${Math.abs(Math.round(kmLeft))} km`
        : daysLeft != null
          ? `${Math.abs(daysLeft)} d`
          : '';

    out.push({
      status: overdue ? 'vencido' : 'proximo',
      label: detail ? `${reminder.title} · ${overdue ? 'hace ' : 'faltan '}${detail}` : reminder.title,
    });
  }

  return out;
}

const styles = StyleSheet.create({
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
  alertText: { fontSize: 13, lineHeight: 19, marginTop: 5 },
  grid: { gap: space.md },
  statLabel: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8 },
  statVal: { fontSize: 22, marginTop: space.sm },
  statHint: { fontSize: 12, marginTop: 6 },
});
