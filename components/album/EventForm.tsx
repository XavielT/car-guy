import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState, type ReactNode } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Switch, View, useWindowDimensions } from 'react-native';

import { DateField } from '@/components/DateField';
import { Field } from '@/components/Field';
import { useFormSkeleton } from '@/components/skeletons/FormLoading';
import { T } from '@/components/T';
import { Chip, GhostButton, PrimaryButton, Segmented, Sheet } from '@/components/ui';
import { FormSkeleton } from '@/components/ui/Skeleton';
import { radius, space } from '@/constants/theme';
import { Alert } from '@/lib/alert';
import {
  albumPhotos,
  deleteMilestone,
  linkPhotosToMilestone,
  markEventProofs,
  milestonePdfs,
  milestonePhotoIds,
  saveMilestone,
  type AlbumPhoto,
} from '@/lib/db/albumQueries';
import { inspections as inspectionRepo, media as mediaRepo, milestones as milestoneRepo, mods as modRepo, serviceRecords as serviceRepo } from '@/lib/db/repos';
import type { Media, MilestoneKind } from '@/lib/db/types';
import { dateAtPrecision } from '@/lib/domain/album';
import { EVENT_TYPES, SEVERITIES, eventFieldsFromDraft, type EventType, type Severity } from '@/lib/domain/events';
import { dateLabel, id as newId, todayIsoDate } from '@/lib/format';
import { t } from '@/lib/i18n';
import { importCandidates, pickCandidates } from '@/lib/media';
import { openPdf, pickPdf } from '@/lib/media/pdf';
import { useTheme } from '@/lib/theme/useTheme';
import { PhotoThumb } from './PhotoThumb';

const HITO_KINDS: MilestoneKind[] = ['compra', 'swap', 'restauracion', 'primer_track', 'pintura', 'venta', 'otro'];

type LinkKind = 'service' | 'mod' | 'check';
type LinkOption = { id: string; title: string; sub: string };

/**
 * An event (IMP 30092026 note 5, ADR-44) — and a hito is an event of type
 * 'hito'. Type chips with icons; severity for anything but a hito; date, km,
 * story, cost; what is still pending and "Resuelto"; proofs (photos from the
 * album or new, PDFs); links to a service / mod / check; the place. Replaces
 * the 2.3 milestone form (app/hito/* redirect here).
 *
 * Editing, its fields stay a `skeleton` (the screen's twin) until the row is
 * read — at once when the screen was already showing it (`skeletonContinued`).
 */
export function EventForm({
  vehicleId,
  milestoneId,
  initialType,
  onDone,
  skeleton,
  skeletonContinued,
}: {
  vehicleId: string;
  milestoneId?: string;
  initialType?: EventType;
  onDone: () => void;
  skeleton?: ReactNode;
  skeletonContinued?: boolean;
}) {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  // The id exists from the start so new photos and PDFs can be linked before the save.
  const [id] = useState(milestoneId ?? newId());
  const [eventType, setEventType] = useState<EventType>(initialType ?? 'hito');
  const [kind, setKind] = useState<MilestoneKind>('otro');
  const [severity, setSeverity] = useState<Severity>('leve');
  const [date, setDate] = useState(todayIsoDate());
  const [km, setKm] = useState('');
  const [title, setTitle] = useState('');
  const [story, setStory] = useState('');
  const [cost, setCost] = useState('');
  const [pending, setPending] = useState('');
  const [resolved, setResolved] = useState(false);
  const [resolvedAt, setResolvedAt] = useState<string | null>(null);
  const [location, setLocation] = useState('');
  const [links, setLinks] = useState<Record<LinkKind, string | null>>({ service: null, mod: null, check: null });
  const [options, setOptions] = useState<Record<LinkKind, LinkOption[]>>({ service: [], mod: [], check: [] });
  const [linkPicker, setLinkPicker] = useState<LinkKind | null>(null);
  const [photoIds, setPhotoIds] = useState<string[]>([]);
  const [initialIds, setInitialIds] = useState<string[]>([]);
  const [newIds, setNewIds] = useState<string[]>([]);
  const [pdfs, setPdfs] = useState<Media[]>([]);
  const [cover, setCover] = useState<string | null>(null);
  const [album, setAlbum] = useState<AlbumPhoto[]>([]);
  const [picking, setPicking] = useState(false);
  // Photos or a PDF still being stored: saving now would leave them off the event.
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!milestoneId);
  const showSkeleton = useFormSkeleton(!loaded, skeletonContinued);

  useEffect(() => {
    void albumPhotos(vehicleId).then((ps) => setAlbum(ps.filter((p) => p.albumItemId)));
    void Promise.all([serviceRepo.listWhere({ vehicleId }), modRepo.listWhere({ vehicleId }), inspectionRepo.listWhere({ vehicleId })]).then(
      ([services, mods, checks]) => {
        const newest = <R extends { date: string }>(rows: R[]) => rows.sort((a, b) => b.date.localeCompare(a.date));
        setOptions({
          service: newest(services.map((s) => ({ id: s.id, title: s.title || '—', sub: dateLabel(s.occurredAt), date: s.occurredAt }))),
          mod: newest(mods.map((m) => ({ id: m.id, title: m.name, sub: m.brand ?? '', date: m.installedAt ?? m.createdAt ?? '' }))),
          check: newest(checks.map((c) => ({ id: c.id, title: t.events.linkCheckTitle(dateLabel(c.occurredAt)), sub: '', date: c.occurredAt }))),
        });
      },
    );
    if (!milestoneId) return;
    void (async () => {
      const [m, ids, files] = await Promise.all([milestoneRepo.getById(milestoneId), milestonePhotoIds(milestoneId), milestonePdfs(milestoneId)]);
      setLoaded(true);
      if (!m) return;
      // Rows from before v8 have no event_type: an accidente kind was the only event.
      setEventType(m.eventType ?? (m.kind === 'accidente' ? 'accidente' : 'hito'));
      setKind(m.kind);
      if (m.severity) setSeverity(m.severity);
      setDate(m.occurredAt.slice(0, 10));
      setKm(m.odometerKm != null ? String(Math.round(m.odometerKm)) : '');
      setTitle(m.title);
      setStory(m.story);
      setCost(m.costDop != null ? String(m.costDop) : '');
      setPending(m.pending ?? '');
      setResolved(Boolean(m.resolvedAt));
      setResolvedAt(m.resolvedAt);
      setLocation(m.locationLabel ?? '');
      setLinks({ service: m.linkedServiceId, mod: m.linkedModId, check: m.linkedInspectionId });
      setCover(m.coverMediaId);
      setPhotoIds(ids);
      setInitialIds(ids);
      setPdfs(files);
    })();
  }, [vehicleId, milestoneId]);

  async function addNew() {
    const picked = await pickCandidates({ multiple: true });
    if (!picked.length) return;
    setImporting(true);
    try {
      const [y, m, d] = date.split('-').map(Number);
      const fallback = dateAtPrecision(y, m - 1, d, 'day');
      const result = await importCandidates(
        picked.map((c) => ({ ...c, takenAt: c.takenAt ?? fallback, precision: 'day' as const })),
        { vehicleId, milestoneId: id },
      );
      setNewIds((prev) => [...prev, ...result.mediaIds]);
      const ids = await milestonePhotoIds(id);
      setPhotoIds((prev) => [...new Set([...prev, ...ids])]);
      setAlbum((await albumPhotos(vehicleId)).filter((p) => p.albumItemId));
    } finally {
      setImporting(false);
    }
  }

  async function addPdf() {
    setImporting(true);
    const r = await pickPdf({ ownerTable: 'milestone', ownerId: id, vehicleId }).finally(() => setImporting(false));
    if (r.ok) setPdfs((prev) => [...prev, r.media]);
    else if (r.reason !== 'cancelled') setError(r.reason === 'too-big' ? t.events.pdfTooBig : t.events.pdfFailed);
  }

  async function removePdf(file: Media) {
    await mediaRepo.upsert({ id: file.id, deletedAt: new Date().toISOString() });
    setPdfs((prev) => prev.filter((p) => p.id !== file.id));
  }

  async function save() {
    if (importing) return;
    if (!title.trim()) return setError(t.events.titleRequired);
    const parsedKm = km.trim() ? Number(km.replace(/[^\d.]/g, '')) : null;
    const [y, m, d] = date.split('-').map(Number);
    const fields = eventFieldsFromDraft(
      {
        eventType,
        severity,
        cost,
        pending,
        resolved,
        resolvedAt,
        linkedServiceId: links.service,
        linkedModId: links.mod,
        linkedInspectionId: links.check,
        locationLabel: location,
      },
      new Date().toISOString(),
    );
    await saveMilestone({
      id,
      vehicleId,
      // The nice kinds are a hito's; an event keeps 'accidente' for the 2.3 readers, else 'otro'.
      kind: eventType === 'hito' ? kind : eventType === 'accidente' ? 'accidente' : 'otro',
      occurredAt: dateAtPrecision(y, m - 1, d, 'day'),
      odometerKm: parsedKm != null && Number.isFinite(parsedKm) ? parsedKm : null,
      title: title.trim(),
      story: story.trim(),
      coverMediaId: cover && photoIds.includes(cover) ? cover : photoIds[0] ?? null,
      ...fields,
    });
    await linkPhotosToMilestone(photoIds, id);
    await linkPhotosToMilestone(initialIds.filter((p) => !photoIds.includes(p)), null);
    // ADR-44: the photos added here are the event's proofs (album_item role 'evento').
    if (eventType !== 'hito') await markEventProofs(newIds.filter((p) => photoIds.includes(p)), id);
    onDone();
  }

  function remove() {
    Alert.alert(t.events.delete, t.events.deleteBody, [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.common.delete, style: 'destructive', onPress: () => void deleteMilestone(id).then(onDone) },
    ]);
  }

  const cell = Math.floor((width - space.gutter * 2 - 12) / 3);
  const selectedPhotos = photoIds.map((pid) => album.find((p) => p.id === pid)).filter((p): p is AlbumPhoto => Boolean(p));
  const isHito = eventType === 'hito';
  const linkLabel: Record<LinkKind, string> = { service: t.events.linkService, mod: t.events.linkMod, check: t.events.linkCheck };
  const eyebrow = (text: string, top = 0) => (
    <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11, marginTop: top, marginBottom: space.sm }}>
      {text}
    </T>
  );

  // Not the empty fields of a new event while the real one is on its way.
  if (!loaded) return showSkeleton ? (skeleton ?? <FormSkeleton />) : null;
  return (
    <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
      <T face="display" style={{ color: theme.text.primary, fontSize: 28, textTransform: 'uppercase', marginBottom: space.lg }}>
        {milestoneId ? t.events.editTitle : t.events.newTitle}
      </T>

      {eyebrow(t.events.type)}
      <View style={styles.chips}>
        {EVENT_TYPES.map((et) => {
          const on = eventType === et.id;
          return (
            <Pressable
              key={et.id}
              onPress={() => setEventType(et.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              aria-selected={on}
              style={[styles.typeChip, { backgroundColor: on ? theme.accentFill : theme.bg.raised, borderColor: on ? theme.accentFill : theme.line }]}>
              <Ionicons name={et.icon as keyof typeof Ionicons.glyphMap} size={15} color={on ? theme.accentFillInk : theme.text.secondary} />
              <T face="title" style={{ color: on ? theme.accentFillInk : theme.text.secondary, fontSize: 13, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                {et.label}
              </T>
            </Pressable>
          );
        })}
      </View>

      {isHito ? (
        <View style={styles.chips}>
          {HITO_KINDS.map((k) => (
            <Chip key={k} label={t.hito.kinds[k]} selected={kind === k} onPress={() => setKind(k)} />
          ))}
        </View>
      ) : (
        <>
          {eyebrow(t.events.severity)}
          <Segmented
            options={SEVERITIES.map((s) => ({
              key: s.id,
              label: s.label,
              color: s.id === 'grave' ? theme.danger : s.id === 'moderado' ? theme.status.urgente : theme.status.proximo,
            }))}
            value={severity}
            onChange={setSeverity}
            style={{ marginBottom: space.md }}
          />
        </>
      )}

      <DateField label={t.events.date} value={date} onChange={setDate} noFuture />
      <Field label={t.events.km} keyboardType="number-pad" value={km} onChangeText={setKm} />
      <Field label={t.events.title} placeholder={isHito ? t.hito.titlePlaceholder : t.events.titlePlaceholder} value={title} onChangeText={(v) => (setTitle(v), setError(null))} />
      <Field label={t.events.story} placeholder={isHito ? t.hito.storyPlaceholder : t.events.storyPlaceholder} value={story} onChangeText={setStory} multiline />
      <Field label={t.events.cost} keyboardType="decimal-pad" value={cost} onChangeText={setCost} />
      {isHito ? null : (
        <>
          <Field label={t.events.pendingLabel} placeholder={t.events.pendingPlaceholder} hint={t.events.pendingHint} value={pending} onChangeText={setPending} />
          {pending.trim() ? (
            <View style={[styles.toggle, { borderColor: theme.line, backgroundColor: theme.bg.surface }]}>
              <View style={{ flex: 1 }}>
                <T face="semibold" style={{ color: theme.text.primary, fontSize: 15 }}>
                  {t.events.resolvedToggle}
                </T>
                {resolved && resolvedAt ? (
                  <T face="body" style={{ color: theme.text.muted, fontSize: 12 }}>
                    {t.events.resolvedOn(dateLabel(resolvedAt))}
                  </T>
                ) : null}
              </View>
              <Switch
                value={resolved}
                onValueChange={(on) => {
                  setResolved(on);
                  setResolvedAt(on ? (resolvedAt ?? new Date().toISOString()) : null);
                }}
                accessibilityLabel={t.events.resolvedToggle}
              />
            </View>
          ) : null}
        </>
      )}
      <Field label={t.events.location} placeholder={t.events.locationPlaceholder} value={location} onChangeText={setLocation} />

      {eyebrow(isHito ? t.hito.photos : t.events.proofs, space.md)}
      {isHito ? null : (
        <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginBottom: space.sm }}>
          {t.events.proofsHint}
        </T>
      )}
      {selectedPhotos.length ? (
        <View style={styles.grid}>
          {selectedPhotos.map((p) => (
            <PhotoThumb key={p.id} mediaId={p.id} blurhash={p.blurhash} size={cell} onPress={() => setCover(p.id)} accessibilityLabel={t.events.cover}>
              {(cover ?? photoIds[0]) === p.id ? (
                <View style={[styles.coverTag, { backgroundColor: theme.accentFill }]}>
                  <T face="eyebrow" style={{ color: theme.accentFillInk, fontSize: 9 }}>
                    {t.events.cover}
                  </T>
                </View>
              ) : null}
            </PhotoThumb>
          ))}
        </View>
      ) : null}
      {pdfs.map((file) => (
        <View key={file.id} style={[styles.pdfRow, { borderColor: theme.line, backgroundColor: theme.bg.surface }]}>
          <Pressable style={styles.pdfName} accessibilityRole="button" onPress={() => void openPdf(file)}>
            <Ionicons name="document-text-outline" size={18} color={theme.text.secondary} />
            <T face="body" numberOfLines={1} style={{ color: theme.text.primary, fontSize: 14, flex: 1 }}>
              {file.caption || 'PDF'}
            </T>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t.events.removePdf(file.caption || 'PDF')} hitSlop={8} onPress={() => void removePdf(file)}>
            <Ionicons name="close" size={18} color={theme.text.muted} />
          </Pressable>
        </View>
      ))}
      <View style={styles.row}>
        <GhostButton label={t.events.attachPhotos} onPress={() => setPicking(true)} style={{ flex: 1 }} disabled={!album.length} />
        <GhostButton label={t.events.addPhotos} onPress={() => void addNew()} style={{ flex: 1 }} />
      </View>
      {isHito ? null : <GhostButton label={t.events.attachPdf} onPress={() => void addPdf()} />}

      {isHito ? null : (
        <>
          {eyebrow(t.events.links, space.md)}
          <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginBottom: space.sm }}>
            {t.events.linksHint}
          </T>
          {(['service', 'mod', 'check'] as const).map((k) => {
            const chosen = options[k].find((o) => o.id === links[k]);
            return (
              <Pressable
                key={k}
                onPress={() => setLinkPicker(k)}
                accessibilityRole="button"
                style={[styles.linkRow, { borderColor: theme.line, backgroundColor: theme.bg.surface }]}>
                <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11, width: 76 }}>
                  {linkLabel[k]}
                </T>
                <T face="body" numberOfLines={1} style={{ color: chosen ? theme.text.primary : theme.text.muted, fontSize: 14, flex: 1 }}>
                  {chosen ? chosen.title : links[k] ? '—' : t.events.linkNone}
                </T>
                <Ionicons name="chevron-forward" size={16} color={theme.text.muted} />
              </Pressable>
            );
          })}
        </>
      )}

      {error ? (
        <T face="body" style={{ color: theme.dangerText, fontSize: 13, marginVertical: space.sm }}>
          {error}
        </T>
      ) : null}
      <View style={{ height: space.md }} />
      <PrimaryButton label={importing ? t.events.storing : t.events.save} onPress={() => void save()} disabled={importing} />
      {milestoneId ? <GhostButton danger label={t.events.delete} onPress={remove} /> : null}

      <Sheet visible={linkPicker != null} onClose={() => setLinkPicker(null)} title={linkPicker ? t.events.linkPick(linkLabel[linkPicker]) : ''}>
        {linkPicker ? (
          <ScrollView style={{ maxHeight: 420 }}>
            {[{ id: '', title: t.events.linkNone, sub: '' }, ...options[linkPicker]].map((o) => {
              const on = (links[linkPicker] ?? '') === o.id;
              return (
                <Pressable
                  key={o.id || 'none'}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => {
                    setLinks((prev) => ({ ...prev, [linkPicker]: o.id || null }));
                    setLinkPicker(null);
                  }}
                  style={[styles.pickRow, { borderColor: theme.line }]}>
                  <View style={{ flex: 1 }}>
                    <T face="semibold" style={{ color: theme.text.primary, fontSize: 15 }}>
                      {o.title}
                    </T>
                    {o.sub ? (
                      <T face="body" style={{ color: theme.text.muted, fontSize: 12 }}>
                        {o.sub}
                      </T>
                    ) : null}
                  </View>
                  {on ? <Ionicons name="checkmark" size={18} color={theme.accent} /> : null}
                </Pressable>
              );
            })}
            {options[linkPicker].length ? null : (
              <T face="body" style={{ color: theme.text.muted, fontSize: 13, marginTop: space.sm }}>
                {t.events.linkEmpty}
              </T>
            )}
          </ScrollView>
        ) : null}
      </Sheet>

      <Sheet visible={picking} onClose={() => setPicking(false)} title={t.events.pickerTitle}>
        <FlatList
          data={album}
          numColumns={3}
          style={{ maxHeight: 420 }}
          keyExtractor={(p) => p.id}
          columnWrapperStyle={{ gap: 6 }}
          contentContainerStyle={{ gap: 6 }}
          renderItem={({ item: p }) => {
            const on = photoIds.includes(p.id);
            return (
              <PhotoThumb
                mediaId={p.id}
                blurhash={p.blurhash}
                size={Math.floor((width - space.xl * 2 - 12) / 3)}
                onPress={() => setPhotoIds((prev) => (on ? prev.filter((x) => x !== p.id) : [...prev, p.id]))}>
                <View style={[styles.check, { backgroundColor: on ? theme.accentFill : 'rgba(0,0,0,0.45)', borderColor: on ? theme.accentFill : '#FFFFFF' }]}>
                  {on ? <Ionicons name="checkmark" size={14} color={theme.accentFillInk} /> : null}
                </View>
              </PhotoThumb>
            );
          }}
        />
        <PrimaryButton label={t.events.pickerDone(photoIds.length)} onPress={() => setPicking(false)} />
      </Sheet>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 48 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: space.md },
  typeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, minHeight: 34, borderRadius: radius.chip, borderWidth: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: space.sm },
  row: { flexDirection: 'row', gap: space.sm, marginBottom: space.sm },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderWidth: 1, borderRadius: radius.input, padding: space.md, marginBottom: space.md },
  pdfRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: 1, borderRadius: radius.input, paddingHorizontal: space.md, minHeight: 44, marginBottom: space.sm },
  pdfName: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: 1, borderRadius: radius.input, paddingHorizontal: space.md, minHeight: 48, marginBottom: space.sm },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.md, borderBottomWidth: 1 },
  coverTag: { position: 'absolute', left: 4, bottom: 4, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3 },
  check: { position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
