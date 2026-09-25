import * as Print from 'expo-print';

import { deliverFile } from '../export/deliver';

/**
 * Native: render the HTML to a real PDF and open the share sheet.
 *
 * `printToFileAsync` writes to the cache and hands back a `file://` URI, which
 * is exactly what `expo-sharing` wants. `printAsync` would open the system
 * print dialog instead — useful, but it does not leave a file the user can send
 * to a mechanic on WhatsApp, which is the point of the feature.
 */
export type PrintResult = 'shared' | 'printed' | 'unavailable';

export async function printReport(html: string, filename: string): Promise<PrintResult> {
  const { uri } = await Print.printToFileAsync({ html });
  // expo-print names the file with a random UUID, and that name is what the
  // mechanic sees in WhatsApp. Copy it to a name that says what it is.
  const { File, Paths } = await import('expo-file-system');
  const named = new File(Paths.cache, filename);
  if (named.exists) named.delete();
  new File(uri).copy(named);
  const delivered = await deliverFile(named.uri, 'application/pdf', 'Reporte de Car Guy');
  return delivered === 'shared' ? 'shared' : 'unavailable';
}
