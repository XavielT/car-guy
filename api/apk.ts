/**
 * GET /api/apk — the newest Android APK (IMP 29092026 Phase 7, ADR-34):
 * { version, publishedAt, url, size, notes } from GitHub's releases/latest.
 *
 * The CDN keeps it 10 minutes (one upstream call per window, whatever the
 * traffic — GitHub allows 60 unauthenticated calls an hour), serves it stale
 * while it revalidates, and for a day if GitHub is down. GITHUB_TOKEN is
 * optional (public repo). Errors carry X-Car-Guy-Error, never a secret.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';

import { apkFromRelease, LATEST_API } from '../lib/release/apk';

export const CACHE = 'public, max-age=60, s-maxage=600, stale-while-revalidate=3600, stale-if-error=86400';

function send(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

export default async function handler(_req: IncomingMessage, res: ServerResponse, env: Record<string, string | undefined> = process.env): Promise<void> {
  let upstream: Response;
  try {
    upstream = await fetch(LATEST_API, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'car-guy-web',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(env.GITHUB_TOKEN ? { Authorization: `Bearer ${env.GITHUB_TOKEN}` } : {}),
      },
    });
  } catch {
    return send(res, 502, { error: 'upstream' }, { 'X-Car-Guy-Error': 'github-unreachable', 'Cache-Control': 'no-store' });
  }
  if (!upstream.ok) {
    return send(res, 502, { error: 'upstream', status: upstream.status }, { 'X-Car-Guy-Error': `github-${upstream.status}`, 'Cache-Control': 'no-store' });
  }
  const info = apkFromRelease(await upstream.json().catch(() => null));
  if (!info) return send(res, 502, { error: 'no-apk' }, { 'X-Car-Guy-Error': 'no-apk-asset', 'Cache-Control': 'public, max-age=60, s-maxage=60' });
  send(res, 200, info, { 'Cache-Control': CACHE });
}
