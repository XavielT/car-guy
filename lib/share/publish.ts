import { getSupabase } from '../cloud/supabase';
import { vehicleShares, vehicles as vehicleRepo } from '../db/repos';
import { costsSummaryText, flagsPatch, getShare, memorySummaryText, shareId, sharedPhotoIds } from '../db/shareQueries';
import type { VehicleShare } from '../db/types';
import { sync } from '../sync/engine';
import { localMediaBytes } from '../sync/mediaBytes';
import { slug as newSlug, type ShareFlags } from './dossier';

/**
 * Publishing a car (IMP 28092026 Phase 7, ADR-22).
 *
 * Enable: the share row gets a slug and `published_at`, a sync pushes it (the
 * bucket policy checks the slug against the cloud row, so the row must land
 * first), then the favourites (≤ 24) and the hero are copied to
 * `carguy-public/<slug>/<id>.jpg` + `.thumb.jpg` from the phone's own bytes.
 * Objects under the slug that are no longer chosen are removed.
 *
 * Revoke: objects deleted first (while the slug still authorises it), then the
 * row loses its slug and gets `revoked_at`; the page 404s. Re-enabling mints a
 * new slug, so an old link never comes back to life.
 */

export const SITE = 'https://car-guy.vercel.app';
export const BUCKET = 'carguy-public';
export const shareUrl = (slug: string) => `${SITE}/c/${slug}`;

export type PublishResult = { ok: true; slug: string; url: string; photos: number; failed: number } | { ok: false; reason: 'signed-out' | 'sync' | 'offline' };

async function signedIn(): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { data } = await supabase.auth.getSession();
  return Boolean(data.session);
}

/** Saves the switches without publishing (or while published: the page follows them after the next sync). */
export async function saveShareSettings(vehicleId: string, patch: { flags?: ShareFlags; visibility?: VehicleShare['visibility'] }): Promise<VehicleShare> {
  const existing = await getShare(vehicleId);
  const showCosts = patch.flags ? patch.flags.costs : (existing?.showCosts ?? false);
  const showMemory = patch.flags ? patch.flags.memory : Boolean(existing?.showMemory);
  return vehicleShares.upsert({
    id: shareId(vehicleId),
    vehicleId,
    visibility: existing?.visibility ?? 'private',
    deletedAt: null,
    ...(patch.flags ? flagsPatch(patch.flags) : {}),
    ...(patch.visibility ? { visibility: patch.visibility } : {}),
    // What the page shows under "Lo que me ha costado" (sql/022): the phone's figure.
    costsSummary: await costsSummaryText(vehicleId, showCosts),
    // "Lo que uso" (sql/032): the phone's worded rows, spec sheet only.
    memorySummary: await memorySummaryText(vehicleId, showMemory),
  });
}

async function syncOk(): Promise<boolean> {
  const r = await sync('manual');
  return r.ok;
}

/** Copies the chosen photos to the public bucket; returns [copied, failed]. */
export async function syncPublicPhotos(vehicleId: string, slug: string): Promise<[number, number]> {
  const supabase = getSupabase();
  if (!supabase) return [0, 0];
  const vehicle = await vehicleRepo.getById(vehicleId);
  const ids = await sharedPhotoIds(vehicleId);
  if (vehicle?.heroMediaId && !ids.includes(vehicle.heroMediaId)) ids.unshift(vehicle.heroMediaId);

  const bucket = supabase.storage.from(BUCKET);
  const { data: existing } = await bucket.list(slug, { limit: 200 });
  const wanted = new Set(ids.flatMap((id) => [`${id}.jpg`, `${id}.thumb.jpg`]));
  const present = new Set((existing ?? []).map((o) => o.name));

  let copied = 0;
  let failed = 0;
  for (const id of ids) {
    let ok = true;
    for (const thumb of [true, false]) {
      const name = `${id}${thumb ? '.thumb' : ''}.jpg`;
      if (present.has(name)) continue;
      const bytes = await localMediaBytes(id, { thumb });
      if (!bytes) {
        ok = false;
        continue;
      }
      const copy = new Uint8Array(bytes.length);
      copy.set(bytes);
      const { error } = await bucket.upload(`${slug}/${name}`, copy.buffer, { contentType: 'image/jpeg', upsert: true }); // not a Blob: see lib/sync/mediaBytes.ts
      if (error) ok = false;
    }
    if (ok) copied += 1;
    else failed += 1;
  }
  const stale = [...present].filter((n) => !wanted.has(n)).map((n) => `${slug}/${n}`);
  if (stale.length) await bucket.remove(stale);
  return [copied, failed];
}

export async function enableShare(vehicleId: string, flags: ShareFlags, visibility: 'link' | 'public' = 'link'): Promise<PublishResult> {
  if (!(await signedIn())) return { ok: false, reason: 'signed-out' };
  const existing = await getShare(vehicleId);
  const slug = existing?.slug && !existing.revokedAt ? existing.slug : newSlug();
  await vehicleShares.upsert({
    id: shareId(vehicleId),
    vehicleId,
    ...flagsPatch(flags),
    costsSummary: await costsSummaryText(vehicleId, flags.costs),
    memorySummary: await memorySummaryText(vehicleId, flags.memory),
    visibility,
    slug,
    publishedAt: existing?.publishedAt && existing.slug === slug ? existing.publishedAt : new Date().toISOString(),
    revokedAt: null,
    deletedAt: null,
  });
  if (!(await syncOk())) return { ok: false, reason: 'sync' };
  const [photos, failed] = await syncPublicPhotos(vehicleId, slug);
  return { ok: true, slug, url: shareUrl(slug), photos, failed };
}

export async function revokeShare(vehicleId: string): Promise<boolean> {
  const existing = await getShare(vehicleId);
  if (!existing?.slug) return true;
  const supabase = getSupabase();
  if (supabase && (await signedIn())) {
    const bucket = supabase.storage.from(BUCKET);
    const { data } = await bucket.list(existing.slug, { limit: 200 });
    const paths = (data ?? []).map((o) => `${existing.slug}/${o.name}`);
    if (paths.length) await bucket.remove(paths);
  }
  await vehicleShares.upsert({ id: existing.id, slug: null, revokedAt: new Date().toISOString(), visibility: 'private', publishedAt: null });
  await sync('manual');
  return true;
}
