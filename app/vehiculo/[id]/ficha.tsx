import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';

import { PhotoThumb } from '@/components/album/PhotoThumb';
import { Field } from '@/components/Field';
import { PhotoPicker } from '@/components/PhotoPicker';
import { T } from '@/components/T';
import { GhostButton, PrimaryButton, Sheet } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import {
  applyVin,
  listDtcEvents,
  listTorques,
  loadPreset,
  readFicha,
  saveTorque,
  setFichaValue,
  setVerified,
  type Ficha,
} from '@/lib/db/diyQueries';
import { torqueSpecs, vehicles as vehicleRepo } from '@/lib/db/repos';
import type { TorqueSpec, Vehicle, VehicleDtcEvent } from '@/lib/db/types';
import { lookup } from '@/lib/domain/dtc';
import { parseDecimal } from '@/lib/domain/economy';
import { FICHA_FIELDS, FICHA_SECTIONS, fichaText, formatFicha, presetsFor, SPEC_PRESETS, type FichaField } from '@/lib/domain/specPresets';
import { checkVin, decodeVin } from '@/lib/domain/vpic';
import { dateLabel, id as newId } from '@/lib/format';
import { es } from '@/lib/i18n/es';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * The ficha técnica (IMP 28092026 Phase 5, 03-screens.md Block D): the service
 * data a shop asks for, each value with where it came from (PRESET / VPIC / TÚ)
 * and whether the owner checked it against the manual. Presets and the VIN
 * only fill what is empty; nothing here blocks.
 */
export default function FichaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const { refresh } = useStore();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [torques, setTorques] = useState<TorqueSpec[]>([]);
  const [events, setEvents] = useState<VehicleDtcEvent[]>([]);
  const [editing, setEditing] = useState<FichaField | null>(null);
  const [value, setValue] = useState('');
  const [presetOpen, setPresetOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [vinBusy, setVinBusy] = useState(false);
  const [torque, setTorque] = useState<(Partial<TorqueSpec> & { id: string }) | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const [v, f, t, e] = await Promise.all([vehicleRepo.getById(id), readFicha(id), listTorques(id), listDtcEvents({ vehicleId: id })]);
    setVehicle(v);
    setFicha(f);
    setTorques(t);
    setEvents(e);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (!vehicle || !ficha) return <View style={{ flex: 1, backgroundColor: theme.bg.base }} />;

  async function saveValue(clear = false) {
    if (!editing) return;
    const raw = clear ? '' : value.trim();
    const v = !raw ? null : editing.kind === 'number' ? parseDecimal(raw) : raw;
    await setFichaValue(vehicle!.id, editing.key, v);
    setEditing(null);
    await load();
  }

  async function pickPreset(presetId: string) {
    const n = await loadPreset(vehicle!.id, presetId);
    setPresetOpen(false);
    setNotice(es.ficha.presetFilled(n));
    await load();
    refresh();
  }

  async function vin() {
    const check = checkVin(vehicle!.vin);
    if (!check.ok) {
      setNotice(check.reason === 'empty' ? es.ficha.vinNoVin : check.reason === 'frame' ? es.ficha.vinFrame : es.ficha.vinInvalid);
      return;
    }
    setVinBusy(true);
    setNotice(es.ficha.vinBusy);
    const res = await decodeVin(check.vin);
    setVinBusy(false);
    if (!res.ok) {
      setNotice(res.reason === 'not_decoded' ? es.ficha.vinFail : es.ficha.vinOffline);
      return;
    }
    const filled = await applyVin(vehicle!.id, res.decoded);
    setNotice(es.ficha.vinOk(filled.join(', ')));
    await load();
    refresh();
  }

  async function share() {
    const text = fichaText(vehicle!, ficha!.values, torques);
    try {
      if (Platform.OS === 'web') {
        const nav = navigator as Navigator & { share?: (d: { text: string }) => Promise<void> };
        if (nav.share) await nav.share({ text });
        else {
          await navigator.clipboard.writeText(text);
          setNotice(es.ficha.copied);
        }
      } else {
        await Share.share({ message: text });
      }
    } catch {
      // Dismissed: nothing to do.
    }
  }

  async function saveTorqueDraft() {
    if (!torque?.item?.trim() || torque.valueNm == null) return;
    await saveTorque({ ...torque, vehicleId: vehicle!.id, item: torque.item.trim(), valueNm: torque.valueNm });
    setTorque(null);
    await load();
  }

  const suggested = presetsFor(vehicle);
  const others = SPEC_PRESETS.filter((p) => !suggested.includes(p));
  const unverified = Object.keys(ficha.sources).filter((k) => ficha.values[k] != null && !ficha.verified.includes(k)).length;
  const hasAny = Object.values(ficha.values).some((v) => v != null);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg.base }}>
      <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
        <T face="eyebrow" style={{ color: theme.accent, fontSize: 11 }}>
          {es.ficha.eyebrow((vehicle.nickname || vehicle.name).toUpperCase())}
        </T>
        <T face="display" accessibilityRole="header" style={{ color: theme.text.primary, fontSize: 30, textTransform: 'uppercase' }}>
          {es.ficha.title}
        </T>
        <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginBottom: space.md }}>
          {[es.ficha.caveat, unverified ? es.ficha.unverifiedCount(unverified) : null].filter(Boolean).join(' · ')}
        </T>

        <View style={styles.row2}>
          <GhostButton label={es.ficha.loadPreset} onPress={() => setPresetOpen(true)} style={{ flex: 1 }} />
          <GhostButton label={vinBusy ? es.ficha.vinBusy : es.ficha.vin} disabled={vinBusy} onPress={() => void vin()} style={{ flex: 1 }} />
        </View>
        {notice ? (
          <T face="body" accessibilityLiveRegion="polite" style={[styles.notice, { color: theme.text.secondary, backgroundColor: theme.bg.surface, borderColor: theme.lineStrong }]}>
            {notice}
          </T>
        ) : null}
        {!hasAny ? (
          <T face="body" style={{ color: theme.text.secondary, fontSize: 14, marginBottom: space.md }}>
            {es.ficha.empty}
          </T>
        ) : null}

        {FICHA_SECTIONS.map((s) => (
          <View key={s.key} style={[styles.card, { backgroundColor: theme.bg.surface, borderColor: theme.lineStrong }]}>
            <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11, paddingVertical: 6 }}>
              {s.label}
            </T>
            {FICHA_FIELDS.filter((f) => f.section === s.key).map((f) => {
              const v = ficha.values[f.key];
              const source = v != null ? ficha.sources[f.key] : undefined;
              const verified = ficha.verified.includes(f.key);
              return (
                <View key={f.key} style={[styles.fieldRow, { borderTopColor: theme.line }]}>
                  <Pressable
                    onPress={() => {
                      setEditing(f);
                      setValue(v != null ? String(v) : '');
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`${f.label}: ${formatFicha(f.key, v)}${source ? `, ${es.ficha.sources[source] ?? source}` : ''}${verified ? `, ${es.ficha.verified}` : ''}`}
                    style={styles.fieldMain}>
                    <T face="body" style={{ color: theme.text.secondary, fontSize: 14, flex: 1 }}>
                      {f.label}
                    </T>
                    <View style={{ alignItems: 'flex-end' }}>
                      <T face="mono" style={{ color: v != null ? theme.text.primary : theme.text.muted, fontSize: 13 }}>
                        {formatFicha(f.key, v)}
                      </T>
                      {source ? (
                        <T face="eyebrow" style={{ color: source === 'user' ? theme.statusText.ok : theme.accent, fontSize: 9 }}>
                          {es.ficha.sources[source] ?? source}
                        </T>
                      ) : null}
                    </View>
                  </Pressable>
                  {v != null ? (
                    <Pressable
                      onPress={() => void setVerified(vehicle.id, f.key, !verified).then(load)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: verified }}
                      accessibilityLabel={`${es.ficha.verified}: ${f.label}`}
                      hitSlop={6}
                      style={[styles.check, { borderColor: verified ? theme.statusText.ok : theme.lineStrong, backgroundColor: verified ? `${theme.statusText.ok}22` : 'transparent' }]}>
                      {verified ? <Ionicons name="checkmark" size={16} color={theme.statusText.ok} /> : null}
                    </Pressable>
                  ) : (
                    <View style={styles.check} />
                  )}
                </View>
              );
            })}
          </View>
        ))}

        <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11, marginTop: space.md, marginBottom: space.sm }}>
          {es.ficha.torques}
        </T>
        {torques.map((t) => (
          <Pressable key={t.id} onPress={() => setTorque({ ...t })} accessibilityRole="button" accessibilityLabel={`${t.item}: ${t.valueNm} Nm`} style={[styles.torque, { backgroundColor: theme.bg.surface, borderColor: theme.lineStrong }]}>
            {t.mediaId ? <PhotoThumb mediaId={t.mediaId} size={44} /> : null}
            <View style={{ flex: 1 }}>
              <T face="semibold" style={{ color: theme.text.primary, fontSize: 14 }}>
                {t.item}
              </T>
              {t.stage || t.source ? (
                <T face="body" style={{ color: theme.text.muted, fontSize: 12 }}>
                  {[t.stage, t.source].filter(Boolean).join(' · ')}
                </T>
              ) : null}
            </View>
            <T face="monoBold" style={{ color: theme.text.primary, fontSize: 14 }}>
              {`${t.valueNm} Nm`}
            </T>
          </Pressable>
        ))}
        <GhostButton label={es.ficha.torqueAdd} onPress={() => setTorque({ id: newId(), item: '', valueNm: undefined })} />

        <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11, marginTop: space.md, marginBottom: space.sm }}>
          {es.ficha.obd}
        </T>
        {events.map((e) => (
          <Pressable key={e.id} onPress={() => router.push({ pathname: '/obd/[code]', params: { code: e.code, vehicleId: vehicle.id } })} accessibilityRole="button" style={[styles.torque, { backgroundColor: theme.bg.surface, borderColor: theme.lineStrong }]}>
            <T face="monoBold" style={{ color: e.clearedAt ? theme.text.muted : theme.statusText.urgente, fontSize: 14 }}>
              {e.code}
            </T>
            <T face="body" numberOfLines={1} style={{ color: theme.text.secondary, fontSize: 13, flex: 1 }}>
              {lookup(e.code)?.descEs ?? ''}
            </T>
            <T face="mono" style={{ color: theme.text.muted, fontSize: 11 }}>
              {`${dateLabel(e.seenAt)} · ${e.clearedAt ? es.obd.resolved : es.obd.open}`}
            </T>
          </Pressable>
        ))}
        <GhostButton label={es.ficha.obdAll} onPress={() => router.push({ pathname: '/obd', params: { vehicleId: vehicle.id } })} />
        <GhostButton label={es.ficha.fluids} onPress={() => router.push({ pathname: '/vehiculo/[id]/fluidos', params: { id: vehicle.id } })} />
        <View style={{ marginTop: space.md }}>
          <PrimaryButton label={es.ficha.share} disabled={!hasAny} onPress={() => void share()} />
        </View>
      </ScrollView>

      <Sheet visible={Boolean(editing)} onClose={() => setEditing(null)} title={editing ? es.ficha.edit(editing.label) : ''}>
        <Field
          label={editing?.unit ? `${editing.label} (${editing.unit})` : editing?.label ?? ''}
          value={value}
          onChangeText={setValue}
          keyboardType={editing?.kind === 'number' ? 'decimal-pad' : 'default'}
          autoFocus
        />
        <PrimaryButton label={es.ficha.save} onPress={() => void saveValue()} />
        {editing && ficha.values[editing.key] != null ? <GhostButton danger label={es.ficha.clear} onPress={() => void saveValue(true)} /> : null}
      </Sheet>

      <Sheet visible={presetOpen} onClose={() => setPresetOpen(false)} title={es.ficha.presetTitle}>
        <ScrollView style={{ maxHeight: 460 }}>
          <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginBottom: space.sm }}>
            {es.ficha.caveat}
          </T>
          {[
            { title: es.ficha.presetSuggested, list: suggested },
            { title: es.ficha.presetOthers, list: others },
          ].map((g) =>
            g.list.length ? (
              <View key={g.title} style={{ marginBottom: space.md }}>
                <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11, marginBottom: space.sm }}>
                  {g.title}
                </T>
                {g.list.map((p) => (
                  <Pressable key={p.id} onPress={() => void pickPreset(p.id)} accessibilityRole="button" style={[styles.preset, { borderColor: theme.lineStrong, backgroundColor: theme.bg.surface }]}>
                    <T face="semibold" style={{ color: theme.text.primary, fontSize: 15 }}>
                      {p.label}
                    </T>
                    <T face="body" style={{ color: theme.text.muted, fontSize: 12 }}>
                      {p.sources.join(' · ')}
                    </T>
                  </Pressable>
                ))}
              </View>
            ) : null,
          )}
        </ScrollView>
      </Sheet>

      <Sheet visible={Boolean(torque)} onClose={() => setTorque(null)} title={es.ficha.torques}>
        {torque ? (
          <ScrollView style={{ maxHeight: 520 }} keyboardShouldPersistTaps="handled">
            <Field label={es.ficha.torqueItem} placeholder={es.ficha.torqueItemPlaceholder} value={torque.item ?? ''} onChangeText={(t) => setTorque((x) => x && { ...x, item: t })} />
            <Field
              label={es.ficha.torqueValue}
              keyboardType="decimal-pad"
              value={torque.valueNm != null ? String(torque.valueNm) : ''}
              onChangeText={(t) => setTorque((x) => x && { ...x, valueNm: t.trim() ? parseDecimal(t) ?? undefined : undefined })}
            />
            <Field label={es.ficha.torqueStage} value={torque.stage ?? ''} onChangeText={(t) => setTorque((x) => x && { ...x, stage: t || null })} />
            <Field label={es.ficha.torqueSource} value={torque.source ?? ''} onChangeText={(t) => setTorque((x) => x && { ...x, source: t || null })} />
            <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11, marginBottom: space.sm }}>
              {es.ficha.torquePhoto}
            </T>
            <PhotoPicker mediaId={torque.mediaId ?? null} ownerTable="torque_spec" ownerId={torque.id} vehicleId={vehicle.id} onChange={(mediaId) => setTorque((x) => x && { ...x, mediaId })} height={140} />
            <PrimaryButton label={es.ficha.save} onPress={() => void saveTorqueDraft()} />
            {torques.some((t) => t.id === torque.id) ? (
              <GhostButton danger label={es.ficha.torqueDelete} onPress={() => void torqueSpecs.softDelete(torque.id).then(() => (setTorque(null), load()))} />
            ) : null}
          </ScrollView>
        ) : null}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 48 },
  row2: { flexDirection: 'row', gap: space.sm },
  notice: { borderWidth: 1, borderRadius: radius.input, padding: space.sm, fontSize: 13, marginBottom: space.md },
  card: { borderWidth: 1, borderRadius: radius.button, paddingHorizontal: space.md, paddingVertical: space.xs, marginBottom: space.md },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderTopWidth: StyleSheet.hairlineWidth },
  fieldMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 8, minHeight: 48 },
  check: { width: 28, height: 28, borderRadius: 6, borderWidth: 1, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  torque: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: 1, borderRadius: radius.input, padding: space.sm, marginBottom: space.sm, minHeight: 48 },
  preset: { borderWidth: 1, borderRadius: radius.input, padding: space.md, marginBottom: space.sm },
});
