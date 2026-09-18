import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { DateField } from '@/components/DateField';
import { Field } from '@/components/Field';
import { FuelPicker } from '@/components/FuelPicker';
import { T } from '@/components/T';
import { Chip, GhostButton, PrimaryButton, Segmented } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { Alert } from '@/lib/alert';
import { completeAmounts, parseDecimal } from '@/lib/domain/economy';
import { FUEL_CATALOG, STATIONS } from '@/lib/fuel';
import { dateInputFromIso, isoFromDateInput, money, todayIsoDate, volume as fmtVol } from '@/lib/format';
import { es } from '@/lib/i18n/es';
import { useTheme } from '@/lib/theme/useTheme';
import type { FillUp, FuelType } from '@/lib/types';

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
  const { theme } = useTheme();

  const [date, setDate] = useState(initial ? dateInputFromIso(initial.occurredAt) : todayIsoDate());
  const [odo, setOdo] = useState(initial ? String(initial.odometerKm) : '');
  const [fuel, setFuel] = useState<FuelType>(initial?.fuelType ?? defaultFuel);
  const [vol, setVol] = useState(initial ? String(initial.volume) : '');
  const [price, setPrice] = useState(initial ? String(initial.pricePerUnit) : '');
  const [total, setTotal] = useState(initial ? String(initial.totalDop) : '');
  const [full, setFull] = useState(initial?.isFullTank ?? true);
  const [missedPrevious, setMissedPrevious] = useState(initial?.missedPrevious ?? false);
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
      Alert.alert(es.fuel.odometer, es.fuel.odometerRequired);
      return;
    }
    if (lastOdo != null && !initial && odometerKm < lastOdo) {
      Alert.alert(es.fuel.odometer, es.fuel.odometerTooLow(lastOdo));
      return;
    }
    if (!amounts) {
      Alert.alert(es.fuel.loadKind, es.fuel.amountsRequired);
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
      missedPrevious,
      station: chosenStation,
      notes: notes.trim(),
    });
  }

  return (
    <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
      <T face="title" style={[styles.h, { color: theme.text.primary }]}>
        {initial ? es.fuel.editTitle : es.fuel.newTitle}
      </T>
      <T face="body" style={[styles.p, { color: theme.text.secondary }]}>
        {es.fuel.intro}
      </T>

      <DateField label={es.fuel.date} value={date} onChange={setDate} />
      <Field
        label={es.fuel.odometer}
        keyboardType="decimal-pad"
        value={odo}
        onChangeText={setOdo}
        placeholder={lastOdo != null ? String(lastOdo) : '45210'}
        hint={lastOdo != null ? es.fuel.odometerHint(`${lastOdo.toLocaleString('es-DO')} km`) : undefined}
      />

      <T face="semibold" style={[styles.label, { color: theme.text.primary }]}>
        {es.fuel.type}
      </T>
      <FuelPicker value={fuel} onChange={setFuel} />

      <Field
        label={es.fuel.volume(meta.unitLabel)}
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
        label={es.fuel.total}
        keyboardType="decimal-pad"
        value={total}
        onChangeText={setTotal}
        placeholder="2583.00"
      />
      {amounts ? (
        <View style={[styles.calc, { backgroundColor: theme.bg.raised, borderColor: theme.line }]}>
          <T face="monoBold" style={[styles.calcTxt, { color: theme.text.primary }]}>
            {fmtVol(amounts.volume, fuel)} · {money(amounts.pricePerUnit)}/{meta.unitLabel} ·{' '}
            {money(amounts.totalDop)}
          </T>
        </View>
      ) : (
        <T face="body" style={[styles.hint, { color: theme.text.muted }]}>
          {es.fuel.calcPending}
        </T>
      )}

      <T face="semibold" style={[styles.label, { color: theme.text.primary }]}>
        {es.fuel.loadKind}
      </T>
      <Segmented
        options={[
          { key: 'full', label: es.fuel.fullTank },
          { key: 'partial', label: es.fuel.partial },
        ]}
        value={full ? 'full' : 'partial'}
        onChange={(next) => setFull(next === 'full')}
      />
      <T face="body" style={[styles.hint, { color: theme.text.muted, marginTop: space.sm }]}>
        {es.fuel.partialHint(meta.unitLabel)}
      </T>

      {/* The honest answer to "my km/gal looks wrong": the chain is only as good
          as the log, so the driver gets a way to say a link is missing. */}
      <Pressable
        onPress={() => setMissedPrevious((value) => !value)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: missedPrevious }}
        accessibilityLabel={es.fuel.missedPrevious}
        style={styles.toggle}>
        <View
          style={[
            styles.checkbox,
            {
              borderColor: missedPrevious ? theme.accent : theme.line,
              backgroundColor: missedPrevious ? theme.accent : theme.bg.raised,
            },
          ]}
        />
        <View style={{ flex: 1 }}>
          <T face="semibold" style={{ color: theme.text.primary, fontSize: 15 }}>
            {es.fuel.missedPrevious}
          </T>
          <T face="body" style={[styles.hint, { color: theme.text.muted, marginTop: 2 }]}>
            {es.fuel.missedPreviousHint}
          </T>
        </View>
      </Pressable>

      <T face="semibold" style={[styles.label, { color: theme.text.primary }]}>
        {es.fuel.station}
      </T>
      <View style={styles.chips}>
        {STATIONS.map((s) => (
          <Chip key={s} label={s} selected={station === s} onPress={() => setStation(s)} />
        ))}
      </View>
      {station === 'Otra' ? (
        <Field label={es.fuel.stationOther} value={customStation} onChangeText={setCustomStation} />
      ) : null}

      <Field
        label={es.fuel.notes}
        value={notes}
        onChangeText={setNotes}
        placeholder={es.fuel.notesPlaceholder}
      />

      <PrimaryButton label={submitLabel} onPress={save} />
      {onDelete ? <GhostButton danger label={es.fuel.delete} onPress={onDelete} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 56 },
  h: { fontSize: 26, marginBottom: space.sm },
  p: { marginBottom: 18, fontSize: 15, lineHeight: 22 },
  label: { fontSize: 13, marginBottom: space.sm, marginTop: 6 },
  hint: { fontSize: 12, marginBottom: space.md, lineHeight: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  calc: {
    borderWidth: 1,
    borderRadius: radius.input,
    padding: space.md,
    marginBottom: 14,
  },
  calcTxt: { fontSize: 14 },
  toggle: {
    flexDirection: 'row',
    gap: space.md,
    alignItems: 'flex-start',
    marginTop: space.sm,
    marginBottom: space.lg,
    minHeight: 44,
  },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1, marginTop: 2 },
});
