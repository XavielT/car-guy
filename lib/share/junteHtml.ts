/**
 * The junte invite on the web, /j/<code> (IMP 01102026 Phase 6): who invites, when, how many go — from
 * junte_invite_card (sql/038) only: no ids, no coordinates. "Abrir en la app" (carguy://junte/<code>) or install.
 */
import { esc, head } from './html';

export const JUNTE_CODE_RE = /^[a-z0-9]{8}$/;

export type WebJunteCard = {
  title: string;
  starts_at: string;
  ends_at: string | null;
  meet_label: string | null;
  status: string;
  owner_handle: string | null;
  owner_name: string | null;
  going: number;
};

function when(iso: string): string {
  return new Intl.DateTimeFormat('es-DO', { dateStyle: 'full', timeStyle: 'short', timeZone: 'America/Santo_Domingo' }).format(new Date(iso));
}

export function renderJunteHtml(c: WebJunteCard, opts: { url: string; code: string; site: string }): string {
  const by = c.owner_handle ? `@${c.owner_handle}` : 'Alguien';
  const desc = `${by} te invita · ${when(c.starts_at)} · ${c.going} van`;
  const ended = c.status === 'ended';
  return `<!doctype html><html lang="es"><head>${head({ title: `Junte: ${c.title} · Car Guy`, description: desc, url: opts.url, image: `${opts.site}/icons/icon-512.png`, indexable: false })}</head>
<body><main><section class="hero"><div class="eyebrow">JUNTE · 仲間</div><h1>${esc(c.title)}</h1>
<div class="sub">${esc(ended ? 'Este junte ya terminó.' : when(c.starts_at))}${c.meet_label ? ` · ${esc(c.meet_label)}` : ''}</div>
<div class="sub">${esc(by)}${c.owner_name ? ` (${esc(c.owner_name)})` : ''} · ${esc(c.going)} van</div></section>
${ended ? '' : `<p class="sub"><a href="carguy://junte/${esc(opts.code)}"><b>Abrir en la app</b></a> · <a href="/instalar">Instalar Car Guy</a></p>
<p class="sub">En la app: Más → Juntes → Unirme con un código → <b>${esc(opts.code)}</b></p>`}
<footer><span><b>CAR GUY</b> · Hecho con Car Guy</span><span>car-guy.vercel.app</span></footer></main></body></html>`;
}

export function renderJunteNotFoundHtml(): string {
  return `<!doctype html><html lang="es"><head>${head({ title: 'Junte no encontrado · Car Guy', description: 'Ese código no existe.', url: 'https://car-guy.vercel.app', image: null, indexable: false })}</head>
<body><main style="padding-top:18vh;text-align:center"><div class="eyebrow">404 · 仲間</div><h1>No está aquí</h1><p class="sub">Ese código de junte no existe.</p>
<footer style="justify-content:center"><span><b>CAR GUY</b> · Hecho con Car Guy</span></footer></main></body></html>`;
}
