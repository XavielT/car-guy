import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Platform, ScrollView, Share, StyleSheet, Switch, View } from 'react-native';

import { PhotoThumb } from '@/components/album/PhotoThumb';
import { VehicleSwitchesSkeleton } from '@/components/skeletons/VehicleSkeletons';
import { T } from '@/components/T';
import { GhostButton, PrimaryButton, Segmented } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { Alert } from '@/lib/alert';
import { albumPhotos, setPhotoFavorite, type AlbumPhoto } from '@/lib/db/albumQueries';
import { vehicles as vehicleRepo } from '@/lib/db/repos';
import { flagsOf, getShare } from '@/lib/db/shareQueries';
import type { Vehicle, VehicleShare } from '@/lib/db/types';
import type { ShareFlags } from '@/lib/share/dossier';
import { enableShare, revokeShare, saveShareSettings, shareUrl } from '@/lib/share/publish';
import { t } from '@/lib/i18n';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

const FLAG_KEYS: (keyof ShareFlags)[] = ['story', 'mods', 'maintenance', 'track', 'odometer', 'status', 'costs', 'plate', 'vin'];
const MAX_PHOTOS = 24;

/**
 * Compartir (03-screens.md Block F): who can see the page, what it shows, which
 * photos, and the link itself. The page is https://car-guy.vercel.app/c/<slug>,
 * rendered by api/c/[slug].ts from what the cloud holds — so publishing needs an
 * account and pushes a sync first.
 */
export default function ShareScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const { refresh } = useStore();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [share, setShare] = useState<VehicleShare | null>(null);
  const [flags, setFlags] = useState<ShareFlags | null>(null);
  const [visibility, setVisibility] = useState<VehicleShare['visibility']>('private');
  const [photos, setPhotos] = useState<AlbumPhoto[]>([]);
  const [mode, setMode] = useState<'fotos' | 'portada'>('fotos');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // True once the first read answered (ok or not).
  const [loaded, setLoaded] = useState(false);
  const showSkeleton = useDelayedLoading(!loaded);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([vehicleRepo.getById(id), getShare(id), albumPhotos(id)]).then(([v, s, p]) => {
      if (cancelled) return;
      setVehicle(v);
      setShare(s);
      setFlags(flagsOf(s));
      setVisibility(s?.slug && !s.revokedAt ? s.visibility : 'private');
      setPhotos(p);
    })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (showSkeleton) return <VehicleSwitchesSkeleton rows={FLAG_KEYS.length} />;
  if (!vehicle || !flags) return null;
  const live = Boolean(share?.slug && !share.revokedAt && share.publishedAt);
  const url = live && share?.slug ? shareUrl(share.slug) : null;
  const chosen = photos.filter((p) => p.isFavorite).length;
  const hero = vehicle.heroMediaId ?? photos.find((p) => p.isFavorite)?.id ?? null;

  async function setFlag(k: keyof ShareFlags, on: boolean) {
    const next = { ...flags!, [k]: on };
    setFlags(next);
    setShare(await saveShareSettings(id, { flags: next }));
  }

  async function togglePhoto(p: AlbumPhoto) {
    if (mode === 'portada') {
      const v = await vehicleRepo.upsertRaw({ id, heroMediaId: p.id });
      setVehicle(v ?? { ...vehicle!, heroMediaId: p.id });
      if (!p.isFavorite) await togglePhotoFavorite(p, true);
      return;
    }
    if (!p.isFavorite && chosen >= MAX_PHOTOS) return setNotice(t.share.maxPhotos(MAX_PHOTOS));
    await togglePhotoFavorite(p, !p.isFavorite);
  }

  async function togglePhotoFavorite(p: AlbumPhoto, on: boolean) {
    await setPhotoFavorite(p.id, on);
    setPhotos((prev) => prev.map((x) => (x.id === p.id ? { ...x, isFavorite: on } : x)));
  }

  async function publish(next: 'link' | 'public') {
    setBusy(true);
    setNotice(t.share.publishing);
    const r = await enableShare(id, flags!, next);
    setBusy(false);
    if (!r.ok) {
      setNotice(r.reason === 'signed-out' ? t.share.needAccount : t.share.syncFailed);
      if (r.reason === 'signed-out') setVisibility('private');
      return;
    }
    setShare(await getShare(id));
    setVisibility(next);
    setNotice(r.failed ? t.share.publishedPartial(r.photos, r.failed) : t.share.published(r.photos));
    refresh();
  }

  function changeVisibility(next: VehicleShare['visibility']) {
    if (next === visibility) return;
    if (next === 'private') {
      if (!live) return setVisibility('private');
      Alert.alert(t.share.revoke, t.share.revokeBody, [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.share.revoke,
          style: 'destructive',
          onPress: () =>
            void (async () => {
              setBusy(true);
              await revokeShare(id);
              setShare(await getShare(id));
              setVisibility('private');
              setBusy(false);
              setNotice(t.share.revoked);
            })(),
        },
      ]);
      return;
    }
    void publish(next);
  }

  async function copyLink() {
    if (!url) return;
    await Clipboard.setStringAsync(url);
    setNotice(t.share.copied);
  }

  async function shareLink() {
    if (!url) return;
    const message = t.share.message(vehicle!.name, url);
    try {
      if (Platform.OS === 'web') {
        const nav = navigator as Navigator & { share?: (d: { text: string; url: string }) => Promise<void> };
        if (nav.share) await nav.share({ text: message, url });
        else await copyLink();
      } else await Share.share({ message });
    } catch {
      // Dismissed.
    }
  }

  const eyebrow = (label: string) => (
    <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11, marginTop: space.lg, marginBottom: space.sm }}>
      {label}
    </T>
  );

  return (
    <ScrollView style={{ backgroundColor: theme.bg.base }} contentContainerStyle={styles.pad}>
      <T face="eyebrow" style={{ color: theme.accent, fontSize: 11 }}>
        {t.share.eyebrow(vehicle.name.toUpperCase())}
      </T>
      <T face="display" accessibilityRole="header" style={{ color: theme.text.primary, fontSize: 30, textTransform: 'uppercase', marginBottom: space.sm }}>
        {t.share.title}
      </T>
      <T face="body" style={{ color: theme.text.secondary, fontSize: 14, marginBottom: space.md }}>
        {t.share.intro}
      </T>

      <Segmented
        options={[
          { key: 'private', label: t.share.visibility.private },
          { key: 'link', label: t.share.visibility.link },
          { key: 'public', label: t.share.visibility.public },
        ]}
        value={visibility}
        onChange={(k) => changeVisibility(k)}
      />
      <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginTop: space.sm }}>
        {t.share.visibilityHint[visibility]}
      </T>

      {url ? (
        <View style={[styles.link, { backgroundColor: theme.bg.surface, borderColor: theme.accent }]}>
          <T face="mono" selectable style={{ color: theme.accent, fontSize: 14 }}>
            {url.replace('https://', '')}
          </T>
          <View style={styles.pair}>
            <GhostButton style={{ flex: 1 }} label={t.share.copy} onPress={() => void copyLink()} />
            <GhostButton style={{ flex: 1 }} label={t.share.send} onPress={() => void shareLink()} />
          </View>
          <GhostButton label={t.share.preview} onPress={() => void Linking.openURL(url)} />
        </View>
      ) : null}
      {notice ? (
        <T face="body" style={{ color: theme.accent, fontSize: 13, marginTop: space.sm }}>
          {notice}
        </T>
      ) : null}

      {eyebrow(t.share.sections)}
      <View style={[styles.card, { backgroundColor: theme.bg.surface, borderColor: theme.lineStrong }]}>
        {FLAG_KEYS.map((k) => (
          <View key={k} style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <T face="semibold" style={{ color: theme.text.primary, fontSize: 15 }}>
                {t.share.flags[k]}
              </T>
              {t.share.flagHints[k] ? (
                <T face="body" style={{ color: theme.text.muted, fontSize: 12 }}>
                  {t.share.flagHints[k]}
                </T>
              ) : null}
            </View>
            <Switch value={flags[k]} onValueChange={(on) => void setFlag(k, on)} accessibilityLabel={t.share.flags[k]} disabled={busy} />
          </View>
        ))}
      </View>
      {live ? (
        <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginTop: space.sm }}>
          {t.share.republishHint}
        </T>
      ) : null}

      {eyebrow(t.share.photos(chosen, MAX_PHOTOS))}
      <Segmented
        options={[
          { key: 'fotos', label: t.share.pickPhotos },
          { key: 'portada', label: t.share.pickHero },
        ]}
        value={mode}
        onChange={setMode}
      />
      <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginVertical: space.sm }}>
        {mode === 'fotos' ? t.share.photosHint : t.share.heroHint}
      </T>
      {!photos.length ? (
        <T face="body" style={{ color: theme.text.muted, fontSize: 13 }}>
          {t.share.noPhotos}
        </T>
      ) : null}
      <View style={styles.grid}>
        {photos.map((p) => (
          <PhotoThumb key={p.id} mediaId={p.id} blurhash={p.blurhash} size={104} onPress={() => void togglePhoto(p)} accessibilityLabel={p.isFavorite ? t.share.photoOn : t.share.photoOff}>
            {p.isFavorite ? (
              <View style={[styles.mark, { backgroundColor: theme.accentFill }]}>
                <T face="eyebrow" style={{ color: theme.accentFillInk, fontSize: 9 }}>
                  {p.id === hero ? t.share.heroBadge : '★'}
                </T>
              </View>
            ) : (
              <View style={[styles.dim, { backgroundColor: 'rgba(0,0,0,0.45)' }]} />
            )}
          </PhotoThumb>
        ))}
      </View>

      <View style={{ height: space.lg }} />
      {live ? (
        <PrimaryButton label={t.share.update} disabled={busy} onPress={() => void publish(visibility === 'public' ? 'public' : 'link')} />
      ) : (
        <PrimaryButton label={t.share.publish} disabled={busy} onPress={() => void publish('link')} />
      )}
      {live ? <GhostButton danger label={t.share.revoke} disabled={busy} onPress={() => changeVisibility('private')} /> : null}
      <GhostButton label={t.share.book} onPress={() => router.push({ pathname: '/vehiculo/[id]/libro', params: { id } })} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 48 },
  link: { borderWidth: 1, borderRadius: radius.button, padding: space.md, marginTop: space.md, gap: space.sm },
  pair: { flexDirection: 'row', gap: space.sm },
  card: { borderWidth: 1, borderRadius: radius.button, paddingHorizontal: space.md, paddingVertical: space.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  mark: { position: 'absolute', right: 4, top: 4, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3 },
  dim: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
});
