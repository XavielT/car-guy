import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { T } from '@/components/T';
import { GhostButton, PrimaryButton, Surface } from '@/components/ui';
import { palette, space } from '@/constants/theme';
import {
  expenses as expenseRepo,
  fuel as fuelRepo,
  serviceRecords as serviceRepo,
  tasks as taskRepo,
  vehicles as vehicleRepo,
} from '@/lib/db/repos';
import type { ExpenseCategory } from '@/lib/db/types';
import { id as newId } from '@/lib/format';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * Not a product screen: a realistic dataset, one tap.
 *
 * PROMPT-07 asks for the statistics to be verified "with a realistic dataset",
 * and the two ways to get one were importing a backup through a file picker no
 * test harness can drive, or typing forty records by hand. This writes the same
 * shape of history a year of ordinary use produces — several months of
 * fill-ups, two services, a repair, the legal expenses and a pending task —
 * straight through the repositories, so it exercises the real write path
 * including the odometer mirroring.
 *
 * Gated on `__DEV__` and reachable only by typing the route, exactly like
 * `app/dev/tokens.tsx`. It adds rows; it never deletes any.
 */
export default function SeedScreen() {
  const { theme } = useTheme();
  const { activeVehicle, refresh } = useStore();
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  if (!__DEV__) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.dark.bg.base }}>
        <T face="body" style={{ color: palette.dark.text.secondary, padding: space.xl }}>
          Solo en desarrollo.
        </T>
      </SafeAreaView>
    );
  }

  async function seed() {
    if (!activeVehicle) return;
    setBusy(true);
    const lines: string[] = [];

    try {
      const vehicleId = activeVehicle.id;
      const today = new Date();
      const at = (daysAgo: number) =>
        new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate() - daysAgo,
          12,
          0,
          0,
        ).toISOString();

      // A year of history so the 12-month charts have something in every bucket.
      await vehicleRepo.upsert({
        id: vehicleId,
        purchaseDate: at(730),
        purchasePrice: 875000,
      });
      lines.push('Vehículo: precio de compra RD$ 875,000');

      // Fill-ups roughly every three weeks, odometer climbing ~450 km each time,
      // with one partial and one flagged as following a missed fill-up.
      let odometer = 44000;
      let fills = 0;
      for (let i = 11; i >= 0; i--) {
        odometer += 430 + ((i * 37) % 90);
        const partial = i === 6;
        const missed = i === 3;
        await fuelRepo.upsert({
          id: newId(),
          vehicleId,
          occurredAt: at(i * 30 + 4),
          odometerKm: odometer,
          volume: partial ? 4.2 : 10.4,
          pricePerUnit: 305 + (i % 4) * 3.5,
          totalDop: (partial ? 4.2 : 10.4) * (305 + (i % 4) * 3.5),
          fuelType: 'regular',
          isFullTank: !partial,
          missedPrevious: missed,
          station: ['Texaco', 'Shell', 'Isla', 'Next'][i % 4],
          notes: '',
        });
        fills += 1;
      }
      lines.push(`${fills} cargas de combustible`);

      await serviceRepo.upsert({
        id: newId(),
        vehicleId,
        kind: 'mantenimiento',
        occurredAt: at(200),
        odometerKm: 46500,
        title: 'Aceite de motor y filtro',
        description: '',
        costPartsDop: 2600,
        costLaborDop: 1400,
        totalDop: 4000,
        shop: 'Taller de Ramón',
        warrantyUntilDate: null,
        warrantyUntilKm: null,
        sourceInspectionId: null,
        sourceTaskId: null,
      });
      await serviceRepo.upsert({
        id: newId(),
        vehicleId,
        kind: 'mantenimiento',
        occurredAt: at(45),
        odometerKm: 49100,
        title: 'Aceite de motor y filtro + Filtro de aire',
        description: '',
        costPartsDop: 3200,
        costLaborDop: 1500,
        totalDop: 4700,
        shop: 'Taller de Ramón',
        warrantyUntilDate: null,
        warrantyUntilKm: null,
        sourceInspectionId: null,
        sourceTaskId: null,
      });
      await serviceRepo.upsert({
        id: newId(),
        vehicleId,
        kind: 'reparacion',
        occurredAt: at(120),
        odometerKm: 47800,
        title: 'Bomba de agua',
        description: 'Goteo en la bomba, se cambió con la correa.',
        costPartsDop: 8500,
        costLaborDop: 4000,
        totalDop: 12500,
        shop: 'Auto Servicio El Che',
        warrantyUntilDate: null,
        warrantyUntilKm: null,
        sourceInspectionId: null,
        sourceTaskId: null,
      });
      await serviceRepo.upsert({
        id: newId(),
        vehicleId,
        kind: 'mejora',
        occurredAt: at(300),
        odometerKm: 45200,
        title: 'Bocinas delanteras',
        description: '',
        costPartsDop: 6800,
        costLaborDop: 1200,
        totalDop: 8000,
        shop: '',
        warrantyUntilDate: null,
        warrantyUntilKm: null,
        sourceInspectionId: null,
        sourceTaskId: null,
      });
      lines.push('4 registros de servicio (2 mantenimientos, 1 reparación, 1 mejora)');

      const spends: [ExpenseCategory, number, number, string][] = [
        ['marbete', 3000, 250, 'Marbete 2026'],
        ['seguro', 18500, 150, 'Póliza anual'],
        ['lavado', 500, 20, 'Lavado y aspirado'],
        ['peaje', 320, 60, 'Autopista Duarte'],
        ['multa', 1500, 95, 'Exceso de velocidad'],
        ['parqueo', 200, 10, 'Ágora'],
      ];
      for (const [category, amount, daysAgo, description] of spends) {
        await expenseRepo.upsert({
          id: newId(),
          vehicleId,
          occurredAt: at(daysAgo),
          odometerKm: null,
          category,
          amountDop: amount,
          description,
          vendor: '',
        });
      }
      lines.push(`${spends.length} gastos (seguro, marbete, multa, peaje, lavado, parqueo)`);

      await taskRepo.upsert({
        id: newId(),
        vehicleId,
        title: 'Cambiar las cuatro gomas',
        kind: 'mantenimiento',
        priority: 'normal',
        status: 'pendiente',
        estimatedCostDop: 24000,
        notes: 'Ya están en el indicador de desgaste.',
        sourceInspectionResultId: null,
        doneRecordId: null,
      });
      lines.push('1 tarea pendiente con costo estimado');

      await refresh();
      lines.push('Listo. Abre Cifras.');
    } catch (error) {
      lines.push(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLog(lines);
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }}>
      <ScrollView contentContainerStyle={styles.pad}>
        <T face="display" style={{ color: theme.text.primary, fontSize: 28 }}>
          Datos de prueba
        </T>
        <T face="body" style={{ color: theme.text.secondary, marginTop: 6, lineHeight: 21 }}>
          Escribe un año de historial en el vehículo activo
          {activeVehicle ? ` (${activeVehicle.name})` : ''}. Solo agrega; no borra nada.
        </T>

        <Surface style={{ marginTop: space.xl }}>
          <PrimaryButton
            label={busy ? 'Escribiendo…' : 'Sembrar historial'}
            onPress={seed}
            disabled={busy || !activeVehicle}
          />
          {log.length ? (
            <>
              {log.map((line) => (
                <T
                  key={line}
                  face="mono"
                  style={{ color: theme.text.secondary, fontSize: 12, marginTop: 8 }}>
                  · {line}
                </T>
              ))}
            </>
          ) : null}
        </Surface>

        <GhostButton label="Recargar" onPress={() => void refresh()} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 40 },
});
