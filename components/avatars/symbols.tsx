import { StyleSheet, Text, View } from 'react-native';
import { Circle, Line, Rect } from 'react-native-svg';

import { fonts } from '@/constants/theme';
import { AV, AvatarSvg, type AvatarArtProps } from './base';

/** A chequered flag on its pole: 6 × 4 squares, amber pole, red cap. */
export function Checkered({ size }: AvatarArtProps) {
  const squares = [];
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 6; col += 1) {
      squares.push(
        <Rect key={`${row}-${col}`} x={38 + col * 10} y={30 + row * 11} width={10} height={11} fill={(row + col) % 2 ? AV.well : AV.ink} />,
      );
    }
  }
  return (
    <AvatarSvg size={size}>
      <Line x1={34} y1={24} x2={34} y2={108} stroke={AV.amber} strokeWidth={5} strokeLinecap="round" />
      <Circle cx={34} cy={22} r={5} fill={AV.red} />
      {squares}
      <Rect x={38} y={30} width={60} height={44} fill="none" stroke={AV.amber} strokeWidth={2} />
    </AvatarSvg>
  );
}

/**
 * A kanji on a disc. The glyph is text in the subset Noto Sans JP the app
 * already ships (tools/subset-fonts.sh keeps 改 走 峠), laid over the SVG in a
 * React Native Text so it uses the same loaded font on every platform.
 */
function KanjiDisc({ size, char, disc, ring, ink }: AvatarArtProps & { char: string; disc: string; ring: string; ink: string }) {
  return (
    <View style={{ width: size, height: size }}>
      <AvatarSvg size={size}>
        <Circle cx={64} cy={64} r={46} fill={disc} stroke={ring} strokeWidth={4} />
      </AvatarSvg>
      <View style={[StyleSheet.absoluteFill, styles.centre]} pointerEvents="none">
        <Text
          allowFontScaling={false}
          style={{ fontFamily: fonts.kanaBold, color: ink, fontSize: size * 0.4, lineHeight: size * 0.5, includeFontPadding: false, textAlign: 'center' }}>
          {char}
        </Text>
      </View>
    </View>
  );
}

/** 改 (kai) — modified, as in kaizō. */
export function KanjiKai({ size }: AvatarArtProps) {
  return <KanjiDisc size={size} char="改" disc={AV.red} ring={AV.red} ink={AV.ink} />;
}

/** 走 (hashiru) — to run, to drive. */
export function KanjiHashiru({ size }: AvatarArtProps) {
  return <KanjiDisc size={size} char="走" disc={AV.amber} ring={AV.amberDark} ink={AV.page} />;
}

/** 峠 (tōge) — the mountain pass. */
export function KanjiTouge({ size }: AvatarArtProps) {
  return <KanjiDisc size={size} char="峠" disc={AV.page} ring={AV.amber} ink={AV.amber} />;
}

const styles = StyleSheet.create({
  centre: { alignItems: 'center', justifyContent: 'center' },
});
