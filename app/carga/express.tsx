import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AiFieldMark } from '@/components/ai/AiFieldMark';
import { DateField } from '@/components/DateField';
import { Field } from '@/components/Field';
import { FuelPicker } from '@/components/FuelPicker';
import { usePermissionRequest } from '@/components/permissions/usePermissionRequest';
import { FillUpReviewSheet } from '@/components/FillUpReviewSheet';
import { T } from '@/components/T';
import { GhostButton, PrimaryButton, Surface, ToggleRow } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { Alert } from '@/lib/alert';
import { AiError } from '@/lib/ai/codes';
import { setAiDraft, type DraftPhoto } from '@/lib/ai/draft';
import { buildExpressCard, cardFrom, closestVehicle, expressToDraft, type ExpressCard, type ExpressContext, type ExpressValues } from '@/lib/ai/express';
import { fuelPrefillFrom, type AiMarks, type FuelPrefill } from '@/lib/ai/fuelMap';
import { prepareForAi, TooLargeError } from '@/lib/ai/prepareImage';
import { processAiQueue } from '@/lib/ai/queueRunner';
import { readImages, type ReadResult } from '@/lib/ai/read';
import { useAiStatus } from '@/lib/ai/useAiStatus';
import { dropAiJob, enqueueAiJob, getAiJob } from '@/lib/db/aiQueueOps';
import { recordReportable } from '@/lib/diagnostics';
import { lastOdometer } from '@/lib/domain/economy';
import { fuelCfgFor } from '@/lib/domain/partialEconomy';
import { fromLiters } from '@/lib/domain/units';
import { evaluateFillUp, type SaveResult } from '@/lib/fillUpSave';
import { todayIsoDate } from '@/lib/format';
import { perUnitLabelFor, unitLabelFor } from '@/lib/fuel';
import { t } from '@/lib/i18n';
import { pickCandidates, storePhoto } from '@/lib/media';
import { defaultFuelForNewLoad, useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * Carga express (IMP 03112026 SPEC-B §B7, P9): a photo of the dashboard and a photo of the receipt, in any order, either
 * skippable → ONE read → ONE confirmation card → ONE tap on Confirmar. The card is compact when everything is confident
 * and expands only the field that fails a check. It saves through the same path as the manual form (`evaluateFillUp`: the
 * duplicate check and the review). Offline, the photos wait in the local queue and the card opens when the read is done.
 * Nothing is saved without the Confirmar tap; "Llenarlo a mano" opens the normal form with everything carried over.
 */
type Slot = 'dashboard' | 'receipt';
type Shot = { uri: string; b64: string };
type Step = 'capture' | 'reading' | 'confirm' | 'failed';

export default function ExpressScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const params = useLocalSearchParams<{ job?: string }>();
  const ai = useAiStatus();
  const { activeVehicle, data, upsertFillUp } = useStore();
  const cameraPermission = usePermissionRequest('camera');

  const [step, setStep] = useState<Step>('capture');
  const [shots, setShots] = useState<Partial<Record<Slot, Shot>>>({});
  const [skipped, setSkipped] = useState<Partial<Record<Slot, boolean>>>({});
  const [busySlot, setBusySlot] = useState<Slot | null>(null);
  const [progress, setProgress] = useState<string>(t.ai.express.readingDash);
  const [message, setMessage] = useState<string | null>(null);
  const [vehicleId, setVehicleId] = useState<string | null>(activeVehicle?.id ?? null);
  const [card, setCard] = useState<ExpressCard | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [jobId, setJobId] = useState<string | null>(null);
  const [saved, setSaved] = useState<(SaveResult & { id: string }) | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const vehicle = data.vehicles.find((v) => v.id === vehicleId) ?? activeVehicle;
  const mine = useMemo(() => data.fillups.filter((f) => f.vehicleId === vehicle?.id), [data.fillups, vehicle?.id]);
  const volumeUnit = vehicle?.detail?.volumeUnit ?? 'gal';

  /** Everything the card's checks need, per vehicle. */
  const ctx: ExpressContext | null = useMemo(() => {
    if (!vehicle) return null;
    const sorted = [...mine].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
    const cap = fuelCfgFor(vehicle.detail).capacityL;
    return {
      today: todayIsoDate(),
      defaultFuel: defaultFuelForNewLoad(vehicle),
      lastOdometerKm: lastOdometer(mine),
      tankVolume: cap ? Number(fromLiters(cap, volumeUnit).toFixed(1)) : null,
      referencePrice: sorted.length ? sorted.at(-1)!.pricePerUnit : null,
    };
  }, [vehicle, mine, volumeUnit]);

  /** A finished read (live, or from the queue) → the card, with the closest car chosen when there are several. */
  function showResult(result: ReadResult, photos: Shot[]) {
    const { prefill, marks } = fuelPrefillFrom(result, volumeUnit);
    const readKm = prefill.odo ? Number(prefill.odo) : null;
    const pick = closestVehicle(readKm, data.vehicles.map((v) => ({ id: v.id, lastOdometerKm: lastOdometer(data.fillups.filter((f) => f.vehicleId === v.id)) })));
    const target = (pick ? data.vehicles.find((v) => v.id === pick) : null) ?? vehicle;
    if (target && target.id !== vehicle?.id) setVehicleId(target.id);
    const tctx = ctxFor(target ?? vehicle);
    if (!tctx) return;
    // The photos stay with the record; a photo that was unreadable still stays (the person can see it).
    setShots({ dashboard: photos[0], receipt: photos[1] });
    const built = buildExpressCard(prefill as FuelPrefill, marks as AiMarks, tctx);
    setCard(built);
    setExpanded(initialExpanded(built));
    const unreadable = (result.per_image ?? []).filter((p) => !p.readable).length;
    setMessage(unreadable > 0 && unreadable < (result.per_image?.length ?? 0) ? t.ai.express.oneUnreadable : null);
    setStep('confirm');
  }

  function ctxFor(v: typeof vehicle): ExpressContext | null {
    if (!v) return null;
    const vf = data.fillups.filter((f) => f.vehicleId === v.id).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
    const unit = v.detail?.volumeUnit ?? 'gal';
    const cap = fuelCfgFor(v.detail).capacityL;
    return { today: todayIsoDate(), defaultFuel: defaultFuelForNewLoad(v), lastOdometerKm: lastOdometer(vf), tankVolume: cap ? Number(fromLiters(cap, unit).toFixed(1)) : null, referencePrice: vf.length ? vf.at(-1)!.pricePerUnit : null };
  }

  // A ready job from the queue (the notification route): open its card. The queue also gets a pass when the screen opens.
  useEffect(() => {
    void processAiQueue().catch(() => {});
    const id = params.job;
    if (!id) return;
    void getAiJob(id).then(async (job) => {
      if (!alive.current || !job) return;
      if (job.status === 'ready' && job.resultJson) {
        setJobId(job.id);
        showResult(JSON.parse(job.resultJson) as ReadResult, job.imageUris.map((uri) => ({ uri, b64: '' })));
      } else if (job.status === 'queued') {
        setMessage(t.ai.express.queued);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.job]);

  // ------------------------------------------------------------------------------------------------ capture
  async function pick(slot: Slot, camera: boolean) {
    if (camera && Platform.OS !== 'web' && !(await cameraPermission.ensure())) return;
    let candidate;
    try {
      [candidate] = await pickCandidates({ camera });
    } catch (e) {
      recordReportable('express-pick', e);
      Alert.alert(t.common.photoErrorTitle, t.common.photoPickError);
      return;
    }
    if (!candidate) return;
    setBusySlot(slot);
    try {
      const image = await prepareForAi(candidate.uri, { express: true, sourceWidth: candidate.width });
      if (!alive.current) return;
      const next = { ...shots, [slot]: { uri: candidate.uri, b64: image.data } };
      setShots(next);
      setSkipped((s) => ({ ...s, [slot]: false }));
      // Both photos in: read at once (the point of "two photos, one tap").
      if (next.dashboard && next.receipt) void read(next);
    } catch (e) {
      if (!alive.current) return;
      Alert.alert(t.ai.consent.title, e instanceof TooLargeError ? t.ai.capture.tooLarge : t.ai.errors.internal);
    } finally {
      if (alive.current) setBusySlot(null);
    }
  }

  async function read(current: Partial<Record<Slot, Shot>> = shots) {
    const list = [current.dashboard, current.receipt].filter((s): s is Shot => !!s);
    if (!list.length) return;
    if (ai.state === 'needs_consent') {
      Alert.alert(t.ai.consent.title, ai.message);
      return;
    }
    setStep('reading');
    setProgress(current.dashboard ? t.ai.express.readingDash : t.ai.express.readingReceipt);
    const timer = current.dashboard && current.receipt ? setTimeout(() => alive.current && setProgress(t.ai.express.readingReceipt), 1800) : null;
    try {
      const result = await readImages('fuel_express', list.map((s) => ({ data: s.b64, mime: 'image/jpeg' as const })));
      if (alive.current) showResult(result, list);
    } catch (e) {
      if (!alive.current) return;
      if (e instanceof AiError && (e.code === 'offline' || e.code === 'timeout')) {
        // No connection: keep the photos and say so; the read happens when the phone is back online (SPEC-B §B7.6).
        if (vehicle) {
          await enqueueAiJob({ kind: 'fuel_express', vehicleId: vehicle.id, imagesB64: list.map((s) => s.b64), imageUris: list.map((s) => s.uri) });
        }
        Alert.alert(t.ai.express.title, t.ai.express.queued);
        router.back();
        return;
      }
      setMessage(e instanceof AiError ? (e.code === 'unreadable' ? t.ai.express.unreadableBoth : t.ai.errors[e.code]) : t.ai.errors.internal);
      setStep('failed');
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  // ------------------------------------------------------------------------------------------------ confirm
  const edit = (patch: Partial<ExpressValues>, clear: (keyof AiMarks)[] = []) => {
    if (!card || !ctx) return;
    const marks = { ...card.marks } as AiMarks;
    for (const k of clear) delete marks[k];
    const milesRead = patch.odo !== undefined ? false : card.milesRead;
    const next = cardFrom({ ...card.values, ...patch }, marks, ctx, milesRead, patch.full !== undefined ? false : card.askPartial);
    setCard(next);
  };

  function toggle(key: string) {
    setExpanded((e) => ({ ...e, [key]: !e[key] }));
  }

  function manual() {
    // Carry everything over to the normal form (and the photos), then drop a queued job: the person chose to type.
    if (card) {
      setAiDraft({
        form: 'fuel',
        prefill: { date: card.values.date, odo: card.values.odo, fuel: card.values.fuel, vol: card.values.vol, price: card.values.price, total: card.values.total, station: card.values.station, odoUnitMi: card.milesRead },
        marks: card.marks as Record<string, number>,
        photos: photoList(),
        source: 'express',
        vehicleId: vehicle?.id ?? null,
      });
    }
    if (jobId) void dropAiJob(jobId);
    router.replace('/carga/nueva');
  }

  function photoList(): DraftPhoto[] {
    return [shots.dashboard && { uri: shots.dashboard.uri, role: 'odometer_photo' as const }, shots.receipt && { uri: shots.receipt.uri, role: 'invoice' as const }].filter(Boolean) as DraftPhoto[];
  }

  function confirm() {
    if (!card || !vehicle) return;
    const out = expressToDraft(card.values, vehicle.id, mine, card.milesRead);
    if (!out.ok) {
      const m = out.reason === 'odometer_missing' ? t.ai.express.missingOdo : out.reason === 'amounts' ? t.ai.express.missingAmounts : out.reason === 'odometer_low' ? t.ai.express.odometerLow(out.bound ?? 0) : t.ai.express.odometerHigh(out.bound ?? 0);
      Alert.alert(t.ai.express.confirmTitle, m);
      setExpanded((e) => ({ ...e, odo: out.reason.startsWith('odometer'), amounts: out.reason === 'amounts' }));
      return;
    }
    // One save path, shared with the manual form: the duplicate check, then the review.
    const evaluation = evaluateFillUp(out.draft, { allFillups: data.fillups, vehicleFillups: mine, vehicle });
    if (evaluation.duplicate) {
      const dup = evaluation.duplicate;
      Alert.alert(t.fuel.duplicateTitle, t.fuel.duplicateBody, [
        { text: t.common.cancel, style: 'cancel' },
        { text: t.fuel.duplicateOpen, onPress: () => router.replace({ pathname: '/carga/[id]', params: { id: dup.id, saved: '1' } }) },
      ]);
      return;
    }
    const id = upsertFillUp(out.draft);
    for (const p of photoList()) {
      void storePhoto({ uri: p.uri, width: null, takenAt: new Date().toISOString() }, { ownerTable: 'fuel_log', ownerId: id, vehicleId: vehicle.id }).catch((e) => recordReportable('express-photo', e));
    }
    if (jobId) void dropAiJob(jobId);
    setSaved({ id, ...evaluation.result });
  }

  // ------------------------------------------------------------------------------------------------ render
  if (!vehicle) return null;
  const title = <Stack.Screen options={{ headerShown: true, title: t.ai.express.title }} />;
  const unit = unitLabelFor(card?.values.fuel ?? 'regular', volumeUnit);
  const perUnit = perUnitLabelFor(card?.values.fuel ?? 'regular', volumeUnit);

  if (step === 'reading') {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: theme.bg.base }]}>
        {title}
        <ActivityIndicator color={theme.accent} size="large" />
        <T face="semibold" accessibilityLiveRegion="polite" style={{ color: theme.text.primary, fontSize: 16, marginTop: space.md }}>
          {progress}
        </T>
        <View style={{ marginTop: space.lg }}>
          <GhostButton label={t.ai.express.cancel} onPress={() => setStep('capture')} />
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'confirm' && card) {
    const v = card.values;
    const row = (key: string, label: string, value: string, mark: number | undefined, flag: string | null, body: React.ReactNode) => (
      <View key={key} style={[styles.row, { borderColor: theme.line }]}>
        <Pressable onPress={() => toggle(key)} accessibilityRole="button" accessibilityLabel={label} style={styles.rowHead}>
          <View style={{ flex: 1 }}>
            <T face="eyebrow" style={{ color: theme.text.secondary }}>
              {label}
            </T>
            <T face="semibold" style={{ color: theme.text.primary, fontSize: 17 }}>
              {value || '—'}
            </T>
          </View>
          <AiFieldMark confidence={mark} />
          <Ionicons name={expanded[key] ? 'chevron-up' : 'create-outline'} size={18} color={theme.text.muted} />
        </Pressable>
        {flag ? (
          <T face="body" accessibilityLiveRegion="polite" style={{ color: theme.accent, fontSize: 13, lineHeight: 18 }}>
            {flag}
          </T>
        ) : null}
        {expanded[key] ? <View style={{ marginTop: space.sm }}>{body}</View> : null}
      </View>
    );
    const flagFor = (field: 'odo' | 'total' | 'date' | 'vol' | 'price') => {
      const f = card.flagBy[field];
      if (!f) return null;
      const d = f.detail;
      switch (f.code) {
        case 'odo_below_last': return t.ai.sanity.odo_below_last(d.last);
        case 'odo_miles': return t.ai.sanity.odo_miles(d.read, d.km);
        case 'total_mismatch': return t.ai.sanity.total_mismatch(d.expected, d.total);
        case 'date_old': return t.ai.sanity.date_old(d.days);
        case 'date_future': return t.ai.sanity.date_future(d.days);
        case 'vol_over_tank': return t.ai.sanity.vol_over_tank(d.volume, d.tank);
        case 'price_band': return t.ai.sanity.price_band(d.price, d.reference);
      }
    };
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
        {title}
        <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
          <T face="display" style={{ color: theme.text.primary, fontSize: 24, textTransform: 'uppercase', marginBottom: space.sm }}>
            {t.ai.express.confirmTitle}
          </T>
          {message ? (
            <T face="body" accessibilityLiveRegion="polite" style={{ color: theme.text.secondary, fontSize: 13, marginBottom: space.sm }}>
              {message}
            </T>
          ) : null}
          <View style={styles.thumbs}>
            {[shots.dashboard, shots.receipt].filter(Boolean).map((s) => (
              <Image key={s!.uri} source={{ uri: s!.uri }} style={[styles.thumb, { backgroundColor: theme.bg.raised }]} accessibilityIgnoresInvertColors />
            ))}
          </View>
          <Surface padded>
            {data.vehicles.length > 1 ? (
              <View style={[styles.row, { borderColor: theme.line }]}>
                <T face="eyebrow" style={{ color: theme.text.secondary }}>
                  {t.ai.express.vehicle}
                </T>
                <View style={styles.chips}>
                  {data.vehicles.map((x) => (
                    <Pressable
                      key={x.id}
                      onPress={() => setVehicleId(x.id)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: x.id === vehicle.id }}
                      style={[styles.chip, { borderColor: x.id === vehicle.id ? theme.accent : theme.line, backgroundColor: theme.bg.raised }]}>
                      <T face="semibold" style={{ fontSize: 13, color: theme.text.primary }}>
                        {x.name}
                      </T>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}
            {row('date', t.ai.express.date, v.date, card.marks.date, flagFor('date'), <DateField label={t.ai.express.date} value={v.date} onChange={(d) => edit({ date: d }, ['date'])} noFuture />)}
            {row('odo', t.ai.express.odometer, v.odo ? `${Number(v.odo).toLocaleString('es-DO')} ${card.milesRead ? 'mi' : 'km'}` : '', card.marks.odo, flagFor('odo') ?? (card.missing.includes('odo') ? t.ai.express.missingOdo : null),
              <Field label={t.ai.express.odometer} keyboardType="decimal-pad" value={v.odo} onChangeText={(x) => edit({ odo: x }, ['odo'])} />)}
            {card.milesRead && v.odo ? (
              <Pressable onPress={() => edit({ odo: String(Math.round(Number(v.odo) * 1.609344)) }, ['odo'])} accessibilityRole="button" style={{ minHeight: 40, justifyContent: 'center' }}>
                <T face="semibold" style={{ color: theme.accent, fontSize: 14 }}>
                  {t.ai.capture.useKm}
                </T>
              </Pressable>
            ) : null}
            {row('vol', `${t.ai.express.volume} (${unit})`, v.vol, card.marks.vol, flagFor('vol'), <Field label={t.ai.express.volume} keyboardType="decimal-pad" value={v.vol} onChangeText={(x) => edit({ vol: x }, ['vol'])} />)}
            {row('price', perUnit, v.price, card.marks.price, flagFor('price'), <Field label={perUnit} keyboardType="decimal-pad" value={v.price} onChangeText={(x) => edit({ price: x }, ['price'])} />)}
            {row('total', t.ai.express.total, v.total, card.marks.total, flagFor('total') ?? (card.missing.includes('amounts') ? t.ai.express.missingAmounts : null), <Field label={t.ai.express.total} keyboardType="decimal-pad" value={v.total} onChangeText={(x) => edit({ total: x }, ['total'])} />)}
            {row('fuel', t.ai.express.fuel, v.fuel, card.marks.fuel, null, <FuelPicker label={t.ai.express.fuel} value={v.fuel} onChange={(f) => edit({ fuel: f }, ['fuel'])} />)}
            {row('station', t.ai.express.station, v.station, card.marks.station, null, <Field label={t.ai.express.station} value={v.station} onChangeText={(x) => edit({ station: x }, ['station'])} />)}
            <ToggleRow label={t.ai.express.fullTank} value={v.full} onChange={(f) => edit({ full: f })} />
            {card.askPartial ? (
              <View style={{ marginTop: space.sm }}>
                <T face="semibold" style={{ color: theme.text.primary, fontSize: 14, marginBottom: 4 }}>
                  {t.ai.express.askPartial}
                </T>
                <View style={styles.chips}>
                  <Pressable onPress={() => edit({ full: false })} style={[styles.chip, { borderColor: theme.line, backgroundColor: theme.bg.raised }]} accessibilityRole="button">
                    <T face="semibold" style={{ fontSize: 13, color: theme.text.primary }}>
                      {t.ai.express.yesPartial}
                    </T>
                  </Pressable>
                  <Pressable onPress={() => edit({ full: true })} style={[styles.chip, { borderColor: theme.line, backgroundColor: theme.bg.raised }]} accessibilityRole="button">
                    <T face="semibold" style={{ fontSize: 13, color: theme.text.primary }}>
                      {t.ai.express.noFull}
                    </T>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </Surface>
          <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginVertical: space.sm }}>
            {t.ai.express.photosKept}
          </T>
          <PrimaryButton label={t.ai.express.confirm} onPress={confirm} />
          <View style={{ height: space.sm }} />
          <GhostButton label={t.ai.express.manual} onPress={manual} />
        </ScrollView>
        <FillUpReviewSheet
          visible={saved != null}
          review={saved?.review ?? null}
          fuelType={saved?.fuelType ?? v.fuel}
          volumeUnit={vehicle.detail?.volumeUnit}
          economyUnit={vehicle.detail?.economyUnit}
          missedPrevious={saved?.missedPrevious ?? false}
          estimate={saved?.estimate ?? null}
          perFillLine={saved?.perFillLine ?? null}
          onClose={() => {
            const id = saved?.id;
            setSaved(null);
            if (id) router.replace({ pathname: '/carga/[id]', params: { id, saved: '1' } });
          }}
          onSeeHistory={() => {
            setSaved(null);
            router.replace('/(tabs)/historial');
          }}
        />
      </SafeAreaView>
    );
  }

  // capture + failed
  const slotCard = (slot: Slot, label: string, skipLabel: string, icon: keyof typeof Ionicons.glyphMap) => {
    const shot = shots[slot];
    const busy = busySlot === slot;
    return (
      <View style={[styles.slot, { borderColor: theme.line, backgroundColor: theme.bg.raised }]}>
        {shot ? (
          <Image source={{ uri: shot.uri }} style={styles.slotImg} accessibilityIgnoresInvertColors />
        ) : busy ? (
          <ActivityIndicator color={theme.text.muted} />
        ) : (
          <Ionicons name={icon} size={30} color={theme.text.muted} />
        )}
        <T face="semibold" style={{ color: theme.text.primary, fontSize: 15, marginTop: space.sm }}>
          {label}
        </T>
        <View style={styles.chips}>
          {Platform.OS !== 'web' ? (
            <Pressable onPress={() => void pick(slot, true)} accessibilityRole="button" style={[styles.chip, { borderColor: theme.accent, backgroundColor: theme.bg.base }]}>
              <T face="semibold" style={{ fontSize: 13, color: theme.text.primary }}>
                {shot ? t.ai.express.retake : t.ai.capture.camera}
              </T>
            </Pressable>
          ) : null}
          <Pressable onPress={() => void pick(slot, false)} accessibilityRole="button" style={[styles.chip, { borderColor: theme.line, backgroundColor: theme.bg.base }]}>
            <T face="semibold" style={{ fontSize: 13, color: theme.text.primary }}>
              {Platform.OS === 'web' ? (shot ? t.ai.express.retake : t.ai.capture.gallery) : t.ai.capture.gallery}
            </T>
          </Pressable>
          {!shot ? (
            <Pressable onPress={() => setSkipped((s) => ({ ...s, [slot]: true }))} accessibilityRole="button" style={styles.chip}>
              <T face="body" style={{ fontSize: 13, color: theme.text.muted }}>
                {skipLabel}
              </T>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  };
  const haveOne = !!(shots.dashboard || shots.receipt);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      {title}
      {cameraPermission.sheet}
      <ScrollView contentContainerStyle={styles.pad}>
        <T face="body" style={{ color: theme.text.secondary, fontSize: 15, lineHeight: 21, marginBottom: space.md }}>
          {t.ai.express.subtitle}
        </T>
        {ai.state !== 'available' && ai.state !== 'loading' ? (
          <T face="body" accessibilityLiveRegion="polite" style={{ color: theme.accent, fontSize: 14, marginBottom: space.md }}>
            {ai.message}
          </T>
        ) : null}
        {message ? (
          <T face="body" accessibilityLiveRegion="polite" style={{ color: theme.accent, fontSize: 14, marginBottom: space.md }}>
            {message}
          </T>
        ) : null}
        {slotCard('dashboard', t.ai.express.dashboardSlot, t.ai.express.skipDashboard, 'speedometer-outline')}
        {slotCard('receipt', t.ai.express.receiptSlot, t.ai.express.skipReceipt, 'receipt-outline')}
        {haveOne || skipped.dashboard || skipped.receipt ? (
          <PrimaryButton label={t.ai.express.read} onPress={() => void read()} disabled={!haveOne || ai.state === 'needs_account' || ai.state === 'disabled' || ai.state === 'not_configured'} />
        ) : null}
        <View style={{ height: space.sm }} />
        <GhostButton label={t.ai.express.manual} onPress={() => router.replace('/carga/nueva')} />
      </ScrollView>
    </SafeAreaView>
  );
}

/** Rows that start open: a failing field, a missing value, or an unsure read (SPEC-B §B7.4). */
function initialExpanded(card: ExpressCard): Record<string, boolean> {
  const open: Record<string, boolean> = {};
  for (const [field, flag] of Object.entries(card.flagBy)) if (flag) open[field === 'total' ? 'total' : field] = true;
  if (card.missing.includes('odo')) open.odo = true;
  if (card.missing.includes('amounts')) {
    open.vol = true;
    open.price = true;
    open.total = true;
  }
  for (const [k, c] of Object.entries(card.marks)) if (c != null && c < 0.6) open[k] = true;
  return open;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.gutter },
  pad: { padding: space.gutter, paddingBottom: 56 },
  slot: { borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.card, padding: space.md, alignItems: 'center', marginBottom: space.md },
  slotImg: { width: '100%', height: 140, borderRadius: radius.input },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm, justifyContent: 'center' },
  chip: { borderWidth: 1, borderColor: 'transparent', borderRadius: radius.chip, paddingHorizontal: space.md, minHeight: 40, justifyContent: 'center' },
  thumbs: { flexDirection: 'row', gap: space.sm, marginBottom: space.md },
  thumb: { width: 84, height: 84, borderRadius: radius.input },
  row: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: space.sm },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 48 },
});
