import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';

import { T } from '@/components/T';
import { GhostButton, Surface } from '@/components/ui';
import { space } from '@/constants/theme';
import { AiError } from '@/lib/ai/codes';
import { prepareForAi, TooLargeError } from '@/lib/ai/prepareImage';
import { readImages, type PreparedImage } from '@/lib/ai/read';
import { documents as documentRepo } from '@/lib/db/repos';
import { recordReportable } from '@/lib/diagnostics';
import { accidentChecklist, damageDraft, type ChecklistItem, type DamageRead, type Severity } from '@/lib/domain/workflowPhotos';
import { FEATURE_AI_ACCIDENT } from '@/lib/flagsAi';
import { todayIsoDate } from '@/lib/format';
import { t } from '@/lib/i18n';
import { getMedia, mediaUri } from '@/lib/media';
import { useTheme } from '@/lib/theme/useTheme';
import { useAiGate } from './useAiGate';

/**
 * Accident events (SPEC-G §G7). Two independent parts:
 *  - the DOCUMENT CHECKLIST (seguro, matrícula, denuncia, fotos, otro conductor): rules over the car's own documents, no AI, always shown
 *    for an accident. It never says what to claim or who is at fault.
 *  - "Describir los daños con IA": up to 4 of the event's photos → a neutral description, the areas and a leve/moderado/grave GUESS. Each
 *    piece is applied only when tapped. No claim advice, no liability, no costs: the server removes any text that goes there.
 */
export function DamageAssist({
  vehicleId,
  eventType,
  photoIds,
  story,
  onUseDescription,
  onUseSeverity,
}: {
  vehicleId: string;
  eventType: string;
  photoIds: string[];
  story: string;
  onUseDescription: (text: string, mode: 'set' | 'append') => void;
  onUseSeverity: (s: Severity) => void;
}) {
  const { theme } = useTheme();
  const { ready, sheet, featureOff } = useAiGate();
  const [checklist, setChecklist] = useState<ChecklistItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<DamageRead | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const alive = useRef(true);
  useEffect(() => () => void (alive.current = false), []);

  useEffect(() => {
    if (eventType !== 'accidente') return;
    let live = true;
    void documentRepo
      .listWhere({ vehicleId })
      .then((docs) => live && setChecklist(accidentChecklist(docs.map((d) => ({ kind: d.kind, expiresAt: d.expiresAt })), todayIsoDate(), { photoCount: photoIds.length })))
      .catch(() => live && setChecklist(accidentChecklist([], todayIsoDate(), { photoCount: photoIds.length })));
    return () => {
      live = false;
    };
  }, [vehicleId, eventType, photoIds.length]);

  if (eventType !== 'accidente' && eventType !== 'dano_menor') return null;
  const x = t.ai.accident;

  async function describe() {
    if (!ready()) return;
    setBusy(true);
    setNote(null);
    try {
      const images: PreparedImage[] = [];
      for (const id of photoIds.slice(0, 4)) {
        const uri = await mediaUri(await getMedia(id));
        if (!uri) continue;
        try {
          images.push(await prepareForAi(uri));
        } finally {
          if (Platform.OS === 'web') URL.revokeObjectURL(uri);
        }
      }
      if (!images.length) return setNote(x.noPhotos);
      const r = await readImages('damage_photos', images);
      if (!alive.current) return;
      const d = damageDraft(r.fields, r.items);
      setDraft(d);
      if (!d.description && !d.severity && !d.areas.length) setNote(x.nothing);
    } catch (e) {
      if (!alive.current) return;
      if (e instanceof TooLargeError) setNote(t.ai.capture.tooLarge);
      else if (e instanceof AiError) setNote(e.code === 'unreadable' ? x.nothing : e.code === 'offline' ? x.offline : t.ai.errors[e.code]);
      else {
        recordReportable('ai-damage', e);
        setNote(t.ai.errors.internal);
      }
    } finally {
      if (alive.current) setBusy(false);
    }
  }

  const stateColor = (s: ChecklistItem['state']) => (s === 'ok' ? theme.statusText.ok : s === 'todo' ? theme.text.secondary : theme.statusText.vencido);

  return (
    <View style={{ gap: space.sm, marginTop: space.md }}>
      {eventType === 'accidente' && checklist ? (
        <Surface padded>
          <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11 }}>
            {x.checklistTitle}
          </T>
          {checklist.map((c) => (
            <T key={c.id} face="body" style={{ color: stateColor(c.state), fontSize: 14, marginTop: 4 }}>
              {`${c.state === 'ok' ? '✓' : c.state === 'todo' ? '•' : '!'} ${x.items[c.id]}${c.state === 'missing' ? ` — ${x.missing}` : c.state === 'expired' ? ` — ${x.expired}` : ''}`}
            </T>
          ))}
          <T face="body" style={{ color: theme.text.muted, fontSize: 11, marginTop: space.xs }}>
            {x.checklistNote}
          </T>
        </Surface>
      ) : null}

      {FEATURE_AI_ACCIDENT && !featureOff('accident') ? (
        <Surface padded>
          <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11 }}>
            {x.title}
          </T>
          <T face="body" style={{ color: theme.text.secondary, fontSize: 13, marginTop: 2 }}>
            {photoIds.length ? x.intro : x.addPhotosFirst}
          </T>
          {busy ? (
            <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center', marginTop: space.xs }} accessibilityLiveRegion="polite">
              <ActivityIndicator color={theme.text.muted} />
              <T face="body" style={{ color: theme.text.secondary, fontSize: 13 }}>
                {x.reading}
              </T>
            </View>
          ) : (
            <GhostButton label={x.ask} onPress={() => void describe()} disabled={!photoIds.length} />
          )}
          {note ? (
            <T face="body" accessibilityLiveRegion="polite" style={{ color: theme.accent, fontSize: 13, marginTop: space.xs }}>
              {note}
            </T>
          ) : null}
          {draft ? (
            <View style={{ gap: 4, marginTop: space.xs }}>
              {draft.description ? (
                <>
                  <T face="body" selectable style={{ color: theme.text.primary, fontSize: 14, lineHeight: 20 }}>
                    {draft.description}
                  </T>
                  <GhostButton label={story.trim() ? x.appendDescription : x.useDescription} onPress={() => onUseDescription(draft.description!, story.trim() ? 'append' : 'set')} />
                </>
              ) : null}
              {draft.areas.length ? (
                <T face="body" style={{ color: theme.text.secondary, fontSize: 13 }}>
                  {`${x.areas}: ${draft.areas.map((a) => x.areaNames[a]).join(', ')}`}
                </T>
              ) : null}
              {draft.severity ? (
                <GhostButton label={x.useSeverity(t.events.severity, x.severityNames[draft.severity])} onPress={() => onUseSeverity(draft.severity!)} />
              ) : null}
              <T face="body" style={{ color: theme.text.muted, fontSize: 11 }}>
                {x.guess}
              </T>
            </View>
          ) : null}
        </Surface>
      ) : null}
      {sheet}
    </View>
  );
}
