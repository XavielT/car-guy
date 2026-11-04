import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { T } from '@/components/T';
import { Field } from '@/components/Field';
import { GhostButton, PrimaryButton, Sheet } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { Alert } from '@/lib/alert';
import { AiError } from '@/lib/ai/codes';
import { setAiDraft } from '@/lib/ai/draft';
import { askIntent } from '@/lib/ai/intent';
import { intentToRoute, needsVehicleChoice, type IntentResult } from '@/lib/ai/intentRoute';
import { currentOdometer } from '@/lib/db/repos';
import { recordReportable } from '@/lib/diagnostics';
import { todayIsoDate } from '@/lib/format';
import { FEATURES, featureHref } from '@/lib/features/registry';
import { t } from '@/lib/i18n';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';
import { VoiceButton } from './VoiceButton';

/**
 * Dictate or type one sentence (IMP 03112026 SPEC-B §B3, ADR-67). Not a chat: one sentence in, ONE form out.
 *
 *   voice → transcript (editable) → `cg-ai-intent` → the SAME form the person already knows, pre-filled and marked.
 *
 * Nothing is saved here. If the sentence could be about several cars the person picks; a car is never guessed. A typed
 * sentence works the same without the microphone, so the feature is usable without the permission or without audio.
 */
export function DictateSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const { theme } = useTheme();
  const { data, activeVehicle, setActiveVehicle } = useStore();
  const [text, setText] = useState('');
  const [fromVoice, setFromVoice] = useState(false);
  const [busy, setBusy] = useState(false);
  const [choice, setChoice] = useState<IntentResult | null>(null);

  const reset = () => {
    setText('');
    setFromVoice(false);
    setChoice(null);
    setBusy(false);
  };
  const close = () => {
    reset();
    onClose();
  };

  /** Opens the target form with the draft. `vehicleId` is the car the sentence is about (null: the active one). */
  function open(result: IntentResult, vehicleId: string | null) {
    const target = vehicleId ?? activeVehicle?.id ?? null;
    const detail = data.vehicles.find((v) => v.id === target)?.detail;
    const route = intentToRoute(result, {
      volumeUnit: detail?.volumeUnit ?? 'gal',
      featureHref: (id) => {
        const def = FEATURES.find((f) => f.id === id);
        return def ? featureHref(def, target) : null;
      },
    });
    if (!route) {
      Alert.alert(t.ai.consent.title, t.ai.voice.notUnderstood);
      return;
    }
    if (target && target !== activeVehicle?.id) setActiveVehicle(target);
    if (route.draft) {
      setAiDraft({ form: route.draft.form, prefill: route.draft.prefill, marks: route.draft.marks, photos: [], source: fromVoice ? 'voice' : 'text', vehicleId: target });
    }
    close();
    router.push({ pathname: route.pathname as never, params: route.params as never });
  }

  async function understand() {
    const sentence = text.trim();
    if (!sentence || busy) return;
    setBusy(true);
    try {
      const lastOdometer = activeVehicle ? await currentOdometer(activeVehicle.id).catch(() => null) : null;
      const result = await askIntent(sentence, {
        // Minimal on purpose (SPEC-B §B3): names and ids, today, the last odometer and the sections that can be opened.
        vehicles: data.vehicles.filter((v) => !v.isArchived).map((v) => ({ id: v.id, name: v.name })),
        today: todayIsoDate(),
        lastOdometer,
        fuelType: null,
        features: FEATURES.map((f) => f.id),
      });
      if (needsVehicleChoice(result)) {
        setChoice(result);
        return;
      }
      open(result, result.vehicle?.id ?? null);
    } catch (e) {
      if (e instanceof AiError) Alert.alert(t.ai.consent.title, e.code === 'unreadable' ? t.ai.voice.notUnderstood : t.ai.errors[e.code]);
      else {
        recordReportable('ai-intent', e);
        Alert.alert(t.ai.consent.title, t.ai.errors.internal);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={visible} onClose={close} title={t.ai.voice.title}>
      <T face="body" style={{ color: theme.text.secondary, fontSize: 14, lineHeight: 20, marginBottom: space.md }}>
        {t.ai.voice.hint}
      </T>

      {choice ? (
        <View>
          <T face="semibold" style={{ color: theme.text.primary, fontSize: 14, marginBottom: space.sm }}>
            {t.ai.voice.pickCar}
          </T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.md }}>
            {(choice.choices ?? []).map((c) => (
              <Pressable
                key={c.id}
                onPress={() => open(choice, c.id)}
                accessibilityRole="button"
                style={{ minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: theme.accent, borderRadius: radius.chip, paddingHorizontal: space.md, backgroundColor: theme.bg.raised }}>
                <T face="semibold" style={{ color: theme.text.primary, fontSize: 14 }}>
                  {c.name}
                </T>
              </Pressable>
            ))}
          </View>
          <GhostButton label={t.common.cancel} onPress={() => setChoice(null)} />
        </View>
      ) : (
        <>
          <VoiceButton
            disabled={busy}
            onTranscript={(spoken) => {
              setText(spoken);
              setFromVoice(true);
            }}
          />
          <Field
            label={t.ai.voice.placeholder}
            value={text}
            multiline
            onChangeText={(v) => {
              setText(v);
              if (!v.trim()) setFromVoice(false);
            }}
          />
          <T face="body" style={{ color: theme.text.muted, fontSize: 12, lineHeight: 17, marginBottom: space.md }}>
            {t.ai.voice.reviewNote}
          </T>
          <PrimaryButton label={busy ? t.ai.voice.understanding : t.ai.voice.continue} onPress={() => void understand()} disabled={busy || !text.trim()} />
        </>
      )}
    </Sheet>
  );
}
