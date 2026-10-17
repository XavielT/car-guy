import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { T } from '@/components/T';
import { Surface } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { useVersionSeen } from '@/lib/changelog/seen';
import { settings } from '@/lib/db/repos';
import type { FeatureId } from '@/lib/features/ids';
import { OBD_NOTICE_KEY, pickDiscover, TOOLS_TOUR_KEY } from '@/lib/features/discover';
import { featureById } from '@/lib/features/registry';
import { dismissDiscover, readDismissed, readUsed } from '@/lib/features/usage';
import { FEATURE_DIY } from '@/lib/flags';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme/useTheme';
import { featureCopy } from './FeatureCards';
import { useOpenFeature } from './useFeatures';

type Nudge = { kind: 'tour'; step: 1 | 2 } | { kind: 'obd' } | { kind: 'discover'; id: FeatureId };

/**
 * One card on Inicio, never two (SPEC-C §7–8): after an update that brings Herramientas, a two-step pointer to it
 * (it waits for the "Novedades" sheet to be read); the first time, OBD's "¿Se prendió una luz?"; then, one at a time,
 * a function the person has never used. Each can be dismissed and stays dismissed.
 */
export function HomeNudge({ hasVehicle, fillups }: { hasVehicle: boolean; fillups: number }) {
  const { theme } = useTheme();
  const { open } = useOpenFeature();
  const seen = useVersionSeen();
  const [nudge, setNudge] = useState<Nudge | null>(null);
  const [ready, setReady] = useState(false);
  const [bump, setBump] = useState(0);

  useEffect(() => {
    if (!hasVehicle) return;
    let live = true;
    void (async () => {
      const [tourDone, obdDone, used, dismissed] = await Promise.all([
        settings.get<boolean>(TOOLS_TOUR_KEY, false).catch(() => true),
        settings.get<boolean>(OBD_NOTICE_KEY, false).catch(() => true),
        readUsed(),
        readDismissed(),
      ]);
      if (!live) return;
      const usedSet = new Set(used);
      if (fillups > 0) usedSet.add('fuel');
      const next: Nudge | null = !tourDone
        ? { kind: 'tour', step: 1 }
        : FEATURE_DIY && !obdDone
          ? { kind: 'obd' }
          : (() => {
              const def = pickDiscover(usedSet, new Set(dismissed));
              return def ? { kind: 'discover', id: def.id } : null;
            })();
      setNudge((prev) => (prev?.kind === 'tour' && next?.kind === 'tour' ? prev : next));
      setReady(true);
    })();
    return () => {
      live = false;
    };
  }, [hasVehicle, fillups, bump]);

  const finishTour = useCallback(async () => {
    await settings.set(TOOLS_TOUR_KEY, true).catch(() => {});
    setBump((b) => b + 1);
  }, []);

  // The tour waits until the update notes were read (a sheet over a card helps nobody).
  if (!hasVehicle || !ready || !nudge || (nudge.kind === 'tour' && seen.sheetOpen)) return null;

  const card = (children: React.ReactNode) => (
    <Surface style={[styles.card, { borderColor: theme.accent }]}>{children}</Surface>
  );
  const link = (label: string, onPress: () => void, primary?: boolean, a11y?: string) => (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={a11y ?? label} style={[styles.action, primary && { backgroundColor: theme.accentFill }]}>
      <T face="semibold" style={{ color: primary ? theme.accentFillInk : theme.text.secondary, fontSize: 13 }}>
        {label}
      </T>
    </Pressable>
  );

  if (nudge.kind === 'tour') {
    const step = nudge.step;
    return card(
      <>
        <View style={styles.head}>
          <Ionicons name={step === 1 ? 'apps-outline' : 'search-outline'} size={20} color={theme.accent} />
          <T face="eyebrow" style={{ color: theme.accent, fontSize: 11 }}>
            {t.features.tour.eyebrow} · {step}/2
          </T>
        </View>
        <T face="body" style={{ color: theme.text.primary, fontSize: 14, lineHeight: 20 }}>
          {step === 1 ? t.features.tour.step1 : t.features.tour.step2}
        </T>
        <View style={styles.actions}>
          {link(t.features.tour.skip, () => void finishTour())}
          {link(step === 1 ? t.features.tour.next : t.features.tour.done, () => (step === 1 ? setNudge({ kind: 'tour', step: 2 }) : void finishTour()), true)}
        </View>
      </>,
    );
  }

  if (nudge.kind === 'obd') {
    const done = async () => {
      await settings.set(OBD_NOTICE_KEY, true).catch(() => {});
      setBump((b) => b + 1);
    };
    return card(
      <>
        <View style={styles.head}>
          <Ionicons name="pulse-outline" size={20} color={theme.accent} />
          <T face="eyebrow" style={{ color: theme.accent, fontSize: 11 }}>
            {t.features.items.obd.title}
          </T>
        </View>
        <T face="body" style={{ color: theme.text.primary, fontSize: 14, lineHeight: 20 }}>
          {t.features.obdFirst.text}
        </T>
        <View style={styles.actions}>
          {link(t.features.obdFirst.dismiss, () => void done())}
          {link(
            t.features.obdFirst.open,
            () => {
              void done();
              open(featureById('obd'));
            },
            true,
          )}
        </View>
      </>,
    );
  }

  const def = featureById(nudge.id);
  const copy = featureCopy(def);
  const dismiss = async () => {
    await dismissDiscover(def.id);
    setBump((b) => b + 1);
  };
  return card(
    <>
      <View style={styles.head}>
        <Ionicons name={def.icon} size={20} color={theme.accent} />
        <T face="eyebrow" style={{ color: theme.accent, fontSize: 11 }}>
          {t.features.discover.eyebrow}
        </T>
      </View>
      <T face="semibold" style={{ color: theme.text.primary, fontSize: 15 }}>
        {copy.title}
      </T>
      <T face="body" style={{ color: theme.text.secondary, fontSize: 13, lineHeight: 18 }}>
        {copy.desc}
      </T>
      <View style={styles.actions}>
        {link(t.features.discover.dismiss, () => void dismiss(), false, t.features.discover.dismissA11y)}
        {link(t.features.discover.open, () => open(def), true)}
      </View>
    </>,
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: space.md, gap: space.sm, borderWidth: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm, marginTop: space.xs },
  action: { minHeight: 44, minWidth: 44, paddingHorizontal: space.md, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center' },
});
