import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { DateField } from '@/components/DateField';
import { Field } from '@/components/Field';
import { FuelPicker } from '@/components/FuelPicker';
import { T } from '@/components/T';
import { GhostButton, PrimaryButton, Segmented } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { Alert } from '@/lib/alert';
import { completeAmounts, odometerBounds, parseDecimal } from '@/lib/domain/economy';
import { FUEL_CATALOG, perUnitLabelFor, unitLabelFor } from '@/lib/fuel';
import { PickerField, SearchSheet, type SearchItem } from '@/components/pickers';
import { brandsForFuel, normaliseStation, recentStations } from '@/lib/domain/stations';
import { foldText } from '@/lib/domain/text';
import { GaugePicker } from '@/components/fuel/GaugePicker';
import { fromFraction, type GaugeCfg } from '@/lib/domain/gauge';
import { remaining } from '@/lib/domain/gaugeCalibration';
import { gaugeCfgOf, isLearned } from '@/lib/domain/gaugeVehicle';
import { fuelCfgFor, readingFrac } from '@/lib/domain/partialEconomy';
import { fromLiters } from '@/lib/domain/units';
import { FEATURE_GAUGE_SEGMENTS } from '@/lib/flagsV10';
import { usePriceData } from '@/hooks/usePriceData';
import { boardSourceLabel, prefillPrice } from '@/lib/domain/fuelPrices';
import { dateInputFromIso, isoFromDateInput, money, todayIsoDate, volume as fmtVol } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useStore } from '@/lib/store';
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
  /**
   * Return `false` when the save was refused (a duplicate): the button comes back.
   * Anything else leaves it disabled — the screen moves on (note 8).
   */
  onSubmit: (draft: FillDraft) => void | boolean;
  onDelete?: () => void;
}) {
  const { theme } = useTheme();
  const { data } = useStore();

  // Note 8: one save per tap. The ref blocks a second tap before the disabled button re-renders.
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [date, setDate] = useState(initial ? dateInputFromIso(initial.occurredAt) : todayIsoDate());
  const [odo, setOdo] = useState(initial ? String(initial.odometerKm) : '');
  const [fuel, setFuel] = useState<FuelType>(initial?.fuelType ?? defaultFuel);
  const [vol, setVol] = useState(initial ? String(initial.volume) : '');
  const [typedPrice, setPrice] = useState(initial ? String(initial.pricePerUnit) : '');
  // Note 1 (Phase 5): a new fill-up starts with the board's price for its fuel, in the
  // vehicle's unit; it follows the fuel chips until the person types a price of their own.
  const [priceTyped, setPriceTyped] = useState(Boolean(initial));
  const { board } = usePriceData();
  const [total, setTotal] = useState(initial ? String(initial.totalDop) : '');
  const [full, setFull] = useState(initial?.isFullTank ?? true);
  const [missedPrevious, setMissedPrevious] = useState(initial?.missedPrevious ?? false);
  // Note 4: the gauge before and after pumping, both optional. v10: as fractions 0..1 on the car's own grid;
  // an untouched reading on an edit keeps the fraction and raw text it was saved with.
  const [gaugeBefore, setGaugeBeforeState] = useState<number | null>(readingFrac(initial?.gaugeBeforeFrac, initial?.gaugeBefore8));
  const [gaugeAfter, setGaugeAfterState] = useState<number | null>(readingFrac(initial?.gaugeAfterFrac, initial?.gaugeAfter8));
  const [touched, setTouched] = useState({ before: false, after: false });
  const setGaugeBefore = (f: number | null) => {
    setTouched((x) => ({ ...x, before: true }));
    setGaugeBeforeState(f);
  };
  const setGaugeAfter = (f: number | null) => {
    setTouched((x) => ({ ...x, after: true }));
    setGaugeAfterState(f);
  };
  const [inReserve, setInReserve] = useState(initial?.inReserve ?? false);
  // A saved log keeps the station text it had ("Otra" from before 2.3.1 reads as none).
  const [station, setStation] = useState(initial?.station && initial.station !== 'Otra' ? initial.station : '');
  const [stationOpen, setStationOpen] = useState(false);
  const [notes, setNotes] = useState(initial?.notes ?? '');

  // v6: labels follow the vehicle's volume unit (GNV stays m³).
  const detail = data.vehicles.find((v) => v.id === vehicleId)?.detail;
  const volumeUnit = detail?.volumeUnit ?? 'gal';
  // v10 (ADR-51): the dash this car has; the needle until FEATURE_GAUGE_SEGMENTS.
  const gaugeCfg: GaugeCfg = FEATURE_GAUGE_SEGMENTS ? gaugeCfgOf(detail) : { type: 'needle8' };
  const meta = { unitLabel: unitLabelFor(fuel, volumeUnit), perUnitLabel: perUnitLabelFor(fuel, volumeUnit) };
  const prefill = initial ? null : prefillPrice(board, fuel, volumeUnit);
  // Until typed, the field shows the board's price (derived, so it follows the fuel and the board).
  const prefilled = prefill != null && !priceTyped;
  const price = prefilled ? String(prefill.price) : typedPrice;
  const stationItems = useMemo<SearchItem[]>(() => {
    const recent = recentStations(data.fillups.filter((f) => f.vehicleId === vehicleId));
    const brands = brandsForFuel(FUEL_CATALOG[fuel].group).filter((b) => !recent.some((r) => foldText(r) === foldText(b.name)));
    return [
      ...recent.map((name) => ({ key: `recent:${name}`, label: name, section: t.fuel.stationRecent })),
      ...brands.map((b) => ({ key: b.id, label: b.name, keywords: (b.aliases ?? []).join(' '), section: t.fuel.stationBrands })),
    ];
  }, [data.fillups, vehicleId, fuel]);
  const amounts = useMemo(
    () =>
      completeAmounts({
        volume: parseDecimal(vol),
        pricePerUnit: parseDecimal(price),
        totalDop: parseDecimal(total),
      }),
    [vol, price, total],
  );

  /** The readings as stored: fraction + raw on the car's grid, eighths for a needle (2.4.x phones read those). */
  function gaugeFields() {
    const one = (frac: number | null, wasTouched: boolean, initFrac: number | null | undefined, initRaw: string | null | undefined) => {
      if (frac == null) return { frac: null, raw: null };
      if (!wasTouched && initial && initFrac != null) return { frac: initFrac, raw: initRaw ?? fromFraction(frac, gaugeCfg)?.raw ?? null };
      const r = fromFraction(frac, gaugeCfg);
      return { frac: r?.frac ?? frac, raw: r?.raw ?? null };
    };
    const before = inReserve ? { frac: null, raw: null } : one(gaugeBefore, touched.before, initial?.gaugeBeforeFrac ?? (initial?.gaugeBefore8 != null ? initial.gaugeBefore8 / 8 : null), initial?.gaugeBeforeRaw);
    const after = one(gaugeAfter, touched.after, initial?.gaugeAfterFrac ?? (initial?.gaugeAfter8 != null ? initial.gaugeAfter8 / 8 : null), initial?.gaugeAfterRaw);
    const eighths = (f: number | null) => (f == null || gaugeCfg.type !== 'needle8' ? null : Math.round(f * 8));
    return {
      gaugeBefore8: eighths(before.frac),
      gaugeAfter8: eighths(after.frac),
      gaugeBeforeFrac: before.frac,
      gaugeBeforeRaw: before.raw,
      gaugeAfterFrac: after.frac,
      gaugeAfterRaw: after.raw,
    };
  }

  // Research 03 §4: what the Antes reading means in the tank, always with its band.
  const fuelCfg = fuelCfgFor(detail);
  const inTank =
    FEATURE_GAUGE_SEGMENTS && fuelCfg.capacityL && (gaugeBefore != null || inReserve)
      ? remaining(fuelCfg.calibration ?? null, gaugeCfg, fuelCfg.capacityL, inReserve ? 0 : gaugeBefore, null, { onReserve: inReserve, reserveL: fuelCfg.reserveL })
      : null;
  // Liters to 1 L, gallons to 0.1 gal (research §4's display rule, in the car's unit).
  const shown = (liters: number) => {
    const v = fromLiters(liters, volumeUnit);
    return volumeUnit === 'l' ? String(Math.round(v)) : v.toFixed(1);
  };
  const fuelForLiters = (v: number) => v * fuelCfg.unitL;

  function save() {
    const odometerKm = parseDecimal(odo);
    if (odometerKm == null) {
      Alert.alert(t.fuel.odometer, t.fuel.odometerRequired);
      return;
    }
    // Against the fill-ups on either side of this date — for a new one and an
    // edited one alike.
    const bounds = odometerBounds(
      data.fillups.filter((f) => f.vehicleId === vehicleId),
      isoFromDateInput(date),
      initial?.id,
    );
    if (bounds.min != null && odometerKm < bounds.min) {
      Alert.alert(t.fuel.odometer, t.fuel.odometerTooLow(bounds.min));
      return;
    }
    if (bounds.max != null && odometerKm > bounds.max) {
      Alert.alert(t.fuel.odometer, t.fuel.odometerTooHigh(bounds.max));
      return;
    }
    if (!amounts) {
      Alert.alert(t.fuel.loadKind, t.fuel.amountsRequired);
      return;
    }
    const chosenStation = station.trim();
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    const accepted = onSubmit({
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
      ...gaugeFields(),
      inReserve,
    });
    if (accepted === false) {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
      <T face="display" style={[styles.h, { color: theme.text.primary }]}>
        {initial ? t.fuel.editTitle : t.fuel.newTitle}
        <T face="kana" style={[styles.kana, { color: theme.text.muted }]}>
          {' 給油'}
        </T>
      </T>
      <T face="body" style={[styles.p, { color: theme.text.secondary }]}>
        {t.fuel.intro(t.fuel.unitWord(FUEL_CATALOG[fuel].unit === 'm3' ? 'm3' : volumeUnit))}
      </T>

      <DateField label={t.fuel.date} value={date} onChange={setDate} noFuture />
      <Field
        label={t.fuel.odometer}
        keyboardType="decimal-pad"
        value={odo}
        onChangeText={setOdo}
        placeholder={lastOdo != null ? String(lastOdo) : '45210'}
        hint={lastOdo != null ? t.fuel.odometerHint(`${lastOdo.toLocaleString('es-DO')} km`) : undefined}
      />

      <T face="eyebrow" style={[styles.label, { color: theme.text.secondary }]}>
        {t.fuel.type}
      </T>
      <FuelPicker value={fuel} onChange={setFuel} />

      <Field
        label={t.fuel.volume(meta.unitLabel)}
        keyboardType="decimal-pad"
        value={vol}
        onChangeText={setVol}
        placeholder="8.4"
      />
      <Field
        label={meta.perUnitLabel}
        keyboardType="decimal-pad"
        value={price}
        onChangeText={(v) => {
          setPriceTyped(true);
          setPrice(v);
        }}
        placeholder="307.50"
        hint={prefilled && prefill ? t.fuelPricesUi.prefillHint(boardSourceLabel(prefill.entry)) : undefined}
      />
      <Field
        label={t.fuel.total}
        keyboardType="decimal-pad"
        value={total}
        onChangeText={setTotal}
        placeholder="2583.00"
      />
      {amounts ? (
        <View style={[styles.calc, { backgroundColor: theme.bg.raised, borderColor: theme.line }]}>
          <T face="monoBold" style={[styles.calcTxt, { color: theme.text.primary }]}>
            {fmtVol(amounts.volume, fuel, volumeUnit)} · {money(amounts.pricePerUnit)}/{meta.unitLabel} ·{' '}
            {money(amounts.totalDop)}
          </T>
        </View>
      ) : (
        <T face="body" style={[styles.hint, { color: theme.text.muted }]}>
          {t.fuel.calcPending}
        </T>
      )}

      <T face="eyebrow" style={[styles.label, { color: theme.text.secondary }]}>
        {t.fuel.loadKind}
      </T>
      <Segmented
        options={[
          { key: 'full', label: t.fuel.fullTank },
          { key: 'partial', label: t.fuel.partial },
        ]}
        value={full ? 'full' : 'partial'}
        onChange={(next) => setFull(next === 'full')}
      />
      <T face="body" style={[styles.hint, { color: theme.text.muted, marginTop: space.sm }]}>
        {t.fuel.partialHint(meta.unitLabel)}
      </T>

      {/* Medidor (note 4): with the level before and after, a partial gets a number too. GNV has no gauge like this. */}
      {FUEL_CATALOG[fuel].unit === 'm3' ? null : (
        <View style={styles.gauges}>
          <T face="eyebrow" style={[styles.label, { color: theme.text.secondary }]}>
            {t.gauge.title}
          </T>
          <T face="body" style={[styles.hint, { color: theme.text.muted }]}>
            {t.gauge.hint}
          </T>
          <GaugePicker
            label={t.gauge.before}
            cfg={gaugeCfg}
            value={gaugeBefore}
            onChange={setGaugeBefore}
            reserve={{ on: inReserve, onToggle: setInReserve }}
          />
          {inTank ? (
            <T face="body" style={[styles.hint, { color: theme.text.secondary, marginTop: -space.xs, marginBottom: space.md }]}>
              {isLearned(fuelCfg.calibration) && !inReserve
                ? t.gauge.inTankLearned(shown(inTank.liters), shown(inTank.band[0]), shown(inTank.band[1]), meta.unitLabel)
                : t.gauge.inTankLinear(shown(inTank.liters), meta.unitLabel)}
              {amounts && !full
                ? `\n${t.gauge.wouldBe(shown(Math.min(inTank.liters + fuelForLiters(amounts.volume), fuelCfg.capacityL!)), shown(fuelCfg.capacityL!), meta.unitLabel)}`
                : ''}
            </T>
          ) : null}
          <GaugePicker label={t.gauge.after} cfg={gaugeCfg} value={gaugeAfter} onChange={setGaugeAfter} />
          {/* F without "Tanque lleno": probably it was full — say so, do not decide (research 02 §1.4). */}
          {gaugeAfter === 1 && !full ? (
            <Pressable
              onPress={() => setFull(true)}
              accessibilityRole="button"
              style={[styles.prompt, { borderColor: theme.accent, backgroundColor: theme.bg.raised }]}>
              <T face="body" style={{ color: theme.text.primary, fontSize: 14, lineHeight: 20 }}>
                {t.gauge.fullPrompt}
              </T>
              <T face="semibold" style={{ color: theme.accent, fontSize: 14, marginTop: 4 }}>
                {t.gauge.fullPromptAction}
              </T>
            </Pressable>
          ) : null}
        </View>
      )}

      {/* The honest answer to "my km/gal looks wrong": the chain is only as good
          as the log, so the driver gets a way to say a link is missing. */}
      <Pressable
        onPress={() => setMissedPrevious((value) => !value)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: missedPrevious }}
        accessibilityLabel={t.fuel.missedPrevious}
        style={styles.toggle}>
        <View
          style={[
            styles.checkbox,
            {
              borderColor: missedPrevious ? theme.accentFill : theme.lineStrong,
              backgroundColor: missedPrevious ? theme.accentFill : theme.bg.raised,
            },
          ]}
        />
        <View style={{ flex: 1 }}>
          <T face="semibold" style={{ color: theme.text.primary, fontSize: 15 }}>
            {t.fuel.missedPrevious}
          </T>
          <T face="body" style={[styles.hint, { color: theme.text.muted, marginTop: 2 }]}>
            {t.fuel.missedPreviousHint(t.fuel.unitWord(FUEL_CATALOG[fuel].unit === 'm3' ? 'm3' : volumeUnit))}
          </T>
        </View>
      </Pressable>

      {/* Note 7: the car's recent stations, then the brands for this fuel, then Otra (free text). */}
      <PickerField
        label={t.fuel.station}
        value={station || null}
        placeholder={t.fuel.stationPick}
        onPress={() => setStationOpen(true)}
      />
      <SearchSheet
        visible={stationOpen}
        title={t.fuel.station}
        items={stationItems}
        selectedKey={station || null}
        otherLabel={t.fuel.stationOther}
        onPick={(pick) => {
          setStation('other' in pick ? normaliseStation(pick.other) : pick.label);
          setStationOpen(false);
        }}
        onClose={() => setStationOpen(false)}
      />

      <Field
        label={t.fuel.notes}
        value={notes}
        onChangeText={setNotes}
        placeholder={t.fuel.notesPlaceholder}
      />

      <PrimaryButton label={submitLabel} onPress={save} disabled={saving} />
      {onDelete ? <GhostButton danger label={t.fuel.delete} onPress={onDelete} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  gauges: { marginTop: space.lg },
  prompt: { borderWidth: 1, borderRadius: 12, padding: space.md, marginBottom: space.md },
  pad: { padding: space.gutter, paddingBottom: 56 },
  h: { fontSize: 26, lineHeight: 28, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: space.sm },
  p: { marginBottom: 18, fontSize: 15, lineHeight: 22 },
  label: { fontSize: 12, marginBottom: space.sm, marginTop: 6 },
  kana: { fontSize: 10, letterSpacing: 0, textTransform: 'none' },
  hint: { fontSize: 13, marginBottom: space.md, lineHeight: 18 },
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
  checkbox: { width: 22, height: 22, borderRadius: radius.lamp, borderWidth: 1, marginTop: 2 },
});
