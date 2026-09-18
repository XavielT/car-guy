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

export async function printReport(html: string): Promise<PrintResult> {
  const { uri } = await Print.printToFileAsync({ html });
  const delivered = await deliverFile(uri, 'application/pdf', 'Reporte de Car Guy');
  return delivered === 'shared' ? 'shared' : 'unavailable';
}
