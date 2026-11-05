import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { radius, space } from '@/constants/theme';
import { FuelPicker } from '@/components/FuelPicker';
import { AiFieldMark } from '@/components/ai/AiFieldMark';
import { CaptureButton } from '@/components/ai/CaptureButton';
import { DateField } from '@/components/DateField';
import { Field } from '@/components/Field';
import { SelectField } from '@/components/pickers';
import { T } from '@/components/T';
import { Collapsible, PrimaryButton, ToggleRow } from '@/components/ui';
import { IdentitySection, type IdentityValue } from '@/components/vehicle/IdentitySection';
import { MakeModelYear, type MakeModelValue } from '@/components/vehicle/MakeModelYear';
import { DEFAULT_SEGMENTS, GaugeTypeSection, type GaugeTypeValue } from '@/components/vehicle/GaugeTypeSection';
import { PhotosSection } from '@/components/vehicle/PhotosSection';
import type { GaugeType } from '@/lib/domain/gauge';
import { FEATURE_GAUGE_SEGMENTS } from '@/lib/flagsV10';
import { Alert } from '@/lib/alert';
import { mergeVpic, vehiclePrefillFrom, type MergeConflict, type VehicleMarks } from '@/lib/ai/docMap';
import type { ReadResult } from '@/lib/ai/read';
import { matchColor, matchMakeModel } from '@/lib/ai/vehicleMatch';
import { checkVin, decodeVin } from '@/lib/domain/vpic';
import { parseDecimal } from '@/lib/domain/economy';
import { normalizeGallery, type Gallery } from '@/lib/domain/gallery';
import { bodyTypeFromLegacy, bodyTypes, colors, legacyTypeFor } from '@/lib/domain/refdata';
import type { EconomyUnit, VolumeUnit } from '@/lib/domain/units';
import { convertTankText, tankCaption, yearError } from '@/lib/domain/vehicleForm';
import { statusLabel } from '@/lib/domain/vehicleStatus';
import { useTheme } from '@/lib/theme/useTheme';
import { t } from '@/lib/i18n';
import { refLabel } from '@/lib/i18n/catalog';
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
  /** The reserve light's volume, in `volumeUnit` (→ reserve_volume_l). null = 10 % of the tank; undefined = leave alone. */
  reserveVolume?: number | null;
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
  // v10 (IMP 01102026 Phase 3, ADR-51): how the dash shows the fuel. Optional: `undefined` leaves them alone.
  gaugeType?: GaugeType;
  gaugeSegments?: number | null;
  gaugeReserveAt?: number | null;
};

/** vendido and perdido are not picked here: the sale sheet closes the ownership period. */
const STATUSES: VehicleStatus[] = ['activo', 'proyecto', 'en_taller', 'accidentado', 'guardado', 'restauracion', 'prestado'];

const MATERIALS = colors('material').filter((m) => m.id !== 'material-otro');
const swatchOptions = (kind: 'exterior' | 'interior') =>
  colors(kind)
    .filter((c) => c.hex)
    .map((c) => ({ value: c.id as string | null, label: refLabel(c), swatch: c.hex }));
const colorLabel = (kind: 'exterior' | 'interior', id: string | null) => (id ? (swatchOptions(kind).find((o) => o.value === id)?.label ?? null) : null);

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
  const [tank, setTank] = useState(initial?.tankVolume != null ? String(initial.tankVolume) : '');
  const [reserve, setReserve] = useState(initial?.reserveVolume != null ? String(initial.reserveVolume) : '');
  const [odometer, setOdometer] = useState(initial?.odometerKm != null ? String(initial.odometerKm) : '');
  // v10 (ADR-51): how the dash shows the fuel.
  const [gauge, setGauge] = useState<GaugeTypeValue>({
    type: initial?.gaugeType ?? 'needle8',
    segments: initial?.gaugeSegments ?? DEFAULT_SEGMENTS,
    reserveAt: initial?.gaugeReserveAt ?? null,
  });
  const [synthetic, setSynthetic] = useState(initial?.synthetic ?? false);
  const [purchaseDate, setPurchaseDate] = useState(initial?.purchaseDate ?? '');
  const [purchasePrice, setPurchasePrice] = useState(initial?.purchasePrice != null ? String(initial.purchasePrice) : '');
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

  // IMP 03112026 SPEC-C §C2 (ADR-67): a photo of the matrícula or the VIN plate fills this form, then vPIC completes the
  // specs from the VIN. The person reviews and saves as always; editing a field clears its "IA" mark.
  const [aiMarks, setAiMarks] = useState<VehicleMarks>({});
  const [scanNotes, setScanNotes] = useState<{ vpicFilled: number; conflicts: MergeConflict[]; frame: boolean; offline: boolean }>({ vpicFilled: 0, conflicts: [], frame: false, offline: false });
  const unmarkAi = (...keys: (keyof VehicleMarks)[]) =>
    setAiMarks((m) => {
      const next = { ...m };
      for (const k of keys) delete next[k];
      return next;
    });

  async function applyScan(result: ReadResult) {
    const { prefill, marks } = vehiclePrefillFrom(result);
    if (!Object.keys(prefill).length) {
      Alert.alert(t.ai.consent.title, t.ai.capture.nothingRead);
      return;
    }
    let work = { ...prefill } as ReturnType<typeof mergeVpic>['merged'];
    const notes = { vpicFilled: 0, conflicts: [] as MergeConflict[], frame: Boolean(prefill.chassisNumber), offline: false };
    // Deterministic enrichment AFTER the read: only a real 17-character VIN is decoded. vPIC wins the specs, the paper wins plate and colour.
    if (prefill.vin && checkVin(prefill.vin).ok) {
      const res = await decodeVin(prefill.vin);
      if (res.ok) {
        const merged = mergeVpic(prefill, res.decoded);
        work = merged.merged;
        notes.vpicFilled = merged.filled.length;
        notes.conflicts = merged.conflicts;
      } else if (res.reason !== 'not_decoded') {
        notes.offline = true;
      }
    }
    // What the person already typed is never overwritten by a value only vPIC knew.
    setMmy((cur) => {
      const make = prefill.make != null || !cur.make.trim() ? work.make : undefined;
      const model = prefill.model != null || !cur.model.trim() ? work.model : undefined;
      const year = prefill.year != null || !cur.year.trim() ? work.year : undefined;
      const hit = matchMakeModel(make ?? cur.make, model ?? cur.model);
      return { ...cur, ...hit, year: year != null ? String(year) : cur.year };
    });
    if (work.color) {
      const hit = matchColor(work.color);
      setColor(hit ? { id: hit.id, label: hit.es } : { id: null, label: work.color });
    }
    if (work.plate) setPlate(work.plate);
    if (work.vin) setVin(work.vin);
    if (work.fuel) setFuel(work.fuel);
    if (work.chassisNumber || work.transmission || work.drivetrain || work.engineModel) {
      setIdentity((i) => ({
        ...i,
        chassisNumber: i.chassisNumber || work.chassisNumber || '',
        transmission: i.transmission ?? work.transmission ?? null,
        drivetrain: i.drivetrain ?? work.drivetrain ?? null,
        engineCode: i.engineCode || work.engineModel || '',
      }));
      setShowIdentity(true);
    }
    setAiMarks((cur) => ({ ...cur, ...marks }));
    setScanNotes(notes);
  }

  /** The person prefers the paper's value over vPIC's for one spec: put it back and stop showing the conflict. */
  function restoreDocument(c: MergeConflict) {
    setMmy((cur) =>
      c.field === 'year'
        ? { ...cur, year: String(c.document) }
        : { ...cur, ...matchMakeModel(c.field === 'make' ? String(c.document) : cur.make, c.field === 'model' ? String(c.document) : cur.model) },
    );
    setScanNotes((n) => ({ ...n, conflicts: n.conflicts.filter((x) => x.field !== c.field) }));
  }
  const aiCount = Object.keys(aiMarks).length;
  const mmyMark = [aiMarks.make, aiMarks.model, aiMarks.year].filter((c): c is number => c != null);

  // A stable owner id so a photo picked before the vehicle is saved still has
  // somewhere to belong. Created once (useState initializer), never re-keyed.
  const [draftId] = useState(() => initial?.id ?? `veh_${Date.now()}`);

  const sold = status === 'vendido' || status === 'perdido';
  const tankValue = tank.trim() ? parseDecimal(tank) : null;
  const caption = tankCaption(tankValue, unit);
  const reserveValue = reserve.trim() ? parseDecimal(reserve) : null;
  // GNV's tank is m³ and its gauge a pressure dial: no reserve estimate (lib/domain/partialEconomy.ts).
  const liquid = fuel !== 'gnv';
  const unitLabel = (u: VolumeUnit) => (u === 'gal' ? 'gal' : 'L');

  function changeUnit(next: VolumeUnit) {
    // The number follows the unit, so the liters stored do not change.
    setTank((t) => convertTankText(t, unit, next, parseDecimal));
    setReserve((r) => convertTankText(r, unit, next, parseDecimal));
    setUnit(next);
  }

  function save() {
    const trimmed = name.trim();
    if (!trimmed) return setError(t.vehicle.nameRequired);

    const badYear = yearError(mmy.year);
    if (badYear) return setError(t.vehicle.yearRange(badYear.min, badYear.max));
    const parsedYear = mmy.year.trim() ? Number(mmy.year.trim()) : null;

    const parsedOdometer = odometer.trim() ? parseDecimal(odometer) : null;
    if (odometer.trim() && parsedOdometer == null) {
      // "-5" and "abc" both land here; only one of them is negative.
      return setError(/^\s*-/.test(odometer) ? t.vehicle.odometerNegative : t.common.invalidNumber(t.vehicle.odometer));
    }
    if (tank.trim() && tankValue == null) return setError(t.common.invalidNumber(t.vehicleForm.tank));
    if (liquid && reserve.trim() && (reserveValue == null || reserveValue <= 0)) return setError(t.common.invalidNumber(t.vehicleForm.reserve));
    if (liquid && reserveValue != null && tankValue != null && reserveValue >= tankValue) return setError(t.vehicleForm.reserveTooBig);
    if (purchasePrice.trim() && parseDecimal(purchasePrice) == null) {
      return setError(t.common.invalidNumber(t.vehicleForm.purchasePrice));
    }

    const importedRaw = identity.importedYear.trim();
    const parsedImported = importedRaw ? Number(importedRaw) : null;
    const now = new Date().getFullYear();
    if (parsedImported != null && (!Number.isInteger(parsedImported) || parsedImported < 1950 || parsedImported > now)) {
      return setError(t.vehicle.yearRange(1950, now));
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
      reserveVolume: liquid ? reserveValue : null,
      ...(FEATURE_GAUGE_SEGMENTS && liquid
        ? { gaugeType: gauge.type, gaugeSegments: gauge.type === 'segments' ? gauge.segments : null, gaugeReserveAt: gauge.type === 'segments' ? gauge.reserveAt : null }
        : {}),
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
        {initial?.id ? t.vehicle.editTitle : t.vehicle.newTitle}
      </T>

      {/* IMP 03112026 SPEC-C §C2: scan the matrícula, or the VIN plate; nothing is saved until Guardar. */}
      <CaptureButton kind="doc_matricula" icon="document-text-outline" label={t.ai.vehicleScan.scanMatricula} onRead={(r) => void applyScan(r)} />
      <CaptureButton kind="vin_plate" icon="barcode-outline" label={t.ai.vehicleScan.scanVin} onRead={(r) => void applyScan(r)} />
      <T face="body" style={{ color: theme.text.muted, fontSize: 12, lineHeight: 17, marginBottom: space.md }}>
        {t.ai.documents.privacyNote}
      </T>
      {aiCount ? (
        <T face="body" accessibilityLiveRegion="polite" style={{ color: theme.text.secondary, fontSize: 13, lineHeight: 18, marginBottom: space.sm }}>
          {t.ai.vehicleScan.filled(aiCount)}
          {scanNotes.vpicFilled ? ` ${t.ai.vehicleScan.vpicFilled(scanNotes.vpicFilled)}` : ''}
        </T>
      ) : null}
      {scanNotes.conflicts.map((c) => (
        <View key={c.field} style={{ marginBottom: space.sm }}>
          <T face="body" style={{ color: theme.statusText.proximo, fontSize: 13, lineHeight: 18 }}>
            {t.ai.vehicleScan.conflict(t.ai.vehicleScan.fields[c.field], String(c.document), String(c.vpic))}
          </T>
          <Pressable onPress={() => restoreDocument(c)} accessibilityRole="button" style={{ alignSelf: 'flex-start', minHeight: 40, justifyContent: 'center' }}>
            <T face="semibold" style={{ color: theme.accent, fontSize: 14 }}>
              {t.ai.vehicleScan.useDocument}
            </T>
          </Pressable>
        </View>
      ))}
      {scanNotes.frame ? (
        <T face="body" style={{ color: theme.text.secondary, fontSize: 13, lineHeight: 18, marginBottom: space.sm }}>
          {t.ai.vehicleScan.frameNote}
        </T>
      ) : null}
      {scanNotes.offline ? (
        <T face="body" style={{ color: theme.text.muted, fontSize: 13, lineHeight: 18, marginBottom: space.sm }}>
          {t.ai.vehicleScan.vpicOffline}
        </T>
      ) : null}

      {/* 1 · Nombre, Fotos */}
      <Field label={t.vehicle.name} placeholder={t.vehicle.namePlaceholder} value={name} onChangeText={setName} />
      <PhotosSection gallery={gallery} onChange={setGallery} vehicleId={draftId} />

      {/* 2 · Marca, Modelo, Año */}
      <AiFieldMark confidence={mmyMark.length ? Math.min(...mmyMark) : undefined} />
      <MakeModelYear
        value={mmy}
        onChange={(v) => {
          setMmy(v);
          unmarkAi('make', 'model', 'year');
        }}
      />

      {/* 5 · Combustible, Tanque (gal | L), Odómetro */}
      <AiFieldMark confidence={aiMarks.fuel} />
      <FuelPicker label={t.vehicle.fuel} value={fuel} onChange={(v) => (setFuel(v), unmarkAi('fuel'))} />

      <View style={styles.pair}>
        <View style={styles.half}>
          <Field
            label={`${t.vehicleForm.tank} (${unitLabel(unit)})`}
            placeholder={unit === 'gal' ? '12.5' : '47'}
            keyboardType="decimal-pad"
            value={tank}
            onChangeText={setTank}
            hint={
              caption
                ? t.vehicleForm.tankConverted(caption.typed, unitLabel(unit), caption.other, unitLabel(caption.otherUnit))
                : undefined
            }
          />
          <SelectField<VolumeUnit>
            label={t.vehicleForm.tankUnit}
            value={unit}
            options={[
              { value: 'gal', label: 'gal' },
              { value: 'l', label: 'L' },
            ]}
            onChange={changeUnit}
          />
        </View>
        <View style={styles.half}>
          <Field
            label={t.vehicle.odometer}
            placeholder="51676"
            keyboardType="number-pad"
            value={odometer}
            onChangeText={setOdometer}
            hint={t.vehicle.odometerHint}
          />
        </View>
      </View>

      <Collapsible id="form-vehicle-more" title={t.ux.moreDetails} hint={t.ux.vehicleMoreHint} defaultOpen={Boolean(initial?.name)}>
      {/* 3 · Tipo */}
      <SelectField<string | null>
        label={t.vehicleForm.bodyType}
        value={bodyType}
        allowNone
        options={bodyTypes().map((b) => ({ value: b.id, label: refLabel(b) }))}
        onChange={setBodyType}
      />

      {/* 4 · Color, Interior */}
      <AiFieldMark confidence={aiMarks.color} />
      <SelectField<string | null>
        label={t.vehicleForm.color}
        variant="swatch"
        value={color.id}
        options={swatchOptions('exterior')}
        other={{ onOther: (text) => setColor({ id: null, label: text }), current: color.id ? null : color.label }}
        onChange={(id) => {
          setColor({ id, label: colorLabel('exterior', id) });
          unmarkAi('color');
        }}
      />
      <SelectField<string | null>
        label={t.vehicleForm.interior}
        variant="swatch"
        value={interior.id}
        allowNone
        options={swatchOptions('interior')}
        onChange={(id) => setInterior({ id, label: colorLabel('interior', id) })}
      />
      <SelectField<string | null>
        label={t.vehicleForm.interiorMaterial}
        value={material}
        allowNone
        options={MATERIALS.map((m) => ({ value: m.id.replace(/^material-/, ''), label: refLabel(m) }))}
        onChange={setMaterial}
      />

      <View style={styles.pair}>
        <View style={styles.half}>
          <AiFieldMark confidence={aiMarks.plate} />
          <Field label={t.vehicle.plate} placeholder="A123456" autoCapitalize="characters" value={plate} onChangeText={(v) => (setPlate(v), unmarkAi('plate'))} />
        </View>
        <View style={styles.half}>
          <AiFieldMark confidence={aiMarks.vin} />
          <Field label={t.vehicle.vin} autoCapitalize="characters" value={vin} onChangeText={(v) => (setVin(v), unmarkAi('vin'))} />
        </View>
      </View>

      {liquid ? (
        <Field
          label={`${t.vehicleForm.reserve} (${unitLabel(unit)})`}
          placeholder={unit === 'gal' ? '1.5' : '6'}
          keyboardType="decimal-pad"
          value={reserve}
          onChangeText={setReserve}
          hint={t.vehicleForm.reserveHint(tankValue != null && tankValue > 0 ? `${Math.round(tankValue * 10) / 100} ${unitLabel(unit)}` : null)}
        />
      ) : null}

      {FEATURE_GAUGE_SEGMENTS && liquid ? <GaugeTypeSection value={gauge} onChange={setGauge} /> : null}

      <SelectField<'volume' | 'l_100km'>
        label={t.vehicleForm.economyUnit}
        value={perHundred ? 'l_100km' : 'volume'}
        options={[
          { value: 'volume', label: unit === 'l' ? 'km/L' : 'km/gal' },
          { value: 'l_100km', label: 'L/100 km' },
        ]}
        onChange={(k) => setPerHundred(k === 'l_100km')}
      />

      <ToggleRow label={t.vehicle.synthetic} hint={t.vehicle.syntheticHint} value={synthetic} onChange={setSynthetic} />

      {/* 6 · Precio y fecha de compra — visible (note 8) */}
      <View style={styles.pair}>
        <View style={styles.half}>
          <Field
            label={t.vehicleForm.purchasePrice}
            placeholder={t.vehicleForm.purchasePriceExample}
            keyboardType="decimal-pad"
            value={purchasePrice}
            onChangeText={setPurchasePrice}
          />
        </View>
        <View style={styles.half}>
          <DateField label={t.vehicle.purchaseDate} value={purchaseDate} onChange={setPurchaseDate} noFuture />
        </View>
      </View>
      <T face="body" style={[styles.caption, { color: theme.text.muted }]}>
        {t.vehicleForm.purchaseCaption}
      </T>

      {/* 7 · Estado (+ Desde, Nota) — a sold car keeps its status; "Cambiar estado" on the hub changes it back */}
      {sold ? null : (
        <>
          <SelectField<VehicleStatus>
            label={t.vehicleForm.status}
            value={status}
            options={STATUSES.map((s) => ({ value: s, label: statusLabel(s) }))}
            onChange={setStatus}
            extra={
              status !== 'activo' ? (
                <View style={styles.pair}>
                  <View style={styles.half}>
                    <DateField label={t.vehicleForm.statusSince} value={statusSince} onChange={setStatusSince} noFuture />
                  </View>
                  <View style={styles.half}>
                    <Field
                      label={t.vehicleForm.statusNote}
                      placeholder={t.vehicleForm.statusNotePlaceholder}
                      value={statusNote}
                      onChangeText={setStatusNote}
                    />
                  </View>
                </View>
              ) : null
            }
          />
        </>
      )}

      {/* 8 · + Identidad */}
      <Pressable
        onPress={() => setShowIdentity((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: showIdentity }}
        style={styles.sectionToggle}>
        <T face="semibold" style={[styles.sectionToggleLabel, { color: theme.accent }]}>
          {showIdentity ? '−' : '+'}  {t.vehicle.identitySection}
        </T>
      </Pressable>
      {showIdentity ? <IdentitySection value={identity} onChange={setIdentity} /> : null}

      {/* 9 · Notas */}
      <Field label={t.vehicle.notes} value={notes} onChangeText={setNotes} multiline />

      </Collapsible>

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
  half: { flex: 1, minWidth: 0 },
  unit: { marginTop: -space.sm, marginBottom: space.md },
  caption: { fontSize: 12, marginTop: -space.sm, marginBottom: space.lg, lineHeight: 17 },
  toggle: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start', marginBottom: space.lg, minHeight: 44 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, marginTop: 2, alignItems: 'center', justifyContent: 'center' },
  toggleLabel: { fontSize: 15 },
  hint: { fontSize: 12, marginTop: 2, lineHeight: 17 },
  sectionToggle: { paddingVertical: space.md, minHeight: 44, justifyContent: 'center' },
  sectionToggleLabel: { fontSize: 14 },
  error: { fontSize: 13, marginBottom: space.md, padding: space.md, borderRadius: radius.input, overflow: 'hidden' },
});
