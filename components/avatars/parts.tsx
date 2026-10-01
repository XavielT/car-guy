import { Circle, G, Line, Path, Rect } from 'react-native-svg';

import { AV, AvatarSvg, polar, type AvatarArtProps } from './base';

/** A six-spoke wheel, face on: tyre, amber rim, lug nuts. Generic spoke pattern. */
export function Wheel({ size }: AvatarArtProps) {
  const spokes = [0, 60, 120, 180, 240, 300].map((deg) => {
    const [x1, y1] = polar(64, 64, 10, deg - 90);
    const [x2, y2] = polar(64, 64, 30, deg - 90);
    return <Line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke={AV.amber} strokeWidth={6} strokeLinecap="round" />;
  });
  const lugs = [30, 90, 150, 210, 270, 330].map((deg) => {
    const [cx, cy] = polar(64, 64, 6, deg - 90);
    return <Circle key={deg} cx={cx} cy={cy} r={1.6} fill={AV.page} />;
  });
  return (
    <AvatarSvg size={size}>
      <Circle cx={64} cy={64} r={46} fill={AV.well} />
      <Circle cx={64} cy={64} r={42} fill="none" stroke={AV.ring} strokeWidth={3} strokeDasharray="4 5" />
      <Circle cx={64} cy={64} r={33} fill={AV.disc} stroke={AV.amber} strokeWidth={4} />
      {spokes}
      <Circle cx={64} cy={64} r={11} fill={AV.amberDark} />
      {lugs}
      <Circle cx={64} cy={64} r={3} fill={AV.red} />
    </AvatarSvg>
  );
}

/** A turbocharger's compressor side: the snail housing, its outlet and the wheel inside. */
export function Turbo({ size }: AvatarArtProps) {
  const blades = [0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
    const [x1, y1] = polar(58, 68, 4, deg);
    const [cx, cy] = polar(58, 68, 12, deg + 30);
    const [x2, y2] = polar(58, 68, 17, deg + 10);
    return <Path key={deg} d={`M${x1} ${y1} Q${cx} ${cy} ${x2} ${y2}`} stroke={AV.greyLight} strokeWidth={2.5} fill="none" strokeLinecap="round" />;
  });
  return (
    <AvatarSvg size={size}>
      <Rect x={58} y={30} width={44} height={18} rx={3} fill={AV.amberDark} />
      <Rect x={98} y={28} width={8} height={22} rx={2} fill={AV.amber} />
      <Circle cx={58} cy={68} r={36} fill={AV.amber} />
      <Path d="M58 32 A36 36 0 0 1 94 68" stroke={AV.amberDark} strokeWidth={4} fill="none" />
      <Circle cx={58} cy={68} r={21} fill={AV.page} />
      {blades}
      <Circle cx={58} cy={68} r={4} fill={AV.red} />
      <Circle cx={30} cy={44} r={3} fill={AV.page} />
      <Circle cx={30} cy={92} r={3} fill={AV.page} />
      <Circle cx={86} cy={92} r={3} fill={AV.page} />
    </AvatarSvg>
  );
}

/** One combination wrench (open end + ring) and one double open-end spanner, crossed. */
export function WrenchSpanner({ size }: AvatarArtProps) {
  return (
    <AvatarSvg size={size}>
      <G transform="rotate(45 64 64)">
        <Rect x={58} y={34} width={12} height={58} rx={4} fill={AV.amber} />
        <Circle cx={64} cy={100} r={13} fill={AV.amber} />
        <Circle cx={64} cy={100} r={6} fill={AV.disc} />
        <Circle cx={64} cy={28} r={14} fill={AV.amber} />
        <Rect x={58} y={10} width={12} height={20} fill={AV.disc} />
      </G>
      <G transform="rotate(-45 64 64)">
        <Rect x={59} y={34} width={10} height={60} rx={4} fill={AV.greyLight} />
        <Circle cx={64} cy={28} r={13} fill={AV.greyLight} />
        <Rect x={59} y={11} width={10} height={19} fill={AV.disc} />
        <Circle cx={64} cy={100} r={13} fill={AV.greyLight} />
        <Rect x={59} y={98} width={10} height={19} fill={AV.disc} />
      </G>
      <Circle cx={64} cy={64} r={4} fill={AV.red} />
    </AvatarSvg>
  );
}

/** A tyre laying down rubber: the wheel bottom-left, smoke rolling up and right, a red skid line. */
export function TireSmoke({ size }: AvatarArtProps) {
  const tread = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => {
    const [x1, y1] = polar(48, 82, 22, deg);
    const [x2, y2] = polar(48, 82, 27, deg);
    return <Line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke={AV.ring} strokeWidth={3} />;
  });
  return (
    <AvatarSvg size={size}>
      <Circle cx={92} cy={46} r={18} fill={AV.grey} opacity={0.55} />
      <Circle cx={74} cy={40} r={14} fill={AV.greyLight} opacity={0.55} />
      <Circle cx={100} cy={66} r={13} fill={AV.greyLight} opacity={0.45} />
      <Circle cx={80} cy={60} r={16} fill={AV.ink} opacity={0.5} />
      <Circle cx={66} cy={58} r={10} fill={AV.ink} opacity={0.35} />
      <Path d="M18 108 L96 108" stroke={AV.red} strokeWidth={4} strokeLinecap="round" />
      <Circle cx={48} cy={82} r={28} fill={AV.well} />
      {tread}
      <Circle cx={48} cy={82} r={15} fill={AV.disc} stroke={AV.amber} strokeWidth={3} />
      <Circle cx={48} cy={82} r={4} fill={AV.amber} />
    </AvatarSvg>
  );
}
