import { PriceBoard } from '@/components/PriceBoard';
import { T } from '@/components/T';
import { Card, PrimaryButton } from '@/components/ui';
import { colors } from '@/constants/theme';
import { economyLabel, FUEL_CATALOG } from '@/lib/fuel';
import { kmPerUnit, money, monthTitle } from '@/lib/format';
import { computeEconomy, inMonth, latestEconomyInsight, sumSpend } from '@/lib/math';
import { useStore } from '@/lib/store';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const router = useRouter();
  const { activeVehicle, vehicleFillups, data, setActiveVehicle } = useStore();
  const now = new Date();
  const monthLogs = vehicleFillups.filter((f) => inMonth(f.occurredAt, now.getFullYear(), now.getMonth()));
  const spent = sumSpend(monthLogs);
  const economy = computeEconomy(vehicleFillups);
  const last = economy[economy.length - 1];
  const insight = latestEconomyInsight(vehicleFillups);
  const avg =
    economy.length > 0
      ? economy.reduce((a, p) => a + p.kmPerUnit, 0) / economy.length
      : null;

  if (!activeVehicle) return null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.pad}>
        <T face="medium" style={styles.kicker}>
          TU COMBUSTIBLE RD
        </T>
        <T face="display" style={styles.brand}>
          Tablero
        </T>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          {data.vehicles.map((v) => (
            <Pressable
              key={v.id}
              onPress={() => setActiveVehicle(v.id)}
              style={[styles.vh, v.id === activeVehicle.id && styles.vhOn]}>
              <T face="semibold" style={[styles.vhTxt, v.id === activeVehicle.id && styles.vhTxtOn]}>
                {v.name}
              </T>
            </Pressable>
          ))}
        </ScrollView>

        <PriceBoard
          eyebrow={monthTitle(now.getFullYear(), now.getMonth())}
          amount={money(spent)}
          caption={
            monthLogs.length
              ? `${monthLogs.length} carga${monthLogs.length === 1 ? '' : 's'} · ${activeVehicle.name}`
              : `Aún no hay cargas este mes · ${activeVehicle.name}`
          }
          prices={data.settings.referencePrices}
        />
        <T face="body" style={styles.micm}>
          Precios de referencia {data.settings.priceWeekLabel}. Lo que pagaste en cada carga manda.
        </T>

        {insight ? (
          <Card>
            <T face="medium" style={styles.alertLabel}>
              {insight.status === 'low'
                ? 'Rendimiento bajo'
                : insight.status === 'great'
                  ? 'Rendimiento excelente'
                  : 'Rendimiento estable'}
            </T>
            <T face="body" style={styles.alertText}>
              {insight.status === 'low'
                ? `Este tanque rindió ${Math.abs(insight.differencePercent).toFixed(0)}% menos que tu promedio anterior.`
                : insight.status === 'great'
                  ? `Este tanque rindió ${insight.differencePercent.toFixed(0)}% más que tu promedio anterior.`
                  : 'Este tanque está dentro de tu rendimiento habitual.'}
            </T>
          </Card>
        ) : null}

        <View style={styles.grid}>
          <Card>
            <T face="medium" style={styles.statLabel}>
              Último tanque
            </T>
            <T face="monoBold" style={styles.statVal}>
              {last ? kmPerUnit(last.kmPerUnit, activeVehicle.defaultFuelType) : '—'}
            </T>
            <T face="body" style={styles.statHint}>
              {last ? `${last.distanceKm} km con ${last.volume} ${FUEL_CATALOG[activeVehicle.defaultFuelType].unitLabel}` : 'Necesitas dos tanques llenos'}
            </T>
          </Card>
          <Card>
            <T face="medium" style={styles.statLabel}>
              Promedio
            </T>
            <T face="monoBold" style={styles.statVal}>
              {avg != null ? kmPerUnit(avg, activeVehicle.defaultFuelType) : '—'}
            </T>
            <T face="body" style={styles.statHint}>
              {economy.length ? `${economy.length} tanques medidos` : `Se mide en ${economyLabel(activeVehicle.defaultFuelType)}`}
            </T>
          </Card>
        </View>

        <View style={{ height: 16 }} />
        <PrimaryButton label="Registrar carga" onPress={() => router.push('/(tabs)/cargar')} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.receipt },
  pad: { padding: 20, paddingBottom: 40 },
  kicker: { color: colors.teal, letterSpacing: 2, fontSize: 12 },
  brand: { fontSize: 40, color: colors.ink, marginTop: 4, marginBottom: 12 },
  vh: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.white,
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.line,
  },
  vhOn: { backgroundColor: colors.canopy, borderColor: colors.canopy },
  vhTxt: { color: colors.ink },
  vhTxtOn: { color: colors.receipt },
  micm: { color: colors.muted, fontSize: 12, marginTop: 10, marginBottom: 16, lineHeight: 18 },
  alertLabel: { color: colors.nozzle, fontSize: 15 },
  alertText: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 5 },
  grid: { gap: 12 },
  statLabel: { color: colors.muted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8 },
  statVal: { color: colors.ink, fontSize: 22, marginTop: 8 },
  statHint: { color: colors.muted, fontSize: 12, marginTop: 6 },
});
