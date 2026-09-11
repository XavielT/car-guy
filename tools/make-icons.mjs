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
 */
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';

const CANOPY = '#0B1F1C';
const CREAM = '#F3EFE4';

// The mark, drawn in a 64 unit box: a gauge sweep with the fuel drop it
// measures nested inside it. Colours are the app's own theme tokens.
const GRADIENT = `
    <linearGradient id="gd" x1="32" y1="23.5" x2="32" y2="49.5" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#F7CC5E"/>
      <stop offset="0.6" stop-color="#F0B429"/>
      <stop offset="1" stop-color="#D79A1C"/>
    </linearGradient>`;

/** @param {{mono?: boolean}} [opts] */
function mark({ mono = false } = {}) {
  const arc = mono ? '#FFFFFF' : CREAM;
  const drop = mono ? '#FFFFFF' : 'url(#gd)';
  // Nudged down 2.5 so the mark sits optically centred in the 64 box: the arc
  // is wide at the top and the drop hangs below it.
  return `
  <g transform="translate(0,2.5)">
    <path d="M15.6 44.5A19 19 0 1 1 48.4 44.5" fill="none" stroke="${arc}"
          stroke-width="4" stroke-linecap="round"${mono ? '' : ' opacity="0.92"'}/>
    <path d="M32 21c0 0 8.6 9.9 8.6 15.5a8.6 8.6 0 0 1-17.2 0C23.4 30.9 32 21 32 21z" fill="${drop}"/>
    ${mono ? '' : '<ellipse cx="28.7" cy="35.8" rx="2.1" ry="3.1" fill="#FFFFFF" opacity="0.30"/>'}
  </g>`;
}

/** @param {{bg?: string|null, rx?: number, scale?: number, mono?: boolean}} opts */
function icon({ bg = CANOPY, rx = 0, scale = 1, mono = false }) {
  const body = scale === 1 ? mark({ mono }) : `<g transform="translate(32,32) scale(${scale}) translate(-32,-32)">${mark({ mono })}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="Tu Combustible RD">
  <defs>${mono ? '' : GRADIENT}</defs>
  ${bg ? `<rect width="64" height="64"${rx ? ` rx="${rx}"` : ''} fill="${bg}"/>` : ''}
  ${body}
</svg>
`;
}

// The composed sources, committed so the artwork is reviewable as text.
const sources = {
  // Rounded: the PWA "any" icon and the card on the portfolio, which are shown
  // as-is rather than masked by an OS.
  'icon.svg': icon({ rx: 14 }),
  // Square: iOS and the apple-touch icon, where the system rounds the corners.
  'icon-fullbleed.svg': icon({ rx: 0 }),
  // Maskable: Android may crop to a circle, so pull the mark in a little.
  'icon-maskable.svg': icon({ rx: 0, scale: 0.92 }),
  // Bare mark on transparency, for the splash, which sits on its own canopy
  // background and is not cropped.
  'mark.svg': icon({ bg: null }),
  // Adaptive foreground. Android lays this on a 108dp canvas but only ever
  // shows a 66dp circle of it, so the mark has to come in to 0.78: at full size
  // the ends of the gauge sweep are the furthest thing from the centre (25.05
  // units against a safe radius of 19.56) and get sliced off by the mask.
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
  sharp({ create: { width: 1024, height: 1024, channels: 4, background: CANOPY } })
    .png()
    .toFile('assets/images/android-icon-background.png'),
]);

console.log('icons: 12 files written');
