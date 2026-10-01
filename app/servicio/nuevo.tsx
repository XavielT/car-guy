import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DateField } from '@/components/DateField';
import { Field } from '@/components/Field';
import { PhotoPicker } from '@/components/PhotoPicker';
import { OilBlock } from '@/components/service/OilBlock';
import { T } from '@/components/T';
import { GhostButton, PrimaryButton, Surface } from '@/components/ui';
import { categoryColors, radius, space } from '@/constants/theme';
import {
  currentOdometer as currentOdometerQuery,
  media as mediaRepo,
  odometer as odometerRepo,
  parts as partRepo,
  serviceRecordItems as itemRepo,
  serviceRecords as serviceRecordRepo,
  serviceTypes as serviceTypeRepo,
  specsheets as specsheetRepo,
} from '@/lib/db/repos';
import { lastOilFor } from '@/lib/db/oilQueries';
import { saveServiceRecord, shopSuggestions, type PartDraft } from '@/lib/db/serviceOps';
import type { ServiceKind, ServiceType, VehicleSpecsheet } from '@/lib/db/types';
import { suggestionsFor } from '@/lib/domain/carMemory';
import { todayIso } from '@/lib/domain/dates';
import { EMPTY_OIL, isOilItem, normalizeOil, type OilFields } from '@/lib/domain/oil';
import { odometerWarning } from '@/lib/domain/odometer';
import { dateInputFromIso, isoFromDateInput } from '@/lib/format';
import { FEATURE_BUILD, FEATURE_DIY } from '@/lib/flags';
import { ContactPicker } from '@/components/diy/ContactPieces';
import { t } from '@/lib/i18n';
import { catalogLabel } from '@/lib/i18n/catalog';
import { Alert } from '@/lib/alert';
import { isInvalidNumber, parseDecimal, roundMoney } from '@/lib/math';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

const KINDS: ServiceKind[] = ['mantenimiento', 'reparacion', 'mejora'];

const KIND_COLOR: Record<ServiceKind, string> = {
  mantenimiento: categoryColors.mantenimiento,
  reparacion: categoryColors.reparacion,
  mejora: categoryColors.mejora,
};

/**
 * One form for the three kinds of work, because they are the same record with a
 * different label (ADR-09) — the same date, odometer, cost, shop and parts.
 *
 * Only *mantenimiento* offers the catalog list: ticking "Aceite de motor" is
 * what re-arms the oil reminder, and a repair or an upgrade has nothing to
 * re-arm.
 */
export default function NuevoServicioScreen() {
  const router = useRouter();
  // `serviceTypeId`, `date` and `km` arrive from a reminder's "Hecho" sheet:
  // the record it opens is what resets that reminder, so the item comes ticked.
  const params = useLocalSearchParams<{
    id?: string;
    kind?: string;
    taskId?: string;
    title?: string;
    serviceTypeId?: string;
    date?: string;
    km?: string;
  }>();
  const editingId = params.id ?? null;
  const { theme } = useTheme();
  const { activeVehicle, refresh } = useStore();

  // The alias: /servicio/nuevo?kind=mejora (the Historial FAB, old links) opens the mod form.
  useEffect(() => {
    if (FEATURE_BUILD && !editingId && params.kind === 'mejora') {
      router.replace({ pathname: '/mod/nuevo', params: { vehicleId: activeVehicle?.id } });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [kind, setKind] = useState<ServiceKind>(
    KINDS.includes(params.kind as ServiceKind) ? (params.kind as ServiceKind) : 'mantenimiento',
  );
  const [date, setDate] = useState(
    params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : dateInputFromIso(todayIso()),
  );
  const [odometer, setOdometer] = useState(params.km ?? '');
  const [title, setTitle] = useState(params.title ?? '');
  const [titleTouched, setTitleTouched] = useState(Boolean(params.title));
  const [selected, setSelected] = useState<string[]>(params.serviceTypeId ? [params.serviceTypeId] : []);
  const [search, setSearch] = useState('');
  const [description, setDescription] = useState('');
  const [costParts, setCostParts] = useState('');
  const [costLabor, setCostLabor] = useState('');
  const [totalOverride, setTotalOverride] = useState<string | null>(null);
  const [shop, setShop] = useState('');
  const [contactId, setContactId] = useState<string | null>(null);
  const [showWarranty, setShowWarranty] = useState(false);
  const [warrantyDate, setWarrantyDate] = useState('');
  const [warrantyKm, setWarrantyKm] = useState('');
  const [showParts, setShowParts] = useState(false);
  const [parts, setParts] = useState<PartDraft[]>([]);
  const [photoMediaId, setPhotoMediaId] = useState<string | null>(null);
  const [sourceTaskId, setSourceTaskId] = useState<string | null>(params.taskId ?? null);
  const [sourceInspectionId, setSourceInspectionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The Aceite block per oil item, and the previous oil offered for each (note 16).
  const [oil, setOil] = useState<Record<string, OilFields>>({});
  const [lastOil, setLastOil] = useState<Record<string, OilFields | null>>({});
  // "Igual que siempre" (IMP 30092026 note 6): what the car's memory says it takes.
  const [sheet, setSheet] = useState<VehicleSpecsheet | null>(null);

  const [catalog, setCatalog] = useState<ServiceType[]>([]);
  const [currentKm, setCurrentKm] = useState<number | null>(null);
  const [readings, setReadings] = useState<{ occurredAt: string; valueKm: number }[]>([]);
  const [shops, setShops] = useState<string[]>([]);
  const [recordId] = useState(() => editingId ?? `svc_${Date.now()}`);

  const vehicleId = activeVehicle?.id;

  useEffect(() => {
    if (!vehicleId) return;
    let cancelled = false;
    (async () => {
      const [types, km, rows, previousShops, specsheet] = await Promise.all([
        serviceTypeRepo.list(undefined, { orderBy: 'sort_order', direction: 'ASC' }),
        currentOdometerQuery(vehicleId),
        odometerRepo.list(vehicleId),
        shopSuggestions(vehicleId),
        specsheetRepo.getForVehicle(vehicleId).catch(() => null),
      ]);
      if (cancelled) return;
      setSheet(specsheet);
      setCatalog(types);
      setCurrentKm(km);
      setReadings(rows);
      setShops(previousShops);
      // Editing keeps the odometer the record was saved with; only a new record
      // gets today's reading pre-filled.
      if (!editingId && !params.km && km != null) setOdometer(String(Math.round(km)));
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [vehicleId, editingId, params.km]);

  // Editing loads the record back into the same form. There is no second screen
  // for it: a record you are correcting has exactly the fields you typed.
  useEffect(() => {
    if (!editingId) return;
    let cancelled = false;

    (async () => {
      const row = await serviceRecordRepo.getById(editingId);
      if (!row) return;
      const [items, partRows, photos] = await Promise.all([
        itemRepo.listWhere({ serviceRecordId: editingId }),
        partRepo.listWhere({ serviceRecordId: editingId }),
        mediaRepo.listWhere({ ownerTable: 'service_record', ownerId: editingId }),
      ]);
      if (cancelled) return;

      setKind(row.kind);
      setDate(dateInputFromIso(row.occurredAt));
      setOdometer(row.odometerKm != null ? String(Math.round(row.odometerKm)) : '');
      setTitle(row.title);
      setTitleTouched(true);
      setSelected(items.map((i) => i.serviceTypeId));
      setOil(Object.fromEntries(items.map((i) => [i.serviceTypeId, normalizeOil(i)])));
      setDescription(row.description);
      setCostParts(row.costPartsDop ? String(row.costPartsDop) : '');
      setCostLabor(row.costLaborDop ? String(row.costLaborDop) : '');
      // There is no "was overridden" flag on the row, so we infer it: a total
      // that matches parts + labour is one the form computed, and must keep
      // recomputing as those are edited. Anything else the user typed by hand.
      const computed = roundMoney(row.costPartsDop + row.costLaborDop);
      setTotalOverride(row.totalDop === computed ? null : String(row.totalDop));
      setShop(row.shop);
      setContactId(row.contactId ?? null);
      if (row.warrantyUntilDate || row.warrantyUntilKm != null) {
        setShowWarranty(true);
        setWarrantyDate(row.warrantyUntilDate ? dateInputFromIso(row.warrantyUntilDate) : '');
        setWarrantyKm(row.warrantyUntilKm != null ? String(row.warrantyUntilKm) : '');
      }
      if (partRows.length) {
        setShowParts(true);
        setParts(
          partRows.map((part) => ({
            id: part.id,
            name: part.name,
            partNumber: part.partNumber,
            brand: part.brand,
            quantity: part.quantity,
            unitCostDop: part.unitCostDop,
          })),
        );
      }
      setPhotoMediaId(photos[0]?.id ?? null);
      // Where the record came from survives an edit — it is history, not input.
      setSourceTaskId(row.sourceTaskId);
      setSourceInspectionId(row.sourceInspectionId);
    })().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [editingId]);

  const oilItems = kind === 'mantenimiento'
    ? selected.map((id) => catalog.find((t) => t.id === id)).filter((t): t is ServiceType => isOilItem(t))
    : [];
  const oilItemKey = oilItems.map((t) => t.id).join(',');

  // "Igual que la última vez": the previous oil of this vehicle, fetched once per oil item.
  useEffect(() => {
    if (!vehicleId) return;
    const missing = oilItemKey.split(',').filter((id) => id && !(id in lastOil));
    if (!missing.length) return;
    let cancelled = false;
    void Promise.all(missing.map((id) => lastOilFor(vehicleId, id, editingId).then((o) => [id, o] as const)))
      .then((pairs) => {
        if (!cancelled) setLastOil((prev) => ({ ...prev, ...Object.fromEntries(pairs) }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [vehicleId, oilItemKey, editingId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!activeVehicle) return null;
  const oilFuel = activeVehicle.defaultFuelType?.startsWith('gasoil') ? 'diesel' : 'gasolina';

  // The title writes itself from the items until the user takes it over; a
  // record called "Aceite de motor y filtro + Filtro de aire" is better than an
  // empty one, and better than making them type it.
  const autoTitle = selected
    .map((id) => catalogLabel('serviceType', catalog.find((t) => t.id === id)))
    .filter(Boolean)
    .join(' + ');
  const effectiveTitle = titleTouched ? title : autoTitle;

  const partsCost = parseDecimal(costParts) ?? 0;
  const laborCost = parseDecimal(costLabor) ?? 0;
  const computedTotal = roundMoney(partsCost + laborCost);
  const total = totalOverride != null ? (parseDecimal(totalOverride) ?? 0) : computedTotal;

  const parsedOdometer = odometer.trim() ? parseDecimal(odometer) : null;
  const warning =
    parsedOdometer != null ? odometerWarning(parsedOdometer, isoFromDateInput(date), readings) : null;

  const visible = search.trim()
    ? catalog.filter((t) => catalogLabel('serviceType', t).toLowerCase().includes(search.trim().toLowerCase()))
    : catalog;

  function save() {
    if (!effectiveTitle.trim()) return setError(t.service.titleRequired);
    const badNumber = (
      [
        [costParts, t.service.costParts],
        [costLabor, t.service.costLabor],
        [totalOverride ?? '', t.service.total],
        [odometer, t.service.odometer],
        [warrantyKm, t.service.warrantyKm],
      ] as const
    ).find(([text]) => isInvalidNumber(text));
    if (badNumber) return setError(t.common.invalidNumber(badNumber[1]));
    setError(null);

    void (async () => {
      const result = await saveServiceRecord({
        id: recordId,
        vehicleId: activeVehicle!.id,
        kind,
        occurredAt: isoFromDateInput(date),
        odometerKm: parsedOdometer,
        title: effectiveTitle.trim(),
        description: description.trim(),
        costPartsDop: partsCost,
        costLaborDop: laborCost,
        totalDop: total,
        shop: shop.trim(),
        contactId: FEATURE_DIY ? contactId : undefined,
        warrantyUntilDate: warrantyDate ? isoFromDateInput(warrantyDate) : null,
        warrantyUntilKm: warrantyKm.trim() ? parseDecimal(warrantyKm) : null,
        sourceTaskId,
        sourceInspectionId,
        serviceTypeIds: kind === 'mantenimiento' ? selected : [],
        // Only the oil items keep their block; an unticked or non-oil item saves empty columns.
        oil: Object.fromEntries(oilItems.map((t) => [t.id, oil[t.id] ?? EMPTY_OIL])),
        parts,
      });
      await refresh();

      Alert.alert(
        t.service.savedTitle,
        result.resets.length
          ? `${t.service.savedWithResets}\n\n${result.resets.map((r) => `· ${r}`).join('\n')}`
          : effectiveTitle.trim(),
      );
      router.back();
    })();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
        <T face="display" style={[styles.h, { color: theme.text.primary }]}>
          {editingId ? t.service.editTitle : t.service.newTitle}
        </T>

        <T face="eyebrow" style={[styles.label, { color: theme.text.secondary }]}>
          {t.service.kind}
        </T>
        <View style={styles.row}>
          {KINDS.map((k) => {
            const on = kind === k;
            return (
              <Pressable
                key={k}
                onPress={() => {
                  // "Mejora" is the build log now (IMP 28092026 Phase 4): a new one is a mod.
                  // Editing a v2.0 mejora record stays here.
                  if (k === 'mejora' && FEATURE_BUILD && !editingId) {
                    router.replace({ pathname: '/mod/nuevo', params: { vehicleId: activeVehicle?.id } });
                    return;
                  }
                  setKind(k);
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                style={[
                  styles.kindChip,
                  { borderColor: on ? KIND_COLOR[k] : theme.line, backgroundColor: on ? `${KIND_COLOR[k]}22` : theme.bg.raised },
                ]}>
                <View style={[styles.dot, { backgroundColor: KIND_COLOR[k] }]} />
                <T face="title" style={[styles.chipLabel, { color: on ? theme.text.primary : theme.text.secondary }]}>
                  {t.service.kinds[k]}
                </T>
              </Pressable>
            );
          })}
        </View>

        <DateField label={t.service.date} value={date} onChange={setDate} noFuture />
        <Field
          label={t.service.odometer}
          keyboardType="number-pad"
          value={odometer}
          onChangeText={setOdometer}
          placeholder={currentKm != null ? String(Math.round(currentKm)) : '51676'}
        />
        {warning ? (
          <T face="body" style={[styles.warning, { color: theme.statusText.proximo }]}>
            {warning}
          </T>
        ) : null}

        {kind === 'mantenimiento' ? (
          <>
            <T face="eyebrow" style={[styles.label, { color: theme.text.secondary }]}>
              {t.service.items}
            </T>
            <T face="body" style={[styles.hint, { color: theme.text.muted }]}>
              {t.service.itemsHint}
            </T>
            {/* Above the list, next to the Aceite chip that opened it (the list is long on a phone). */}
            {oilItems.map((type) => (
              <OilBlock
                key={type.id}
                title={oilItems.length > 1 || type.id !== 'aceite_motor' ? t.oil.titleFor(catalogLabel('serviceType', type)) : t.oil.title}
                value={oil[type.id] ?? EMPTY_OIL}
                onChange={(next) => setOil((prev) => ({ ...prev, [type.id]: next }))}
                last={lastOil[type.id]}
                memory={suggestionsFor(type.id, sheet)}
                fuel={oilFuel}
              />
            ))}
            <Field label={t.service.searchItems} value={search} onChangeText={setSearch} />
            <View style={styles.row}>
              {visible.map((type) => {
                const on = selected.includes(type.id);
                return (
                  <Pressable
                    key={type.id}
                    onPress={() =>
                      setSelected((prev) =>
                        prev.includes(type.id) ? prev.filter((x) => x !== type.id) : [...prev, type.id],
                      )
                    }
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    style={[
                      styles.itemChip,
                      { borderColor: on ? theme.accentFill : theme.line, backgroundColor: on ? theme.accentFill : theme.bg.raised },
                    ]}>
                    <T face="title" style={{ color: on ? theme.accentFillInk : theme.text.secondary, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase' }}>
                      {catalogLabel('serviceType', type)}
                    </T>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        <Field
          label={t.service.title}
          placeholder={t.service.titlePlaceholder}
          value={effectiveTitle}
          onChangeText={(v) => {
            setTitleTouched(true);
            setTitle(v);
          }}
        />
        <Field label={t.service.description} value={description} onChangeText={setDescription} multiline />

        <T face="eyebrow" accessibilityRole="header" style={[styles.section, { color: theme.text.muted }]}>
          {t.service.costs}
        </T>
        <View style={styles.pair}>
          <View style={styles.half}>
            <Field label={t.service.costParts} keyboardType="decimal-pad" value={costParts} onChangeText={setCostParts} />
          </View>
          <View style={styles.half}>
            <Field label={t.service.costLabor} keyboardType="decimal-pad" value={costLabor} onChangeText={setCostLabor} />
          </View>
        </View>
        <Field
          label={t.service.total}
          keyboardType="decimal-pad"
          value={totalOverride ?? String(computedTotal)}
          onChangeText={setTotalOverride}
          hint={t.service.totalAuto}
        />

        {FEATURE_DIY ? (
          // The shop is a contact now (call / WhatsApp from it), with free text for a one-off.
          <ContactPicker
            contactId={contactId}
            text={shop}
            textLabel={t.service.shop}
            onChange={({ contactId: c, text }) => {
              setContactId(c);
              setShop(text);
            }}
          />
        ) : (
          <Field label={t.service.shop} placeholder={t.service.shopPlaceholder} value={shop} onChangeText={setShop} />
        )}
        {shops.length && !contactId ? (
          <View style={styles.row}>
            {shops.map((s) => (
              <Pressable
                key={s}
                onPress={() => setShop(s)}
                accessibilityRole="button"
                style={[styles.suggestion, { borderColor: theme.line, backgroundColor: theme.bg.raised }]}>
                <T face="body" style={{ color: theme.text.secondary, fontSize: 12 }}>
                  {s}
                </T>
              </Pressable>
            ))}
          </View>
        ) : null}

        <Pressable
          onPress={() => setShowWarranty((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ expanded: showWarranty }}
          style={styles.toggle}>
          <T face="title" style={[styles.toggleLabel, { color: theme.text.secondary }]}>
            {showWarranty ? '−' : '+'}  {t.service.warranty}
          </T>
        </Pressable>
        {showWarranty ? (
          <>
            <DateField label={t.service.warrantyDate} value={warrantyDate} onChange={setWarrantyDate} />
            <Field label={t.service.warrantyKm} keyboardType="number-pad" value={warrantyKm} onChangeText={setWarrantyKm} />
          </>
        ) : null}

        <Pressable
          onPress={() => setShowParts((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ expanded: showParts }}
          style={styles.toggle}>
          <T face="title" style={[styles.toggleLabel, { color: theme.text.secondary }]}>
            {showParts ? '−' : '+'}  {t.service.parts}
          </T>
        </Pressable>
        {showParts ? (
          <Surface style={{ marginBottom: space.md }}>
            {parts.map((part, index) => (
              <View key={index} style={styles.partRow}>
                <T face="body" style={{ color: theme.text.primary, flex: 1 }}>
                  <T face="mono" style={{ fontSize: 13 }}>
                    {part.quantity}×
                  </T>{' '}
                  {part.name}
                </T>
                <Pressable
                  onPress={() => setParts((prev) => prev.filter((_, i) => i !== index))}
                  accessibilityRole="button"
                  accessibilityLabel={t.common.removeItem(part.name)}
                  hitSlop={12}>
                  <T face="body" style={{ color: theme.text.muted }}>
                    ×
                  </T>
                </Pressable>
              </View>
            ))}
            <PartAdder onAdd={(part) => setParts((prev) => [...prev, part])} />
          </Surface>
        ) : null}

        <T face="eyebrow" style={[styles.label, { color: theme.text.secondary }]}>
          {t.service.photos}
        </T>
        <PhotoPicker
          mediaId={photoMediaId}
          ownerTable="service_record"
          ownerId={recordId}
          vehicleId={activeVehicle.id}
          onChange={setPhotoMediaId}
        />

        {error ? (
          <T face="body" style={[styles.error, { color: theme.dangerText }]}>
            {error}
          </T>
        ) : null}
        <PrimaryButton label={t.service.save} onPress={save} />
      </ScrollView>
    </SafeAreaView>
  );
}

function PartAdder({ onAdd }: { onAdd: (part: PartDraft) => void }) {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [cost, setCost] = useState('');

  return (
    <View>
      <Field label={t.service.partName} value={name} onChangeText={setName} />
      <View style={styles.pair}>
        <View style={styles.half}>
          <Field label={t.service.partQuantity} keyboardType="decimal-pad" value={quantity} onChangeText={setQuantity} />
        </View>
        <View style={styles.half}>
          <Field label={t.service.partCost} keyboardType="decimal-pad" value={cost} onChangeText={setCost} />
        </View>
      </View>
      <GhostButton
        label={t.service.addPart}
        onPress={() => {
          if (!name.trim()) return;
          onAdd({
            name: name.trim(),
            quantity: parseDecimal(quantity) ?? 1,
            unitCostDop: cost.trim() ? parseDecimal(cost) : null,
          });
          setName('');
          setQuantity('1');
          setCost('');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 40 },
  h: { fontSize: 28, lineHeight: 30, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: space.lg },
  label: { fontSize: 12, marginBottom: 6 },
  hint: { fontSize: 13, lineHeight: 18, marginBottom: space.sm },
  section: { fontSize: 12, marginTop: space.xl, marginBottom: space.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.md },
  kindChip: { minHeight: 44, justifyContent: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: radius.chip,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  chipLabel: { fontSize: 13, letterSpacing: 1, textTransform: 'uppercase' },
  toggleLabel: { fontSize: 14, letterSpacing: 0.9, textTransform: 'uppercase' },
  dot: { width: 8, height: 8, borderRadius: 999 },
  itemChip: { borderWidth: 1, borderRadius: radius.chip, paddingHorizontal: space.md, paddingVertical: 6 },
  suggestion: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderRadius: radius.chip, paddingHorizontal: space.md, paddingVertical: 6 },
  toggle: { paddingVertical: space.md },
  partRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 6 },
  pair: { flexDirection: 'row', gap: space.md },
  half: { flex: 1 },
  warning: { fontSize: 13, lineHeight: 19, marginBottom: space.md },
  error: { fontSize: 13, marginBottom: space.md },
});
