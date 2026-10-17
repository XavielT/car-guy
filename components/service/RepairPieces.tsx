import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { DateField } from '@/components/DateField';
import { Field } from '@/components/Field';
import { PhotoPicker } from '@/components/PhotoPicker';
import { SelectField } from '@/components/pickers';
import { T } from '@/components/T';
import { radius, space } from '@/constants/theme';
import { listOpenPendings, type PendingChoice } from '@/lib/db/serviceOps';
import type { DoneBy, ServiceCategory, ServiceMediaRole } from '@/lib/db/types';
import { WARRANTY_CHOICES, warrantyChoiceOf, warrantyEnd, type WarrantyChoice } from '@/lib/domain/repairs';
import { dateInputFromIso, dateLabel, isoFromDateInput } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useMediaUri } from '@/lib/media/useMediaUri';
import { useTheme } from '@/lib/theme/useTheme';

/** The systems a repair can touch, in the order people think of them. */
export const REPAIR_SYSTEMS: ServiceCategory[] = ['motor', 'frenos', 'gomas', 'fluidos', 'electrico', 'suspension', 'carroceria', 'filtros', 'otro'];
export const DONE_BY: DoneBy[] = ['self', 'shop', 'friend', 'other'];

export function SystemSelect({ value, onChange }: { value: ServiceCategory | null; onChange: (v: ServiceCategory | null) => void }) {
  return (
    <SelectField<ServiceCategory | null>
      label={t.repair.systemLabel}
      value={value}
      allowNone
      options={REPAIR_SYSTEMS.map((s) => ({ value: s, label: t.repair.systems[s] }))}
      onChange={onChange}
    />
  );
}

export function DoneBySelect({ value, onChange }: { value: DoneBy; onChange: (v: DoneBy) => void }) {
  return <SelectField<DoneBy> label={t.repair.doneByLabel} value={value} options={DONE_BY.map((d) => ({ value: d, label: t.repair.doneBy[d] }))} onChange={onChange} />;
}

/**
 * The warranty as a quick choice (Sin garantía · 30 días · 90 días · 6 meses · 1 año · Otra…): a quick choice fills the
 * end date from the repair's own date and keeps following it if the date is edited; "Otra…" opens the date and the km.
 * The parent keeps `date` / `km` as the form's text, exactly as before.
 */
export function WarrantyPicker({
  repairDate,
  date,
  km,
  onChange,
}: {
  /** The repair's date in the form's `YYYY-MM-DD` input format. */
  repairDate: string;
  date: string;
  km: string;
  onChange: (next: { date: string; km: string }) => void;
}) {
  const repairedIso = isoFromDateInput(repairDate);
  // What the stored values are (so an edit shows "90 días"), unless the person has picked something this visit.
  const [picked, setPicked] = useState<WarrantyChoice | null>(null);
  const choice = picked ?? warrantyChoiceOf(repairedIso, date ? isoFromDateInput(date) : null, km.trim() ? Number(km) : null);

  // A quick choice counts from the repair's date: change the date and the end moves with it.
  useEffect(() => {
    if (choice === 'none' || choice === 'other') return;
    const next = dateInputFromIso(warrantyEnd(choice, repairedIso));
    if (next !== date) onChange({ date: next, km });
  }, [repairDate, choice]); // eslint-disable-line react-hooks/exhaustive-deps

  function pick(next: WarrantyChoice) {
    setPicked(next);
    if (next === 'none') onChange({ date: '', km: '' });
    else if (next !== 'other') onChange({ date: dateInputFromIso(warrantyEnd(next, repairedIso)), km });
  }

  return (
    <>
      <SelectField<WarrantyChoice>
        label={t.repair.warrantyLabel}
        value={choice}
        options={WARRANTY_CHOICES.map((c) => ({ value: c, label: t.repair.warranty[c], hint: c !== 'none' && c !== 'other' ? t.repair.warrantyUntil(dateLabel(warrantyEnd(c, repairedIso))) : undefined }))}
        onChange={pick}
      />
      {choice === 'other' ? (
        <>
          <DateField label={t.service.warrantyDate} value={date} onChange={(d) => onChange({ date: d, km })} />
          <Field label={t.repair.warrantyKmLabel} keyboardType="number-pad" value={km} onChangeText={(k) => onChange({ date, km: k })} />
        </>
      ) : null}
    </>
  );
}

/** Which Pendiente the repair closes: events with a pending text, then open tasks (X7). */
export function PendingPicker({ vehicleId, value, onChange }: { vehicleId: string; value: string | null; onChange: (key: string | null, choice: PendingChoice | null) => void }) {
  const [items, setItems] = useState<PendingChoice[] | null>(null);
  useEffect(() => {
    let live = true;
    void listOpenPendings(vehicleId).then((rows) => live && setItems(rows)).catch(() => live && setItems([]));
    return () => {
      live = false;
    };
  }, [vehicleId]);
  // Nothing to resolve: nothing to show (a form that always asks for an empty list is noise).
  if (!items || (!items.length && !value)) return null;
  return (
    <SelectField<string | null>
      label={t.repair.pendingLabel}
      value={value}
      allowNone={t.repair.pendingNone}
      hint={t.repair.pendingHint}
      options={items.map((p) => ({ value: p.key, label: p.title }))}
      onChange={(key) => onChange(key, items.find((p) => p.key === key) ?? null)}
    />
  );
}

// ── Photos with a role ──────────────────────────────────────────────────────

export type PhotoSlots = { before: string | null; after: string | null; invoice: string | null; others: string[] };
export const NO_PHOTOS: PhotoSlots = { before: null, after: null, invoice: null, others: [] };

/** The slots as the links `saveServiceRecord` replaces (Antes, Después, Factura, then the others). */
export function slotsToLinks(s: PhotoSlots): { mediaId: string; role: ServiceMediaRole }[] {
  return [
    ...(s.before ? [{ mediaId: s.before, role: 'before' as const }] : []),
    ...(s.after ? [{ mediaId: s.after, role: 'after' as const }] : []),
    ...(s.invoice ? [{ mediaId: s.invoice, role: 'invoice' as const }] : []),
    ...s.others.map((mediaId) => ({ mediaId, role: 'other' as const })),
  ];
}

/** Links back into slots: the first of each named role takes its slot, the rest are "otras". */
export function linksToSlots(links: { mediaId: string; role: ServiceMediaRole }[]): PhotoSlots {
  const out: PhotoSlots = { before: null, after: null, invoice: null, others: [] };
  for (const l of links) {
    if (l.role !== 'other' && out[l.role] == null) out[l.role] = l.mediaId;
    else out.others.push(l.mediaId);
  }
  return out;
}

export function RepairPhotos({ recordId, vehicleId, value, onChange }: { recordId: string; vehicleId: string; value: PhotoSlots; onChange: (next: PhotoSlots) => void }) {
  const { theme } = useTheme();
  const slot = (role: 'before' | 'after' | 'invoice') => (
    <View key={role} style={styles.slot}>
      <T face="eyebrow" style={{ color: theme.text.secondary, fontSize: 11, marginBottom: 4 }}>
        {t.repair.slots[role]}
      </T>
      <PhotoPicker
        mediaId={value[role]}
        ownerTable="service_record"
        ownerId={recordId}
        vehicleId={vehicleId}
        height={110}
        onChange={(id) => onChange({ ...value, [role]: id })}
      />
    </View>
  );
  return (
    <View>
      <View style={styles.slots}>{(['before', 'after', 'invoice'] as const).map(slot)}</View>
      <T face="eyebrow" style={{ color: theme.text.secondary, fontSize: 11, marginTop: space.sm, marginBottom: 4 }}>
        {t.repair.slots.other}
      </T>
      <View style={styles.others}>
        {value.others.map((id) => (
          <OtherThumb key={id} mediaId={id} onRemove={() => onChange({ ...value, others: value.others.filter((x) => x !== id) })} />
        ))}
      </View>
      <PhotoPicker
        mediaId={null}
        ownerTable="service_record"
        ownerId={recordId}
        vehicleId={vehicleId}
        height={80}
        onChange={(id) => id && onChange({ ...value, others: [...value.others, id] })}
      />
    </View>
  );
}

function OtherThumb({ mediaId, onRemove }: { mediaId: string; onRemove: () => void }) {
  const { theme } = useTheme();
  const uri = useMediaUri(mediaId);
  return (
    <View style={[styles.thumb, { backgroundColor: theme.bg.raised, borderColor: theme.line }]}>
      {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors /> : null}
      <Pressable onPress={onRemove} accessibilityRole="button" accessibilityLabel={t.common.removePhoto} hitSlop={8} style={styles.thumbX}>
        <Ionicons name="close" size={16} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  slot: { width: '48%', flexGrow: 1 },
  others: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.sm },
  thumb: { width: 72, height: 72, borderRadius: radius.input, borderWidth: 1, overflow: 'hidden' },
  thumbX: { position: 'absolute', top: 0, right: 0, width: 44, height: 44, alignItems: 'flex-end', padding: 6 },
});
