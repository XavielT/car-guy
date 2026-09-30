import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { radius, space } from '@/constants/theme';
import { FuelPicker } from '@/components/FuelPicker';
import { DateField } from '@/components/DateField';
import { Field } from '@/components/Field';
import { SwatchGrid } from '@/components/pickers';
import { T } from '@/components/T';
import { Chip, PrimaryButton, Segmented } from '@/components/ui';
import { IdentitySection, type IdentityValue } from '@/components/vehicle/IdentitySection';
import { MakeModelYear, type MakeModelValue } from '@/components/vehicle/MakeModelYear';
import { PhotosSection } from '@/components/vehicle/PhotosSection';
import { parseDecimal } from '@/lib/domain/economy';
import { normalizeGallery, type Gallery } from '@/lib/domain/gallery';
import { bodyTypeFromLegacy, bodyTypes, colors, legacyTypeFor } from '@/lib/domain/refdata';
import type { EconomyUnit, VolumeUnit } from '@/lib/domain/units';
import { convertTankText, tankCaption, yearError } from '@/lib/domain/vehicleForm';
import { statusLabel } from '@/lib/domain/vehicleStatus';
import { useTheme } from '@/lib/theme/useTheme';
import { es } from '@/lib/i18n/es';
import type { FuelType } from '@/lib/types';
import type { Drivetrain, Transmission, VehicleOrigin, VehicleStatus, VehicleType } from '@/lib/db/types';

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
  /** In `volumeUnit`, as typed; saveVehicleDraft stores liters. */
  tankVolume: number | null;
  /** Written as an `odometer_reading` with source 'manual', not a vehicle column. */
  odometerKm: number | null;
  /** Stretches the seeded aceite_motor reminder to 10,000 km / 12 months. */
  synthetic: boolean;
  purchaseDate: string | null;
  purchasePrice: number | null;
  /** The cover; always one of `galleryIds` when there are photos. */
  photoMediaId: string | null;
  notes: string;
  // schema v2 identity (IMP 28092026)
  nickname: string | null;
  status: VehicleStatus;
  chassisCode: string | null;
  chassisNumber: string | null;
  engineCode: string | null;
  transmission: Transmission | null;
  drivetrain: Drivetrain | null;
  origin: VehicleOrigin | null;
  importedYear: number | null;
  story: string;
  // schema v6 (IMP 29092026 Phase 3). Optional so older callers still type-check.
  makeId?: string | null;
  modelId?: string | null;
  bodyType?: string | null;
  colorId?: string | null;
  interiorColorId?: string | null;
  interiorMaterial?: string | null;
  volumeUnit?: VolumeUnit;
  /** 'l_100km' when chosen; otherwise the economy follows the volume unit (km/gal, km/L). */
  economyUnit?: EconomyUnit;
  statusNote?: string;
  statusSince?: string | null;
  /** The gallery in order (album items with role 'vehicle'). */
  galleryIds?: string[];
};

/** vendido and perdido are not picked here: the sale sheet closes the ownership period. */
const STATUSES: VehicleStatus[] = ['activo', 'proyecto', 'en_taller', 'accidentado', 'guardado', 'restauracion', 'prestado'];

const MATERIALS = colors('material').filter((m) => m.id !== 'material-otro');
const swatches = (kind: 'exterior' | 'interior') => colors(kind).map((c) => ({ id: c.id, label: c.es, hex: c.hex, light: c.light }));

/**
 * The vehicle form v2 (IMP 29092026 Phase 3, 03-screens.md "Phase 3"): the
 * fast path first — name, photos, make/model/year — and everything after the
 * name optional. The order is fixed by the spec.
 */
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
  const [bodyType, setBodyType] = useState<string | null>(initial?.bodyType ?? bodyTypeFromLegacy(initial?.type));
  const [mmy, setMmy] = useState<MakeModelValue>({
    makeId: initial?.makeId ?? null,
    make: initial?.make ?? '',
    modelId: initial?.modelId ?? null,
    model: initial?.model ?? '',
    year: initial?.year ? String(initial.year) : '',
  });
  const [color, setColor] = useState<{ id: string | null; label: string | null }>({
    id: initial?.colorId ?? null,
    label: initial?.color ?? null,
  });
  const [interior, setInterior] = useState<{ id: string | null; label: string | null }>({
    id: initial?.interiorColorId ?? null,
    label: null,
  });
  const [material, setMaterial] = useState<string | null>(initial?.interiorMaterial ?? null);
  const [plate, setPlate] = useState(initial?.plate ?? '');
  const [vin, setVin] = useState(initial?.vin ?? '');
  const [fuel, setFuel] = useState<FuelType>(initial?.defaultFuelType ?? 'regular');
  const [unit, setUnit] = useState<VolumeUnit>(initial?.volumeUnit ?? 'gal');
  const [perHundred, setPerHundred] = useState(initial?.economyUnit === 'l_100km');
  const [tank, setTank] = useState(initial?.tankVolume ? String(initial.tankVolume) : '');
  const [odometer, setOdometer] = useState(initial?.odometerKm ? String(initial.odometerKm) : '');
  const [synthetic, setSynthetic] = useState(initial?.synthetic ?? false);
  const [purchaseDate, setPurchaseDate] = useState(initial?.purchaseDate ?? '');
  const [purchasePrice, setPurchasePrice] = useState(initial?.purchasePrice ? String(initial.purchasePrice) : '');
  const [gallery, setGallery] = useState<Gallery>(() =>
    normalizeGallery(
      [...(initial?.galleryIds ?? []), ...(initial?.photoMediaId ? [initial.photoMediaId] : [])],
      initial?.photoMediaId ?? null,
    ),
  );
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [status, setStatus] = useState<VehicleStatus>(initial?.status ?? 'activo');
  const [statusSince, setStatusSince] = useState(initial?.statusSince ?? '');
  const [statusNote, setStatusNote] = useState(initial?.statusNote ?? '');
  const [identity, setIdentity] = useState<IdentityValue>({
    nickname: initial?.nickname ?? '',
    chassisCode: initial?.chassisCode ?? '',
    chassisNumber: initial?.chassisNumber ?? '',
    engineCode: initial?.engineCode ?? '',
    transmission: initial?.transmission ?? null,
    drivetrain: initial?.drivetrain ?? null,
    origin: initial?.origin ?? null,
    importedYear: initial?.importedYear ? String(initial.importedYear) : '',
    story: initial?.story ?? '',
  });
  const [showIdentity, setShowIdentity] = useState(
    Boolean(initial?.nickname || initial?.chassisCode || initial?.engineCode || initial?.story),
  );
  const [error, setError] = useState<string | null>(null);

  // A stable owner id so a photo picked before the vehicle is saved still has
  // somewhere to belong. Created once (useState initializer), never re-keyed.
  const [draftId] = useState(() => initial?.id ?? `veh_${Date.now()}`);

  const sold = status === 'vendido' || status === 'perdido';
  const tankValue = tank.trim() ? parseDecimal(tank) : null;
  const caption = tankCaption(tankValue, unit);
  const unitLabel = (u: VolumeUnit) => (u === 'gal' ? 'gal' : 'L');

  function changeUnit(next: VolumeUnit) {
    // The number follows the unit, so the liters stored do not change.
    setTank((t) => convertTankText(t, unit, next, parseDecimal));
    setUnit(next);
  }

  function save() {
    const trimmed = name.trim();
    if (!trimmed) return setError(es.vehicle.nameRequired);

    const badYear = yearError(mmy.year);
    if (badYear) return setError(es.vehicle.yearRange(badYear.min, badYear.max));
    const parsedYear = mmy.year.trim() ? Number(mmy.year.trim()) : null;

    const parsedOdometer = odometer.trim() ? parseDecimal(odometer) : null;
    if (odometer.trim() && parsedOdometer == null) {
      // "-5" and "abc" both land here; only one of them is negative.
      return setError(/^\s*-/.test(odometer) ? es.vehicle.odometerNegative : es.common.invalidNumber(es.vehicle.odometer));
    }
    if (tank.trim() && tankValue == null) return setError(es.common.invalidNumber(es.vehicleForm.tank));
    if (purchasePrice.trim() && parseDecimal(purchasePrice) == null) {
      return setError(es.common.invalidNumber(es.vehicleForm.purchasePrice));
    }

    const importedRaw = identity.importedYear.trim();
    const parsedImported = importedRaw ? Number(importedRaw) : null;
    const now = new Date().getFullYear();
    if (parsedImported != null && (!Number.isInteger(parsedImported) || parsedImported < 1950 || parsedImported > now)) {
      return setError(es.vehicle.yearRange(1950, now));
    }

    setError(null);
    const active = status === 'activo';
    onSubmit({
      id: initial?.id ?? draftId,
      name: trimmed,
      type: legacyTypeFor(bodyType),
      bodyType,
      make: mmy.make.trim() || null,
      makeId: mmy.makeId,
      model: mmy.model.trim() || null,
      modelId: mmy.modelId,
      year: parsedYear,
      color: color.label?.trim() || null,
      colorId: color.id,
      interiorColorId: interior.id,
      interiorMaterial: material,
      plate: plate.trim().toUpperCase() || null,
      vin: vin.trim().toUpperCase() || null,
      defaultFuelType: fuel,
      volumeUnit: unit,
      economyUnit: perHundred ? 'l_100km' : unit === 'l' ? 'km_l' : 'km_gal',
      tankVolume: tankValue,
      odometerKm: parsedOdometer,
      synthetic,
      purchaseDate: purchaseDate || null,
      purchasePrice: purchasePrice.trim() ? parseDecimal(purchasePrice) : null,
      photoMediaId: gallery.cover,
      galleryIds: gallery.ids,
      notes: notes.trim(),
      nickname: identity.nickname.trim() || null,
      status,
      statusSince: active ? null : statusSince || null,
      statusNote: active ? '' : statusNote.trim(),
      chassisCode: identity.chassisCode.trim().toUpperCase() || null,
      chassisNumber: identity.chassisNumber.trim().toUpperCase() || null,
      engineCode: identity.engineCode.trim() || null,
      transmission: identity.transmission,
      drivetrain: identity.drivetrain,
      origin: identity.origin,
      importedYear: parsedImported,
      story: identity.story.trim(),
    });
  }

  return (
    <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
      <T face="display" style={[styles.h, { color: theme.text.primary }]}>
        {initial?.id ? es.vehicle.editTitle : es.vehicle.newTitle}
      </T>

      {/* 1 · Nombre, Fotos */}
      <Field label={es.vehicle.name} placeholder={es.vehicle.namePlaceholder} value={name} onChangeText={setName} />
      <PhotosSection gallery={gallery} onChange={setGallery} vehicleId={draftId} />

      {/* 2 · Marca, Modelo, Año */}
      <MakeModelYear value={mmy} onChange={setMmy} />

      {/* 3 · Tipo */}
      <T face="eyebrow" style={[styles.label, { color: theme.text.muted }]}>
        {es.vehicleForm.bodyType}
      </T>
      <View style={styles.row}>
        {bodyTypes().map((b) => (
          <Chip key={b.id} label={b.es} selected={bodyType === b.id} onPress={() => setBodyType(bodyType === b.id ? null : b.id)} />
        ))}
      </View>

      {/* 4 · Color, Interior */}
      <SwatchGrid label={es.vehicleForm.color} swatches={swatches('exterior')} value={color.id} otherText={color.id ? null : color.label} onChange={setColor} />
      <SwatchGrid label={es.vehicleForm.interior} swatches={swatches('interior')} value={interior.id} onChange={setInterior} />
      <T face="eyebrow" style={[styles.label, { color: theme.text.muted }]}>
        {es.vehicleForm.interiorMaterial}
      </T>
      <View style={styles.row}>
        {MATERIALS.map((m) => {
          const id = m.id.replace(/^material-/, '');
          return <Chip key={m.id} label={m.es} selected={material === id} onPress={() => setMaterial(material === id ? null : id)} />;
        })}
      </View>

      <View style={styles.pair}>
        <View style={styles.half}>
          <Field label={es.vehicle.plate} placeholder="A123456" autoCapitalize="characters" value={plate} onChangeText={setPlate} />
        </View>
        <View style={styles.half}>
          <Field label={es.vehicle.vin} autoCapitalize="characters" value={vin} onChangeText={setVin} />
        </View>
      </View>

      {/* 5 · Combustible, Tanque (gal | L), Odómetro */}
      <T face="eyebrow" style={[styles.label, { color: theme.text.muted }]}>
        {es.vehicle.fuel}
      </T>
      <FuelPicker value={fuel} onChange={setFuel} />

      <View style={styles.pair}>
        <View style={styles.half}>
          <Field
            label={`${es.vehicleForm.tank} (${unitLabel(unit)})`}
            placeholder={unit === 'gal' ? '12.5' : '47'}
            keyboardType="decimal-pad"
            value={tank}
            onChangeText={setTank}
            hint={
              caption
                ? es.vehicleForm.tankConverted(caption.typed, unitLabel(unit), caption.other, unitLabel(caption.otherUnit))
                : undefined
            }
          />
          <Segmented<VolumeUnit>
            options={[
              { key: 'gal', label: 'gal' },
              { key: 'l', label: 'L' },
            ]}
            value={unit}
            onChange={changeUnit}
            style={styles.unit}
          />
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

      <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11, marginBottom: space.xs }}>
        {es.vehicleForm.economyUnit}
      </T>
      <Segmented<'volume' | 'l_100km'>
        options={[
          { key: 'volume', label: unit === 'l' ? 'km/L' : 'km/gal' },
          { key: 'l_100km', label: 'L/100 km' },
        ]}
        value={perHundred ? 'l_100km' : 'volume'}
        onChange={(k) => setPerHundred(k === 'l_100km')}
        style={{ marginBottom: space.md }}
      />

      <Pressable
        onPress={() => setSynthetic((v) => !v)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: synthetic }}
        accessibilityLabel={es.vehicle.synthetic}
        style={styles.toggle}>
        <View
          style={[
            styles.checkbox,
            { borderColor: synthetic ? theme.accent : theme.line, backgroundColor: synthetic ? theme.accent : theme.bg.raised },
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

      {/* 6 · Precio y fecha de compra — visible (note 8) */}
      <View style={styles.pair}>
        <View style={styles.half}>
          <Field
            label={es.vehicleForm.purchasePrice}
            placeholder="875,000"
            keyboardType="decimal-pad"
            value={purchasePrice}
            onChangeText={setPurchasePrice}
          />
        </View>
        <View style={styles.half}>
          <DateField label={es.vehicle.purchaseDate} value={purchaseDate} onChange={setPurchaseDate} noFuture />
        </View>
      </View>
      <T face="body" style={[styles.caption, { color: theme.text.muted }]}>
        {es.vehicleForm.purchaseCaption}
      </T>

      {/* 7 · Estado (+ Desde, Nota) — a sold car keeps its status; "Cambiar estado" on the hub changes it back */}
      {sold ? null : (
        <>
          <T face="eyebrow" style={[styles.label, { color: theme.text.muted }]}>
            {es.vehicleForm.status}
          </T>
          <View style={styles.row}>
            {STATUSES.map((s) => (
              <Chip key={s} label={statusLabel(s)} selected={status === s} onPress={() => setStatus(s)} />
            ))}
          </View>
          {status !== 'activo' ? (
            <View style={styles.pair}>
              <View style={styles.half}>
                <DateField label={es.vehicleForm.statusSince} value={statusSince} onChange={setStatusSince} noFuture />
              </View>
              <View style={styles.half}>
                <Field
                  label={es.vehicleForm.statusNote}
                  placeholder={es.vehicleForm.statusNotePlaceholder}
                  value={statusNote}
                  onChangeText={setStatusNote}
                />
              </View>
            </View>
          ) : null}
        </>
      )}

      {/* 8 · + Identidad */}
      <Pressable
        onPress={() => setShowIdentity((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: showIdentity }}
        style={styles.sectionToggle}>
        <T face="semibold" style={[styles.sectionToggleLabel, { color: theme.accent }]}>
          {showIdentity ? '−' : '+'}  {es.vehicle.identitySection}
        </T>
      </Pressable>
      {showIdentity ? <IdentitySection value={identity} onChange={setIdentity} /> : null}

      {/* 9 · Notas */}
      <Field label={es.vehicle.notes} value={notes} onChangeText={setNotes} multiline />

      {error ? (
        <T face="body" accessibilityRole="alert" style={[styles.error, { color: theme.dangerText, backgroundColor: theme.statusBg.vencido }]}>
          {error}
        </T>
      ) : null}

      <PrimaryButton label={submitLabel} onPress={save} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 40 },
  h: { fontSize: 28, marginBottom: space.lg, textTransform: 'uppercase' },
  label: { fontSize: 13, marginBottom: 6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: space.sm },
  pair: { flexDirection: 'row', gap: space.md },
  half: { flex: 1 },
  unit: { marginTop: -space.sm, marginBottom: space.md },
  caption: { fontSize: 12, marginTop: -space.sm, marginBottom: space.lg, lineHeight: 17 },
  toggle: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start', marginBottom: space.lg, minHeight: 44 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1, marginTop: 2 },
  toggleLabel: { fontSize: 15 },
  hint: { fontSize: 12, marginTop: 2, lineHeight: 17 },
  sectionToggle: { paddingVertical: space.md, minHeight: 44, justifyContent: 'center' },
  sectionToggleLabel: { fontSize: 14 },
  error: { fontSize: 13, marginBottom: space.md, padding: space.md, borderRadius: radius.input, overflow: 'hidden' },
});
