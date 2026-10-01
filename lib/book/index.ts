import { Asset } from 'expo-asset';
import { Platform } from 'react-native';

import { documents as documentRepo } from '../db/repos';
import { eventsForBook } from '../db/albumQueries';
import { albumPhotoIds, localRawDossier } from '../db/shareQueries';
import { EVENT_TYPE_LABEL, eventSubtitle, eventTypeOf } from '../domain/events';
import { dateLabel } from '../format';
import { deliverBytes, type DeliverResult } from '../export/deliver';
import { publicDossier, type ShareFlags } from '../share/dossier';
import { localMediaBytes } from '../sync/mediaBytes';
import { bookFileName, MAX_BOOK_PHOTOS, renderBook, type BookFonts } from './render';

/**
 * The car book on the phone (and on web): the dossier from the local tables
 * with the share switches, the album's photos (favourites first, ≤ 60), the
 * house fonts embedded — Saira Condensed and Rajdhani, JetBrains Mono for
 * numbers — falling back to Helvetica if a font will not load.
 */

export type BookOptions = { flags: ShareFlags; photos: boolean; docs: boolean; from: string | null; to: string | null; periodLabel: string | null; /** "Lo que uso" (note 6). */ memory?: boolean };

async function assetBytes(mod: number): Promise<Uint8Array> {
  const asset = Asset.fromModule(mod);
  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  if (Platform.OS === 'web') return new Uint8Array(await (await fetch(uri)).arrayBuffer());
  const { File } = await import('expo-file-system');
  return new Uint8Array(await new File(uri).bytes());
}

let fontCache: Promise<BookFonts> | null = null;
function loadFonts(): Promise<BookFonts> {
  fontCache ??= Promise.all([
    assetBytes(require('@expo-google-fonts/saira-condensed/800ExtraBold/SairaCondensed_800ExtraBold.ttf')),
    assetBytes(require('@expo-google-fonts/saira-condensed/600SemiBold/SairaCondensed_600SemiBold.ttf')),
    assetBytes(require('../../assets/fonts/Rajdhani-Latin_500Medium.ttf')),
    assetBytes(require('../../assets/fonts/Rajdhani-Latin_700Bold.ttf')),
    assetBytes(require('@expo-google-fonts/jetbrains-mono/500Medium/JetBrainsMono_500Medium.ttf')),
  ])
    .then(([display, title, body, bold, mono]) => ({ display, title, body, bold, mono }))
    .catch(() => {
      fontCache = null;
      return null;
    });
  return fontCache;
}

export async function generateBook(vehicleId: string, opts: BookOptions, onProgress?: (done: number, total: number) => void): Promise<{ bytes: Uint8Array; filename: string } | null> {
  const raw = await localRawDossier(vehicleId, opts.flags, { from: opts.from, to: opts.to, memory: opts.memory });
  if (!raw) return null;
  const dossier = publicDossier(raw, { storageBase: '' });
  const photos = opts.photos ? await albumPhotoIds(vehicleId, opts.from, opts.to, MAX_BOOK_PHOTOS) : [];
  const docs = opts.docs
    ? (await documentRepo.listWhere({ vehicleId })).map((d) => ({ title: d.title, kind: d.kind, issuedAt: d.issuedAt, expiresAt: d.expiresAt }))
    : null;
  // Events ride with the story switch (the hitos' chapter); they are never on the public page (ADR-44).
  const events = opts.flags.story
    ? (await eventsForBook(vehicleId, opts.from, opts.to)).map((m) => ({
        date: dateLabel(m.occurredAt),
        title: `${EVENT_TYPE_LABEL[eventTypeOf(m)]} · ${m.title}`,
        line: [eventSubtitle(m), m.locationLabel].filter(Boolean).join(' · '),
      }))
    : null;
  const [fonts, fontkit] = await Promise.all([loadFonts(), import('@pdf-lib/fontkit').then((m) => m.default ?? m).catch(() => null)]);
  const bytes = await renderBook(
    {
      dossier,
      heroId: raw.vehicle.hero_media_id ?? raw.photos[0] ?? photos[0]?.id ?? null,
      photos,
      documents: docs,
      generatedAt: new Date().toISOString(),
      periodLabel: opts.periodLabel,
      events,
    },
    { fonts, fontkit, image: (id, thumb) => localMediaBytes(id, { thumb }), onProgress },
  );
  return { bytes, filename: bookFileName(raw.vehicle.name, raw.slug ?? raw.vehicle.nickname, new Date()) };
}

export async function deliverBook(bytes: Uint8Array, filename: string, dialogTitle: string): Promise<DeliverResult> {
  return deliverBytes(bytes, filename, 'application/pdf', dialogTitle);
}
