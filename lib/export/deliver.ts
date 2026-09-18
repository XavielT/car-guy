import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

/**
 * Hands a generated file to the user — the one mechanism the CSV export and the
 * PDF report both need, factored out of `lib/backup.ts`'s copy of it.
 *
 * There is no shared implementation to share: `expo-file-system` has no web
 * module in SDK 57 (its web build is a stub that only warns), and
 * `expo-sharing` explicitly cannot share a local file URI on web. So web builds
 * a Blob and clicks an `<a download>`, and native writes to the cache directory
 * and opens the system share sheet.
 */
export type DeliverResult = 'shared' | 'downloaded' | 'unavailable';

export async function deliverText(
  content: string,
  filename: string,
  mimeType: string,
  dialogTitle: string,
): Promise<DeliverResult> {
  if (Platform.OS === 'web') {
    downloadInBrowser(new Blob([content], { type: `${mimeType};charset=utf-8` }), filename);
    return 'downloaded';
  }

  const { File, Paths } = await import('expo-file-system');
  const file = new File(Paths.cache, filename);
  file.create({ overwrite: true });
  file.write(content);

  if (!(await Sharing.isAvailableAsync())) return 'unavailable';
  // A file:// URL, never contentUri — expo-sharing builds its own content URI
  // through SharingFileProvider and throws if handed one already.
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle });
  return 'shared';
}

/** Shares a file that already exists on disk, e.g. the PDF expo-print wrote. */
export async function deliverFile(
  uri: string,
  mimeType: string,
  dialogTitle: string,
): Promise<DeliverResult> {
  if (Platform.OS === 'web') return 'unavailable';
  if (!(await Sharing.isAvailableAsync())) return 'unavailable';
  await Sharing.shareAsync(uri, { mimeType, dialogTitle });
  return 'shared';
}

function downloadInBrowser(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoking immediately cancels the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
