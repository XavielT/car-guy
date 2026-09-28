/**
 * Generates every icon the app ships, from one mark.
 *
 * sharp is deliberately NOT a dependency of this project: it is a large native
 * package needed only when the artwork changes, and Vercel installs devDeps on
 * every build. To regenerate:
 *
 *   npm i --no-save sharp && node tools/make-icons.mjs
 *
 * Outputs (all committed, so a normal build never needs this):
 *   assets/pwa/*.svg          the composed sources
 *   assets/images/*.png       native icons, splash and adaptive layers
 *   public/icons/*.png        PWA icons
 *   public/favicon.png        web favicon
 *   assets/images/carbon*.png the CarbonFrame tile
 */
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';

const PANEL = '#121212';
const ACCENT = '#FFB300';
const NEEDLE = '#FF5F00';
const REDLINE = '#E10600';
const TRACK = '#2A2A2A';
const DIGIT = '#EDEDED';

/**
 * The mark (IMP 28092026, 05-design-jdm.md "Icon and splash"), in a 64 unit
 * box: a 240° tach from 8 to 4 o'clock (same geometry as ClusterHero) — amber
 * to about 3 o'clock, a solid red wedge over the last 40° — an orange needle
 * into the red, a dark hub with an amber
 * ring, and a tiny 7-segment "085" under it: the hachi-gō nod. No letters.
 *
 * Angles are clockwise from +x with y pointing down, centre (32, 31), arc
 * radius 20. The sweep's round caps reach radius 22 at 8 and 4 o'clock.
 */
const C = { x: 32, y: 31 };
const R = 20;
const at = (deg, r = R) => {
  const a = (deg * Math.PI) / 180;
  return `${(C.x + r * Math.cos(a)).toFixed(2)} ${(C.y + r * Math.sin(a)).toFixed(2)}`;
};
const arc = (from, to, color, width = 4, cap = 'round') =>
  `<path d="M${at(from)} A${R} ${R} 0 ${to - from > 180 ? 1 : 0} 1 ${at(to)}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="${cap}"/>`;

// 7-segment digits, the same geometry as components/ui/LcdDigits.tsx.
const SEG = {
  a: '4,1 18,1 15.5,3.5 6.5,3.5',
  b: '19,2 19,17 16.5,15.5 16.5,4.5',
  c: '19,19 19,34 16.5,31.5 16.5,20.5',
  d: '4,35 18,35 15.5,32.5 6.5,32.5',
  e: '3,19 3,34 5.5,31.5 5.5,20.5',
  f: '3,2 3,17 5.5,15.5 5.5,4.5',
  g: '4.5,18 6.5,16.7 15.5,16.7 17.5,18 15.5,19.3 6.5,19.3',
};
const LIT = { 0: 'abcdef', 8: 'abcdefg', 5: 'afgcd' };
function digits085() {
  const scale = 0.16; // 22×36 box → 3.5×5.8
  return ['0', '8', '5']
    .map((d, i) => {
      const color = i === 2 ? NEEDLE : DIGIT;
      const polys = [...LIT[d]].map((s) => `<polygon points="${SEG[s]}" fill="${color}"/>`).join('');
      return `<g transform="translate(${26.4 + i * 3.9} 41.2) scale(${scale})">${polys}</g>`;
    })
    .join('');
}

/** A 2×2 twill, faint, for the lower half of the tile. */
const TWILL = `<pattern id="twill" width="4" height="4" patternUnits="userSpaceOnUse">
    <rect width="4" height="4" fill="#161616"/>
    <rect x="0" y="0" width="2" height="1" fill="#262626"/><rect x="1" y="1" width="2" height="1" fill="#262626"/>
    <rect x="2" y="2" width="2" height="1" fill="#262626"/><rect x="3" y="3" width="1" height="1" fill="#262626"/>
    <rect x="0" y="3" width="1" height="1" fill="#262626"/>
  </pattern>`;

/** @param {{mono?: boolean}} [opts] */
function mark({ mono = false } = {}) {
  if (mono) {
    // Themed-icon silhouette: the arc and the needle, nothing else.
    return `
  ${arc(150, 390, '#FFFFFF')}
  <polygon points="${at(102, 1.8)} ${at(12, 17)} ${at(282, 1.8)} ${at(192, 4.5)}" fill="#FFFFFF"/>
  <circle cx="${C.x}" cy="${C.y}" r="3.2" fill="#FFFFFF"/>`;
  }
  return `
  ${arc(150, 390, TRACK)}
  ${arc(150, 345, ACCENT)}
  ${arc(350, 390, REDLINE, 4, 'butt')}
  <path d="M${at(390 - 0.01)} L${at(390)}" stroke="${REDLINE}" stroke-width="4" stroke-linecap="round"/>
  <polygon points="${at(102, 1.5)} ${at(12, 17)} ${at(282, 1.5)} ${at(192, 4.5)}" fill="${NEEDLE}"/>
  <circle cx="${C.x}" cy="${C.y}" r="3" fill="#0E0E0E" stroke="${ACCENT}" stroke-width="1.2"/>
  ${digits085()}`;
}

/** @param {{bg?: string|null, rx?: number, scale?: number, mono?: boolean}} opts */
function icon({ bg = PANEL, rx = 0, scale = 1, mono = false }) {
  const body =
    scale === 1
      ? mark({ mono })
      : `<g transform="translate(32,32) scale(${scale}) translate(-32,-32)">${mark({ mono })}</g>`;
  // The twill is trim: only on the tile's lower half, only when there is a tile.
  const tile = bg
    ? `<defs>${TWILL}<clipPath id="tile"><rect width="64" height="64"${rx ? ` rx="${rx}"` : ''}/></clipPath></defs>
  <rect width="64" height="64"${rx ? ` rx="${rx}"` : ''} fill="${bg}"/>
  <rect y="32" width="64" height="32" fill="url(#twill)" opacity="0.35" clip-path="url(#tile)"/>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="Car Guy">
  ${tile}
  ${body}
</svg>
`;
}

/**
 * The carbon tile CarbonFrame repeats (05-design-jdm.md §7): a 2×2 twill,
 * drawn at full contrast — the component sets the opacity (carbonOpacity).
 */
const CARBON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8" width="8" height="8">
  <rect width="8" height="8" fill="#000"/>
  ${[0, 1, 2, 3, 4, 5, 6, 7]
    .map((y) => [0, 4].map((x0) => `<rect x="${(x0 + y) % 8}" y="${y}" width="2" height="1" fill="#FFF"/>`).join(''))
    .join('')}
  ${[0, 1, 2, 3, 4, 5, 6, 7]
    .map((y) => [2, 6].map((x0) => `<rect x="${(x0 + 8 - y) % 8}" y="${y}" width="1" height="1" fill="#777"/>`).join(''))
    .join('')}
</svg>`;

// The composed sources, committed so the artwork is reviewable as text.
const sources = {
  // Rounded: the PWA "any" icon and the card on the portfolio, which are shown
  // as-is rather than masked by an OS.
  'icon.svg': icon({ rx: 14 }),
  // Square: iOS and the apple-touch icon, where the system rounds the corners.
  'icon-fullbleed.svg': icon({ rx: 0 }),
  // Maskable: the 80% safe zone is radius 25.6 from the centre; the mark reaches
  // 23.84 at full size, so 0.92 leaves room without shrinking it needlessly.
  'icon-maskable.svg': icon({ rx: 0, scale: 0.92 }),
  // Bare mark on transparency, for the splash, which sits on its own panel
  // background and is not cropped.
  'mark.svg': icon({ bg: null }),
  // Adaptive foreground. Android lays this on a 108dp canvas but only ever shows
  // a 66dp circle of it — safe radius 19.56 in this box. The sweep's endpoints
  // are the furthest thing from the centre at 23.84, so the mark has to come in
  // to 0.78 or their round caps get sliced off by the mask.
  'adaptive-foreground.svg': icon({ bg: null, scale: 0.78 }),
  // Same crop applies to the themed-icon silhouette.
  'adaptive-monochrome.svg': icon({ bg: null, scale: 0.78, mono: true }),
};

for (const [name, svg] of Object.entries(sources)) {
  await writeFile(`assets/pwa/${name}`, svg);
}

const render = (src, size, out) =>
  sharp(Buffer.from(sources[src]), { density: 900 }).resize(size, size).png().toFile(out);

await Promise.all([
  // PWA
  render('icon.svg', 192, 'public/icons/icon-192.png'),
  render('icon.svg', 512, 'public/icons/icon-512.png'),
  render('icon-maskable.svg', 192, 'public/icons/icon-maskable-192.png'),
  render('icon-maskable.svg', 512, 'public/icons/icon-maskable-512.png'),
  render('icon-fullbleed.svg', 180, 'public/icons/apple-touch-icon-180.png'),
  render('icon.svg', 48, 'public/favicon.png'),

  // Native, per the paths in app.json
  render('icon-fullbleed.svg', 1024, 'assets/images/icon.png'),
  render('adaptive-foreground.svg', 1024, 'assets/images/android-icon-foreground.png'),
  render('adaptive-monochrome.svg', 1024, 'assets/images/android-icon-monochrome.png'),
  render('mark.svg', 1024, 'assets/images/splash-icon.png'),
  render('icon.svg', 196, 'assets/images/favicon.png'),

  // Adaptive background layer: flat colour, matching app.json's backgroundColor.
  sharp({ create: { width: 1024, height: 1024, channels: 4, background: PANEL } })
    .png()
    .toFile('assets/images/android-icon-background.png'),

  // Carbon tile for CarbonFrame, 1× and 2× (Metro picks the density).
  sharp(Buffer.from(CARBON), { density: 900 }).resize(8, 8, { kernel: 'nearest' }).png().toFile('assets/images/carbon.png'),
  sharp(Buffer.from(CARBON), { density: 900 }).resize(16, 16, { kernel: 'nearest' }).png().toFile('assets/images/carbon@2x.png'),
]);

console.log('icons: 14 files written');
