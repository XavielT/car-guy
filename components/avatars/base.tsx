import type { ReactNode } from 'react';
import Svg, { Circle } from 'react-native-svg';

/**
 * Shared pieces of the avatar drawings (IMP 30092026 note 10). Every drawing is
 * a 128 × 128 viewBox on the #121212 page, amber/red house palette. The colours
 * are fixed rather than themed: an avatar is a picture, and it has to look the
 * same on another person's phone in light mode as it did when it was chosen.
 *
 * Trademark hygiene (PROGRESS.md "Avatars trademark checklist (Phase 6)"): no
 * real model's lines, no badges, grilles, wordmarks or liveries.
 */
export const AV = {
  page: '#121212',
  disc: '#1B1B1B',
  ring: '#2A2A2A',
  well: '#0E0E0E',
  amber: '#FFB300',
  amberDark: '#FF8F00',
  orange: '#FF5F00',
  red: '#E10600',
  ink: '#EDEDED',
  grey: '#8C8C8C',
  greyLight: '#B3B3B3',
} as const;

export type AvatarArtProps = { size: number };

/** The disc every drawing sits on. */
export function AvatarSvg({ size, children }: AvatarArtProps & { children: ReactNode }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 128 128">
      <Circle cx={64} cy={64} r={64} fill={AV.page} />
      <Circle cx={64} cy={64} r={60} fill={AV.disc} stroke={AV.ring} strokeWidth={2} />
      {children}
    </Svg>
  );
}

/** A side-view wheel for the car silhouettes: tyre, rim, hub. */
export function CarWheel({ cx, cy, r = 11 }: { cx: number; cy: number; r?: number }) {
  return (
    <>
      <Circle cx={cx} cy={cy} r={r + 2} fill={AV.disc} />
      <Circle cx={cx} cy={cy} r={r} fill={AV.well} />
      <Circle cx={cx} cy={cy} r={r * 0.55} fill="none" stroke={AV.greyLight} strokeWidth={2} />
      <Circle cx={cx} cy={cy} r={r * 0.2} fill={AV.amber} />
    </>
  );
}

/** Points on a circle, for spokes, blades and lug nuts (no transform strings: one code path on every platform). */
export function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [Math.round((cx + r * Math.cos(a)) * 100) / 100, Math.round((cy + r * Math.sin(a)) * 100) / 100];
}
