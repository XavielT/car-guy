/**
 * GET /c/<slug> — the public car page (IMP 28092026 Phase 7, ADR-22).
 *
 * A Vercel Node function next to the static export (vercel.json rewrites
 * /c/:slug here before the SPA rules). It calls carguy.public_dossier(slug)
 * with the anon key — the only thing anon can do in the schema (sql/012) —
 * and returns final HTML, because link-preview crawlers do not run JS.
 *
 * Env: SUPABASE_URL / SUPABASE_ANON_KEY, falling back to the EXPO_PUBLIC_ pair
 * the web build already has in the Vercel project (the anon key is public by
 * design; RLS and the function's gating are the security boundary).
 */
import type { IncomingMessage, ServerResponse } from 'node:http';

import { isSlug, publicDossier, type RawDossier } from '../../lib/share/dossier';
import { renderDossierHtml, renderNotFoundHtml } from '../../lib/share/html';

type Req = IncomingMessage & { query?: Record<string, string | string[]> };

const SITE = 'https://car-guy.vercel.app';

export async function fetchDossier(slug: string, env: Record<string, string | undefined> = process.env): Promise<RawDossier | null> {
  const url = env.SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_ANON_KEY ?? env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_ANON_KEY missing');
  const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/public_dossier`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Content-Profile': 'carguy', Accept: 'application/json' },
    body: JSON.stringify({ p_slug: slug }),
  });
  if (!res.ok) throw new Error(`public_dossier ${res.status}`);
  return (await res.json()) as RawDossier | null;
}

export default async function handler(req: Req, res: ServerResponse): Promise<void> {
  const raw = req.query?.slug;
  const slug = (Array.isArray(raw) ? raw[0] : raw) ?? new URL(req.url ?? '/', SITE).pathname.split('/').pop() ?? '';
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  const notFound = () => {
    res.statusCode = 404;
    // Short: a link re-enabled with a new slug should not wait on a cached 404.
    res.setHeader('Cache-Control', 'public, s-maxage=60');
    res.setHeader('X-Robots-Tag', 'noindex');
    res.end(renderNotFoundHtml());
  };

  if (!isSlug(slug)) return notFound();
  try {
    const dossier = await fetchDossier(slug);
    if (!dossier) return notFound();
    const d = publicDossier(dossier, { storageBase: process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? '' });
    res.statusCode = 200;
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400');
    if (!d.indexable) res.setHeader('X-Robots-Tag', 'noindex');
    res.end(renderDossierHtml(d, { url: `${SITE}/c/${slug}` }));
  } catch (error) {
    console.error('[c/slug]', error);
    res.statusCode = 502;
    res.setHeader('Cache-Control', 'no-store');
    res.end(renderNotFoundHtml());
  }
}
