import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { DateField } from '@/components/DateField';
import { Field } from '@/components/Field';
import { T } from '@/components/T';
import { Chip, GhostButton, PrimaryButton, Sheet } from '@/components/ui';
import { space } from '@/constants/theme';
import { Alert } from '@/lib/alert';
import {
  albumPhotos,
  deleteMilestone,
  linkPhotosToMilestone,
  milestonePhotoIds,
  saveMilestone,
  type AlbumPhoto,
} from '@/lib/db/albumQueries';
import { milestones as milestoneRepo } from '@/lib/db/repos';
import type { MilestoneKind } from '@/lib/db/types';
import { dateAtPrecision } from '@/lib/domain/album';
import { id as newId, todayIsoDate } from '@/lib/format';
import { t } from '@/lib/i18n';
import { importCandidates, pickCandidates } from '@/lib/media';
import { useTheme } from '@/lib/theme/useTheme';
import { PhotoThumb } from './PhotoThumb';

const KINDS: MilestoneKind[] = ['compra', 'swap', 'restauracion', 'primer_track', 'accidente', 'pintura', 'venta', 'otro'];

/**
 * A milestone (hito): the swap, the crash, the paint job, the day it was sold.
 * Kind, date, km, title, story, and photos — chosen from the album or added new
 * — with one of them as the cover. Shows on the album timeline and in Historial.
 */
export function MilestoneForm({
  vehicleId,
  milestoneId,
  onDone,
}: {
  vehicleId: string;
  milestoneId?: string;
  onDone: () => void;
}) {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  // The id exists from the start so new photos can be linked before the save.
  const [id] = useState(milestoneId ?? newId());
  const [kind, setKind] = useState<MilestoneKind>('otro');
  const [date, setDate] = useState(todayIsoDate());
  const [km, setKm] = useState('');
  const [title, setTitle] = useState('');
  const [story, setStory] = useState('');
  const [photoIds, setPhotoIds] = useState<string[]>([]);
  const [initialIds, setInitialIds] = useState<string[]>([]);
  const [cover, setCover] = useState<string | null>(null);
  const [album, setAlbum] = useState<AlbumPhoto[]>([]);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void albumPhotos(vehicleId).then((ps) => setAlbum(ps.filter((p) => p.albumItemId)));
    if (!milestoneId) return;
    void (async () => {
      const [m, ids] = await Promise.all([milestoneRepo.getById(milestoneId), milestonePhotoIds(milestoneId)]);
      if (!m) return;
      setKind(m.kind);
      setDate(m.occurredAt.slice(0, 10));
      setKm(m.odometerKm != null ? String(Math.round(m.odometerKm)) : '');
      setTitle(m.title);
      setStory(m.story);
      setCover(m.coverMediaId);
      setPhotoIds(ids);
      setInitialIds(ids);
    })();
  }, [vehicleId, milestoneId]);

  async function addNew() {
    const picked = await pickCandidates({ multiple: true });
    if (!picked.length) return;
    const [y, m, d] = date.split('-').map(Number);
    const fallback = dateAtPrecision(y, m - 1, d, 'day');
    await importCandidates(
      picked.map((c) => ({ ...c, takenAt: c.takenAt ?? fallback, precision: 'day' as const })),
      { vehicleId, milestoneId: id },
    );
    const ids = await milestonePhotoIds(id);
    setPhotoIds((prev) => [...new Set([...prev, ...ids])]);
    setAlbum((await albumPhotos(vehicleId)).filter((p) => p.albumItemId));
  }

  async function save() {
    if (!title.trim()) return setError(t.hito.titleRequired);
    const parsedKm = km.trim() ? Number(km.replace(/[^\d.]/g, '')) : null;
    const [y, m, d] = date.split('-').map(Number);
    await saveMilestone({
      id,
      vehicleId,
      kind,
      occurredAt: dateAtPrecision(y, m - 1, d, 'day'),
      odometerKm: parsedKm != null && Number.isFinite(parsedKm) ? parsedKm : null,
      title: title.trim(),
      story: story.trim(),
      coverMediaId: cover && photoIds.includes(cover) ? cover : photoIds[0] ?? null,
    });
    await linkPhotosToMilestone(photoIds, id);
    await linkPhotosToMilestone(initialIds.filter((p) => !photoIds.includes(p)), null);
    onDone();
  }

  function remove() {
    Alert.alert(t.hito.delete, t.hito.deleteBody, [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.common.delete, style: 'destructive', onPress: () => void deleteMilestone(id).then(onDone) },
    ]);
  }

  const cell = Math.floor((width - space.gutter * 2 - 12) / 3);
  const selectedPhotos = photoIds.map((pid) => album.find((p) => p.id === pid)).filter((p): p is AlbumPhoto => Boolean(p));

  return (
    <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
      <T face="display" style={{ color: theme.text.primary, fontSize: 28, textTransform: 'uppercase', marginBottom: space.lg }}>
        {milestoneId ? t.hito.editTitle : t.hito.newTitle}
      </T>

      <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11, marginBottom: space.sm }}>
        {t.hito.kind}
      </T>
      <View style={styles.chips}>
        {KINDS.map((k) => (
          <Chip key={k} label={t.hito.kinds[k]} selected={kind === k} onPress={() => setKind(k)} />
        ))}
      </View>

      <DateField label={t.hito.date} value={date} onChange={setDate} noFuture />
      <Field label={t.hito.km} keyboardType="number-pad" value={km} onChangeText={setKm} />
      <Field label={t.hito.title} placeholder={t.hito.titlePlaceholder} value={title} onChangeText={(t) => (setTitle(t), setError(null))} />
      <Field label={t.hito.story} placeholder={t.hito.storyPlaceholder} value={story} onChangeText={setStory} multiline />

      <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11, marginTop: space.md, marginBottom: space.sm }}>
        {t.hito.photos}
      </T>
      {selectedPhotos.length ? (
        <View style={styles.grid}>
          {selectedPhotos.map((p) => (
            <PhotoThumb key={p.id} mediaId={p.id} blurhash={p.blurhash} size={cell} onPress={() => setCover(p.id)} accessibilityLabel={t.hito.cover}>
              {(cover ?? photoIds[0]) === p.id ? (
                <View style={[styles.coverTag, { backgroundColor: theme.accentFill }]}>
                  <T face="eyebrow" style={{ color: theme.accentFillInk, fontSize: 9 }}>
                    {t.hito.cover}
                  </T>
                </View>
              ) : null}
            </PhotoThumb>
          ))}
        </View>
      ) : null}
      <View style={styles.row}>
        <GhostButton label={t.hito.attach} onPress={() => setPicking(true)} style={{ flex: 1 }} disabled={!album.length} />
        <GhostButton label={t.hito.addNew} onPress={() => void addNew()} style={{ flex: 1 }} />
      </View>

      {error ? (
        <T face="body" style={{ color: theme.dangerText, fontSize: 13, marginVertical: space.sm }}>
          {error}
        </T>
      ) : null}
      <PrimaryButton label={t.hito.save} onPress={() => void save()} />
      {milestoneId ? <GhostButton danger label={t.hito.delete} onPress={remove} /> : null}

      <Sheet visible={picking} onClose={() => setPicking(false)} title={t.hito.pickerTitle}>
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
        <PrimaryButton label={t.hito.pickerDone(photoIds.length)} onPress={() => setPicking(false)} />
      </Sheet>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 48 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: space.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: space.sm },
  row: { flexDirection: 'row', gap: space.sm, marginBottom: space.lg },
  coverTag: { position: 'absolute', left: 4, bottom: 4, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3 },
  check: { position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
