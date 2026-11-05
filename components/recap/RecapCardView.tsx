import { StyleSheet, View } from 'react-native';

import { T } from '@/components/T';
import { palette } from '@/constants/theme';
import type { CardText } from '@/lib/recap/copy';

/** Accent per card kind: the JDM amber → orange → red range, so a recap reads as one family. */
export const CARD_ACCENT: Record<string, string> = {
  cover: '#FFB000',
  distance: '#FFB000',
  speed: '#FF6A00',
  fuel: '#FFB000',
  cost: '#FF6A00',
  care: '#E5A800',
  build: '#FF6A00',
  compare: '#FFB000',
  months: '#FF6A00',
  odometer: '#FFB000',
  garage: '#FF6A00',
  closer: '#E10600',
};

/**
 * ONE card, drawn at any size from a `CardText`: the story viewer draws it at the screen's width, the share image at 1080 px wide. Everything is
 * scaled from `w` (a 390 px card is 1×), so the exported image is the viewer's card, not a second design. Dark on purpose: ≥ 4.5:1 for the
 * text colours below on the card background (white and #FFB000 on #14110D are 17:1 and 9.6:1).
 */
export function RecapCardView({ text, kind, w, h, footer }: { text: CardText; kind: string; w: number; h: number; footer?: string }) {
  const u = w / 390;
  const accent = CARD_ACCENT[kind] ?? '#FFB000';
  const max = text.bars ? Math.max(1, ...text.bars.map((b) => b.value)) : 1;
  return (
    <View style={[styles.card, { width: w, height: h, padding: 28 * u, backgroundColor: palette.dark.bg.base }]}>
      <View style={{ height: 6 * u, width: 56 * u, backgroundColor: accent, borderRadius: 3 * u, marginBottom: 18 * u }} />
      <T face="eyebrow" style={{ color: accent, fontSize: 13 * u, letterSpacing: 2 * u }}>
        {text.eyebrow}
      </T>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <T face="display" numberOfLines={2} adjustsFontSizeToFit style={{ color: '#FFFFFF', fontSize: (text.big.length > 9 ? 52 : 72) * u, lineHeight: (text.big.length > 9 ? 56 : 76) * u }}>
          {text.big}
        </T>
        {text.caption ? (
          <T face="semibold" style={{ color: accent, fontSize: 18 * u, marginTop: 6 * u }}>
            {text.caption}
          </T>
        ) : null}
        {text.bars ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 120 * u, marginTop: 24 * u, gap: 4 * u }}>
            {text.bars.map((b, i) => (
              <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                <View style={{ width: '100%', height: Math.max(3 * u, (b.value / max) * 100 * u), backgroundColor: accent, borderRadius: 2 * u, opacity: b.value > 0 ? 1 : 0.25 }} />
                <T face="mono" style={{ color: '#C9C2B6', fontSize: 9 * u, marginTop: 4 * u }}>
                  {b.label}
                </T>
              </View>
            ))}
          </View>
        ) : null}
        <View style={{ marginTop: 22 * u, gap: 6 * u }}>
          {text.lines.map((l, i) => (
            <T key={i} face="body" style={{ color: '#E8E2D6', fontSize: 17 * u, lineHeight: 24 * u }}>
              {l}
            </T>
          ))}
        </View>
      </View>
      {footer ? (
        <T face="eyebrow" style={{ color: '#C9C2B6', fontSize: 12 * u, letterSpacing: 2 * u }}>
          {footer}
        </T>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden', borderRadius: 0 },
});
