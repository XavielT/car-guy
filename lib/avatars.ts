/**
 * The 16 in-house avatars (IMP 30092026 note 10, research 02 §4).
 *
 * Ids are what `carguy.profiles.avatar_id` and the local `profile_avatar_id`
 * setting hold, so they never change once shipped: rename a label, never an id.
 * The drawings live in components/avatars/ (react-native-svg, no transformer);
 * the labels in the dictionary (`t.profileUi.avatars[id]`), read at the moment
 * of use. Trademark checklist: docs/imp-30092026/04-tracking/PROGRESS.md
 * "Avatars trademark checklist (Phase 6)".
 *
 * Pure on purpose — no React, no SVG — so the fallback and crop rules below are
 * unit-tested without rendering anything.
 */
import { t } from './i18n';

export const AVATAR_IDS = [
  'helmet_full',
  'helmet_open',
  'helmet_kart',
  'car_coupe',
  'car_hatch',
  'car_kei',
  'car_pickup',
  'car_wagon',
  'wheel',
  'turbo',
  'checkered',
  'kanji_kai',
  'kanji_hashiru',
  'kanji_touge',
  'wrench_spanner',
  'tire_smoke',
] as const;

export type AvatarId = (typeof AVATAR_IDS)[number];

export function isAvatarId(value: unknown): value is AvatarId {
  return typeof value === 'string' && (AVATAR_IDS as readonly string[]).includes(value);
}

/** The avatar's accessible label in the current language. */
export function avatarLabel(id: AvatarId): string {
  return t.profileUi.avatars[id];
}

/**
 * Up to two initials: the first letters of the first two words ("Xaviel
 * Torres" → "XT"), or of the part before the @ for an e-mail ("x@…" → "X").
 * "?" when there is nothing to take a letter from.
 */
export function initialsOf(name: string | null | undefined): string {
  const raw = (name ?? '').trim();
  const base = raw.includes('@') ? raw.split('@')[0] : raw;
  const words = base.split(/[\s._-]+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
  if (!words.length) return '?';
  const letter = (w: string) => (w.match(/[\p{L}\p{N}]/u)?.[0] ?? '').toUpperCase();
  return words
    .slice(0, raw.includes('@') ? 1 : 2)
    .map(letter)
    .join('');
}

export type AvatarSource =
  | { kind: 'photo'; uri: string }
  | { kind: 'art'; id: AvatarId }
  | { kind: 'initials'; text: string };

/**
 * Photo → avatar → initials. A photo that failed to load (`photoFailed`, from
 * the image's onError) is skipped, so a broken or expired URL never shows; an
 * unknown avatar id (a newer build's, or garbage) is skipped too.
 */
export function resolveAvatar(input: {
  photoUri?: string | null;
  avatarId?: string | null;
  name?: string | null;
  photoFailed?: boolean;
}): AvatarSource {
  const uri = input.photoUri?.trim();
  if (uri && !input.photoFailed) return { kind: 'photo', uri };
  if (isAvatarId(input.avatarId)) return { kind: 'art', id: input.avatarId };
  return { kind: 'initials', text: initialsOf(input.name) };
}

export type SquareCrop = { originX: number; originY: number; width: number; height: number };

/**
 * The centred square of a `width × height` image, in whole pixels, for
 * expo-image-manipulator's `crop`. Web and some Android pickers ignore
 * `aspect: [1, 1]`, so every photo goes through this whatever the picker did.
 * Null for a missing or non-positive size.
 */
export function centerSquareCrop(width: number | null | undefined, height: number | null | undefined): SquareCrop | null {
  if (!width || !height || width <= 0 || height <= 0) return null;
  const w = Math.floor(width);
  const h = Math.floor(height);
  const side = Math.min(w, h);
  return { originX: Math.floor((w - side) / 2), originY: Math.floor((h - side) / 2), width: side, height: side };
}

/** True when the crop would change nothing (the picker already squared it). */
export function isFullFrame(crop: SquareCrop, width: number, height: number): boolean {
  return crop.originX === 0 && crop.originY === 0 && crop.width === Math.floor(width) && crop.height === Math.floor(height);
}
