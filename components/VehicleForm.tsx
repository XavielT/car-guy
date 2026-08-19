import { Field } from '@/components/Field';
import { T } from '@/components/T';
import { FuelPicker } from '@/components/FuelPicker';
import { PrimaryButton } from '@/components/ui';
import { colors } from '@/constants/theme';
import { FUEL_CATALOG } from '@/lib/fuel';
import { parseDecimal } from '@/lib/math';
import type { FuelType, Vehicle } from '@/lib/types';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

export function VehicleForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: Partial<Vehicle>;
  submitLabel: string;
  onSubmit: (v: Omit<Vehicle, 'id' | 'createdAt'>) => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [plate, setPlate] = useState(initial?.plate ?? '');
  const [fuel, setFuel] = useState<FuelType>(initial?.defaultFuelType ?? 'regular');
  const [tank, setTank] = useState(initial?.tankVolume ? String(initial.tankVolume) : '');

  const unit = FUEL_CATALOG[fuel].unitLabel;

  return (
    <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
      <T face="title" style={styles.h}>
        El carro que vas a cargar
      </T>
      <T face="body" style={styles.p}>
        El tipo de combustible queda como predeterminado. Lo puedes cambiar en cada carga.
      </T>
      <Field label="Nombre" placeholder="Corolla, motor, jeva…" value={name} onChangeText={setName} />
      <Field
        label="Placa (opcional)"
        placeholder="A123456"
        autoCapitalize="characters"
        value={plate}
        onChangeText={setPlate}
      />
      <T face="semibold" style={styles.label}>
        Combustible de fábrica
      </T>
      <FuelPicker value={fuel} onChange={setFuel} />
      <Field
        label={`Tanque (${unit}, opcional)`}
        placeholder="12.5"
        keyboardType="decimal-pad"
        value={tank}
        onChangeText={setTank}
      />
      <View style={{ height: 12 }} />
      <PrimaryButton
        label={submitLabel}
        disabled={!name.trim()}
        onPress={() =>
          onSubmit({
            name: name.trim(),
            plate: plate.trim().toUpperCase(),
            defaultFuelType: fuel,
            tankVolume: parseDecimal(tank),
          })
        }
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 20, paddingBottom: 48 },
  h: { fontSize: 26, color: colors.ink, marginBottom: 8 },
  p: { color: colors.muted, marginBottom: 20, fontSize: 15, lineHeight: 22 },
  label: { color: colors.ink, fontSize: 13, marginBottom: 8 },
});
