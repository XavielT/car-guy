import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { Field } from '@/components/Field';
import { T } from '@/components/T';
import { GhostButton, PrimaryButton, Surface } from '@/components/ui';
import { space } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { isHandleFree, type HandleCheck } from '@/lib/social/api';
import { handleProblem, normalizeHandle, normalizeInstagram } from '@/lib/social/handle';
import { publicPhotoDataUri } from '@/lib/social/publicPhoto';
import { readMySocialProfile, saveMySocialProfile, type MySocialProfile } from '@/lib/social/store';
import { useTheme } from '@/lib/theme/useTheme';

import { PrivacyZonesEditor } from './PrivacyZonesEditor';

type SwitchKey = 'is_public' | 'photo_public' | 'show_cars' | 'show_stats' | 'show_fichas';
const SWITCHES: SwitchKey[] = ['is_public', 'photo_public', 'show_cars', 'show_stats', 'show_fichas'];
const BIO_MAX = 160;

/**
 * Perfil → Perfil público (IMP 01102026 Phase 5, notes 11, 14, 16): @handle with a live check, bio, Instagram,
 * the five switches, privacy zones, and "Qué ven los demás". The row lives in the cloud (signed-in only); the
 * zones are local-first and synced.
 */
export function PublicProfileEditor({ hasPhoto }: { hasPhoto: boolean }) {
  const { theme } = useTheme();
  const router = useRouter();
  const [saved, setSaved] = useState<MySocialProfile | null>(null);
  const [draft, setDraft] = useState<MySocialProfile | null>(null);
  const [handleText, setHandleText] = useState('');
  const [igText, setIgText] = useState('');
  // The cloud's answer for one handle, and what a save said about it (cooldown/taken) — the rest is derived.
  const [remote, setRemote] = useState<{ handle: string; result: HandleCheck | 'cooldown' } | null>(null);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    void readMySocialProfile().then((p) => {
      if (!p) return;
      setSaved(p);
      setDraft(p);
      setHandleText(p.handle ?? '');
      setIgText(p.instagram ?? '');
    });
  }, []);

  const handle = normalizeHandle(handleText);
  const problem = handle ? handleProblem(handle) : null;
  const isMine = Boolean(handle) && handle === saved?.handle;
  const needsCloud = Boolean(handle) && !isMine && !problem;
  useEffect(() => {
    if (!needsCloud) return;
    const mine = ++seq.current;
    const timer = setTimeout(() => {
      void isHandleFree(handle).then((r) => mine === seq.current && r.ok && setRemote({ handle, result: r.data }));
    }, 350);
    return () => clearTimeout(timer);
  }, [handle, needsCloud]);
  const check: HandleCheck | 'short' | 'cooldown' | null = !handle
    ? null
    : remote?.handle === handle && remote.result === 'cooldown'
      ? 'cooldown'
      : isMine
        ? 'mine'
        : problem
          ? problem === 'short'
            ? 'short'
            : 'format'
          : remote?.handle === handle
            ? remote.result
            : null;
  const setCheck = (result: HandleCheck | 'cooldown') => setRemote({ handle, result });

  if (!draft) return null;
  const set = (patch: Partial<MySocialProfile>) => setDraft({ ...draft, ...patch });
  const handleOk = check === 'free' || check === 'mine';

  const save = async () => {
    setBusy(true);
    setNotice(null);
    const patch: Partial<MySocialProfile> & { photo_public_jpeg?: string | null } = {
      bio: draft.bio.trim().slice(0, BIO_MAX),
      instagram: igText.trim() ? normalizeInstagram(igText) : null,
      is_public: draft.is_public,
      photo_public: draft.photo_public,
      show_cars: draft.show_cars,
      show_stats: draft.show_stats,
      show_fichas: draft.show_fichas,
    };
    if (handle && handle !== saved?.handle) patch.handle = handle;
    // Note 16: the small public copy exists only while the switch is on.
    if (draft.photo_public !== saved?.photo_public || draft.photo_public) {
      patch.photo_public_jpeg = draft.photo_public ? await publicPhotoDataUri() : null;
    }
    const r = await saveMySocialProfile(patch);
    setBusy(false);
    if (r.ok) {
      const next = { ...draft, ...patch, handle: patch.handle ?? saved?.handle ?? null } as MySocialProfile;
      setSaved(next);
      setDraft(next);
      setNotice({ text: t.social.saved, ok: true });
    } else if (r.reason === 'handle_cooldown') setCheck('cooldown');
    else if (r.reason === 'handle_taken') setCheck('taken');
    else if (r.reason === 'handle_reserved') setCheck('reserved');
    else setNotice({ text: t.social.saveFailed, ok: false });
  };

  return (
    <View style={{ marginTop: space.lg }}>
      <T face="eyebrow" accessibilityRole="header" style={{ color: theme.accent, fontSize: 12, marginBottom: space.sm }}>
        {t.social.publicTitle}
      </T>
      <Field
        label={`${t.social.handle} (@)`}
        value={handleText}
        onChangeText={(v) => setHandleText(normalizeHandle(v))}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="trueno_ae85"
        hint={check ? `${t.social.handleState[check]} · ${t.social.handleHint}` : t.social.handleHint}
      />
      <Field label={t.social.bio} value={draft.bio} onChangeText={(bio) => set({ bio: bio.slice(0, BIO_MAX) })} placeholder={t.social.bioPlaceholder} multiline hint={`${draft.bio.length}/${BIO_MAX}`} />
      <Field label={t.social.instagram} value={igText} onChangeText={setIgText} autoCapitalize="none" autoCorrect={false} placeholder="@usuario" />

      <Surface padded style={{ gap: space.sm, marginBottom: space.md }}>
        {SWITCHES.map((k) => {
          const hint = k === 'is_public' ? t.social.switches.is_publicHint : k === 'photo_public' ? (hasPhoto ? t.social.switches.photo_publicHint : t.social.noPhotoForPublic) : null;
          return (
            <View key={k} style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <T face="semibold" style={{ color: theme.text.primary, fontSize: 14 }}>
                  {t.social.switches[k]}
                </T>
                {hint ? (
                  <T face="body" style={{ color: theme.text.muted, fontSize: 12, lineHeight: 17 }}>
                    {hint}
                  </T>
                ) : null}
              </View>
              <Switch value={draft[k]} onValueChange={(v) => set({ [k]: v } as Partial<MySocialProfile>)} accessibilityLabel={t.social.switches[k]} />
            </View>
          );
        })}
      </Surface>

      {notice ? (
        <T face="body" accessibilityLiveRegion="polite" style={{ color: notice.ok ? theme.statusText.ok : theme.dangerText, fontSize: 13, marginBottom: space.sm }}>
          {notice.text}
        </T>
      ) : null}
      <PrimaryButton label={t.social.save} disabled={busy || (Boolean(handle) && !handleOk)} onPress={() => void save()} />
      {saved?.handle ? (
        <GhostButton label={t.social.preview} onPress={() => router.push({ pathname: '/u/[handle]', params: { handle: saved.handle! } })} />
      ) : null}

      <PrivacyZonesEditor />
    </View>
  );
}

const styles = StyleSheet.create({
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
