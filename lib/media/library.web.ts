/**
 * expo-media-library has no web build. The import screen checks
 * LIBRARY_AVAILABLE and offers a multi-file input instead; these stubs exist so
 * nothing on web can reach the native module by accident.
 */
import type { Candidate } from './index';

export const LIBRARY_AVAILABLE = false;

export type PhotoAccess = { granted: boolean; limited: boolean; canAskAgain: boolean };
export type LibraryPhoto = { id: string; uri: string; width: number | null; height: number | null; creationTime: number | null };

export async function ensurePhotoPermission(): Promise<PhotoAccess> {
  return { granted: false, limited: false, canAskAgain: false };
}
export async function chooseMorePhotos(): Promise<void> {}
export async function libraryYears(): Promise<number[]> {
  return [];
}
export async function monthCounts(_year: number): Promise<number[]> {
  return Array.from({ length: 12 }, () => 0);
}
export async function monthPhotos(_year: number, _month0: number): Promise<LibraryPhoto[]> {
  return [];
}
export async function candidatesFromLibrary(_photos: LibraryPhoto[]): Promise<Candidate[]> {
  return [];
}
