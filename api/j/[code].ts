/**
 * GET /j/<code> — a junte invite (IMP 01102026 Phase 6): anon key → carguy.junte_invite_card, final HTML with OG
 * tags for link previews, always noindex (an invite is not for search engines). Same shape as api/u/[handle].ts.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';

import { JUNTE_CODE_RE, renderJunteHtml, renderJunteNotFoundHtml, type WebJunteCard } from '../../lib/share/junteHtml';

type Req = IncomingMessage & { query?: Record<string, string | string[]> };

const SITE = 'https://car-guy.vercel.app';

export async function fetchCard(code: string, env: Record<string, string | undefined> = process.env): Promise<WebJunteCard | null> {
  const url = env.SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_ANON_KEY ?? env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_ANON_KEY missing');
  const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/junte_invite_card`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Content-Profile': 'carguy', Accept: 'application/json' },
    body: JSON.stringify({ p_code: code }),
  });
  if (!res.ok) throw new Error(`junte_invite_card ${res.status}`);
  return (await res.json()) as WebJunteCard | null;
}

export default async function handler(req: Req, res: ServerResponse): Promise<void> {
  const raw = req.query?.code;
  const code = ((Array.isArray(raw) ? raw[0] : raw) ?? new URL(req.url ?? '/', SITE).pathname.split('/').pop() ?? '').toLowerCase();
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Robots-Tag', 'noindex');
  const notFound = () => {
    res.statusCode = 404;
    res.setHeader('Cache-Control', 'public, s-maxage=60');
    res.end(renderJunteNotFoundHtml());
  };
  if (!JUNTE_CODE_RE.test(code)) return notFound();
  try {
    const card = await fetchCard(code);
    if (!card) return notFound();
    res.statusCode = 200;
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=600');
    res.end(renderJunteHtml(card, { url: `${SITE}/j/${code}`, code, site: SITE }));
  } catch (error) {
    console.error('[j/code]', error);
    const message = error instanceof Error ? error.message : String(error);
    res.setHeader('X-Car-Guy-Error', /missing/.test(message) ? 'missing-env' : message.replace(/[^a-z0-9 _-]/gi, '').slice(0, 60));
    res.statusCode = 502;
    res.setHeader('Cache-Control', 'no-store');
    res.end(renderJunteNotFoundHtml());
  }
}
