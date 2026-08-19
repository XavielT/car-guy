import { T } from '@/components/T';
import { Card } from '@/components/ui';
import { colors } from '@/constants/theme';
import { FUEL_CATALOG, FUEL_ORDER, economyLabel } from '@/lib/fuel';
import { km, money, monthTitle } from '@/lib/format';
import { computeEconomy, distanceInLogs, inMonth, latestEconomyInsight, roundMoney, sumSpend } from '@/lib/math';
import { useStore } from '@/lib/store';
import type { FuelType } from '@/lib/types';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function monthBuckets(fillups: { occurredAt: string; totalDop: number }[]) {
  const map = new Map<string, number>();
  for (const f of fillups) {
    const d = new Date(f.occurredAt);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    map.set(key, (map.get(key) ?? 0) + f.totalDop);
  }
  return [...map.entries()]
    .map(([key, total]) => {
      const [y, m] = key.split('-').map(Number);
      return { year: y, month: m, total: roundMoney(total), label: monthTitle(y, m) };
    })
    .sort((a, b) => (a.year === b.year ? b.month - a.month : b.year - a.year))
    .slice(0, 6);
}

export default function CifrasScreen() {
  const { vehicleFillups, activeVehicle } = useStore();
  if (!activeVehicle) return null;

  const now = new Date();
  const monthLogs = vehicleFillups.filter((f) => inMonth(f.occurredAt, now.getFullYear(), now.getMonth()));
  const byType = FUEL_ORDER.map((type) => ({
    type,
    total: sumSpend(vehicleFillups.filter((f) => f.fuelType === type)),
  })).filter((x) => x.total > 0);
  const maxType = Math.max(...byType.map((x) => x.total), 1);
  const months = monthBuckets(vehicleFillups);
  const maxMonth = Math.max(...months.map((m) => m.total), 1);
  const dist = distanceInLogs(vehicleFillups);
  const allSpend = sumSpend(vehicleFillups);
  const costKm = dist > 0 ? roundMoney(allSpend / dist) : null;
  const eco = computeEconomy(vehicleFillups);
  const insight = latestEconomyInsight(vehicleFillups);
  const avg = eco.length ? eco.reduce((a, p) => a + p.kmPerUnit, 0) / eco.length : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.pad}>
        <T face="display" style={styles.h}>
          Cifras
        </T>
        <T face="body" style={styles.sub}>
          {activeVehicle.name} · gasto y consumo reales, no el de la computadora del carro.
        </T>

        <View style={styles.row}>
          <Card>
            <T face="medium" style={styles.lbl}>
              Este mes
            </T>
            <T face="monoBold" style={styles.val}>
              {money(sumSpend(monthLogs))}
            </T>
          </Card>
        </View>
        <View style={[styles.row, { marginTop: 12 }]}>
          <Card>
            <T face="medium" style={styles.lbl}>
              RD$ / km
            </T>
            <T face="monoBold" style={styles.val}>
              {costKm != null ? money(costKm) : '—'}
            </T>
            <T face="body" style={styles.hint}>
              {dist ? km(dist) + ' entre primera y última carga' : 'Registra al menos dos cargas'}
            </T>
          </Card>
        </View>
        <View style={[styles.row, { marginTop: 12 }]}>
          <Card>
            <T face="medium" style={styles.lbl}>
              Consumo medio
            </T>
            <T face="monoBold" style={styles.val}>
              {avg != null ? `${avg.toFixed(2)} ${economyLabel(activeVehicle.defaultFuelType)}` : '—'}
            </T>
          </Card>
        </View>

        {insight ? (
          <Card style={styles.insightCard}>
            <T face="medium" style={styles.lbl}>
              Lectura del último tanque
            </T>
            <T face="monoBold" style={styles.val}>
              {insight.status === 'low' ? 'Bajo' : insight.status === 'great' ? 'Excelente' : 'Estable'}
            </T>
            <T face="body" style={styles.hint}>
              Comparado con el promedio de tus tanques anteriores ({insight.baseline.toFixed(2)} {economyLabel(activeVehicle.defaultFuelType)}).
            </T>
          </Card>
        ) : null}

        <T face="title" style={styles.sec}>
          Por tipo
        </T>
        {byType.length === 0 ? (
          <T face="body" style={styles.hint}>
            Cuando haya cargas, aquí se parte Premium, Regular, gasoil y GLP.
          </T>
        ) : (
          byType.map((x) => (
            <View key={x.type} style={styles.barBlock}>
              <View style={styles.barHead}>
                <T face="semibold">{FUEL_CATALOG[x.type as FuelType].label}</T>
                <T face="mono">{money(x.total)}</T>
              </View>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${(x.total / maxType) * 100}%` }]} />
              </View>
            </View>
          ))
        )}

        <T face="title" style={styles.sec}>
          Mes a mes
        </T>
        {months.length === 0 ? (
          <T face="body" style={styles.hint}>
            El gasto mensual aparece después de la primera carga.
          </T>
        ) : (
          months.map((m) => (
            <View key={`${m.year}-${m.month}`} style={styles.barBlock}>
              <View style={styles.barHead}>
                <T face="semibold">{m.label}</T>
                <T face="mono">{money(m.total)}</T>
              </View>
              <View style={styles.track}>
                <View style={[styles.fillAmber, { width: `${(m.total / maxMonth) * 100}%` }]} />
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.receipt },
  pad: { padding: 20, paddingBottom: 48 },
  h: { fontSize: 36, color: colors.ink },
  sub: { color: colors.muted, marginTop: 6, marginBottom: 16, lineHeight: 22 },
  row: {},
  lbl: { color: colors.muted, fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase' },
  val: { fontSize: 26, color: colors.ink, marginTop: 8 },
  hint: { color: colors.muted, fontSize: 12, marginTop: 8, lineHeight: 18 },
  insightCard: { marginTop: 12 },
  sec: { fontSize: 22, color: colors.ink, marginTop: 28, marginBottom: 12 },
  barBlock: { marginBottom: 12 },
  barHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  track: {
    height: 10,
    backgroundColor: colors.receiptDeep,
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: { height: 10, backgroundColor: colors.teal, borderRadius: 999 },
  fillAmber: { height: 10, backgroundColor: colors.ledDim, borderRadius: 999 },
});
