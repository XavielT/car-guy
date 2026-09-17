import { File, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';

import type { AppData } from './types';

const BACKUP_VERSION = 2;

/**
 * Every backup Car Guy has ever been able to read. `tu-combustible-rd` is the v1
 * envelope and stays supported **forever**: Car Guy ships under a new Android
 * package, so a fresh install has no data and importing that file is how a Tu
 * Combustible RD user's history arrives (decision D1).
 */
const KNOWN_APPS = ['car-guy', 'tu-combustible-rd'] as const;

type BackupApp = (typeof KNOWN_APPS)[number];

type BackupFile = {
  app: BackupApp;
  version: number;
  exportedAt: string;
  data: AppData;
};

export async function exportBackup(data: AppData): Promise<boolean> {
  const file = new File(Paths.cache, `car-guy-${new Date().toISOString().slice(0, 10)}.json`);
  file.create({ overwrite: true });
  file.write(
    JSON.stringify(
      {
        app: 'car-guy',
        version: BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        data,
      } satisfies BackupFile,
      null,
      2,
    ),
  );

  if (!(await Sharing.isAvailableAsync())) return false;
  // expo-sharing only accepts a file:// URL — it builds its own content:// URI through
  // SharingFileProvider. Passing file.contentUri makes it throw InvalidArgumentException.
  await Sharing.shareAsync(file.uri, {
    dialogTitle: 'Guardar respaldo de Car Guy',
    mimeType: 'application/json',
  });
  return true;
}

export async function importBackup(): Promise<AppData | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) return null;

  const file = new File(result.assets[0].uri);
  const parsed = JSON.parse(await file.text()) as Partial<BackupFile> & Partial<AppData>;
  if (parsed.app && (KNOWN_APPS as readonly string[]).includes(parsed.app) && parsed.data) {
    return parsed.data;
  }
  // Older exports were sometimes unwrapped AppData.
  if (parsed.vehicles || parsed.fillups || parsed.settings) return parsed as AppData;
  throw new Error('El archivo no parece un respaldo de Car Guy ni de Tu Combustible RD.');
}
