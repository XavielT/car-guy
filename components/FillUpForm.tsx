import { DateField } from '@/components/DateField';
import { Field } from '@/components/Field';
import { FuelPicker } from '@/components/FuelPicker';
import { T } from '@/components/T';
import { Chip, GhostButton, PrimaryButton } from '@/components/ui';
import { colors } from '@/constants/theme';
import { FUEL_CATALOG, STATIONS } from '@/lib/fuel';
import { dateInputFromIso, isoFromDateInput, money, todayIsoDate, volume as fmtVol } from '@/lib/format';
import { completeAmounts, parseDecimal } from '@/lib/math';
import type { FillUp, FuelType } from '@/lib/types';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Alert } from '@/lib/alert';

export type FillDraft = Omit<FillUp, 'id' | 'createdAt'>;

export function FillUpForm({
  vehicleId,
  defaultFuel,
  lastOdo,
  initial,
  submitLabel,
  onSubmit,
  onDelete,
}: {
  vehicleId: string;
  defaultFuel: FuelType;
  lastOdo: number | null;
  initial?: FillUp;
  submitLabel: string;
  onSubmit: (draft: FillDraft) => void;
  onDelete?: () => void;
}) {
  const [date, setDate] = useState(initial ? dateInputFromIso(initial.occurredAt) : todayIsoDate());
  const [odo, setOdo] = useState(initial ? String(initial.odometerKm) : '');
  const [fuel, setFuel] = useState<FuelType>(initial?.fuelType ?? defaultFuel);
  const [vol, setVol] = useState(initial ? String(initial.volume) : '');
  const [price, setPrice] = useState(initial ? String(initial.pricePerUnit) : '');
  const [total, setTotal] = useState(initial ? String(initial.totalDop) : '');
  const [full, setFull] = useState(initial?.isFullTank ?? true);
  const [station, setStation] = useState(initial?.station ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [customStation, setCustomStation] = useState(
    initial?.station && !(STATIONS as readonly string[]).includes(initial.station) ? initial.station : '',
  );

  const meta = FUEL_CATALOG[fuel];
  const amounts = useMemo(
    () =>
      completeAmounts({
        volume: parseDecimal(vol),
        pricePerUnit: parseDecimal(price),
        totalDop: parseDecimal(total),
      }),
    [vol, price, total],
  );

  function save() {
    const odometerKm = parseDecimal(odo);
    if (odometerKm == null) {
      Alert.alert('Odómetro', 'Pon el kilometraje que marca el tablero.');
      return;
    }
    if (lastOdo != null && !initial && odometerKm < lastOdo) {
      Alert.alert('Odómetro', `La última carga quedó en ${lastOdo} km. El nuevo valor no puede ser menor.`);
      return;
    }
    if (!amounts) {
      Alert.alert('Montos', 'Llena dos de estos tres: volumen, precio por unidad, o total.');
      return;
    }
    const chosenStation = station === 'Otra' ? customStation.trim() : station;
    onSubmit({
      vehicleId,
      occurredAt: isoFromDateInput(date),
      odometerKm,
      volume: amounts.volume,
      pricePerUnit: amounts.pricePerUnit,
      totalDop: amounts.totalDop,
      fuelType: fuel,
      isFullTank: full,
      station: chosenStation,
      notes: notes.trim(),
    });
  }

  return (
    <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
      <T face="title" style={styles.h}>
        En la bomba
      </T>
      <T face="body" style={styles.p}>
        Anota dos de tres (galones, precio, total) y el tercero se calcula solo. El consumo sale cuando marcas tanque lleno.
      </T>

      <DateField label="Fecha" value={date} onChange={setDate} />
      <Field
        label="Odómetro (km)"
        keyboardType="decimal-pad"
        value={odo}
        onChangeText={setOdo}
        placeholder={lastOdo != null ? String(lastOdo) : '45210'}
        hint={lastOdo != null ? `Última carga: ${lastOdo} km` : undefined}
      />

      <T face="semibold" style={styles.label}>
        Combustible
      </T>
      <FuelPicker value={fuel} onChange={setFuel} />

      <Field
        label={`Volumen (${meta.unitLabel})`}
        keyboardType="decimal-pad"
        value={vol}
        onChangeText={setVol}
        placeholder="8.4"
      />
      <Field
        label={meta.perUnitLabel}
        keyboardType="decimal-pad"
        value={price}
        onChangeText={setPrice}
        placeholder="307.50"
      />
      <Field
        label="Total pagado (RD$)"
        keyboardType="decimal-pad"
        value={total}
        onChangeText={setTotal}
        placeholder="2583.00"
      />
      {amounts ? (
        <View style={styles.calc}>
          <T face="mono" style={styles.calcTxt}>
            {fmtVol(amounts.volume, fuel)} · {money(amounts.pricePerUnit)}/{meta.unitLabel} · {money(amounts.totalDop)}
          </T>
        </View>
      ) : (
        <T face="body" style={styles.hint}>
          Falta un dato más para cerrar la cuenta.
        </T>
      )}

      <T face="semibold" style={styles.label}>
        Tipo de carga
      </T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        <Chip label="Tanque lleno" selected={full} onPress={() => setFull(true)} />
        <Chip label="Carga parcial" selected={!full} onPress={() => setFull(false)} />
      </View>
      <T face="body" style={styles.hint}>
        El km/{meta.unitLabel} solo se calcula entre dos tanques llenos. Las parciales entran en el gasto y se suman al próximo lleno.
      </T>

      <T face="semibold" style={styles.label}>
        Estación
      </T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {STATIONS.map((s) => (
          <Chip key={s} label={s} selected={station === s} onPress={() => setStation(s)} />
        ))}
      </View>
      {station === 'Otra' ? (
        <Field label="Nombre de la estación" value={customStation} onChangeText={setCustomStation} />
      ) : null}

      <Field label="Nota (opcional)" value={notes} onChangeText={setNotes} placeholder="Viaje a Santiago, tráfico…" />

      <PrimaryButton label={submitLabel} onPress={save} />
      {onDelete ? <GhostButton danger label="Borrar esta carga" onPress={onDelete} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 20, paddingBottom: 56 },
  h: { fontSize: 26, color: colors.ink, marginBottom: 8 },
  p: { color: colors.muted, marginBottom: 18, fontSize: 15, lineHeight: 22 },
  label: { color: colors.ink, fontSize: 13, marginBottom: 8, marginTop: 6 },
  hint: { color: colors.muted, fontSize: 12, marginBottom: 12, lineHeight: 18 },
  calc: {
    backgroundColor: colors.receiptDeep,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  calcTxt: { color: colors.ink, fontSize: 13 },
});
