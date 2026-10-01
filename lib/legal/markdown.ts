/**
 * The legal texts' Markdown (content/legal/*.md) → blocks, and blocks → HTML for the public pages
 * (IMP 30092026 note 15, ADR-47). The app draws the same blocks with React Native
 * (components/legal/LegalMarkdown.tsx), so the web page and Más → Legal never disagree.
 *
 * Shared with tools/build-legal.mjs, which Node runs with its built-in type stripping: this file
 * stays erasable TypeScript with no imports.
 *
 * The subset the texts use, nothing more:
 *   # / ## / ###                headings
 *   blank-line separated text   paragraphs (lines joined with a space)
 *   - item  /  1. item          lists (continuation lines are indented)
 *   > text                      a notice (one paragraph)
 *   ---                         a rule
 *   **bold**  *em*  `code`  [text](href)   inline
 */

export type Inline =
  | { type: 'text'; text: string }
  | { type: 'strong'; children: Inline[] }
  | { type: 'em'; children: Inline[] }
  | { type: 'code'; text: string }
  | { type: 'link'; href: string; children: Inline[] };

export type Block =
  | { type: 'heading'; level: 1 | 2 | 3; children: Inline[] }
  | { type: 'paragraph'; children: Inline[] }
  | { type: 'list'; ordered: boolean; items: Inline[][] }
  | { type: 'quote'; children: Inline[] }
  | { type: 'rule' };

/** Inline Markdown → nodes. Unclosed markers stay as text. */
export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let buffer = '';
  const flush = () => {
    if (buffer) out.push({ type: 'text', text: buffer });
    buffer = '';
  };
  let i = 0;
  while (i < text.length) {
    const rest = text.slice(i);
    if (rest.startsWith('**')) {
      const end = text.indexOf('**', i + 2);
      if (end > i + 2) {
        flush();
        out.push({ type: 'strong', children: parseInline(text.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    } else if (rest[0] === '*') {
      const end = text.indexOf('*', i + 1);
      if (end > i + 1 && text[end + 1] !== '*') {
        flush();
        out.push({ type: 'em', children: parseInline(text.slice(i + 1, end)) });
        i = end + 1;
        continue;
      }
    } else if (rest[0] === '`') {
      const end = text.indexOf('`', i + 1);
      if (end > i + 1) {
        flush();
        out.push({ type: 'code', text: text.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    } else if (rest[0] === '[') {
      const m = /^\[([^\]]+)\]\(([^)\s]+)\)/.exec(rest);
      if (m) {
        flush();
        out.push({ type: 'link', href: m[2], children: parseInline(m[1]) });
        i += m[0].length;
        continue;
      }
    }
    buffer += text[i];
    i += 1;
  }
  flush();
  return out;
}

const LIST_ITEM = /^(\s*)([-*]|\d+\.)\s+(.*)$/;

/** Block Markdown → blocks. */
export function parseMarkdown(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) {
      i += 1;
      continue;
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(trimmed);
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length as 1 | 2 | 3, children: parseInline(heading[2].trim()) });
      i += 1;
      continue;
    }
    if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
      blocks.push({ type: 'rule' });
      i += 1;
      continue;
    }
    if (trimmed.startsWith('>')) {
      const parts: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        parts.push(lines[i].trim().replace(/^>\s?/, ''));
        i += 1;
      }
      blocks.push({ type: 'quote', children: parseInline(parts.join(' ').trim()) });
      continue;
    }
    const first = LIST_ITEM.exec(line);
    if (first) {
      const ordered = /\d/.test(first[2]);
      const items: string[] = [];
      while (i < lines.length) {
        const current = lines[i];
        const item = LIST_ITEM.exec(current);
        if (item && /\d/.test(item[2]) === ordered && item[1].length === 0) {
          items.push(item[3].trim());
        } else if (current.trim() && /^\s+/.test(current) && items.length) {
          items[items.length - 1] += ` ${current.trim()}`;
        } else break;
        i += 1;
      }
      blocks.push({ type: 'list', ordered, items: items.map(parseInline) });
      continue;
    }
    const parts: string[] = [];
    while (i < lines.length) {
      const current = lines[i].trim();
      if (!current || /^#{1,3}\s/.test(current) || current.startsWith('>') || LIST_ITEM.test(lines[i]) || /^(-{3,}|\*{3,})$/.test(current)) break;
      parts.push(current);
      i += 1;
    }
    blocks.push({ type: 'paragraph', children: parseInline(parts.join(' ')) });
  }
  return blocks;
}

/** Plain text of some inline nodes (titles, accessibility labels). */
export function inlineText(nodes: readonly Inline[]): string {
  return nodes.map((n) => (n.type === 'text' || n.type === 'code' ? n.text : inlineText(n.children))).join('');
}

/** The document's title: its first heading. */
export function titleOf(markdown: string): string {
  const h = parseMarkdown(markdown).find((b) => b.type === 'heading');
  return h && h.type === 'heading' ? inlineText(h.children) : '';
}

/** Only links that stay on this site, or go to the web or an e-mail; anything else renders as text. */
export function safeHref(href: string): string | null {
  if (/^(https?:\/\/|mailto:)/i.test(href)) return href;
  if (href.startsWith('/') && !href.startsWith('//')) return href;
  return null;
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function inlineToHtml(nodes: readonly Inline[]): string {
  return nodes
    .map((n) => {
      switch (n.type) {
        case 'text':
          return escapeHtml(n.text);
        case 'code':
          return `<code>${escapeHtml(n.text)}</code>`;
        case 'strong':
          return `<strong>${inlineToHtml(n.children)}</strong>`;
        case 'em':
          return `<em>${inlineToHtml(n.children)}</em>`;
        case 'link': {
          const href = safeHref(n.href);
          return href ? `<a href="${escapeHtml(href)}">${inlineToHtml(n.children)}</a>` : inlineToHtml(n.children);
        }
      }
    })
    .join('');
}

export function blocksToHtml(blocks: readonly Block[]): string {
  return blocks
    .map((b) => {
      switch (b.type) {
        case 'heading':
          return `<h${b.level}>${inlineToHtml(b.children)}</h${b.level}>`;
        case 'paragraph':
          return `<p>${inlineToHtml(b.children)}</p>`;
        case 'quote':
          return `<blockquote><p>${inlineToHtml(b.children)}</p></blockquote>`;
        case 'rule':
          return '<hr>';
        case 'list': {
          const tag = b.ordered ? 'ol' : 'ul';
          return `<${tag}>${b.items.map((item) => `<li>${inlineToHtml(item)}</li>`).join('')}</${tag}>`;
        }
      }
    })
    .join('\n');
}

// —— The public pages (/terminos, /privacidad, /eliminar-cuenta) ——————————————————————————

export type LegalDocId = 'terminos' | 'privacidad' | 'eliminar-cuenta';
export const LEGAL_DOC_IDS: readonly LegalDocId[] = ['terminos', 'privacidad', 'eliminar-cuenta'];
export type LegalLang = 'es' | 'en';

const NAV: Record<LegalLang, Record<LegalDocId, string>> = {
  es: { terminos: 'Términos', privacidad: 'Privacidad', 'eliminar-cuenta': 'Eliminar cuenta' },
  en: { terminos: 'Terms', privacidad: 'Privacy', 'eliminar-cuenta': 'Delete account' },
};
const FOOT: Record<LegalLang, (version: string, date: string) => string> = {
  es: (version, date) => `Versión ${version} · ${date} · Car Guy, de Xaviel Terrero`,
  en: (version, date) => `Version ${version} · ${date} · Car Guy, by Xaviel Terrero`,
};
const OPEN_APP: Record<LegalLang, string> = { es: 'Abrir Car Guy', en: 'Open Car Guy' };

const CSS = `
:root{color-scheme:dark;--bg:#121212;--surface:#1B1B1B;--text:#EDEDED;--muted:#B3B3B3;--line:#2C2C2C;--accent:#FFB300;--red:#E10600}
@media (prefers-color-scheme:light){:root{color-scheme:light;--bg:#F5F4F0;--surface:#FFFFFF;--text:#121212;--muted:#4A4A4A;--line:#DAD7CF;--accent:#8F5A00}}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--text);font:17px/1.65 system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif}
main{max-width:720px;margin:0 auto;padding:16px 16px 56px}
nav{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;justify-content:space-between;padding:8px 0 16px;border-bottom:3px solid var(--red);margin-bottom:24px}
nav .brand{font-weight:800;letter-spacing:.12em;color:var(--text);text-decoration:none}
nav .langs a{color:var(--muted);text-decoration:none;padding:6px 4px}
nav .langs a[aria-current="true"]{color:var(--accent);font-weight:700}
h1{font-size:1.75rem;line-height:1.2;margin:0 0 8px}
h2{font-size:1.2rem;line-height:1.3;margin:2em 0 .5em;color:var(--accent)}
h3{font-size:1.05rem;margin:1.5em 0 .4em}
p,ul,ol{margin:0 0 1em}
ul,ol{padding-left:1.4em}
li{margin:.3em 0}
a{color:var(--accent)}
code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.92em}
blockquote{margin:1.2em 0;padding:12px 16px;background:var(--surface);border-left:4px solid var(--accent);border-radius:6px}
blockquote p{margin:0}
hr{border:0;border-top:1px solid var(--line);margin:2em 0}
footer{margin-top:40px;padding-top:16px;border-top:1px solid var(--line);color:var(--muted);font-size:.9rem}
footer .docs{display:flex;flex-wrap:wrap;gap:8px 16px;margin-bottom:8px}
`.trim();

// ?lang=, else the app's own language (AsyncStorage on web is localStorage 'car-guy/language'),
// else the browser's; Spanish by default. Without JS both articles show (the <noscript> style).
const SCRIPT = `(function(){var d=document,q=null,s=null;try{q=new URLSearchParams(location.search).get('lang')}catch(e){}try{s=localStorage.getItem('car-guy/language')}catch(e){}
var l=q==='en'||q==='es'?q:s==='en'||s==='es'?s:/^en/i.test(navigator.language||'')?'en':'es';
d.documentElement.lang=l==='en'?'en':'es-DO';
var a=d.querySelectorAll('[data-lang]');for(var i=0;i<a.length;i++){if(a[i].tagName==='ARTICLE'||a[i].tagName==='FOOTER'){a[i].hidden=a[i].getAttribute('data-lang')!==l}else{a[i].setAttribute('aria-current',String(a[i].getAttribute('data-lang')===l))}}
var t=d.querySelector('article[data-lang="'+l+'"]');if(t&&t.getAttribute('data-title'))d.title=t.getAttribute('data-title');
var k=d.querySelectorAll('a[href^="/"]');for(var j=0;j<k.length;j++){var h=k[j].getAttribute('href');if(h!=='/'&&h.indexOf('lang=')<0)k[j].setAttribute('href',h+(h.indexOf('?')<0?'?':'&')+'lang='+l)}})();`;

function footerHtml(doc: LegalDocId, lang: LegalLang, version: string, date: string): string {
  const docs = LEGAL_DOC_IDS.map((id) =>
    id === doc ? `<span>${escapeHtml(NAV[lang][id])}</span>` : `<a href="/${id}${lang === 'en' ? '?lang=en' : ''}">${escapeHtml(NAV[lang][id])}</a>`,
  ).join('');
  return `<footer data-lang="${lang}"${lang === 'en' ? ' hidden' : ''}><div class="docs">${docs}<a href="/">${escapeHtml(OPEN_APP[lang])}</a></div><div>${escapeHtml(FOOT[lang](version, date))}</div></footer>`;
}

/** One public page with both languages; the version string is in the raw HTML (tools/smoke-legal.mjs). */
export function renderLegalPage(doc: LegalDocId, sources: Record<LegalLang, string>, version: string, date: string): string {
  const titles = { es: `${titleOf(sources.es)} · Car Guy`, en: `${titleOf(sources.en)} · Car Guy` };
  const article = (lang: LegalLang) =>
    `<article lang="${lang === 'en' ? 'en' : 'es-DO'}" data-lang="${lang}" data-title="${escapeHtml(titles[lang])}"${lang === 'en' ? ' hidden' : ''}>\n${blocksToHtml(parseMarkdown(sources[lang]))}\n</article>`;
  return `<!doctype html>
<html lang="es-DO">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(titles.es)}</title>
<meta name="description" content="${escapeHtml(`${titleOf(sources.es)} — Car Guy · ${titleOf(sources.en)}`)}">
<meta name="car-guy-legal-version" content="${escapeHtml(version)}">
<meta name="theme-color" content="#121212">
<link rel="icon" href="/favicon.png">
<style>${CSS}</style>
<noscript><style>article[hidden],footer[hidden]{display:block}</style></noscript>
</head>
<body>
<main>
<nav><a class="brand" href="/">CAR GUY</a><span class="langs"><a href="?lang=es" data-lang="es" aria-current="true">Español</a> · <a href="?lang=en" data-lang="en" aria-current="false">English</a></span></nav>
${article('es')}
${article('en')}
${footerHtml(doc, 'es', version, date)}
${footerHtml(doc, 'en', version, date)}
</main>
<script>${SCRIPT}</script>
</body>
</html>
`;
}

/** lib/legal/content.generated.ts: the Markdown as strings, so the app bundles the same texts. */
export function renderContentModule(sources: Record<LegalDocId, Record<LegalLang, string>>): string {
  const body = LEGAL_DOC_IDS.map(
    (id) => `  ${JSON.stringify(id)}: {\n    es: ${JSON.stringify(sources[id].es)},\n    en: ${JSON.stringify(sources[id].en)},\n  },`,
  ).join('\n');
  return `// Generated by tools/build-legal.mjs from content/legal/*.md — do not edit by hand.\n// __tests__/legal/markdown.test.ts fails when this file is stale.\n\nexport const LEGAL_MARKDOWN = {\n${body}\n} as const;\n`;
}
