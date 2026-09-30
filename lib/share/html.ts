/**
 * The public car page as one self-contained HTML document (ADR-22): crawlers
 * (WhatsApp, Telegram, X) read the OG tags from this response and never run JS,
 * so everything is server-rendered and the page has no script at all.
 *
 * Dark JDM tokens inline; Saira Condensed / Rajdhani / JetBrains Mono / Michroma
 * from Google Fonts with system fallbacks. Pure: `api/c/[slug].ts` calls it and
 * the tests snapshot what matters.
 */
import type { Dossier } from './dossier';

export const esc = (s: string | number | null | undefined): string =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const FONTS =
  'https://fonts.googleapis.com/css2?family=Saira+Condensed:wght@400;600;800&family=Rajdhani:wght@500;700&family=JetBrains+Mono:wght@500;700&family=Michroma&display=swap';

const CSS = `
:root{--bg:#121212;--surface:#1B1B1B;--raised:#212121;--well:#0E0E0E;--line:#2A2A2A;--text:#EDEDED;--text2:#B3B3B3;--muted:#8C8C8C;--amber:#FFB300;--red:#E10600;--redText:#FF4D45;--green:#3DDC84;--orange:#FF5F00}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--text);font:500 16px/1.45 Rajdhani,system-ui,sans-serif}
a{color:var(--amber)}
main{max-width:760px;margin:0 auto;padding:0 16px 48px}
.hero{position:relative;margin:0 -16px;aspect-ratio:16/10;background:var(--well) repeating-linear-gradient(45deg,#161616 0 6px,#101010 6px 12px);overflow:hidden}
.hero img{width:100%;height:100%;object-fit:cover;display:block}
.badges{position:absolute;left:16px;top:16px;display:flex;gap:6px;flex-wrap:wrap}
.badge{font:400 11px/18px Michroma,sans-serif;letter-spacing:.06em;padding:0 7px;border-radius:3px;border:1px solid rgba(0,0,0,.15);text-transform:uppercase}
.badge.red{background:var(--red);color:#fff}.badge.amber{background:var(--amber);color:#121212}.badge.green{background:var(--green);color:#121212}.badge.outline{background:rgba(18,18,18,.7);color:var(--text2);border-color:var(--line)}
.eyebrow{font:400 12px/1 'Saira Condensed',sans-serif;letter-spacing:.18em;text-transform:uppercase;color:var(--muted)}
h1{font:800 44px/1 'Saira Condensed',sans-serif;text-transform:uppercase;margin:20px 0 4px;letter-spacing:.01em}
.nick{color:var(--amber);font-weight:700;font-size:18px}
.sub{color:var(--text2);margin:2px 0 0}
h2{font:600 22px/1.1 'Saira Condensed',sans-serif;text-transform:uppercase;letter-spacing:.04em;margin:36px 0 12px;display:flex;align-items:center;gap:10px}
h2::before{content:"";width:4px;height:18px;background:var(--amber);border-radius:2px}
.card{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:14px 16px}
.facts{display:grid;grid-template-columns:1fr 1fr;gap:10px 16px;margin-top:18px}
.fact .eyebrow{font-size:11px}.fact .v{font:700 15px/1.3 'JetBrains Mono',monospace;margin-top:4px;word-break:break-word}
.story{white-space:pre-wrap;font-size:17px;color:var(--text)}
.ms{margin-top:10px;color:var(--text2)}.ms b{color:var(--text)}
table{width:100%;border-collapse:collapse;font:500 14px/1.35 'JetBrains Mono',monospace}
td,th{padding:8px 6px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
th{font:400 11px 'Saira Condensed',sans-serif;letter-spacing:.14em;color:var(--muted);text-transform:uppercase}
td.l{font-family:Rajdhani,sans-serif;font-weight:700;color:var(--text2)}
.chg{color:var(--amber)}
.cat{margin-top:14px}.cat .eyebrow{margin-bottom:6px;display:block}
.row{display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid var(--line)}
.row:last-child{border-bottom:0}.row .n{font-weight:700}.row .d{color:var(--muted);font-size:14px}.row .c{font:500 13px 'JetBrains Mono',monospace;color:var(--text2);white-space:nowrap}
.stats{display:flex;gap:10px;flex-wrap:wrap}.stat{flex:1;min-width:130px}.stat .big{font:700 26px/1.1 'JetBrains Mono',monospace}.stat .big.amber{color:var(--amber)}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:4px}
.grid a{display:block;aspect-ratio:1;background:var(--well);overflow:hidden;border-radius:4px}
.grid img{width:100%;height:100%;object-fit:cover;display:block}
footer{margin-top:48px;padding-top:18px;border-top:1px solid var(--line);color:var(--muted);font-size:14px;display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}
footer b{font-family:'Saira Condensed',sans-serif;letter-spacing:.12em;color:var(--text2)}
@media (max-width:420px){h1{font-size:36px}.facts{grid-template-columns:1fr 1fr}}
`;

function head(opts: { title: string; description: string; url: string; image: string | null; indexable: boolean }): string {
  const t = esc(opts.title);
  const d = esc(opts.description);
  return `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${t}</title>
<meta name="description" content="${d}">
${opts.indexable ? '' : '<meta name="robots" content="noindex,nofollow">'}
<meta property="og:type" content="website">
<meta property="og:site_name" content="Car Guy">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:url" content="${esc(opts.url)}">
${opts.image ? `<meta property="og:image" content="${esc(opts.image)}"><meta property="og:image:width" content="1600"><meta property="og:image:height" content="1200">` : ''}
<meta name="twitter:card" content="${opts.image ? 'summary_large_image' : 'summary'}">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
${opts.image ? `<meta name="twitter:image" content="${esc(opts.image)}">` : ''}
<meta name="theme-color" content="#121212">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">
<style>${CSS}</style>`;
}

export function renderDossierHtml(d: Dossier, opts: { url: string }): string {
  const pageTitle = d.nickname ? `${d.name} “${d.nickname}” · ${d.title}` : `${d.name} · ${d.title}`;
  const sections: string[] = [];

  sections.push(`<div class="hero">${d.heroUrl ? `<img src="${esc(d.heroUrl)}" alt="${esc(d.name)}">` : ''}<div class="badges">${d.badges
    .map((b) => `<span class="badge ${b.tone}">${esc(b.label)}</span>`)
    .join('')}</div></div>`);
  sections.push(`<header><h1>${esc(d.name)}</h1>${d.nickname ? `<div class="nick">“${esc(d.nickname)}”</div>` : ''}<p class="sub">${esc(d.title)}</p>
<div class="facts">${d.facts.map((f) => `<div class="fact"><div class="eyebrow">${esc(f.label)}</div><div class="v">${esc(f.value)}</div></div>`).join('')}</div></header>`);

  if (d.story || d.milestones.length) {
    sections.push(`<section><h2>Historia</h2><div class="card">${d.story ? `<div class="story">${esc(d.story)}</div>` : ''}${d.milestones
      .map((m) => `<div class="ms"><b>${esc(m.date)}</b> · ${esc(m.title)}${m.story ? ` — ${esc(m.story)}` : ''}</div>`)
      .join('')}</div></section>`);
  }

  if (d.specs && d.specs.length) {
    sections.push(`<section><h2>Stock → Actual</h2><div class="card"><table><thead><tr><th></th><th>Stock</th><th>Actual</th></tr></thead><tbody>${d.specs
      .map((s) => `<tr><td class="l">${esc(s.label)}</td><td>${esc(s.stock)}</td><td class="${s.changed ? 'chg' : ''}">${esc(s.value)}</td></tr>`)
      .join('')}</tbody></table></div></section>`);
  }

  if (d.mods && d.mods.length) {
    sections.push(`<section><h2>Mods · ${d.modCount}${d.modsTotal ? ` · ${esc(d.modsTotal)}` : ''}</h2><div class="card">${d.mods
      .map(
        (g) =>
          `<div class="cat"><span class="eyebrow">${esc(g.category)}</span>${g.items
            .map((i) => `<div class="row"><div><div class="n">${esc(i.name)}</div><div class="d">${esc(i.detail)}</div></div>${i.cost ? `<div class="c">${esc(i.cost)}</div>` : ''}</div>`)
            .join('')}</div>`,
      )
      .join('')}</div></section>`);
  }

  if (d.maintenance && d.maintenance.count) {
    const m = d.maintenance;
    sections.push(`<section><h2>Mantenimiento</h2><div class="card"><div class="stats"><div class="stat"><div class="eyebrow">Registros</div><div class="big">${m.count}</div></div>${
      m.last ? `<div class="stat"><div class="eyebrow">Último</div><div class="n" style="font-weight:700;margin-top:4px">${esc(m.last.title)}</div><div class="d" style="color:var(--muted)">${esc(m.last.date)}</div></div>` : ''
    }${m.total ? `<div class="stat"><div class="eyebrow">Invertido</div><div class="big" style="font-size:20px">${esc(m.total)}</div></div>` : ''}</div>${m.recent
      .map((r) => `<div class="row"><div><div class="n">${esc(r.title)}</div><div class="d">${esc(r.date)}</div></div>${r.cost ? `<div class="c">${esc(r.cost)}</div>` : ''}</div>`)
      .join('')}</div></section>`);
  }

  if (d.track && d.track.events) {
    const t = d.track;
    sections.push(`<section><h2>Pista 走り</h2><div class="card"><div class="stats"><div class="stat"><div class="eyebrow">Eventos</div><div class="big">${t.events}</div></div>${t.bests
      .map((b) => `<div class="stat"><div class="eyebrow">PB · ${esc(b.venue)}</div><div class="big amber">${esc(b.lap)}</div></div>`)
      .join('')}</div>${t.recent.map((r) => `<div class="row"><div><div class="n">${esc(r.title)}</div><div class="d">${esc(r.line)}</div></div><div class="c">${esc(r.date)}</div></div>`).join('')}</div></section>`);
  }

  // Note 8, only when the owner turned "costos" on (publicDossier leaves it null otherwise).
  if (d.costs) {
    const c = d.costs;
    sections.push(`<section><h2>Lo que ha costado</h2><div class="card"><div class="stats"><div class="stat"><div class="eyebrow">Total</div><div class="big" style="font-size:20px">${esc(c.total)}</div></div>${
      c.perKm ? `<div class="stat"><div class="eyebrow">Por km</div><div class="big" style="font-size:20px">${esc(c.perKm)}</div></div>` : ''
    }</div>${c.rows.map((r) => `<div class="row"><div><div class="n">${esc(r.label)}</div></div><div class="c">${esc(r.value)}</div></div>`).join('')}${
      c.since ? `<div class="d" style="color:var(--muted);margin-top:8px">${esc(c.since)}</div>` : ''
    }</div></section>`);
  }

  if (d.photos.length) {
    sections.push(`<section><h2>Fotos</h2><div class="grid">${d.photos
      .map((p) => `<a href="${esc(p.full)}"><img loading="lazy" src="${esc(p.thumb)}" alt=""></a>`)
      .join('')}</div></section>`);
  }

  return `<!doctype html><html lang="es"><head>${head({ title: pageTitle, description: d.description, url: opts.url, image: d.heroUrl, indexable: d.indexable })}</head>
<body><main>${sections.join('\n')}
<footer><span><b>CAR GUY</b> · Hecho con Car Guy</span><span>car-guy.vercel.app</span></footer></main></body></html>`;
}

export function renderNotFoundHtml(): string {
  return `<!doctype html><html lang="es"><head>${head({ title: 'Este carro no está compartido · Car Guy', description: 'El link no existe o su dueño lo desactivó.', url: 'https://car-guy.vercel.app', image: null, indexable: false })}</head>
<body><main style="padding-top:18vh;text-align:center"><div class="eyebrow">404 · 走り</div><h1>No está aquí</h1><p class="sub">Este link no existe o su dueño lo desactivó.</p>
<footer style="justify-content:center"><span><b>CAR GUY</b> · Hecho con Car Guy</span></footer></main></body></html>`;
}
