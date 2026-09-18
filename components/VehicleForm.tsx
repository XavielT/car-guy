import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { radius, space } from '@/constants/theme';
import { FuelPicker } from '@/components/FuelPicker';
import { DateField } from '@/components/DateField';
import { Field } from '@/components/Field';
import { PhotoPicker } from '@/components/PhotoPicker';
import { T } from '@/components/T';
import { Chip, PrimaryButton } from '@/components/ui';
import { parseDecimal } from '@/lib/domain/economy';
import { useTheme } from '@/lib/theme/useTheme';
import { es } from '@/lib/i18n/es';
import type { FuelType } from '@/lib/types';
import type { VehicleType } from '@/lib/db/types';

export type VehicleDraft = {
  id?: string;
  name: string;
  type: VehicleType;
  make: string | null;
  model: string | null;
  year: number | null;
  color: string | null;
  plate: string | null;
  vin: string | null;
  defaultFuelType: FuelType;
  tankVolume: number | null;
  /** Written as an `odometer_reading` with source 'manual', not a vehicle column. */
  odometerKm: number | null;
  /** Stretches the seeded aceite_motor reminder to 10,000 km / 12 months. */
  synthetic: boolean;
  purchaseDate: string | null;
  purchasePrice: number | null;
  photoMediaId: string | null;
  notes: string;
};

const TYPES: VehicleType[] = ['carro', 'jeepeta', 'camioneta', 'motor', 'camion', 'guagua', 'otro'];

const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = 1950;

export function VehicleForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: Partial<VehicleDraft>;
  submitLabel: string;
  onSubmit: (draft: VehicleDraft) => void;
}) {
  const { theme } = useTheme();
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState<VehicleType>(initial?.type ?? 'carro');
  const [make, setMake] = useState(initial?.make ?? '');
  const [model, setModel] = useState(initial?.model ?? '');
  const [year, setYear] = useState(initial?.year ? String(initial.year) : '');
  const [color, setColor] = useState(initial?.color ?? '');
  const [plate, setPlate] = useState(initial?.plate ?? '');
  const [vin, setVin] = useState(initial?.vin ?? '');
  const [fuel, setFuel] = useState<FuelType>(initial?.defaultFuelType ?? 'regular');
  const [tank, setTank] = useState(initial?.tankVolume ? String(initial.tankVolume) : '');
  const [odometer, setOdometer] = useState(initial?.odometerKm ? String(initial.odometerKm) : '');
  const [synthetic, setSynthetic] = useState(initial?.synthetic ?? false);
  const [showPurchase, setShowPurchase] = useState(Boolean(initial?.purchaseDate || initial?.purchasePrice));
  const [purchaseDate, setPurchaseDate] = useState(initial?.purchaseDate ?? '');
  const [purchasePrice, setPurchasePrice] = useState(
    initial?.purchasePrice ? String(initial.purchasePrice) : '',
  );
  const [photoMediaId, setPhotoMediaId] = useState<string | null>(initial?.photoMediaId ?? null);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [error, setError] = useState<string | null>(null);

  // A stable owner id so a photo picked before the vehicle is saved still has
  // somewhere to belong.
  const [draftId] = useState(() => initial?.id ?? `veh_${Date.now()}`);

  function save() {
    const trimmed = name.trim();
    if (!trimmed) return setError(es.vehicle.nameRequired);

    const parsedYear = year.trim() ? Number(year.trim()) : null;
    if (parsedYear != null && (!Number.isInteger(parsedYear) || parsedYear < MIN_YEAR || parsedYear > CURRENT_YEAR + 1)) {
      return setError(es.vehicle.yearRange(MIN_YEAR, CURRENT_YEAR + 1));
    }

    const parsedOdometer = odometer.trim() ? parseDecimal(odometer) : null;
    if (odometer.trim() && parsedOdometer == null) return setError(es.vehicle.odometerNegative);

    setError(null);
    onSubmit({
      id: initial?.id ?? draftId,
      name: trimmed,
      type,
      make: make.trim() || null,
      model: model.trim() || null,
      year: parsedYear,
      color: color.trim() || null,
      plate: plate.trim().toUpperCase() || null,
      vin: vin.trim().toUpperCase() || null,
      defaultFuelType: fuel,
      tankVolume: tank.trim() ? parseDecimal(tank) : null,
      odometerKm: parsedOdometer,
      synthetic,
      purchaseDate: purchaseDate || null,
      purchasePrice: purchasePrice.trim() ? parseDecimal(purchasePrice) : null,
      photoMediaId,
      notes: notes.trim(),
    });
  }

  return (
    <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
      <T face="display" style={[styles.h, { color: theme.text.primary }]}>
        {initial?.id ? es.vehicle.editTitle : es.vehicle.newTitle}
      </T>

      <Field
        label={es.vehicle.name}
        placeholder={es.vehicle.namePlaceholder}
        value={name}
        onChangeText={setName}
      />

      <T face="semibold" style={[styles.label, { color: theme.text.primary }]}>
        {es.vehicle.type}
      </T>
      <View style={styles.row}>
        {TYPES.map((t) => (
          <Chip key={t} label={es.vehicleTypes[t]} selected={type === t} onPress={() => setType(t)} />
        ))}
      </View>

      <View style={styles.pair}>
        <View style={styles.half}>
          <Field label={es.vehicle.make} placeholder={es.vehicle.makePlaceholder} value={make} onChangeText={setMake} />
        </View>
        <View style={styles.half}>
          <Field label={es.vehicle.model} placeholder={es.vehicle.modelPlaceholder} value={model} onChangeText={setModel} />
        </View>
      </View>

      <View style={styles.pair}>
        <View style={styles.half}>
          <Field label={es.vehicle.year} placeholder="2015" keyboardType="number-pad" value={year} onChangeText={setYear} />
        </View>
        <View style={styles.half}>
          <Field label={es.vehicle.color} placeholder="Negro" value={color} onChangeText={setColor} />
        </View>
      </View>

      <View style={styles.pair}>
        <View style={styles.half}>
          <Field
            label={es.vehicle.plate}
            placeholder="A123456"
            autoCapitalize="characters"
            value={plate}
            onChangeText={setPlate}
          />
        </View>
        <View style={styles.half}>
          <Field label={es.vehicle.vin} autoCapitalize="characters" value={vin} onChangeText={setVin} />
        </View>
      </View>

      <T face="semibold" style={[styles.label, { color: theme.text.primary }]}>
        {es.vehicle.fuel}
      </T>
      <FuelPicker value={fuel} onChange={setFuel} />

      <View style={styles.pair}>
        <View style={styles.half}>
          <Field label={es.vehicle.tank} placeholder="12.5" keyboardType="decimal-pad" value={tank} onChangeText={setTank} />
        </View>
        <View style={styles.half}>
          <Field
            label={es.vehicle.odometer}
            placeholder="51676"
            keyboardType="number-pad"
            value={odometer}
            onChangeText={setOdometer}
            hint={es.vehicle.odometerHint}
          />
        </View>
      </View>

      <Pressable
        onPress={() => setSynthetic((v) => !v)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: synthetic }}
        accessibilityLabel={es.vehicle.synthetic}
        style={styles.toggle}>
        <View
          style={[
            styles.checkbox,
            {
              borderColor: synthetic ? theme.accent : theme.line,
              backgroundColor: synthetic ? theme.accent : theme.bg.raised,
            },
          ]}
        />
        <View style={{ flex: 1 }}>
          <T face="semibold" style={[styles.toggleLabel, { color: theme.text.primary }]}>
            {es.vehicle.synthetic}
          </T>
          <T face="body" style={[styles.hint, { color: theme.text.muted }]}>
            {es.vehicle.syntheticHint}
          </T>
        </View>
      </Pressable>

      <T face="semibold" style={[styles.label, { color: theme.text.primary }]}>
        {es.vehicle.photo}
      </T>
      <PhotoPicker
        mediaId={photoMediaId}
        ownerTable="vehicle"
        ownerId={draftId}
        vehicleId={draftId}
        onChange={setPhotoMediaId}
      />

      <Pressable
        onPress={() => setShowPurchase((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: showPurchase }}
        style={styles.sectionToggle}>
        <T face="semibold" style={[styles.sectionToggleLabel, { color: theme.accent }]}>
          {showPurchase ? '−' : '+'}  {es.vehicle.purchaseSection}
        </T>
      </Pressable>
      {showPurchase ? (
        <>
          <DateField label={es.vehicle.purchaseDate} value={purchaseDate} onChange={setPurchaseDate} />
          <Field
            label={es.vehicle.purchasePrice}
            keyboardType="decimal-pad"
            value={purchasePrice}
            onChangeText={setPurchasePrice}
          />
        </>
      ) : null}

      <Field label={es.vehicle.notes} value={notes} onChangeText={setNotes} multiline />

      {error ? (
        <T
          face="body"
          accessibilityRole="alert"
          style={[styles.error, { color: theme.danger, backgroundColor: theme.statusBg.vencido }]}>
          {error}
        </T>
      ) : null}

      <PrimaryButton label={submitLabel} onPress={save} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 40 },
  h: { fontSize: 28, marginBottom: space.lg },
  label: { fontSize: 13, marginBottom: 6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: space.sm },
  pair: { flexDirection: 'row', gap: space.md },
  half: { flex: 1 },
  toggle: {
    flexDirection: 'row',
    gap: space.md,
    alignItems: 'flex-start',
    marginBottom: space.lg,
    minHeight: 44,
  },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1, marginTop: 2 },
  toggleLabel: { fontSize: 15 },
  hint: { fontSize: 12, marginTop: 2, lineHeight: 17 },
  sectionToggle: { paddingVertical: space.md, minHeight: 44, justifyContent: 'center' },
  sectionToggleLabel: { fontSize: 14 },
  error: {
    fontSize: 13,
    marginBottom: space.md,
    padding: space.md,
    borderRadius: radius.input,
    overflow: 'hidden',
  },
});
