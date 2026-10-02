/**
 * The public profile on the web, /u/<handle> (IMP 01102026 Phase 5, ADR-54): final HTML for people and link
 * previews, from get_public_profile only — never a plate, never a route (shared trips are the app's), never an
 * id. No React, no Expo: api/u/[handle].ts imports it.
 */
import { esc, head } from './html';

export const HANDLE_URL_RE = /^[a-z0-9_]{3,20}$/;

export type WebProfile = {
  handle: string;
  display_name: string | null;
  avatar_id: string | null;
  photo: string | null;
  is_public: boolean;
  premium: boolean;
  followers: number;
  following: number;
  can_see: boolean;
  bio?: string | null;
  instagram?: string | null;
  cars?: { name: string; nickname: string | null; make: string | null; model: string | null; year: number | null; slug: string | null }[];
  stats?: { km_trips: number; tires_burned: number; mods: number; cars: number };
};

/** og:image: the public photo (served as bytes by /u/<handle>?photo=1) or the drawn avatar PNG. */
export function profileImage(p: WebProfile, site: string): string | null {
  if (p.photo) return `${site}/u/${p.handle}?photo=1`;
  // No photo, no drawing chosen: the app icon, so a shared link still has a picture.
  return p.avatar_id ? `${site}/avatars/${encodeURIComponent(p.avatar_id)}.png` : `${site}/icons/icon-512.png`;
}

export function renderProfileHtml(p: WebProfile, opts: { url: string; site: string }): string {
  const name = p.display_name || `@${p.handle}`;
  const description = p.can_see && p.bio ? p.bio.slice(0, 160) : `@${p.handle} en Car Guy · ${p.followers} seguidores`;
  const image = profileImage(p, opts.site);
  const avatar = p.photo
    ? `<img src="${esc(p.photo)}" alt="" width="96" height="96" style="border-radius:50%;object-fit:cover">`
    : p.avatar_id
      ? `<img src="/avatars/${esc(encodeURIComponent(p.avatar_id))}.png" alt="" width="96" height="96" style="border-radius:50%">`
      : '';
  const cars = p.cars?.length
    ? `<section class="card"><div class="eyebrow">CARROS</div>${p.cars
        .map((c) => {
          const label = esc(c.nickname || c.name);
          const sub = esc([c.make, c.model, c.year].filter(Boolean).join(' '));
          const title = c.slug ? `<a href="/c/${esc(c.slug)}">${label}</a>` : label;
          return `<div class="row"><span class="n">${title}</span><span class="d">${sub}</span></div>`;
        })
        .join('')}</section>`
    : '';
  const stats = p.stats
    ? `<section class="stats"><div class="stat"><div class="big">${esc(p.stats.km_trips)}</div><div class="eyebrow">KM EN VIAJES</div></div><div class="stat"><div class="big">${esc(p.stats.mods)}</div><div class="eyebrow">MODS</div></div><div class="stat"><div class="big">${esc(p.stats.tires_burned)}</div><div class="eyebrow">GOMAS QUEMADAS</div></div></section>`
    : '';
  const body = p.can_see
    ? `${p.bio ? `<p class="story">${esc(p.bio)}</p>` : ''}${p.instagram ? `<p class="sub"><a href="https://instagram.com/${esc(p.instagram)}" rel="noopener nofollow">IG @${esc(p.instagram)}</a></p>` : ''}${cars}${stats}`
    : `<p class="sub">Cuenta privada: en la app puedes solicitar seguirla.</p>`;
  return `<!doctype html><html lang="es"><head>${head({ title: `${name} (@${p.handle}) · Car Guy`, description, url: opts.url, image, indexable: p.is_public })}</head>
<body><main><section class="hero" style="display:flex;gap:16px;align-items:center">${avatar}<div><div class="eyebrow">CAR GUY · 仲間</div><h1>${esc(name)}</h1><div class="nick">@${esc(p.handle)}${p.premium ? ' · <span class="badge amber">APOYA CAR GUY</span>' : ''}</div><div class="sub">${esc(p.followers)} seguidores · ${esc(p.following)} siguiendo</div></div></section>
${body}
<p class="sub"><a href="carguy://u/${esc(p.handle)}">Abrir en la app</a> · <a href="/instalar">Instalar Car Guy</a></p>
<footer><span><b>CAR GUY</b> · Hecho con Car Guy</span><span>car-guy.vercel.app</span></footer></main></body></html>`;
}

export function renderProfileNotFoundHtml(): string {
  return `<!doctype html><html lang="es"><head>${head({ title: 'Perfil no encontrado · Car Guy', description: 'No hay nadie con ese usuario.', url: 'https://car-guy.vercel.app', image: null, indexable: false })}</head>
<body><main style="padding-top:18vh;text-align:center"><div class="eyebrow">404 · 仲間</div><h1>No está aquí</h1><p class="sub">No hay nadie con ese usuario.</p>
<footer style="justify-content:center"><span><b>CAR GUY</b> · Hecho con Car Guy</span></footer></main></body></html>`;
}

/** The photo copy → bytes for ?photo=1 (null unless it is a JPEG data URI). */
export function photoBytes(dataUri: string | null): Buffer | null {
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(dataUri ?? '');
  return m ? Buffer.from(m[1], 'base64') : null;
}
