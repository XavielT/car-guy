import { Path, Rect } from 'react-native-svg';

import { AV, AvatarSvg, CarWheel, type AvatarArtProps } from './base';

/*
 * Generic side silhouettes built from a handful of straight lines and soft
 * corners — deliberately no real model's proportions, no grille, no lights
 * with a signature shape, no badge (PROGRESS.md trademark checklist).
 */

const GROUND = 'M14 98 L114 98';

export function CarCoupe({ size }: AvatarArtProps) {
  return (
    <AvatarSvg size={size}>
      <Path d={GROUND} stroke={AV.ring} strokeWidth={2} />
      <Path d="M14 86 L14 76 Q16 70 26 68 L44 64 L58 52 Q62 50 70 50 L84 50 Q90 50 96 56 L104 64 L112 66 Q116 68 116 74 L116 86 Z" fill={AV.amber} />
      <Path d="M61 55 L70 53 L84 53 Q88 53 92 58 L97 63 L52 63 Z" fill={AV.well} />
      <Rect x={18} y={74} width={94} height={3} fill={AV.red} />
      <CarWheel cx={38} cy={86} />
      <CarWheel cx={92} cy={86} />
    </AvatarSvg>
  );
}

export function CarHatch({ size }: AvatarArtProps) {
  return (
    <AvatarSvg size={size}>
      <Path d={GROUND} stroke={AV.ring} strokeWidth={2} />
      <Path d="M18 86 L18 74 Q20 68 30 66 L44 62 L54 48 Q56 46 62 46 L94 46 Q100 46 102 52 L108 66 Q110 68 110 74 L110 86 Z" fill={AV.red} />
      <Path d="M57 50 L76 50 L76 62 L48 62 Z" fill={AV.well} />
      <Path d="M80 50 L94 50 Q97 50 98 54 L102 62 L80 62 Z" fill={AV.well} />
      <Rect x={22} y={72} width={84} height={3} fill={AV.amber} />
      <CarWheel cx={36} cy={86} />
      <CarWheel cx={92} cy={86} />
    </AvatarSvg>
  );
}

export function CarKei({ size }: AvatarArtProps) {
  return (
    <AvatarSvg size={size}>
      <Path d={GROUND} stroke={AV.ring} strokeWidth={2} />
      <Path d="M24 88 L24 68 Q24 64 28 62 L36 60 L42 40 Q43 36 48 36 L96 36 Q102 36 102 42 L104 88 Z" fill={AV.amber} />
      <Path d="M46 41 L70 41 L70 58 L40 58 Z" fill={AV.well} />
      <Path d="M74 41 L97 41 L98 58 L74 58 Z" fill={AV.well} />
      <Rect x={28} y={68} width={74} height={3} fill={AV.red} />
      <CarWheel cx={42} cy={88} r={9} />
      <CarWheel cx={88} cy={88} r={9} />
    </AvatarSvg>
  );
}

export function CarPickup({ size }: AvatarArtProps) {
  return (
    <AvatarSvg size={size}>
      <Path d={GROUND} stroke={AV.ring} strokeWidth={2} />
      <Path d="M12 86 L12 72 Q12 68 18 66 L36 64 L46 46 Q48 44 52 44 L70 44 Q74 44 74 48 L74 66 L116 66 L116 86 Z" fill={AV.orange} />
      <Path d="M50 48 L70 48 L70 63 L41 63 Z" fill={AV.well} />
      <Rect x={78} y={62} width={38} height={4} fill={AV.ink} />
      <Rect x={16} y={74} width={98} height={3} fill={AV.page} />
      <CarWheel cx={34} cy={86} />
      <CarWheel cx={96} cy={86} />
    </AvatarSvg>
  );
}

export function CarWagon({ size }: AvatarArtProps) {
  return (
    <AvatarSvg size={size}>
      <Path d={GROUND} stroke={AV.ring} strokeWidth={2} />
      <Path d="M12 86 L12 74 Q14 68 24 66 L40 62 L52 48 Q54 46 60 46 L108 46 Q112 46 113 50 L116 68 L116 86 Z" fill={AV.ink} />
      <Path d="M56 50 L76 50 L76 62 L46 62 Z" fill={AV.well} />
      <Path d="M80 50 L109 50 L111 62 L80 62 Z" fill={AV.well} />
      <Rect x={50} y={42} width={56} height={3} rx={1} fill={AV.grey} />
      <Rect x={16} y={72} width={98} height={3} fill={AV.red} />
      <CarWheel cx={34} cy={86} />
      <CarWheel cx={96} cy={86} />
    </AvatarSvg>
  );
}
