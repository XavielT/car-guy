/**
 * GET /u/<handle> — the public profile page (IMP 01102026 Phase 5, ADR-54); ?photo=1 returns the public photo
 * copy as image/jpeg (for og:image — a data URI cannot be one). Same shape as api/c/[slug].ts: anon key →
 * carguy.get_public_profile, final HTML for link previews, noindex unless the account is public.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';

import { HANDLE_URL_RE, photoBytes, renderProfileHtml, renderProfileNotFoundHtml, type WebProfile } from '../../lib/share/profileHtml';

type Req = IncomingMessage & { query?: Record<string, string | string[]> };

const SITE = 'https://car-guy.vercel.app';

export async function fetchProfile(handle: string, env: Record<string, string | undefined> = process.env): Promise<WebProfile | null> {
  const url = env.SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_ANON_KEY ?? env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_ANON_KEY missing');
  const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/get_public_profile`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Content-Profile': 'carguy', Accept: 'application/json' },
    body: JSON.stringify({ p_handle: handle }),
  });
  if (!res.ok) throw new Error(`get_public_profile ${res.status}`);
  return (await res.json()) as WebProfile | null;
}

export default async function handler(req: Req, res: ServerResponse): Promise<void> {
  const raw = req.query?.handle;
  const u = new URL(req.url ?? '/', SITE);
  const handle = ((Array.isArray(raw) ? raw[0] : raw) ?? u.pathname.split('/').pop() ?? '').toLowerCase().replace(/^@/, '');
  const wantsPhoto = (req.query?.photo ?? u.searchParams.get('photo')) === '1';
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  const notFound = () => {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=60');
    res.setHeader('X-Robots-Tag', 'noindex');
    res.end(renderProfileNotFoundHtml());
  };

  if (!HANDLE_URL_RE.test(handle)) return notFound();
  try {
    const p = await fetchProfile(handle);
    if (!p) return notFound();
    if (wantsPhoto) {
      const bytes = photoBytes(p.photo);
      if (!bytes) return notFound();
      res.statusCode = 200;
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
      return void res.end(bytes);
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=3600');
    if (!p.is_public) res.setHeader('X-Robots-Tag', 'noindex');
    res.end(renderProfileHtml(p, { url: `${SITE}/u/${handle}`, site: SITE }));
  } catch (error) {
    console.error('[u/handle]', error);
    const message = error instanceof Error ? error.message : String(error);
    res.setHeader('X-Car-Guy-Error', /missing/.test(message) ? 'missing-env' : message.replace(/[^a-z0-9 _-]/gi, '').slice(0, 60));
    res.statusCode = 502;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(renderProfileNotFoundHtml());
  }
}
