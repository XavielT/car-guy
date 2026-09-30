import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';

import { PhotoThumb } from '@/components/album/PhotoThumb';
import { DateField } from '@/components/DateField';
import { Field } from '@/components/Field';
import { T } from '@/components/T';
import { Chip, GhostButton, PrimaryButton } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { Alert } from '@/lib/alert';
import {
  addModPhotos,
  applyReminderReset,
  lastFxRate,
  modPhotos,
  reminderResetFor,
  removeModPhoto,
  saveMod,
  setModPhotoRole,
} from '@/lib/db/buildQueries';
import { contacts as contactRepo, modCategories, mods as modRepo, odometer as odometerRepo } from '@/lib/db/repos';
import type { Contact, Mod, ModCategory, ModMedia, OdometerReading } from '@/lib/db/types';
import { jsonObject } from '@/lib/domain/album';
import { cleanSpecs, foreignToDop, modTotalDop, parseTags, SPEC_FIELDS, specFieldLabel } from '@/lib/domain/build';
import { parseDecimal } from '@/lib/domain/economy';
import { odometerWarning } from '@/lib/domain/odometer';
import { dateInputFromIso, id as newId, isoFromDateInput, money, todayIsoDate } from '@/lib/format';
import { t } from '@/lib/i18n';
import { catalogLabel } from '@/lib/i18n/catalog';
import { importCandidates, pickCandidates } from '@/lib/media';
import { useTheme } from '@/lib/theme/useTheme';
import { ContactPicker } from '@/components/diy/ContactPieces';

const STATUSES: Mod['status'][] = ['instalado', 'planeado', 'pedido', 'quitado', 'vendido', 'danado'];
const INSTALLERS: Mod['installerType'][] = ['yo', 'taller', 'amigo'];
const CURRENCIES = ['USD', 'EUR', 'JPY'];
const ROLES: ModMedia['role'][] = ['despues', 'antes', 'instalacion', 'recibo', 'dyno', 'foto'];
/** The mini-form's fields (03-screens.md): hp, torque, peso, motor, ECU, aros, gomas, altura. */
const EFFECT_KEYS = ['engine_code', 'hp', 'torque_nm', 'ecu', 'wheel_f', 'wheel_r', 'tire_f', 'tire_r', 'weight_kg', 'ride_height'];

const num = (s: string): number => (s.trim() ? parseDecimal(s) ?? 0 : 0);
const str = (n: number | null | undefined): string => (n ? String(n) : '');

/**
 * The mod form (03-screens.md Block B). Costs are stored in RD$; a foreign
 * price is an entry helper — "USD 210 × 59.8 = RD$ 12 558" — whose rate
 * defaults to the last one used. "Afecta la ficha" writes `spec_effects`
 * (validated against lib/domain/build.ts's contract). An installed mod with a
 * km leaves an odometer reading; new gomas/pads/coolant offer to reset their
 * reminder.
 */
export function ModForm({
  vehicleId,
  modId,
  draft,
  onDone,
}: {
  vehicleId: string;
  modId?: string;
  draft?: Partial<Mod> & { fromWishlistId?: string };
  /** The saved mod — "Usar en un mod" links the inventory item to it. */
  onDone: (saved?: { id: string }) => void;
}) {
  const { theme } = useTheme();
  // Known before the first save, so photos can be attached right away.
  const [id] = useState(modId ?? newId());
  const [categories, setCategories] = useState<ModCategory[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [others, setOthers] = useState<Mod[]>([]);
  const [readings, setReadings] = useState<OdometerReading[]>([]);
  const [photos, setPhotos] = useState<ModMedia[]>([]);
  const [search, setSearch] = useState('');

  const [categoryId, setCategoryId] = useState(draft?.categoryId ?? 'otro');
  const [name, setName] = useState(draft?.name ?? '');
  const [brand, setBrand] = useState(draft?.brand ?? '');
  const [partNumber, setPartNumber] = useState(draft?.partNumber ?? '');
  const [variant, setVariant] = useState(draft?.variant ?? '');
  const [status, setStatus] = useState<Mod['status']>(draft?.status ?? 'instalado');
  const [installedAt, setInstalledAt] = useState(draft?.installedAt ? dateInputFromIso(draft.installedAt) : todayIsoDate());
  const [installedKm, setInstalledKm] = useState(str(draft?.installedKm));
  const [installer, setInstaller] = useState<Mod['installerType']>(draft?.installerType ?? 'yo');
  const [contactId, setContactId] = useState<string | null>(draft?.contactId ?? null);
  const [part, setPart] = useState(str(draft?.costPartDop));
  const [labor, setLabor] = useState(str(draft?.costLaborDop));
  const [shipping, setShipping] = useState(str(draft?.costShippingDop));
  const [customs, setCustoms] = useState(str(draft?.costCustomsDop));
  const [foreign, setForeign] = useState(str(draft?.priceForeign));
  const [currency, setCurrency] = useState(draft?.currency ?? 'USD');
  const [rate, setRate] = useState(str(draft?.fxRateToDop));
  const [vendor, setVendor] = useState(draft?.vendor ?? '');
  const [vendorUrl, setVendorUrl] = useState(draft?.vendorUrl ?? '');
  const [affects, setAffects] = useState(Boolean(draft?.affectsSpecs));
  const [effects, setEffects] = useState<Record<string, string>>({});
  const [replaces, setReplaces] = useState<string | null>(draft?.replacesModId ?? null);
  const [tags, setTags] = useState(parseTags(draft?.tags).join(', '));
  const [notes, setNotes] = useState(draft?.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [soldPrice, setSoldPrice] = useState<number | null>(draft?.soldPriceDop ?? null);

  useEffect(() => {
    void (async () => {
      const [cats, cs, ms, rs, r] = await Promise.all([
        modCategories.listWhere({}, { orderBy: 'sort_order', direction: 'ASC' }),
        contactRepo.listWhere({}),
        modRepo.listWhere({ vehicleId }),
        odometerRepo.list(vehicleId),
        lastFxRate(),
      ]);
      setCategories(cats);
      setContacts(cs);
      setOthers(ms.filter((m) => m.id !== id));
      setReadings(rs);
      if (!rate && r) setRate(String(r));
      if (!modId) return;
      const m = await modRepo.getById(modId);
      if (!m) return;
      setCategoryId(m.categoryId);
      setName(m.name);
      setBrand(m.brand ?? '');
      setPartNumber(m.partNumber ?? '');
      setVariant(m.variant ?? '');
      setStatus(m.status);
      setInstalledAt(m.installedAt ? dateInputFromIso(m.installedAt) : todayIsoDate());
      setInstalledKm(str(m.installedKm));
      setInstaller(m.installerType);
      setContactId(m.contactId);
      setPart(str(m.costPartDop));
      setLabor(str(m.costLaborDop));
      setShipping(str(m.costShippingDop));
      setCustoms(str(m.costCustomsDop));
      setForeign(str(m.priceForeign));
      setCurrency(m.currency ?? 'USD');
      if (m.fxRateToDop) setRate(String(m.fxRateToDop));
      setVendor(m.vendor ?? '');
      setVendorUrl(m.vendorUrl ?? '');
      setAffects(m.affectsSpecs);
      setEffects(Object.fromEntries(Object.entries(jsonObject(m.specEffects)).map(([k, v]) => [k, String(v)])));
      setReplaces(m.replacesModId);
      setTags(parseTags(m.tags).join(', '));
      setNotes(m.notes);
      setSoldPrice(m.soldPriceDop);
      setPhotos(await modPhotos(modId));
    })();
  }, [vehicleId, modId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fx = foreignToDop(foreign.trim() ? parseDecimal(foreign) : null, rate.trim() ? parseDecimal(rate) : null);
  const total = modTotalDop({ costPartDop: num(part), costLaborDop: num(labor), costShippingDop: num(shipping), costCustomsDop: num(customs) });
  const kmValue = installedKm.trim() ? parseDecimal(installedKm) : null;
  const kmWarning = kmValue != null && status === 'instalado' ? odometerWarning(kmValue, isoFromDateInput(installedAt), readings) : null;
  const shownCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? categories.filter((c) => catalogLabel('modCategory', c).toLowerCase().includes(q)) : categories;
  }, [categories, search]);

  async function addPhotos() {
    const picked = await pickCandidates({ multiple: true });
    if (!picked.length) return;
    const fallback = isoFromDateInput(installedAt);
    const result = await importCandidates(
      picked.map((c) => ({ ...c, takenAt: c.takenAt ?? fallback, precision: 'day' as const })),
      { vehicleId, modId: id },
    );
    await addModPhotos(id, result.mediaIds, photos.length ? 'foto' : 'despues');
    setPhotos(await modPhotos(id));
  }

  async function cycleRole(p: ModMedia) {
    const next = ROLES[(ROLES.indexOf(p.role) + 1) % ROLES.length];
    await setModPhotoRole(p.id, next);
    setPhotos((prev) => prev.map((x) => (x.id === p.id ? { ...x, role: next } : x)));
  }

  async function save() {
    if (!name.trim()) return setError(t.modForm.nameRequired);
    const cleaned = cleanSpecs(affects ? effects : {}).specs;
    const at = isoFromDateInput(installedAt);
    const saved = await saveMod({
      id,
      vehicleId,
      categoryId,
      name: name.trim(),
      brand: brand.trim() || null,
      partNumber: partNumber.trim() || null,
      variant: variant.trim() || null,
      status,
      installedAt: status === 'planeado' || status === 'pedido' ? null : at,
      installedKm: status === 'planeado' || status === 'pedido' ? null : kmValue,
      installerType: installer,
      contactId: installer === 'yo' ? null : contactId,
      costPartDop: num(part),
      costLaborDop: num(labor),
      costShippingDop: num(shipping),
      costCustomsDop: num(customs),
      priceForeign: foreign.trim() ? parseDecimal(foreign) : null,
      currency: foreign.trim() ? currency : null,
      fxRateToDop: foreign.trim() && rate.trim() ? parseDecimal(rate) : null,
      vendor: vendor.trim() || null,
      vendorUrl: vendorUrl.trim() || null,
      affectsSpecs: affects,
      specEffects: JSON.stringify(cleaned),
      replacesModId: replaces,
      tags: JSON.stringify(tags.split(',').map((t) => t.trim()).filter(Boolean)),
      notes: notes.trim(),
      soldPriceDop: soldPrice,
      fromWishlistId: draft?.fromWishlistId ?? null,
    });

    // New gomas, pads or coolant: offer to re-arm the matching reminder.
    const reset = saved.status === 'instalado' && !modId ? await reminderResetFor(vehicleId, saved.categoryId) : null;
    if (reset) {
      Alert.alert(t.modForm.reminderTitle, t.modForm.reminderBody(reset.titles.join('", "')), [
        { text: t.modForm.reminderNo, style: 'cancel', onPress: () => onDone(saved) },
        { text: t.modForm.reminderYes, onPress: () => void applyReminderReset(vehicleId, reset.serviceTypeId, { date: at, km: kmValue }).then(() => onDone(saved)) },
      ]);
      return;
    }
    onDone(saved);
  }

  function remove() {
    if (!modId) return;
    Alert.alert(t.modForm.delete, t.modForm.deleteBody, [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.common.delete, style: 'destructive', onPress: () => void modRepo.softDelete(modId).then(() => onDone()) },
    ]);
  }

  const eyebrow = (label: string) => (
    <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11, marginTop: space.md, marginBottom: space.sm }}>
      {label}
    </T>
  );

  return (
    <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
      <T face="display" style={{ color: theme.text.primary, fontSize: 28, textTransform: 'uppercase', marginBottom: space.sm }}>
        {modId ? t.modForm.editTitle : t.modForm.newTitle}
      </T>
      {draft?.fromWishlistId ? (
        <T face="body" style={{ color: theme.accent, fontSize: 13, marginBottom: space.sm }}>
          {t.modForm.fromWishlist}
        </T>
      ) : null}

      {eyebrow(t.modForm.category)}
      <Field label={t.modForm.searchCategory} value={search} onChangeText={setSearch} />
      <View style={styles.chips}>
        {shownCategories.map((c) => (
          <Chip key={c.id} label={catalogLabel('modCategory', c)} selected={categoryId === c.id} onPress={() => setCategoryId(c.id)} />
        ))}
      </View>

      <Field label={t.modForm.name} placeholder={t.modForm.namePlaceholder} value={name} onChangeText={(t) => (setName(t), setError(null))} />
      <View style={styles.pair}>
        <View style={{ flex: 1 }}>
          <Field label={t.modForm.brand} value={brand} onChangeText={setBrand} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label={t.modForm.partNumber} value={partNumber} onChangeText={setPartNumber} />
        </View>
      </View>
      <Field label={t.modForm.variant} value={variant} onChangeText={setVariant} />

      {eyebrow(t.modForm.status)}
      <View style={styles.chips}>
        {STATUSES.map((s) => (
          <Chip key={s} label={t.build.statuses[s]} selected={status === s} onPress={() => setStatus(s)} />
        ))}
      </View>

      {status !== 'planeado' && status !== 'pedido' ? (
        <>
          <DateField label={t.modForm.installedAt} value={installedAt} onChange={setInstalledAt} noFuture />
          <Field label={t.modForm.installedKm} keyboardType="number-pad" value={installedKm} onChangeText={setInstalledKm} hint={kmWarning ?? t.modForm.installedKmHint} />
        </>
      ) : null}

      {eyebrow(t.modForm.installer)}
      <View style={styles.chips}>
        {INSTALLERS.map((i) => (
          <Chip key={i} label={t.build.installers[i]} selected={installer === i} onPress={() => setInstaller(i)} />
        ))}
      </View>
      {installer !== 'yo' ? (
        <ContactPicker
          contactId={contactId}
          text={contactId ? contacts.find((c) => c.id === contactId)?.name ?? '' : vendor}
          onChange={({ contactId: c }) => setContactId(c)}
        />
      ) : null}

      {eyebrow(t.modForm.costs)}
      <View style={styles.pair}>
        <View style={{ flex: 1 }}>
          <Field label={t.modForm.foreign} keyboardType="decimal-pad" value={foreign} onChangeText={setForeign} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label={t.modForm.rate} keyboardType="decimal-pad" value={rate} onChangeText={setRate} />
        </View>
      </View>
      <View style={styles.chips}>
        {CURRENCIES.map((c) => (
          <Chip key={c} label={c} selected={currency === c} onPress={() => setCurrency(c)} />
        ))}
      </View>
      {fx != null ? (
        <View style={[styles.fx, { backgroundColor: theme.bg.raised, borderColor: theme.line }]}>
          <T face="mono" style={{ color: theme.text.primary, fontSize: 13, flex: 1 }}>
            {t.modForm.fxLine(foreign.trim(), currency, rate.trim(), money(fx))}
          </T>
          <GhostButton label={t.modForm.useFx} onPress={() => setPart(String(fx))} />
        </View>
      ) : null}
      <View style={styles.pair}>
        <View style={{ flex: 1 }}>
          <Field label={t.modForm.costPart} keyboardType="decimal-pad" value={part} onChangeText={setPart} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label={t.modForm.costLabor} keyboardType="decimal-pad" value={labor} onChangeText={setLabor} />
        </View>
      </View>
      <View style={styles.pair}>
        <View style={{ flex: 1 }}>
          <Field label={t.modForm.costShipping} keyboardType="decimal-pad" value={shipping} onChangeText={setShipping} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label={t.modForm.costCustoms} keyboardType="decimal-pad" value={customs} onChangeText={setCustoms} />
        </View>
      </View>
      <T face="monoBold" style={{ color: theme.text.primary, fontSize: 16, marginBottom: space.md }}>
        {`${t.modForm.total}: ${money(total)}`}
      </T>
      <Field label={t.modForm.vendor} value={vendor} onChangeText={setVendor} />
      <Field label={t.modForm.vendorUrl} value={vendorUrl} onChangeText={setVendorUrl} autoCapitalize="none" keyboardType="url" />

      <View style={styles.switchRow}>
        <View style={{ flex: 1 }}>
          <T face="semibold" style={{ color: theme.text.primary, fontSize: 15 }}>
            {t.modForm.affects}
          </T>
          <T face="body" style={{ color: theme.text.muted, fontSize: 12 }}>
            {t.modForm.affectsHint}
          </T>
        </View>
        <Switch value={affects} onValueChange={setAffects} accessibilityLabel={t.modForm.affects} />
      </View>
      {affects
        ? SPEC_FIELDS.filter((f) => EFFECT_KEYS.includes(f.key)).map((f) => (
            <Field
              key={f.key}
              label={f.unit ? `${specFieldLabel(f)} (${f.unit})` : specFieldLabel(f)}
              keyboardType={f.kind === 'number' ? 'decimal-pad' : 'default'}
              value={effects[f.key] ?? ''}
              onChangeText={(t) => setEffects((e) => ({ ...e, [f.key]: t }))}
            />
          ))
        : null}

      {eyebrow(t.modForm.photos)}
      {photos.length ? (
        <View style={styles.photos}>
          {photos.map((p) => (
            <PhotoThumb key={p.id} mediaId={p.mediaId} size={96} onPress={() => void cycleRole(p)} onLongPress={() => void removeModPhoto(p.id).then(() => setPhotos((prev) => prev.filter((x) => x.id !== p.id)))} accessibilityLabel={t.modForm.roles[p.role]}>
              <View style={[styles.role, { backgroundColor: p.role === 'despues' ? theme.accentFill : 'rgba(18,18,18,0.75)' }]}>
                <T face="eyebrow" style={{ color: p.role === 'despues' ? theme.accentFillInk : '#EDEDED', fontSize: 9 }}>
                  {t.modForm.roles[p.role]}
                </T>
              </View>
            </PhotoThumb>
          ))}
        </View>
      ) : null}
      <GhostButton label={t.modForm.addPhotos} onPress={() => void addPhotos()} />

      {others.length ? (
        <>
          {eyebrow(t.modForm.replaces)}
          <View style={styles.chips}>
            <Chip label={t.modForm.replacesNone} selected={!replaces} onPress={() => setReplaces(null)} />
            {others.map((m) => (
              <Chip key={m.id} label={m.name} selected={replaces === m.id} onPress={() => setReplaces(m.id)} />
            ))}
          </View>
        </>
      ) : null}

      <Field label={t.modForm.tags} placeholder={t.modForm.tagsPlaceholder} value={tags} onChangeText={setTags} autoCapitalize="none" />
      <Field label={t.modForm.notes} value={notes} onChangeText={setNotes} multiline />

      {error ? (
        <T face="body" style={{ color: theme.dangerText, fontSize: 13, marginBottom: space.sm }}>
          {error}
        </T>
      ) : null}
      <PrimaryButton label={t.modForm.save} onPress={() => void save()} />
      {modId ? <GhostButton danger label={t.modForm.delete} onPress={remove} /> : null}
      <View style={{ height: space.xl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 48 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: space.sm },
  pair: { flexDirection: 'row', gap: space.sm },
  fx: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: 1, borderRadius: radius.input, paddingHorizontal: space.md, paddingVertical: 4, marginBottom: space.md },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginVertical: space.md },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: space.sm },
  role: { position: 'absolute', left: 4, bottom: 4, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3 },
});
