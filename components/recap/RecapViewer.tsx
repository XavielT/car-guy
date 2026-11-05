import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Animated, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RecapCardView } from '@/components/recap/RecapCardView';
import { T } from '@/components/T';
import { palette, space } from '@/constants/theme';
import type { Recap } from '@/lib/domain/recap';
import { t } from '@/lib/i18n';
import { cardText } from '@/lib/recap/copy';
import { useLayout } from '@/lib/theme/useLayout';

/** Seconds a card stays before the next (SPEC-J §J4); none at all with "reduce motion". */
export const AUTO_ADVANCE_MS = 6000;

/**
 * The story viewer (SPEC-J §J4): tap right/left, hold to pause, progress segments, close, keyboard (← → Space Esc), auto-advance unless the
 * person asked for reduced motion. Each card is an accessible group whose label is the whole sentence. Phone: the card fills the screen;
 * wide: a centred 9:16 card with a side list of the cards.
 */
export function RecapViewer({ recap, index, onIndex, onClose, onShare, onMonth }: { recap: Recap; index: number; onIndex: (i: number) => void; onClose: () => void; onShare: () => void; onMonth?: (month: number) => void }) {
  const reduced = useReducedMotion();
  const { wide } = useLayout();
  const { width, height } = useWindowDimensions();
  const [paused, setPaused] = useState(false);
  const [progress] = useState(() => new Animated.Value(0));
  const total = recap.cards.length;
  const texts = useMemo(() => recap.cards.map((c) => cardText(c, recap.period)), [recap]);

  const go = useCallback((d: number) => onIndex(Math.min(total - 1, Math.max(0, index + d))), [total, index, onIndex]);
  const next = useCallback(() => (index >= total - 1 ? onClose() : go(1)), [index, total, go, onClose]);

  // Auto-advance: the progress segment fills over 6 s; pausing (hold / Space) stops it where it is. Reduced motion: manual only.
  useEffect(() => {
    if (reduced || paused) return;
    progress.setValue(0);
    const anim = Animated.timing(progress, { toValue: 1, duration: AUTO_ADVANCE_MS, useNativeDriver: Platform.OS !== 'web', easing: (x) => x });
    anim.start(({ finished }) => {
      if (finished) next();
    });
    return () => anim.stop();
  }, [index, paused, reduced, progress, next]);

  // Keyboard on the web (SPEC-F): ← → Space Esc.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === ' ') {
        e.preventDefault();
        setPaused((p) => !p);
      } else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, onClose]);

  const card = recap.cards[index];
  const text = texts[index];
  const cardH = wide ? Math.min(820, height - 160) : height - 150;
  const cardW = wide ? Math.round((cardH * 9) / 16) : width;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: '#0A0907' }]}>
      <View style={[styles.top, wide && { alignSelf: 'center', width: cardW }]}>
        <View style={styles.segments}>
          {recap.cards.map((_, i) => (
            <View key={i} style={styles.segTrack}>
              {i < index || (reduced && i === index) ? (
                <View style={[styles.segFill, { width: '100%' }]} />
              ) : i === index ? (
                <Animated.View style={[styles.segFill, { width: '100%', transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-(wide ? cardW : width - 32) / Math.max(1, total), 0] }) }] }]} />
              ) : null}
            </View>
          ))}
        </View>
        <View style={styles.bar}>
          <T face="eyebrow" style={{ color: '#C9C2B6', fontSize: 11 }} accessibilityLiveRegion="polite">
            {t.recap.viewer.card(index + 1, total)}
            {recap.partial ? ` · ${t.recap.viewer.soFarBadge}` : ''}
          </T>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Pressable onPress={() => setPaused((p) => !p)} accessibilityRole="button" accessibilityLabel={paused ? t.recap.viewer.play : t.recap.viewer.pause} style={styles.iconBtn}>
              <Ionicons name={paused ? 'play' : 'pause'} size={20} color="#FFFFFF" />
            </Pressable>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t.recap.viewer.close} style={styles.iconBtn}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      </View>

      <View style={[styles.stage, wide && { flexDirection: 'row', justifyContent: 'center', gap: space.xl }]}>
        {wide ? (
          <ScrollView style={styles.side} accessibilityLabel={t.recap.viewer.list}>
            {texts.map((x, i) => (
              <Pressable key={i} onPress={() => onIndex(i)} accessibilityRole="button" accessibilityState={{ selected: i === index }} accessibilityLabel={x.sentence} style={[styles.sideRow, i === index && { borderColor: '#FFB000' }]}>
                <T face="eyebrow" style={{ color: i === index ? '#FFB000' : '#C9C2B6', fontSize: 11 }}>
                  {x.eyebrow}
                </T>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        <View style={{ width: cardW, height: cardH }} accessible accessibilityLabel={text.sentence} accessibilityRole="summary">
          <RecapCardView text={text} kind={card.kind} w={cardW} h={cardH} footer="CAR GUY" />
          {/* Tap zones: left third back, the rest forward; hold anywhere pauses. They are real buttons for assistive tech. */}
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            <View style={styles.zones}>
              <Pressable onPress={() => go(-1)} onLongPress={() => setPaused(true)} onPressOut={() => paused && setPaused(false)} accessibilityRole="button" accessibilityLabel={t.recap.viewer.prev} style={{ flex: 1 }} />
              <Pressable onPress={next} onLongPress={() => setPaused(true)} onPressOut={() => paused && setPaused(false)} accessibilityRole="button" accessibilityLabel={t.recap.viewer.next} style={{ flex: 2 }} />
            </View>
          </View>
        </View>
      </View>

      <View style={[styles.actions, wide && { alignSelf: 'center', width: cardW }]}>
        {card.kind === 'months' && onMonth ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
            {card.months.map((m, i) => (
              <Pressable key={i} onPress={() => onMonth(m.month)} disabled={m.km <= 0 && m.spend <= 0} accessibilityRole="button" accessibilityLabel={text.bars?.[i]?.label ?? String(i + 1)} style={[styles.chip, m.km <= 0 && m.spend <= 0 && { opacity: 0.35 }]}>
                <T face="semibold" style={{ color: '#FFFFFF', fontSize: 13 }}>
                  {text.bars?.[i]?.label}
                </T>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <View />
        )}
        {recap.shareable ? (
          <Pressable onPress={onShare} accessibilityRole="button" style={styles.share}>
            <Ionicons name="share-outline" size={18} color="#14110D" />
            <T face="semibold" style={{ color: '#14110D', fontSize: 15 }}>
              {t.recap.viewer.share}
            </T>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  top: { paddingHorizontal: 16, paddingTop: 8 },
  segments: { flexDirection: 'row', gap: 4 },
  segTrack: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' },
  segFill: { height: 3, backgroundColor: '#FFB000' },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  stage: { flex: 1, alignItems: 'center' },
  side: { width: 200, maxHeight: 700 },
  sideRow: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 12, borderLeftWidth: 3, borderColor: 'transparent' },
  zones: { flex: 1, flexDirection: 'row' },
  actions: { minHeight: 64, paddingHorizontal: 16, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  chip: { minHeight: 44, minWidth: 44, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
  share: { minHeight: 48, paddingHorizontal: 20, borderRadius: 24, backgroundColor: palette.dark.accentFill, flexDirection: 'row', alignItems: 'center', gap: 8 },
});
