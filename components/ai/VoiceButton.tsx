import Ionicons from '@expo/vector-icons/Ionicons';
import { RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { T } from '@/components/T';
import { radius, space } from '@/constants/theme';
import { Alert } from '@/lib/alert';
import { AiError } from '@/lib/ai/codes';
import { useAiStatus } from '@/lib/ai/useAiStatus';
import { ClipTooLargeError, discardClip, MAX_RECORD_MS, MIN_RECORD_MS, prepareClip, transcribe } from '@/lib/ai/voice';
import { recordReportable } from '@/lib/diagnostics';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme/useTheme';
import { AiConsentSheet } from './AiConsentSheet';
import { usePermissionRequest } from '../permissions/usePermissionRequest';

/**
 * "Hablar" (IMP 03112026 SPEC-B §B3, ADR-67): tap to start, tap to stop (or 30 s), the clip is sent to `cg-stt` and
 * the TRANSCRIPT is handed to `onTranscript`. It never acts on what was said: the caller shows the text, the person
 * edits it, and only then is it interpreted. Foreground recording only: the recorder stops when this unmounts.
 *
 * Like the capture buttons it never hides: when AI or the microphone cannot be used it says why, and typing the
 * sentence stays available underneath.
 */
export function VoiceButton({ onTranscript, disabled }: { onTranscript: (text: string) => void; disabled?: boolean }) {
  const { theme } = useTheme();
  const ai = useAiStatus();
  const mic = usePermissionRequest('microphone');
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const rec = useAudioRecorderState(recorder, 250);
  const [phase, setPhase] = useState<'idle' | 'recording' | 'sending'>('idle');
  const [consentSheet, setConsentSheet] = useState(false);
  const mounted = useRef(true);
  const stopping = useRef(false);
  const recording = useRef(false);
  const startedAt = useRef(0);
  const limitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (limitTimer.current) clearTimeout(limitTimer.current);
      // Never keep the microphone open behind another screen.
      if (recording.current) void recorder.stop().catch(() => {});
    };
    // The recorder object is stable for the life of the component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unavailable = ai.state !== 'available' && ai.state !== 'loading';

  async function start() {
    if (ai.state === 'needs_consent') {
      setConsentSheet(true);
      return;
    }
    if (ai.state !== 'available') {
      Alert.alert(t.ai.consent.title, ai.message);
      return;
    }
    if (!(await mic.ensure())) return;
    try {
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      recording.current = true;
      stopping.current = false;
      startedAt.current = Date.now();
      // The 30 s limit (the server's cap is sized for it).
      limitTimer.current = setTimeout(() => void stopAndSend(), MAX_RECORD_MS);
      if (mounted.current) setPhase('recording');
    } catch (e) {
      recordReportable('ai-voice-start', e);
      Alert.alert(t.ai.consent.title, t.ai.voice.recordFailed);
    }
  }

  async function stopAndSend() {
    if (stopping.current) return;
    stopping.current = true;
    if (limitTimer.current) clearTimeout(limitTimer.current);
    const durationMs = Date.now() - startedAt.current;
    let uri: string | null = null;
    try {
      await recorder.stop();
      recording.current = false;
      uri = recorder.uri;
      await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      if (!uri || durationMs < MIN_RECORD_MS) {
        if (mounted.current) setPhase('idle');
        Alert.alert(t.ai.consent.title, t.ai.voice.tooShort);
        return;
      }
      if (mounted.current) setPhase('sending');
      const clip = await prepareClip(uri);
      const text = await transcribe(clip);
      if (mounted.current) onTranscript(text);
    } catch (e) {
      if (!mounted.current) return;
      if (e instanceof ClipTooLargeError) Alert.alert(t.ai.consent.title, t.ai.voice.tooLarge);
      else if (e instanceof AiError) Alert.alert(t.ai.consent.title, e.code === 'unreadable' ? t.ai.voice.tooShort : t.ai.errors[e.code]);
      else {
        recordReportable('ai-voice', e);
        Alert.alert(t.ai.consent.title, t.ai.voice.recordFailed);
      }
    } finally {
      recording.current = false;
      void discardClip(uri);
      if (mounted.current) setPhase('idle');
    }
  }

  const seconds = Math.floor(rec.durationMillis / 1000);
  const label = phase === 'recording' ? t.ai.voice.stop : t.ai.voice.start;
  const tint = unavailable ? theme.text.muted : phase === 'recording' ? theme.danger : theme.accent;

  return (
    <View style={styles.wrap}>
      {mic.sheet}
      {phase === 'sending' ? (
        <View style={[styles.action, { borderColor: theme.line, backgroundColor: theme.bg.raised }]} accessibilityLiveRegion="polite">
          <ActivityIndicator color={theme.text.muted} />
          <T face="semibold" style={{ fontSize: 13, color: theme.text.secondary }}>
            {t.ai.voice.transcribing}
          </T>
        </View>
      ) : (
        <Pressable
          onPress={() => void (phase === 'recording' ? stopAndSend() : start())}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ disabled: Boolean(disabled) || unavailable }}
          style={[styles.action, { borderColor: tint, backgroundColor: theme.bg.raised, opacity: unavailable ? 0.65 : 1 }]}>
          <Ionicons name={phase === 'recording' ? 'stop-circle' : 'mic-outline'} size={18} color={tint} />
          <T face="semibold" style={{ fontSize: 13, color: unavailable ? theme.text.muted : theme.text.primary }}>
            {phase === 'recording' ? `${label} · ${t.ai.voice.recording(seconds)}` : label}
          </T>
        </Pressable>
      )}
      {unavailable ? (
        <T face="body" accessibilityLiveRegion="polite" style={{ fontSize: 12, lineHeight: 17, color: theme.text.muted, marginTop: 4 }}>
          {ai.message}
        </T>
      ) : null}
      <AiConsentSheet
        visible={consentSheet}
        onClose={() => setConsentSheet(false)}
        onAccept={() => {
          void ai.setConsent(true).then((ok) => {
            if (ok && mounted.current) setConsentSheet(false);
          });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space.md },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: radius.chip,
    paddingHorizontal: space.md,
    minHeight: 44,
    alignSelf: 'flex-start',
  },
});
