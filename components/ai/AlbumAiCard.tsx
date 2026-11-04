import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { T } from '@/components/T';
import { GhostButton, PrimaryButton } from '@/components/ui';
import { space } from '@/constants/theme';
import { AiError } from '@/lib/ai/codes';
import { prepareForAi, TooLargeError } from '@/lib/ai/prepareImage';
import { readImages, type PreparedImage } from '@/lib/ai/read';
import { saveMilestone } from '@/lib/db/albumQueries';
import { settings } from '@/lib/db/repos';
import { recordReportable } from '@/lib/diagnostics';
import { albumBatches, albumReads, albumSuggestions, type AlbumSuggestion } from '@/lib/domain/workflowPhotos';
import { FEATURE_AI_ALBUM } from '@/lib/flagsAi';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme/useTheme';
import { useAiGate } from './useAiGate';

/** The most photos one import analyses (3 calls of 12): the album is the biggest cost driver, so there is a ceiling per import. */
export const MAX_ANALYSED = 36;
const OPT_IN_KEY = 'ai_album_optin';

type Photo = { uri: string; takenAt: string | null };

/**
 * Album photo understanding (SPEC-G §G2), offered AFTER an import. Opt-in on first use, with a plain line about volume and cost. Photos
 * go oldest-first in batches of ≤ 12, shrunk to 768 px, ONE call per batch. The result is a short list of "looks like a change"
 * suggestions grouped by date; each becomes a milestone (or opens the mod form) only when the person taps it. Nothing is stored by the
 * analysis itself, and a photo is never sent unless the person asked for this.
 */
export function AlbumAiCard({ photos, vehicleId }: { photos: Photo[]; vehicleId: string }) {
  const { theme } = useTheme();
  const router = useRouter();
  const { ready, sheet } = useAiGate();
  const [optIn, setOptIn] = useState<boolean | null>(null);
  const [phase, setPhase] = useState<'idle' | 'running' | 'done'>('idle');
  const [progress, setProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const [suggestions, setSuggestions] = useState<AlbumSuggestion[]>([]);
  const [calls, setCalls] = useState(0);
  const [read, setRead] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [added, setAdded] = useState<Record<string, boolean>>({});
  const alive = useRef(true);
  useEffect(() => () => void (alive.current = false), []);
  useEffect(() => {
    void settings.get<boolean>(OPT_IN_KEY, false).then((v) => alive.current && setOptIn(v)).catch(() => alive.current && setOptIn(false));
  }, []);

  if (!FEATURE_AI_ALBUM || photos.length === 0) return null;
  const x = t.ai.album;
  const analysed = Math.min(photos.length, MAX_ANALYSED);

  async function run() {
    if (!ready()) return;
    if (!optIn) {
      await settings.set(OPT_IN_KEY, true).catch(() => {});
      setOptIn(true);
    }
    setPhase('running');
    setNote(null);
    const batches = albumBatches(photos.map((p, i) => ({ ...p, i }))).flat().slice(0, MAX_ANALYSED);
    const chunks = albumBatches(batches);
    setProgress({ done: 0, total: chunks.length });
    const all: AlbumSuggestion[] = [];
    let n = 0;
    let used = 0;
    try {
      for (const chunk of chunks) {
        const images: PreparedImage[] = [];
        for (const p of chunk) images.push(await prepareForAi(p.uri, { album: true }));
        const r = await readImages('album_batch', images);
        used += 1;
        n += chunk.length;
        const reads = albumReads(r.items, chunk.length);
        all.push(...albumSuggestions(chunk.map((p, i) => ({ index: i + 1, takenAt: p.takenAt })), reads));
        if (!alive.current) return;
        setProgress({ done: used, total: chunks.length });
      }
    } catch (e) {
      if (!alive.current) return;
      if (e instanceof TooLargeError) setNote(t.ai.capture.tooLarge);
      else if (e instanceof AiError) setNote(e.code === 'offline' ? x.offline : e.code === 'unreadable' ? x.nothing : t.ai.errors[e.code]);
      else {
        recordReportable('ai-album', e);
        setNote(t.ai.errors.internal);
      }
    }
    if (!alive.current) return;
    setSuggestions(all.sort((a, b) => a.date.localeCompare(b.date)));
    setCalls(used);
    setRead(n);
    setPhase('done');
  }

  async function addMilestone(s: AlbumSuggestion, key: string) {
    await saveMilestone({
      vehicleId,
      kind: 'otro',
      occurredAt: s.date ? `${s.date}T12:00:00.000Z` : new Date().toISOString(),
      title: x.changeTitle[s.change],
      story: s.note ?? '',
    });
    setAdded((a) => ({ ...a, [key]: true }));
  }

  return (
    <View style={{ gap: space.sm, marginTop: space.md }}>
      <T face="eyebrow" accessibilityRole="header" style={{ color: theme.text.muted, fontSize: 11 }}>
        {x.title}
      </T>
      {phase === 'idle' ? (
        <>
          <T face="body" style={{ color: theme.text.secondary, fontSize: 13, lineHeight: 19 }}>
            {optIn ? x.intro(analysed) : x.consent(analysed, Math.ceil(analysed / 12))}
          </T>
          <PrimaryButton label={optIn ? x.analyse : x.enable} onPress={() => void run()} disabled={optIn === null} />
        </>
      ) : null}
      {phase === 'running' ? (
        <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }} accessibilityLiveRegion="polite">
          <ActivityIndicator color={theme.text.muted} />
          <T face="body" style={{ color: theme.text.secondary, fontSize: 13 }}>
            {x.working(progress.done, progress.total)}
          </T>
        </View>
      ) : null}
      {phase === 'done' ? (
        <View style={{ gap: space.xs }}>
          <T face="body" style={{ color: theme.text.muted, fontSize: 12 }}>
            {x.volume(read, calls)}
          </T>
          {note ? (
            <T face="body" accessibilityLiveRegion="polite" style={{ color: theme.accent, fontSize: 13 }}>
              {note}
            </T>
          ) : null}
          {suggestions.length === 0 && !note ? (
            <T face="body" style={{ color: theme.text.secondary, fontSize: 14 }}>
              {x.noChanges}
            </T>
          ) : null}
          {suggestions.map((s) => {
            const key = `${s.date}|${s.change}`;
            return (
              <View key={key} style={{ gap: 2 }}>
                <T face="semibold" style={{ color: theme.text.primary, fontSize: 14 }}>
                  {`${s.date || x.noDate} · ${x.changeTitle[s.change]}`}
                </T>
                <T face="body" style={{ color: theme.text.secondary, fontSize: 12 }}>
                  {[x.photosCount(s.indexes.length), s.note].filter(Boolean).join(' · ')}
                </T>
                {added[key] ? (
                  <T face="semibold" style={{ color: theme.statusText.ok, fontSize: 13 }}>
                    {x.added}
                  </T>
                ) : (
                  <GhostButton label={x.addMilestone} onPress={() => void addMilestone(s, key)} />
                )}
                {s.kind === 'mod' ? <GhostButton label={x.addMod} onPress={() => router.push({ pathname: '/mod/nuevo', params: { vehicleId } })} /> : null}
              </View>
            );
          })}
          <T face="body" style={{ color: theme.text.muted, fontSize: 11 }}>
            {x.hedge}
          </T>
        </View>
      ) : null}
      {sheet}
    </View>
  );
}
