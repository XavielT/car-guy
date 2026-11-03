/**
 * CORS by allow-list (SGC `_shared/cors.ts` pattern, trimmed to Car Guy). Only a BROWSER sends an Origin: Expo web /
 * the PWA on Vercel, and local dev. The native app (APK) sends none, so it needs no CORS and no entry here.
 * Extra origins (a preview deploy) come from the secret CG_ALLOWED_ORIGINS, comma separated.
 */
export const ALLOWED_ORIGINS = [
  'https://car-guy.vercel.app',
  'http://localhost:8081',
  'http://localhost:8100',
  'http://localhost:19006',
  'http://localhost:3000',
];

const BASE: Record<string, string> = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
  Vary: 'Origin',
};

export function corsHeaders(origin: string | null | undefined, extra: string[] = []): Record<string, string> {
  if (origin && [...ALLOWED_ORIGINS, ...extra].includes(origin)) {
    return { ...BASE, 'Access-Control-Allow-Origin': origin };
  }
  // No Origin (native app, server-to-server, curl) or an unlisted one: no ACAO header, so a browser blocks it.
  return { ...BASE };
}

export function parseExtraOrigins(raw: string | undefined): string[] {
  return (raw ?? '').split(',').map((s) => s.trim()).filter((s) => /^https?:\/\/[^\s]+$/.test(s));
}
