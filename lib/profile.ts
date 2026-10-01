/**
 * The person's own profile: display name, avatar drawing, profile photo
 * (IMP 30092026 note 10, 03-screens.md "Phase 6").
 *
 * Local first, like everything else (ADR-05). Three reserved setting keys hold
 * it (PROGRESS.md Phase 2): `profile_avatar_id`, `profile_avatar_rel_path`,
 * `profile_display_name`. They are not in SYNCED_SETTING_KEYS — the cloud copy
 * is the `carguy.profiles` row, written here, not a synced setting.
 *
 * The photo: squared (lib/media/crop.ts), 512 px JPEG 0.8 (compressPhoto), then
 * - native: a file under `Paths.document/avatar/`, the setting keeps the
 *   **relative** path (an absolute one breaks when the sandbox moves);
 * - web: there is no file system, so the setting keeps the JPEG as a
 *   `data:` URI (~40–70 KB at 512 px).
 *
 * Signed in, every change also goes up: the photo to the private
 * `carguy-media` bucket at `<uid>/avatar.jpg` (the owner path the 013 policies
 * allow, counted in the 300 MB quota) and `avatar_id` / `avatar_path` /
 * `display_name` to the caller's own profiles row (003 own-row update policy).
 * Anonymous, it stays on the phone; `syncProfileOnSignIn` (called from the
 * sign-in / sign-up success path in lib/cloud/auth.ts) uploads it later — or,
 * on a fresh phone with nothing local, brings the cloud profile down.
 *
 * Others' photos are not readable by members (the bucket's select policy only
 * opens `<uid>/…` to its owner and `v/<vehicle>/…` to members), so lists of
 * other people show their drawing or their initials.
 */
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { isAvatarId, type AvatarId } from './avatars';
import { getSupabase } from './cloud/supabase';
import { settings } from './db/repos';
import { recordError } from './diagnostics';
import { compressPhoto } from './media/compress';
import { cropToSquare } from './media/crop';

export const PROFILE_KEYS = {
  avatarId: 'profile_avatar_id',
  photo: 'profile_avatar_rel_path',
  displayName: 'profile_display_name',
} as const;

const BUCKET = 'carguy-media';
const PHOTO = { width: 512, quality: 0.8 };
const MAX_NAME = 40;

export type LocalProfile = {
  avatarId: AvatarId | null;
  /** Native: path relative to Paths.document. Web: a data: URI. */
  photoRelPath: string | null;
  displayName: string | null;
};

export type ProfileState = LocalProfile & {
  /** Renderable URI for <Avatar photoUri>, or null. */
  photoUri: string | null;
  ready: boolean;
};

const EMPTY: ProfileState = { avatarId: null, photoRelPath: null, displayName: null, photoUri: null, ready: false };

let current: ProfileState = EMPTY;
const listeners = new Set<(state: ProfileState) => void>();

function publish(next: ProfileState) {
  current = next;
  for (const listener of listeners) listener(next);
}

async function uriFor(relPath: string | null): Promise<string | null> {
  if (!relPath) return null;
  if (relPath.startsWith('data:') || Platform.OS === 'web') return relPath;
  try {
    const { File, Paths } = await import('expo-file-system');
    const file = new File(Paths.document, relPath);
    return file.exists ? file.uri : null;
  } catch {
    return null;
  }
}

/** Reads the three settings again (after a wipe, a sign-in pull, or on first use). */
export async function reloadProfile(): Promise<ProfileState> {
  const [avatarId, photoRelPath, displayName] = await Promise.all([
    settings.get<string | null>(PROFILE_KEYS.avatarId, null),
    settings.get<string | null>(PROFILE_KEYS.photo, null),
    settings.get<string | null>(PROFILE_KEYS.displayName, null),
  ]);
  const next: ProfileState = {
    avatarId: isAvatarId(avatarId) ? avatarId : null,
    photoRelPath: photoRelPath || null,
    displayName: displayName?.trim() || null,
    photoUri: await uriFor(photoRelPath || null),
    ready: true,
  };
  publish(next);
  return next;
}

/** The profile, live: every screen showing it re-renders when it changes. */
export function useProfile(): ProfileState {
  const [state, setState] = useState<ProfileState>(current);
  useEffect(() => {
    listeners.add(setState);
    void reloadProfile().catch((error) => recordError('profile', error));
    return () => {
      listeners.delete(setState);
    };
  }, []);
  return state;
}

export function cleanDisplayName(name: string | null | undefined): string | null {
  const trimmed = (name ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
  return trimmed || null;
}

async function removeLocalPhoto(relPath: string | null) {
  if (!relPath || relPath.startsWith('data:') || Platform.OS === 'web') return;
  try {
    const { File, Paths } = await import('expo-file-system');
    const file = new File(Paths.document, relPath);
    if (file.exists) file.delete();
  } catch (error) {
    recordError('profile-photo', error);
  }
}

/** Picks an avatar drawing. It replaces the photo: the picture you chose last is the one shown. */
export async function chooseAvatar(id: AvatarId): Promise<PushResult> {
  const previous = current.photoRelPath;
  await settings.set(PROFILE_KEYS.avatarId, id);
  await settings.set(PROFILE_KEYS.photo, null);
  await removeLocalPhoto(previous);
  await reloadProfile();
  // Local is saved and on screen already; the caller may await the upload to report it.
  return pushProfile();
}

export async function saveDisplayName(name: string): Promise<PushResult> {
  await settings.set(PROFILE_KEYS.displayName, cleanDisplayName(name));
  await reloadProfile();
  // Local is saved and on screen already; the caller may await the upload to report it.
  return pushProfile();
}

export async function removePhoto(): Promise<PushResult> {
  const previous = current.photoRelPath;
  await settings.set(PROFILE_KEYS.photo, null);
  await removeLocalPhoto(previous);
  await reloadProfile();
  // Local is saved and on screen already; the caller may await the upload to report it.
  return pushProfile();
}

function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Stores an already-squared, compressed JPEG as the profile photo. */
async function storePhoto(uri: string): Promise<PushResult> {
  const previous = current.photoRelPath;
  let stored: string;
  if (Platform.OS === 'web') {
    stored = await blobToDataUri(await (await fetch(uri)).blob());
  } else {
    const { Directory, File, Paths } = await import('expo-file-system');
    const folder = new Directory(Paths.document, 'avatar');
    if (!folder.exists) folder.create({ intermediates: true });
    // A new name per photo, so no image cache keeps showing the old one.
    const name = `avatar-${Date.now()}.jpg`;
    new File(uri).copy(new File(folder, name));
    stored = `avatar/${name}`;
  }
  await settings.set(PROFILE_KEYS.photo, stored);
  if (previous && previous !== stored) await removeLocalPhoto(previous);
  await reloadProfile();
  // Local is saved and on screen already; the caller may await the upload to report it.
  return pushProfile();
}

export type PhotoResult = { saved: false } | { saved: true; push: PushResult };

/**
 * "Tomar foto" / "Elegir foto": picker → centred square → 512 px → stored.
 * Call it straight from the press handler — on web the picker is an
 * `<input type="file">` and browsers only open one inside a user gesture.
 */
export async function pickProfilePhoto(camera: boolean): Promise<PhotoResult> {
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 1,
    // Android/iOS show their own square cropper; web ignores both, crop.ts squares it anyway.
    allowsEditing: Platform.OS !== 'web',
    aspect: [1, 1],
  };
  const picked = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (picked.canceled || !picked.assets?.length) return { saved: false };
  const asset = picked.assets[0];
  const square = await cropToSquare(asset.uri, asset.width || null, asset.height || null);
  const small = await compressPhoto(square.uri, square.width, PHOTO);
  return { saved: true, push: await storePhoto(small.uri) };
}

async function readPhotoBytes(relPath: string): Promise<Uint8Array | null> {
  if (relPath.startsWith('data:') || Platform.OS === 'web') {
    return new Uint8Array(await (await fetch(relPath)).arrayBuffer());
  }
  const { File, Paths } = await import('expo-file-system');
  const file = new File(Paths.document, relPath);
  return file.exists ? new Uint8Array(await file.bytes()) : null;
}

export function avatarObjectPath(userId: string): string {
  return `${userId}/avatar.jpg`;
}

export type PushResult = { ok: true } | { ok: false; reason: 'not-configured' | 'signed-out' | 'offline' | 'upload' | 'update' };

/**
 * Sends the local profile to the signed-in account: photo bytes first (so the
 * row never names an object that is not there), then the row. Best-effort —
 * the local copy is the one that matters, and the next change or sign-in
 * tries again.
 */
export async function pushProfile(userId?: string): Promise<PushResult> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, reason: 'not-configured' };
  try {
    const uid = userId ?? (await supabase.auth.getSession()).data.session?.user.id;
    if (!uid) return { ok: false, reason: 'signed-out' };
    const profile = current.ready ? current : await reloadProfile();
    const path = avatarObjectPath(uid);
    const bucket = supabase.storage.from(BUCKET);

    let avatarPath: string | null = null;
    if (profile.photoRelPath) {
      const bytes = await readPhotoBytes(profile.photoRelPath);
      if (bytes) {
        // An ArrayBuffer, not a Blob: React Native cannot build a Blob from bytes (lib/sync/mediaBytes.ts).
        const copy = new Uint8Array(bytes.length);
        copy.set(bytes);
        const { error } = await bucket.upload(path, copy.buffer, { contentType: 'image/jpeg', upsert: true });
        if (error) {
          recordError('profile-upload', error);
          return { ok: false, reason: 'upload' };
        }
        avatarPath = path;
      }
    } else {
      // No photo any more: the old one should not linger in the bucket (or the quota).
      void bucket.remove([path]).then(({ error }) => error && recordError('profile-remove', error));
    }

    const patch: { avatar_id: string | null; avatar_path: string | null; updated_at: string; display_name?: string } = {
      avatar_id: profile.avatarId,
      avatar_path: avatarPath,
      updated_at: new Date().toISOString(),
    };
    // A name set at signup lives on the row already; an empty local name never erases it.
    if (profile.displayName) patch.display_name = profile.displayName;
    const { error } = await supabase.from('profiles').update(patch).eq('user_id', uid);
    if (error) {
      recordError('profile-update', error);
      return { ok: false, reason: 'update' };
    }
    return { ok: true };
  } catch (error) {
    recordError('profile-push', error);
    return { ok: false, reason: 'offline' };
  }
}

/**
 * Brings the account's profile down onto a phone that has none of its own
 * (a fresh install signing in). The photo is fetched once and kept locally.
 */
async function pullProfile(uid: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const { data, error } = await supabase
    .from('profiles')
    .select('avatar_id, avatar_path, display_name')
    .eq('user_id', uid)
    .maybeSingle();
  if (error || !data) return;
  if (isAvatarId(data.avatar_id)) await settings.set(PROFILE_KEYS.avatarId, data.avatar_id);
  if (data.display_name?.trim()) await settings.set(PROFILE_KEYS.displayName, cleanDisplayName(data.display_name));
  if (data.avatar_path) {
    const { data: blob, error: downloadError } = await supabase.storage.from(BUCKET).download(data.avatar_path);
    if (!downloadError && blob) {
      if (Platform.OS === 'web') {
        await settings.set(PROFILE_KEYS.photo, await blobToDataUri(blob));
      } else {
        const { Directory, File, Paths } = await import('expo-file-system');
        const folder = new Directory(Paths.document, 'avatar');
        if (!folder.exists) folder.create({ intermediates: true });
        const name = `avatar-${Date.now()}.jpg`;
        const file = new File(folder, name);
        file.create();
        file.write(new Uint8Array(await blob.arrayBuffer()));
        await settings.set(PROFILE_KEYS.photo, `avatar/${name}`);
      }
    }
  }
  await reloadProfile();
}

/** Something chosen on this phone (a name, a drawing or a photo). */
/** A push that was attempted for a signed-in account and did not land (worth telling the person). */
export function pushFailed(result: PushResult): boolean {
  return !result.ok && result.reason !== 'not-configured' && result.reason !== 'signed-out';
}

export function hasLocalProfile(profile: LocalProfile): boolean {
  return Boolean(profile.avatarId || profile.photoRelPath || profile.displayName);
}

/**
 * Called once a sign-in or sign-up succeeded: what was set up anonymously goes
 * up; a phone with nothing set up takes the account's profile instead.
 */
export async function syncProfileOnSignIn(uid: string): Promise<void> {
  try {
    const local = await reloadProfile();
    if (hasLocalProfile(local)) await pushProfile(uid);
    else await pullProfile(uid);
  } catch (error) {
    recordError('profile-sign-in', error);
  }
}
