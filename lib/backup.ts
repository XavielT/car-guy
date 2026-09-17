import { File, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';

import type { AppData } from './types';

const BACKUP_VERSION = 1;

type BackupFile = {
  app: 'tu-combustible-rd';
  version: number;
  exportedAt: string;
  data: AppData;
};

export async function exportBackup(data: AppData): Promise<boolean> {
  const file = new File(Paths.cache, `tu-combustible-rd-${new Date().toISOString().slice(0, 10)}.json`);
  file.create({ overwrite: true });
  file.write(
    JSON.stringify(
      {
        app: 'tu-combustible-rd',
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
    dialogTitle: 'Guardar respaldo de Tu Combustible RD',
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
  if (parsed.app === 'tu-combustible-rd' && parsed.data) return parsed.data;
  if (parsed.vehicles || parsed.fillups || parsed.settings) return parsed as AppData;
  throw new Error('El archivo no parece un respaldo de Tu Combustible RD.');
}
