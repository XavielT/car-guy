import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';

import { T } from '@/components/T';
import { GhostButton, PrimaryButton, Sheet } from '@/components/ui';
import { palette, space } from '@/constants/theme';
import { agoText } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme/useTheme';
import { currentPlatform, isIosWeb } from '@/lib/platform/capabilities';
import type { GpsNotice } from '@/lib/trips/gpsNotice';
import { askMyLocation, refreshMyPosition } from '@/lib/trips/myPosition';

const ink = palette.dark;
/** How long "Buscando GPS…" waits before offering "Reintentar" (SPEC-A). */
const RETRY_AFTER_MS = 15_000;

/**
 * The position notice of Modo conducir as something you can press (IMP 16102026 M-2). It used to be a line of text
 * saying "Sin permiso de ubicación" — to someone who had never been asked, with nothing to do about it.
 *
 *  - never asked  → "Activar mi ubicación": asks from the tap (the web needs a gesture);
 *  - blocked      → "Cómo activarla": Android opens the app's settings, the web shows the exact steps and
 *                   "Ya la activé" reads the permission again;
 *  - read failed  → "Reintentar";
 *  - the rest is a status line (a button after 15 s of searching).
 *
 * Phase 2's permission registry replaces this with its chip; the behaviour stays.
 */
export function GpsNoticeButton({ notice, top }: { notice: Exclude<GpsNotice, null>; top: number }) {
  const { theme } = useTheme();
  const [steps, setSteps] = useState(false);
  const [searchedLong, setSearchedLong] = useState(false);

  // The parent keys this component on the notice's kind, so the wait starts over whenever the kind changes.
  useEffect(() => {
    if (notice.kind !== 'searching') return;
    const id = setTimeout(() => setSearchedLong(true), RETRY_AFTER_MS);
    return () => clearTimeout(id);
  }, [notice.kind]);

  const native = Platform.OS !== 'web';
  const iphone = isIosWeb(currentPlatform());

  const ask = async () => {
    const result = await askMyLocation();
    if (result === 'blocked') {
      if (native) void Linking.openSettings();
      else setSteps(true);
    }
  };

  let label: string;
  let onPress: (() => void) | null = null;
  let a11y: string | undefined;
  switch (notice.kind) {
    case 'ask':
      label = t.drive.gpsAsk;
      a11y = t.drive.gpsAskA11y;
      onPress = () => void ask();
      break;
    case 'blocked':
      label = t.drive.gpsBlocked;
      onPress = () => (native ? void Linking.openSettings() : setSteps(true));
      break;
    case 'error':
      label = t.drive.gpsError;
      onPress = () => void refreshMyPosition();
      break;
    case 'approx':
      label = t.drive.gpsApprox(notice.acc == null ? null : Math.round(notice.acc));
      break;
    case 'stale':
      label = t.drive.lastPosition(agoText(notice.ageMs));
      break;
    case 'searching':
    default:
      label = searchedLong ? `${t.drive.gpsSearching} · ${t.drive.gpsRetry}` : t.drive.gpsSearching;
      if (searchedLong) onPress = () => void refreshMyPosition();
  }

  const body = (
    <T face={onPress ? 'semibold' : 'body'} style={{ color: onPress ? ink.accent : ink.text.secondary, fontSize: 13 }}>
      {label}
    </T>
  );

  return (
    <>
      {onPress ? (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={a11y ?? label}
          hitSlop={8}
          style={[styles.pill, { top, borderColor: ink.accent, minHeight: 44 }]}>
          {body}
        </Pressable>
      ) : (
        <View style={[styles.pill, { top, borderColor: ink.lineStrong }]} accessibilityLiveRegion="polite">
          {body}
        </View>
      )}
      <Sheet visible={steps} onClose={() => setSteps(false)} title={t.drive.gpsStepsTitle}>
        <T face="body" style={[styles.intro, { color: theme.text.secondary }]}>
          {t.drive.gpsStepsIntro}
        </T>
        {(iphone ? t.drive.gpsStepsIphone : t.drive.gpsStepsWeb).map((step, i) => (
          <T key={step} face="body" style={[styles.step, { color: theme.text.primary }]}>
            {i + 1}. {step}
          </T>
        ))}
        <View style={{ gap: space.sm, marginTop: space.md }}>
          <PrimaryButton
            label={t.drive.gpsDone}
            onPress={() => {
              setSteps(false);
              void refreshMyPosition();
            }}
          />
          <GhostButton label={t.common.close} onPress={() => setSteps(false)} />
        </View>
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  pill: {
    position: 'absolute',
    alignSelf: 'center',
    maxWidth: '88%',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: space.md,
    paddingVertical: 8,
    justifyContent: 'center',
    backgroundColor: 'rgba(18,18,18,0.92)',
  },
  intro: { fontSize: 14, lineHeight: 21, marginBottom: space.sm },
  step: { fontSize: 15, lineHeight: 22, marginBottom: space.sm },
});
