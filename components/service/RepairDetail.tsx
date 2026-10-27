import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { ContactButtons } from '@/components/diy/ContactPieces';
import { T } from '@/components/T';
import { GhostButton, Surface } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { contacts as contactRepo, milestones as milestoneRepo, tasks as taskRepo } from '@/lib/db/repos';
import { clearUndo, useUndoOffer } from '@/lib/db/resolvedPendingStore';
import { loadServiceMedia, undoResolvedPending } from '@/lib/db/serviceOps';
import type { Contact, ServiceMediaRole, ServiceRecord } from '@/lib/db/types';
import { todayIso } from '@/lib/domain/dates';
import { warrantyState } from '@/lib/domain/repairs';
import { dateLabel, km as fmtKm } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useMediaUri } from '@/lib/media/useMediaUri';
import { useTheme } from '@/lib/theme/useTheme';

type Link = { mediaId: string; role: ServiceMediaRole };

/**
 * What a repair adds to the service detail (IMP 16102026 N7/X7): who did it and the system, the shop with call /
 * WhatsApp, the photos by role (Antes y después side by side, the invoice), the warranty counting down, and the
 * Pendiente it closed — with "Deshacer" for 10 s right after saving.
 */
export function RepairDetail({ record, version }: { record: ServiceRecord; version: unknown }) {
  const { theme } = useTheme();
  const router = useRouter();
  const [links, setLinks] = useState<Link[]>([]);
  const [contact, setContact] = useState<Contact | null>(null);
  // Bumped after "Deshacer": the closed Pendiente line has to be read again (found on the phone: it stayed on screen).
  const [tick, setTick] = useState(0);
  const [closed, setClosed] = useState<{ kind: 'event' | 'task'; id: string; title: string } | null>(null);

  useEffect(() => {
    let live = true;
    void (async () => {
      const [media, c, events, tasks] = await Promise.all([
        loadServiceMedia(record.id),
        record.contactId ? contactRepo.getById(record.contactId) : Promise.resolve(null),
        milestoneRepo.listWhere({ vehicleId: record.vehicleId }),
        taskRepo.listWhere({ vehicleId: record.vehicleId }),
      ]);
      if (!live) return;
      setLinks(media);
      setContact(c);
      const event = events.find((e) => e.linkedServiceId === record.id && e.resolvedAt);
      const task = tasks.find((x) => x.doneRecordId === record.id);
      setClosed(event ? { kind: 'event', id: event.id, title: event.pending || event.title } : task ? { kind: 'task', id: task.id, title: task.title } : null);
    })().catch(() => {});
    return () => {
      live = false;
    };
  }, [record.id, record.contactId, record.vehicleId, version, tick]);

  const first = (role: ServiceMediaRole) => links.find((l) => l.role === role)?.mediaId ?? null;
  const before = first('before');
  const after = first('after');
  const invoice = first('invoice');
  const others = links.filter((l) => l.role === 'other').map((l) => l.mediaId);
  const warranty = warrantyState(record.warrantyUntilDate, todayIso());
  const system = record.system ? t.repair.systems[record.system] : null;
  const who = t.repair.doneBy[record.doneBy];
  const undo = useUndoOffer();
  const offer = undo && undo.recordId === record.id ? undo : null;

  return (
    <>
      {offer ? (
        <View accessibilityLiveRegion="polite" style={[styles.toast, { backgroundColor: theme.bg.raised, borderColor: theme.accent }]}>
          <T face="body" style={{ color: theme.text.primary, fontSize: 13, flex: 1 }}>
            {t.repair.resolved(offer.resolved.title)}
          </T>
          <Pressable
            onPress={() => {
              void undoResolvedPending(offer.resolved).then(() => {
                clearUndo();
                setTick((n) => n + 1);
              });
            }}
            accessibilityRole="button"
            style={styles.toastBtn}>
            <T face="semibold" style={{ color: theme.accent, fontSize: 14 }}>
              {t.repair.undo}
            </T>
          </Pressable>
        </View>
      ) : null}

      <T face="body" style={{ color: theme.text.secondary, fontSize: 13, marginBottom: space.sm }}>
        {t.repair.detail.doneBy(who)}
        {system ? ` · ${system}` : ''}
      </T>

      {record.doneBy !== 'self' && (record.shop || contact) ? (
        <Surface style={{ marginBottom: space.md }}>
          <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11 }}>
            {t.repair.detail.shop}
          </T>
          <T face="semibold" style={{ color: theme.text.primary, fontSize: 16, marginTop: 2 }}>
            {contact?.name ?? record.shop}
          </T>
          {contact ? <ContactButtons contact={contact} /> : null}
        </Surface>
      ) : null}

      {before || after ? (
        <>
          <T face="eyebrow" accessibilityRole="header" style={[styles.section, { color: theme.text.muted }]}>
            {t.repair.detail.compare}
          </T>
          <View style={styles.compare}>
            {before ? <Shot mediaId={before} label={t.repair.slots.before} /> : null}
            {after ? <Shot mediaId={after} label={t.repair.slots.after} /> : null}
          </View>
        </>
      ) : null}
      {invoice ? (
        <>
          <T face="eyebrow" accessibilityRole="header" style={[styles.section, { color: theme.text.muted }]}>
            {t.repair.detail.invoice}
          </T>
          <Shot mediaId={invoice} label={t.repair.slots.invoice} wide />
        </>
      ) : null}
      {others.length ? (
        <>
          <T face="eyebrow" accessibilityRole="header" style={[styles.section, { color: theme.text.muted }]}>
            {t.repair.detail.photos}
          </T>
          <View style={styles.compare}>
            {others.map((id) => (
              <Shot key={id} mediaId={id} label={t.repair.slots.other} />
            ))}
          </View>
        </>
      ) : null}

      {warranty.state !== 'none' || record.warrantyUntilKm != null ? (
        <Surface style={{ marginBottom: space.md, marginTop: space.md }}>
          <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11 }}>
            {t.repair.detail.warranty}
          </T>
          {record.warrantyUntilDate ? (
            <T face="semibold" style={{ color: warranty.state === 'expired' ? theme.text.muted : warranty.days <= 14 ? theme.statusText.proximo : theme.statusText.ok, fontSize: 15, marginTop: 2 }}>
              {warranty.state === 'active' ? t.repair.detail.warrantyLeft(warranty.days) : warranty.state === 'today' ? t.repair.detail.warrantyToday : t.repair.detail.warrantyExpired(warranty.days)}
              <T face="mono" style={{ fontSize: 12, color: theme.text.secondary }}>
                {`  ·  ${dateLabel(record.warrantyUntilDate)}`}
              </T>
            </T>
          ) : null}
          {record.warrantyUntilKm != null ? (
            <T face="body" style={{ color: theme.text.secondary, fontSize: 13, marginTop: 2 }}>
              {t.repair.detail.warrantyKm(fmtKm(record.warrantyUntilKm))}
            </T>
          ) : null}
        </Surface>
      ) : null}

      {closed ? (
        <Pressable
          onPress={() => (closed.kind === 'task' ? router.push({ pathname: '/tarea/[id]', params: { id: closed.id } }) : router.push({ pathname: '/vehiculo/[id]', params: { id: record.vehicleId, tab: 'eventos' } }))}
          accessibilityRole="link"
          style={{ minHeight: 44, justifyContent: 'center' }}>
          <T face="body" style={{ color: theme.accent, fontSize: 13 }}>
            {t.repair.detail.resolvedPending(closed.title)}
          </T>
        </Pressable>
      ) : null}
    </>
  );
}

function Shot({ mediaId, label, wide }: { mediaId: string | null; label: string; wide?: boolean }) {
  const { theme } = useTheme();
  const uri = useMediaUri(mediaId);
  return (
    <View style={wide ? styles.wide : styles.half}>
      <View style={[styles.shot, { backgroundColor: theme.bg.raised, borderColor: theme.line, height: wide ? 200 : 140 }]}>
        {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityLabel={label} accessibilityIgnoresInvertColors /> : null}
      </View>
      <T face="body" style={{ color: theme.text.muted, fontSize: 11, marginTop: 4 }}>
        {label}
      </T>
    </View>
  );
}

/** "Registrar reparación" / "Resolver con una reparación" button used by the Pendiente cards. */
export function ResolveButton({ onPress, label }: { onPress: () => void; label?: string }) {
  return <GhostButton label={label ?? t.repair.resolveWith} onPress={onPress} />;
}

const styles = StyleSheet.create({
  toast: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: 1, borderRadius: radius.button, paddingLeft: space.md, marginBottom: space.md },
  toastBtn: { minHeight: 44, minWidth: 44, paddingHorizontal: space.md, alignItems: 'center', justifyContent: 'center' },
  section: { fontSize: 12, marginTop: space.lg, marginBottom: space.sm },
  compare: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  half: { width: '48%', flexGrow: 1 },
  wide: { width: '100%' },
  shot: { borderRadius: radius.input, borderWidth: 1, overflow: 'hidden' },
});
