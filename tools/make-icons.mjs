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

const PANEL = '#0E1116';
const ACCENT = '#22D3EE';
const OK = '#34D399';

/**
 * The mark, drawn in a 64 unit box: an instrument-cluster gauge. A 270° sweep
 * with a gap at the bottom, a needle resting at about 2 o'clock, and a green dot
 * at its tip — a cluster that reads "everything is fine". No letters.
 *
 * Geometry, all from the centre (32, 32) with the arc at radius 20:
 *   the sweep runs from 135° to 405° measured clockwise from the +x axis with y
 *   pointing down, i.e. bottom-left → left → top → right → bottom-right.
 *   The needle points at 330° (2 o'clock) and stops at radius 14, so its dot
 *   (r 3) ends at 17 and never touches the arc's inner edge at 18.
 */
const ARC_START = '17.86 46.14';
const ARC_END = '46.14 46.14';
const NEEDLE_TIP = { x: 44.12, y: 25.0 };

/** @param {{mono?: boolean}} [opts] */
function mark({ mono = false } = {}) {
  const stroke = mono ? '#FFFFFF' : ACCENT;
  const tip = mono ? '#FFFFFF' : OK;
  // Nudged down 2.5 so the mark sits optically centred: the sweep's gap is at
  // the bottom, which makes a geometrically centred gauge read high.
  return `
  <g transform="translate(0,2.5)">
    <path d="M${ARC_START} A20 20 0 1 1 ${ARC_END}" fill="none" stroke="${stroke}"
          stroke-width="4" stroke-linecap="round"/>
    <path d="M32 32 L${NEEDLE_TIP.x} ${NEEDLE_TIP.y}" fill="none" stroke="${stroke}"
          stroke-width="2.8" stroke-linecap="round"/>
    <circle cx="32" cy="32" r="1.9" fill="${stroke}"/>
    <circle cx="${NEEDLE_TIP.x}" cy="${NEEDLE_TIP.y}" r="3" fill="${tip}"/>
  </g>`;
}

/** @param {{bg?: string|null, rx?: number, scale?: number, mono?: boolean}} opts */
function icon({ bg = PANEL, rx = 0, scale = 1, mono = false }) {
  const body =
    scale === 1
      ? mark({ mono })
      : `<g transform="translate(32,32) scale(${scale}) translate(-32,-32)">${mark({ mono })}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="Car Guy">
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
]);

console.log('icons: 12 files written');
