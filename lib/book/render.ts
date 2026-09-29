/**
 * The car book (IMP 28092026 Phase 7, research §5): one PDF with pdf-lib, the
 * same engine on Android and web. Pure layout — fonts and photo bytes come in
 * through `deps`, so the tests render with the standard fonts and no photos.
 *
 * Pages: cover (dark, the hero), ficha + historia, STOCK → ACTUAL, mods by
 * category, mantenimiento, documentos (dates only), pista, then photo pages
 * 3×3 grouped by year (≤ 60 images). Content pages are white so it prints.
 */
import { clip, endPath, PDFDocument, popGraphicsState, pushGraphicsState, rectangle, rgb, StandardFonts, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';

import type { Dossier } from '../share/dossier';

export type BookFonts = { display: Uint8Array; title: Uint8Array; body: Uint8Array; bold: Uint8Array; mono: Uint8Array } | null;

export type BookInput = {
  dossier: Dossier;
  heroId: string | null;
  photos: { id: string; takenAt: string | null }[];
  documents: { title: string; kind: string; issuedAt: string | null; expiresAt: string | null }[] | null;
  generatedAt: string;
  periodLabel: string | null;
};

export type BookDeps = {
  fonts: BookFonts;
  /** JPEG bytes of a photo (thumb for the grid, full for the cover); null skips it. */
  image: (id: string, thumb: boolean) => Promise<Uint8Array | null>;
  fontkit?: unknown;
  onProgress?: (done: number, total: number) => void;
};

export const MAX_BOOK_PHOTOS = 60;

const W = 595.28;
const H = 841.89;
const M = 48;
const AMBER = rgb(1, 0.702, 0);
const INK = rgb(0.07, 0.07, 0.07);
const INK2 = rgb(0.33, 0.33, 0.33);
const MUTED = rgb(0.55, 0.55, 0.55);
const LINE = rgb(0.86, 0.86, 0.86);
const DARK = rgb(0.071, 0.071, 0.071);
const RED = rgb(0.882, 0.024, 0);

type Fonts = { display: PDFFont; title: PDFFont; body: PDFFont; bold: PDFFont; mono: PDFFont };

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
const shortDate = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

/** Characters a font cannot draw become their closest ASCII, or vanish. */
const FALLBACK: Record<string, string> = { '→': '>', '•': '*', '·': '-', '“': '"', '”': '"', '‘': "'", '’': "'", '—': '-', '–': '-', '…': '...', '★': '*', '°': 'o' };
function safeText(font: PDFFont, text: string): string {
  const set = charSet(font);
  let out = '';
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (set.has(cp)) out += ch;
    else if (FALLBACK[ch] && [...FALLBACK[ch]].every((c) => set.has(c.codePointAt(0)!))) out += FALLBACK[ch];
    else if (cp < 128 && set.has(cp)) out += ch;
    else {
      const plain = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
      if (plain !== ch && [...plain].every((c) => set.has(c.codePointAt(0)!))) out += plain;
    }
  }
  return out;
}
const sets = new WeakMap<PDFFont, Set<number>>();
function charSet(font: PDFFont): Set<number> {
  let s = sets.get(font);
  if (!s) {
    s = new Set(font.getCharacterSet());
    sets.set(font, s);
  }
  return s;
}

class Writer {
  page!: PDFPage;
  y = 0;
  pageNo = 0;
  constructor(
    private doc: PDFDocument,
    private f: Fonts,
    private footer: string,
  ) {}

  newPage(): PDFPage {
    this.page = this.doc.addPage([W, H]);
    this.pageNo += 1;
    this.y = H - M;
    this.page.drawRectangle({ x: 0, y: H - 6, width: W, height: 6, color: AMBER });
    this.text(this.footer, M, 26, { font: this.f.title, size: 8, color: MUTED });
    const n = String(this.pageNo);
    this.text(n, W - M - this.f.mono.widthOfTextAtSize(n, 8), 26, { font: this.f.mono, size: 8, color: MUTED });
    return this.page;
  }

  ensure(h: number) {
    if (this.y - h < M + 20) this.newPage();
  }

  text(s: string, x: number, y: number, o: { font: PDFFont; size: number; color?: ReturnType<typeof rgb> }) {
    const t = safeText(o.font, s);
    if (t) this.page.drawText(t, { x, y, font: o.font, size: o.size, color: o.color ?? INK });
  }

  wrap(s: string, font: PDFFont, size: number, width: number): string[] {
    const lines: string[] = [];
    for (const para of safeText(font, s).split('\n')) {
      let line = '';
      for (const word of para.split(/\s+/)) {
        const next = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(next, size) > width && line) {
          lines.push(line);
          line = word;
        } else line = next;
      }
      lines.push(line);
    }
    return lines;
  }

  para(s: string, o: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; width?: number; gap?: number } = {}) {
    const font = o.font ?? this.f.body;
    const size = o.size ?? 11;
    const lh = size * 1.4;
    for (const line of this.wrap(s, font, size, o.width ?? W - 2 * M)) {
      this.ensure(lh);
      this.y -= lh;
      this.text(line, M, this.y, { font, size, color: o.color ?? INK });
    }
    this.y -= o.gap ?? 6;
  }

  heading(s: string) {
    this.ensure(48);
    this.y -= 30;
    this.page.drawRectangle({ x: M, y: this.y - 2, width: 4, height: 18, color: AMBER });
    this.text(s.toUpperCase(), M + 12, this.y, { font: this.f.display, size: 20 });
    this.y -= 12;
  }

  eyebrow(s: string) {
    this.ensure(20);
    this.y -= 16;
    this.text(s.toUpperCase(), M, this.y, { font: this.f.title, size: 9, color: MUTED });
    this.y -= 2;
  }

  /** Columns: widths as fractions of the text width; the last column right-aligned when `rightLast`. */
  row(cells: string[], widths: number[], o: { bold?: boolean; header?: boolean; rightLast?: boolean } = {}) {
    const total = W - 2 * M;
    const size = o.header ? 8 : 10;
    const font = o.header ? this.f.title : o.bold ? this.f.bold : this.f.body;
    const wrapped = cells.map((c, i) => this.wrap(c, i === cells.length - 1 && o.rightLast ? this.f.mono : font, size, widths[i] * total - 6));
    const lines = Math.max(...wrapped.map((w) => w.length));
    const h = lines * size * 1.35 + 8;
    this.ensure(h);
    let x = M;
    wrapped.forEach((ls, i) => {
      const f = i === cells.length - 1 && o.rightLast && !o.header ? this.f.mono : font;
      ls.forEach((l, j) => {
        const lx = i === cells.length - 1 && o.rightLast ? M + total - f.widthOfTextAtSize(l, size) : x;
        this.text(o.header ? l.toUpperCase() : l, lx, this.y - 4 - (j + 1) * size * 1.25, { font: f, size, color: o.header ? MUTED : INK });
      });
      x += widths[i] * total;
    });
    this.y -= h;
    this.page.drawLine({ start: { x: M, y: this.y }, end: { x: W - M, y: this.y }, thickness: 0.5, color: LINE });
  }
}

async function loadFonts(doc: PDFDocument, deps: BookDeps): Promise<Fonts> {
  if (deps.fonts && deps.fontkit) {
    try {
      doc.registerFontkit(deps.fontkit as never);
      const [display, title, body, bold, mono] = await Promise.all([
        doc.embedFont(deps.fonts.display, { subset: true }),
        doc.embedFont(deps.fonts.title, { subset: true }),
        doc.embedFont(deps.fonts.body, { subset: true }),
        doc.embedFont(deps.fonts.bold, { subset: true }),
        doc.embedFont(deps.fonts.mono, { subset: true }),
      ]);
      return { display, title, body, bold, mono };
    } catch {
      // Fall through to Helvetica: a book in the wrong font beats no book.
    }
  }
  const [display, body, mono] = await Promise.all([doc.embedFont(StandardFonts.HelveticaBold), doc.embedFont(StandardFonts.Helvetica), doc.embedFont(StandardFonts.Courier)]);
  return { display, title: display, body, bold: display, mono };
}

async function embed(doc: PDFDocument, bytes: Uint8Array | null): Promise<PDFImage | null> {
  if (!bytes) return null;
  try {
    return await doc.embedJpg(bytes);
  } catch {
    return null;
  }
}

/** Draws `img` covering the box, centre-cropped (clip path, then the scaled image). */
function drawCover(page: PDFPage, img: PDFImage, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  page.pushOperators(pushGraphicsState(), rectangle(x, y, w, h), clip(), endPath());
  page.drawImage(img, { x: x + (w - dw) / 2, y: y + (h - dh) / 2, width: dw, height: dh });
  page.pushOperators(popGraphicsState());
}

export async function renderBook(input: BookInput, deps: BookDeps): Promise<Uint8Array> {
  const d = input.dossier;
  const doc = await PDFDocument.create();
  doc.setTitle(`${d.name} — Libro del carro`);
  doc.setAuthor('Car Guy');
  doc.setCreator('Car Guy');
  doc.setCreationDate(new Date(input.generatedAt));
  const f = await loadFonts(doc, deps);
  const photos = input.photos.slice(0, MAX_BOOK_PHOTOS);
  const total = photos.length + 2;
  let done = 0;
  const tick = () => deps.onProgress?.(++done, total);

  // ---- cover (dark) ----
  const cover = doc.addPage([W, H]);
  cover.drawRectangle({ x: 0, y: 0, width: W, height: H, color: DARK });
  const hero = input.heroId ? await embed(doc, await deps.image(input.heroId, false)) : null;
  if (hero) {
    const boxH = H * 0.55;
    const fit = Math.min(W / hero.width, boxH / hero.height);
    const fw = hero.width * fit;
    const fh = hero.height * fit;
    cover.drawImage(hero, { x: (W - fw) / 2, y: H - boxH + (boxH - fh) / 2, width: fw, height: fh });
  }
  tick();
  const cw = new Writer(doc, f, '');
  cw.page = cover;
  let cy = H * 0.4;
  let bx = M;
  for (const b of d.badges) {
    const label = safeText(f.title, b.label);
    const bw = f.title.widthOfTextAtSize(label, 10) + 14;
    cover.drawRectangle({ x: bx, y: cy, width: bw, height: 18, color: b.tone === 'red' ? RED : b.tone === 'amber' ? AMBER : rgb(0.2, 0.2, 0.2) });
    cw.text(label, bx + 7, cy + 5, { font: f.title, size: 10, color: b.tone === 'amber' ? INK : rgb(1, 1, 1) });
    bx += bw + 6;
  }
  cy -= 56;
  for (const line of cw.wrap(d.name.toUpperCase(), f.display, 46, W - 2 * M).slice(0, 2)) {
    cw.text(line, M, cy, { font: f.display, size: 46, color: rgb(0.93, 0.93, 0.93) });
    cy -= 46;
  }
  if (d.nickname) {
    cw.text(`“${d.nickname}”`, M, cy, { font: f.bold, size: 18, color: AMBER });
    cy -= 26;
  }
  cw.text(d.title, M, cy, { font: f.body, size: 14, color: rgb(0.7, 0.7, 0.7) });
  cw.text('LIBRO DEL CARRO', M, 70, { font: f.title, size: 12, color: AMBER });
  cw.text([shortDate(input.generatedAt), input.periodLabel].filter(Boolean).join(' · '), M, 52, { font: f.mono, size: 9, color: rgb(0.6, 0.6, 0.6) });
  cw.text('CAR GUY', W - M - f.title.widthOfTextAtSize('CAR GUY', 12), 70, { font: f.title, size: 12, color: rgb(0.6, 0.6, 0.6) });

  const w = new Writer(doc, f, `${d.name.toUpperCase()} · LIBRO DEL CARRO`);
  w.newPage();

  // ---- ficha + historia ----
  w.heading('Ficha');
  for (let i = 0; i < d.facts.length; i += 2) {
    const pair = d.facts.slice(i, i + 2);
    w.row(pair.flatMap((p) => [p.label, p.value]).concat(pair.length === 1 ? ['', ''] : []), [0.16, 0.34, 0.16, 0.34]);
  }
  if (d.story || d.milestones.length) {
    w.heading('Historia');
    if (d.story) w.para(d.story, { size: 12 });
    for (const m of d.milestones) w.para(`${m.date} · ${m.title}${m.story ? ` — ${m.story}` : ''}`, { size: 10, color: INK2, gap: 2 });
  }
  if (d.specs?.length) {
    w.heading('Stock → Actual');
    w.row(['', 'Stock', 'Actual'], [0.34, 0.33, 0.33], { header: true });
    for (const s of d.specs) w.row([s.label, s.stock, s.value], [0.34, 0.33, 0.33], { bold: s.changed });
  }
  if (d.mods?.length) {
    w.heading(`Mods · ${d.modCount}${d.modsTotal ? ` · ${d.modsTotal}` : ''}`);
    for (const g of d.mods) {
      w.eyebrow(g.category);
      for (const m of g.items) w.row([m.name, m.detail, m.cost ?? ''], [0.45, 0.37, 0.18], { rightLast: true });
    }
  }
  if (d.maintenance?.count) {
    const m = d.maintenance;
    w.heading('Mantenimiento');
    w.para([`${m.count} ${m.count === 1 ? "registro" : "registros"}`, m.last ? `último: ${m.last.title} (${m.last.date})` : null, m.total ? `total ${m.total}` : null].filter(Boolean).join(' · '), { size: 10, color: INK2 });
    w.row(['Fecha', 'Trabajo', m.total ? 'Costo' : ''], [0.2, 0.6, 0.2], { header: true, rightLast: true });
    for (const r of m.recent) w.row([r.date, r.title, r.cost ?? ''], [0.2, 0.6, 0.2], { rightLast: true });
  }
  if (input.documents?.length) {
    w.heading('Documentos');
    w.row(['Documento', 'Emitido', 'Vence'], [0.5, 0.25, 0.25], { header: true });
    for (const doc2 of input.documents) w.row([doc2.title || doc2.kind, shortDate(doc2.issuedAt), shortDate(doc2.expiresAt)], [0.5, 0.25, 0.25]);
  }
  if (d.track?.events) {
    const t = d.track;
    w.heading('Pista');
    w.para([`${t.events} ${t.events === 1 ? 'evento' : 'eventos'}`, ...t.bests.map((b) => `PB ${b.venue} ${b.lap}`)].join(' · '), { size: 11, font: f.bold });
    for (const r of t.recent) w.row([r.date, r.title, r.line], [0.18, 0.32, 0.5]);
  }
  tick();

  // ---- photos, 3×3 per page, a chapter per year ----
  if (photos.length) {
    const years = new Map<string, typeof photos>();
    for (const p of photos) {
      const y = p.takenAt ? String(new Date(p.takenAt).getUTCFullYear()) : 'Sin fecha';
      if (!years.has(y)) years.set(y, []);
      years.get(y)!.push(p);
    }
    const keys = [...years.keys()].sort((a, b) => (a === 'Sin fecha' ? 1 : b === 'Sin fecha' ? -1 : b.localeCompare(a)));
    const gap = 8;
    const cell = (W - 2 * M - 2 * gap) / 3;
    for (const year of keys) {
      const list = years.get(year)!;
      for (let i = 0; i < list.length; i += 9) {
        w.newPage();
        w.heading(i === 0 ? `Fotos · ${year}` : `${year} (cont.)`);
        const top = w.y - 8;
        const chunk = list.slice(i, i + 9);
        for (let k = 0; k < chunk.length; k++) {
          const img = await embed(doc, await deps.image(chunk[k].id, true));
          tick();
          const col = k % 3;
          const rowN = Math.floor(k / 3);
          const x = M + col * (cell + gap);
          const y = top - (rowN + 1) * cell - rowN * gap;
          w.page.drawRectangle({ x, y, width: cell, height: cell, color: rgb(0.94, 0.94, 0.94) });
          if (img) drawCover(w.page, img, x, y, cell, cell);
        }
      }
    }
  }

  return doc.save();
}

/** car-guy_<slug|nick>_<yyyymmdd>.pdf */
export function bookFileName(name: string, slugOrNick: string | null, at: Date): string {
  const base = (slugOrNick || name)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'carro';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `car-guy_${base}_${at.getFullYear()}${pad(at.getMonth() + 1)}${pad(at.getDate())}.pdf`;
}
