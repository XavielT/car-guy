import { Circle, Path, Rect } from 'react-native-svg';

import { AV, AvatarSvg, type AvatarArtProps } from './base';

/** Full-face helmet, side view, amber shell with a red stripe and a dark visor. Generic shape, no maker's graphics. */
export function HelmetFull({ size }: AvatarArtProps) {
  return (
    <AvatarSvg size={size}>
      <Path d="M28 84 Q24 46 58 34 Q96 24 106 60 L108 84 Q108 94 98 96 L40 96 Q30 96 28 84 Z" fill={AV.amber} />
      <Path d="M32 74 Q52 44 100 42" stroke={AV.red} strokeWidth={7} fill="none" strokeLinecap="round" />
      <Path d="M64 56 Q90 50 105 60 L107 74 Q86 77 68 74 Q60 66 64 56 Z" fill={AV.well} />
      <Path d="M72 59 Q86 56 98 60" stroke={AV.greyLight} strokeWidth={2} fill="none" strokeLinecap="round" />
      <Rect x={36} y={88} width={66} height={8} rx={3} fill={AV.amberDark} />
      <Circle cx={46} cy={72} r={4} fill={AV.well} />
    </AvatarSvg>
  );
}

/** Open-face helmet with goggles on the brow, front view. */
export function HelmetOpen({ size }: AvatarArtProps) {
  return (
    <AvatarSvg size={size}>
      <Path d="M28 90 Q22 30 64 28 Q106 30 100 90 Z" fill={AV.ink} />
      <Path d="M44 96 Q40 64 64 62 Q88 64 84 96 Z" fill={AV.page} />
      <Path d="M64 28 L64 44" stroke={AV.red} strokeWidth={8} />
      <Rect x={28} y={46} width={72} height={9} rx={4} fill={AV.red} />
      <Circle cx={51} cy={50} r={10} fill={AV.well} stroke={AV.amber} strokeWidth={3} />
      <Circle cx={77} cy={50} r={10} fill={AV.well} stroke={AV.amber} strokeWidth={3} />
      <Path d="M46 46 L50 44" stroke={AV.greyLight} strokeWidth={2} strokeLinecap="round" />
      <Path d="M72 46 L76 44" stroke={AV.greyLight} strokeWidth={2} strokeLinecap="round" />
    </AvatarSvg>
  );
}

/** Rounded kart-style full-face helmet, front view, visor down. */
export function HelmetKart({ size }: AvatarArtProps) {
  return (
    <AvatarSvg size={size}>
      <Path d="M26 74 Q26 26 64 26 Q102 26 102 74 Q102 102 64 104 Q26 102 26 74 Z" fill={AV.orange} />
      <Rect x={60} y={26} width={8} height={24} fill={AV.ink} />
      <Rect x={33} y={50} width={62} height={24} rx={11} fill={AV.well} />
      <Path d="M42 56 Q56 53 70 55" stroke={AV.amber} strokeWidth={3} fill="none" strokeLinecap="round" />
      <Rect x={50} y={84} width={6} height={10} rx={2} fill={AV.page} />
      <Rect x={61} y={84} width={6} height={12} rx={2} fill={AV.page} />
      <Rect x={72} y={84} width={6} height={10} rx={2} fill={AV.page} />
    </AvatarSvg>
  );
}
