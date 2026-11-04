import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';

import { T } from '@/components/T';
import { radius, space } from '@/constants/theme';
import { Alert } from '@/lib/alert';
import { AiError } from '@/lib/ai/codes';
import { prepareForAi, TooLargeError } from '@/lib/ai/prepareImage';
import { readImages, type ReadKind, type ReadResult } from '@/lib/ai/read';
import { useAiStatus } from '@/lib/ai/useAiStatus';
import { recordReportable } from '@/lib/diagnostics';
import { firstImage } from '@/lib/desktop/dropPaste';
import { t } from '@/lib/i18n';
import { pickCandidates } from '@/lib/media';
import { useTheme } from '@/lib/theme/useTheme';
import { AiConsentSheet } from './AiConsentSheet';
import { usePermissionRequest } from '../permissions/usePermissionRequest';

/**
 * "Escanear recibo" / "Foto del tablero" / "Escanear factura"… (IMP 03112026 SPEC-B §B2, ADR-67).
 *
 * One tap: a photo (camera on the phone, file picker on the web), compressed and sent to `cg-ai-read`, and the result is
 * handed to `onRead` to PRE-FILL the screen's existing form. Nothing is saved here and nothing is saved by the AI: the
 * person reviews and uses the form's normal Save.
 *
 * The button never hides. When AI cannot be used it says why (account, consent, offline, limit, switched off) and the
 * manual form underneath is untouched. A failed or unreadable read changes nothing in the form.
 */
export function CaptureButton({
  kind,
  label,
  onRead,
  icon = 'scan-outline',
  style,
  extra,
}: {
  kind: ReadKind;
  label: string;
  /** The read result and the photo it came from (kept by the caller as the record's media). */
  onRead: (result: ReadResult, photo: { uri: string }) => void;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: object;
  /** Closed-list context for the kind (check_photo: the item). */
  extra?: Record<string, string>;
}) {
  const { theme } = useTheme();
  const ai = useAiStatus();
  const cameraPermission = usePermissionRequest('camera');
  const [busy, setBusy] = useState(false);
  const [consentSheet, setConsentSheet] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const unavailable = ai.state !== 'available' && ai.state !== 'loading';

  // Desktop (SPEC-F §F3): drop a photo on the button, or paste one while the pointer is over it or it has focus. Same pipeline as a picked photo.
  const box = useRef<View>(null);
  const latest = useRef({ allowed, process, busy });
  useEffect(() => {
    latest.current = { allowed, process, busy };
  });
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = box.current as unknown as HTMLElement | null;
    if (!el || typeof el.addEventListener !== 'function') return;
    let over = false;
    const take = (files: FileList | null | undefined) => {
      const file = firstImage(files);
      const cur = latest.current;
      if (!file || cur.busy || !cur.allowed()) return;
      const url = URL.createObjectURL(file as File);
      void cur.process(url, null).finally(() => setTimeout(() => URL.revokeObjectURL(url), 60_000));
    };
    const onOver = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes('Files')) e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      take(e.dataTransfer?.files);
    };
    const onEnter = () => (over = true);
    const onLeave = () => (over = false);
    const onPaste = (e: ClipboardEvent) => {
      if (!over && !el.contains(document.activeElement)) return;
      const typing = /^(INPUT|TEXTAREA)$/.test((e.target as HTMLElement | null)?.tagName ?? '');
      if (typing) return;
      take(e.clipboardData?.files);
    };
    el.addEventListener('dragover', onOver);
    el.addEventListener('drop', onDrop);
    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mouseleave', onLeave);
    window.addEventListener('paste', onPaste);
    return () => {
      el.removeEventListener('dragover', onOver);
      el.removeEventListener('drop', onDrop);
      el.removeEventListener('mouseenter', onEnter);
      el.removeEventListener('mouseleave', onLeave);
      window.removeEventListener('paste', onPaste);
    };
  }, []);

  /** The same three steps in front of every AI call: consent first, then say why it cannot be used. */
  function allowed(): boolean {
    if (ai.state === 'needs_consent') {
      setConsentSheet(true);
      return false;
    }
    if (ai.state !== 'available') {
      Alert.alert(t.ai.consent.title, ai.message);
      return false;
    }
    return true;
  }

  async function go(camera: boolean) {
    if (!allowed()) return;
    // The camera is asked with its primer first (ADR-59). Never an await before the picker on web (it needs the tap's gesture).
    if (camera && Platform.OS !== 'web' && !(await cameraPermission.ensure())) return;
    let candidate;
    try {
      [candidate] = await pickCandidates({ camera });
    } catch (e) {
      recordReportable('ai-capture-pick', e);
      Alert.alert(t.common.photoErrorTitle, t.common.photoPickError);
      return;
    }
    if (!candidate) return;
    await process(candidate.uri, candidate.width);
  }

  /** Reads one photo (picked, dropped or pasted) and hands the result on. */
  async function process(uri: string, sourceWidth: number | null) {
    setBusy(true);
    try {
      const image = await prepareForAi(uri, { sourceWidth });
      const result = await readImages(kind, [image], extra);
      if (mounted.current) onRead(result, { uri });
    } catch (e) {
      if (!mounted.current) return;
      if (e instanceof TooLargeError) Alert.alert(t.ai.consent.title, t.ai.capture.tooLarge);
      else if (e instanceof AiError) Alert.alert(t.ai.consent.title, e.code === 'unreadable' ? t.ai.capture.nothingRead : t.ai.errors[e.code]);
      else {
        recordReportable('ai-capture', e);
        Alert.alert(t.ai.consent.title, t.ai.errors.internal);
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  const primary = (camera: boolean, text: string, name: keyof typeof Ionicons.glyphMap) => (
    <Pressable
      key={text}
      onPress={() => void go(camera)}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={text}
      accessibilityState={{ disabled: busy || unavailable }}
      style={[styles.action, { borderColor: unavailable ? theme.line : theme.accent, backgroundColor: theme.bg.raised, opacity: unavailable ? 0.65 : 1 }]}>
      <Ionicons name={name} size={16} color={unavailable ? theme.text.muted : theme.accent} />
      <T face="semibold" style={{ fontSize: 13, color: unavailable ? theme.text.muted : theme.text.primary }}>
        {text}
      </T>
    </Pressable>
  );

  return (
    <View ref={box} style={[styles.wrap, style]}>
      {cameraPermission.sheet}
      {busy ? (
        <View style={[styles.action, { borderColor: theme.line, backgroundColor: theme.bg.raised }]} accessibilityLiveRegion="polite">
          <ActivityIndicator color={theme.text.muted} />
          <T face="semibold" style={{ fontSize: 13, color: theme.text.secondary }}>
            {t.ai.capture.reading}
          </T>
        </View>
      ) : (
        <View style={styles.row}>
          {Platform.OS !== 'web' ? primary(true, label, icon) : primary(false, label, icon)}
          {Platform.OS !== 'web' ? primary(false, t.ai.capture.gallery, 'images-outline') : null}
        </View>
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
  row: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: radius.chip,
    paddingHorizontal: space.md,
    minHeight: 44,
    alignSelf: 'flex-start',
  },
});
