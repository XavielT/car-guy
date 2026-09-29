import * as DocumentPicker from 'expo-document-picker';
import { Platform } from 'react-native';

import { media as mediaRepo } from '../db/repos';
import type { Media } from '../db/types';
import { id as newId } from '../format';
import { mediaUri } from './index';

/** A marbete scan or a policy PDF is small; a 40 MB brochure is not a document. */
export const MAX_PDF_BYTES = 10 * 1024 * 1024;

export type PdfPick = { ok: true; media: Media } | { ok: false; reason: 'cancelled' | 'too-big' | 'failed' };

/**
 * Attaches a PDF to a document (NEXT.md backlog: "PDF documents are not wired
 * into the documents screen"). Stored like a photo — bytes local, `kind: 'pdf'`,
 * synced to Storage by the same media upload — minus the thumb and the album.
 */
export async function pickPdf(target: { ownerTable: string; ownerId: string; vehicleId: string }): Promise<PdfPick> {
  const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true, multiple: false });
  if (result.canceled || !result.assets?.[0]) return { ok: false, reason: 'cancelled' };
  const asset = result.assets[0];
  if (asset.size != null && asset.size > MAX_PDF_BYTES) return { ok: false, reason: 'too-big' };
  try {
    const id = newId();
    const common = {
      id,
      ownerTable: target.ownerTable,
      ownerId: target.ownerId,
      kind: 'pdf' as const,
      mime: 'application/pdf',
      width: null,
      height: null,
      takenAt: null,
      datePrecision: 'day' as const,
      source: 'import' as const,
      caption: asset.name ?? '',
      deletedAt: null,
    };
    if (Platform.OS === 'web') {
      const bytes = asset.file ? new Uint8Array(await asset.file.arrayBuffer()) : new Uint8Array(await (await fetch(asset.uri)).arrayBuffer());
      if (bytes.byteLength > MAX_PDF_BYTES) return { ok: false, reason: 'too-big' };
      return { ok: true, media: await mediaRepo.upsert({ ...common, blob: bytes, sizeBytes: bytes.byteLength }) };
    }
    const { Directory, File, Paths } = await import('expo-file-system');
    const folder = new Directory(Paths.document, 'media', target.vehicleId);
    if (!folder.exists) folder.create({ intermediates: true });
    const dest = new File(folder, `${id}.pdf`);
    new File(asset.uri).copy(dest);
    return { ok: true, media: await mediaRepo.upsert({ ...common, relPath: `media/${target.vehicleId}/${id}.pdf`, sizeBytes: dest.size ?? asset.size ?? null }) };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}

/** Opens the PDF: a new tab on web, the share sheet (any PDF viewer) on the phone. */
export async function openPdf(item: Media): Promise<boolean> {
  const uri = await mediaUri(item);
  if (!uri) return false;
  if (Platform.OS === 'web') {
    window.open(uri, '_blank', 'noopener');
    return true;
  }
  const Sharing = await import('expo-sharing');
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
  return true;
}
