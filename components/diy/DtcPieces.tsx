import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { DateField } from '@/components/DateField';
import { Field } from '@/components/Field';
import { T } from '@/components/T';
import { Chip, GhostButton, PrimaryButton, Sheet } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { createRepairForDtc, linkDtcRepair, logDtc, repairsFor, setDtcResolved } from '@/lib/db/diyQueries';
import type { ServiceRecord, VehicleDtcEvent } from '@/lib/db/types';
import { lookup, normalizeCode, type Dtc } from '@/lib/domain/dtc';
import { parseDecimal } from '@/lib/domain/economy';
import { dateLabel, isoFromDateInput, km as fmtKm, todayIsoDate } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

/** A code's description card: Spanish first, English below, and the generic/manufacturer note. */
export function DtcCard({ dtc, code }: { dtc: Dtc | null; code: string }) {
  const { theme } = useTheme();
  const manufacturer = dtc ? !dtc.isGeneric : /^[PBCU][13]/.test(code);
  return (
    <View style={[styles.card, { backgroundColor: theme.bg.surface, borderColor: theme.lineStrong }]}>
      <T face="monoBold" style={{ color: theme.accent, fontSize: 24 }}>
        {code}
      </T>
      <T face="semibold" style={{ color: theme.text.primary, fontSize: 16 }}>
        {dtc?.descEs ?? t.obd.notFound}
      </T>
      {dtc?.descEn ? (
        <>
          <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 10, marginTop: space.sm }}>
            {t.obd.english}
          </T>
          <T face="body" style={{ color: theme.text.secondary, fontSize: 13 }}>
            {dtc.descEn}
          </T>
        </>
      ) : null}
      <T face="body" style={{ color: manufacturer ? theme.statusText.urgente : theme.text.muted, fontSize: 12, marginTop: space.sm }}>
        {manufacturer ? t.obd.manufacturer : t.obd.generic}
      </T>
    </View>
  );
}

/** "Anotar este código": which car, when, at what km. */
export function DtcLogSheet({ visible, code, vehicleId, onClose, onSaved }: { visible: boolean; code: string; vehicleId?: string; onClose: () => void; onSaved: () => void }) {
  const { data, activeVehicle } = useStore();
  const [target, setTarget] = useState(vehicleId ?? activeVehicle?.id ?? '');
  const [date, setDate] = useState(todayIsoDate());
  const [km, setKm] = useState('');
  const [notes, setNotes] = useState('');
  const cars = data.vehicles.filter((v) => !v.isArchived);

  async function save() {
    if (!target || !normalizeCode(code)) return;
    await logDtc({ vehicleId: target, code, seenAt: isoFromDateInput(date), odometerKm: km.trim() ? parseDecimal(km) : null, notes: notes.trim() });
    setKm('');
    setNotes('');
    onSaved();
  }

  return (
    <Sheet visible={visible} onClose={onClose} title={`${t.obd.log} · ${code}`}>
      <ScrollView style={{ maxHeight: 480 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: space.sm }}>
          {cars.map((v) => (
            <Chip key={v.id} label={v.name} selected={target === v.id} onPress={() => setTarget(v.id)} />
          ))}
        </View>
        <DateField label={t.obd.seenAt} value={date} onChange={setDate} noFuture />
        <Field label={t.obd.km} keyboardType="number-pad" value={km} onChangeText={setKm} />
        <Field label={t.obd.notes} value={notes} onChangeText={setNotes} multiline />
        <PrimaryButton label={t.obd.save} onPress={() => void save()} />
      </ScrollView>
    </Sheet>
  );
}

/**
 * One logged code: when, km, open/resolved, the linked repair — and the
 * actions (resolve / reopen, link a repair or start one).
 */
export function DtcEventRow({ event, vehicleName, onChanged }: { event: VehicleDtcEvent; vehicleName?: string; onChanged: () => void }) {
  const router = useRouter();
  const { theme } = useTheme();
  const [linking, setLinking] = useState(false);
  const [repairs, setRepairs] = useState<ServiceRecord[]>([]);
  const [linkedRow, setLinkedRow] = useState<ServiceRecord | null>(null);
  // Only trusted while it is the record the event points at now.
  const linked = linkedRow && linkedRow.id === event.repairRecordId ? linkedRow : null;

  useEffect(() => {
    if (!event.repairRecordId) return;
    let cancelled = false;
    void repairsFor(event.vehicleId).then((rs) => !cancelled && setLinkedRow(rs.find((r) => r.id === event.repairRecordId) ?? null));
    return () => {
      cancelled = true;
    };
  }, [event.repairRecordId, event.vehicleId]);

  async function openLink() {
    setRepairs(await repairsFor(event.vehicleId));
    setLinking(true);
  }

  return (
    <View style={[styles.event, { backgroundColor: theme.bg.surface, borderColor: event.clearedAt ? theme.lineStrong : theme.status.urgente }]}>
      <View style={styles.eventHead}>
        <T face="monoBold" style={{ color: event.clearedAt ? theme.text.muted : theme.statusText.urgente, fontSize: 15 }}>
          {event.code}
        </T>
        <T face="mono" style={{ color: theme.text.muted, fontSize: 11, flex: 1 }}>
          {[vehicleName, dateLabel(event.seenAt), event.odometerKm != null ? fmtKm(Math.round(event.odometerKm)) : null].filter(Boolean).join(' · ')}
        </T>
        <T face="eyebrow" style={{ color: event.clearedAt ? theme.statusText.ok : theme.statusText.urgente, fontSize: 10 }}>
          {event.clearedAt ? t.obd.resolved : t.obd.open}
        </T>
      </View>
      {event.notes ? (
        <T face="body" style={{ color: theme.text.secondary, fontSize: 13 }}>
          {event.notes}
        </T>
      ) : null}
      {linked ? (
        <Pressable onPress={() => router.push({ pathname: '/servicio/[id]', params: { id: linked.id } })} accessibilityRole="link">
          <T face="semibold" style={{ color: theme.accent, fontSize: 13 }}>
            {t.obd.linked(linked.title)}
          </T>
        </Pressable>
      ) : null}
      <View style={styles.actions}>
        <GhostButton label={event.clearedAt ? t.obd.reopen : t.obd.markResolved} onPress={() => void setDtcResolved(event.id, !event.clearedAt).then(onChanged)} style={{ flex: 1 }} />
        <GhostButton label={t.obd.linkRepair} onPress={() => void openLink()} style={{ flex: 1 }} />
      </View>

      <Sheet visible={linking} onClose={() => setLinking(false)} title={t.obd.linkTitle}>
        <ScrollView style={{ maxHeight: 420 }}>
          <GhostButton
            label={t.obd.linkNew}
            onPress={() =>
              void createRepairForDtc(event, lookup(event.code)?.descEs ?? '').then((r) => {
                setLinking(false);
                onChanged();
                router.push({ pathname: '/servicio/[id]', params: { id: r.id } });
              })
            }
          />
          {repairs.map((r) => (
            <Pressable
              key={r.id}
              onPress={() => void linkDtcRepair(event.id, r.id).then(() => (setLinking(false), onChanged()))}
              accessibilityRole="button"
              style={[styles.repair, { borderColor: r.id === event.repairRecordId ? theme.accentFill : theme.lineStrong, backgroundColor: theme.bg.surface }]}>
              <T face="semibold" style={{ color: theme.text.primary, fontSize: 14 }}>
                {r.title}
              </T>
              <T face="mono" style={{ color: theme.text.muted, fontSize: 11 }}>
                {dateLabel(r.occurredAt)}
              </T>
            </Pressable>
          ))}
        </ScrollView>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.button, padding: space.md, gap: 4, marginBottom: space.md },
  event: { borderWidth: 1, borderRadius: radius.input, padding: space.md, gap: 6, marginBottom: space.sm },
  eventHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  actions: { flexDirection: 'row', gap: space.sm },
  repair: { borderWidth: 1, borderRadius: radius.input, padding: space.md, marginBottom: space.sm },
});
