import { useState } from 'react';
import { View } from 'react-native';

import { T } from '@/components/T';
import { GhostButton } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { str, conf, type ReadResult } from '@/lib/ai/read';
import { checkItemFor, verdictFromSuggestion, type CheckSuggestion } from '@/lib/domain/workflowPhotos';
import type { Verdict } from '@/lib/domain/inspections';
import { FEATURE_AI_CHECK_PHOTO } from '@/lib/flagsAi';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme/useTheme';
import { CaptureButton } from './CaptureButton';

/**
 * "Revisar con foto" on one weekly-check item (SPEC-G §G6). The photo is read by `cg-ai-read` kind `check_photo` (the item is sent as a
 * closed id, never as the label's text). The answer is a SUGGESTION in hedged words: the person taps "Usar" to set the item's answer
 * or ignores it and answers as always. Nothing changes without that tap, and a fail still goes through the item's own "if it fails"
 * action when the checklist is saved. A photo never measures: the card says so.
 */
export function CheckPhotoAi({ label, current, onUse }: { label: string; current: Verdict | undefined; onUse: (verdict: Verdict, observation: string, photoUri: string) => void }) {
  const { theme } = useTheme();
  const [s, setS] = useState<{ suggestion: CheckSuggestion; observation: string; uri: string; low: boolean } | null>(null);
  const item = checkItemFor(label);
  if (!FEATURE_AI_CHECK_PHOTO || item === 'other') return null;
  const x = t.ai.checkPhoto;

  function read(r: ReadResult, photo: { uri: string }) {
    const sug = str(r, 'suggestion');
    if (sug !== 'pass' && sug !== 'watch' && sug !== 'fail') return;
    setS({ suggestion: sug, observation: str(r, 'observation') ?? '', uri: photo.uri, low: conf(r, 'suggestion') < 0.6 });
  }

  const verdict = s ? verdictFromSuggestion(s.suggestion) : null;
  const tone = s?.suggestion === 'pass' ? theme.statusText.ok : s?.suggestion === 'fail' ? theme.statusText.vencido : theme.statusText.proximo;

  return (
    <View style={{ marginTop: space.sm }}>
      <CaptureButton kind="check_photo" label={x.button} icon="camera-outline" extra={{ item }} onRead={read} />
      {s && verdict ? (
        <View style={{ borderWidth: 1, borderColor: theme.line, backgroundColor: theme.bg.raised, borderRadius: radius.input, padding: space.sm, marginTop: space.xs, gap: 4 }} accessibilityLiveRegion="polite">
          <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 10 }}>
            {x.title}
          </T>
          <T face="semibold" style={{ color: tone, fontSize: 14 }}>
            {x.verdicts[s.suggestion]}
          </T>
          {s.observation ? (
            <T face="body" selectable style={{ color: theme.text.secondary, fontSize: 13, lineHeight: 18 }}>
              {s.observation}
            </T>
          ) : null}
          <T face="body" style={{ color: theme.text.muted, fontSize: 11, lineHeight: 15 }}>
            {s.low ? x.unsure : x.hedge}
          </T>
          {current === verdict ? null : (
            <GhostButton
              label={x.use(x.answers[verdict])}
              onPress={() => {
                onUse(verdict, s.observation, s.uri);
                setS(null);
              }}
            />
          )}
          <GhostButton label={x.dismiss} onPress={() => setS(null)} />
        </View>
      ) : null}
    </View>
  );
}
