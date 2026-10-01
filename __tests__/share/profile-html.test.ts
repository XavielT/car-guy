/** IMP 01102026 Phase 5: the web profile never shows an id or a route, and says noindex when private. */
import { photoBytes, profileImage, renderProfileHtml, type WebProfile } from '@/lib/share/profileHtml';
import { toBase64 } from '@/lib/social/base64';

const base: WebProfile = {
  handle: 'trueno_ae85',
  display_name: 'Xaviel',
  avatar_id: 'car_coupe',
  photo: null,
  is_public: true,
  premium: false,
  followers: 3,
  following: 2,
  can_see: true,
  bio: 'Montaña <los> domingos',
  instagram: 'car.guy',
  cars: [{ name: 'Trueno AE85', nickname: null, make: 'Toyota', model: 'Corolla', year: 1985, slug: 'abc23def' }],
  stats: { km_trips: 120, tires_burned: 4, mods: 5, cars: 3 },
};
const opts = { url: 'https://car-guy.vercel.app/u/trueno_ae85', site: 'https://car-guy.vercel.app' };

it('a public profile: escaped bio, cars linked to their page, indexable, the drawn avatar as og:image', () => {
  const html = renderProfileHtml(base, opts);
  expect(html).toContain('Montaña &lt;los&gt; domingos');
  expect(html).toContain('href="/c/abc23def"');
  expect(html).not.toContain('noindex');
  expect(html).toContain('og:image" content="https://car-guy.vercel.app/avatars/car_coupe.png"');
});

it('a private profile for a stranger: a card, no bio, noindex', () => {
  const html = renderProfileHtml({ ...base, is_public: false, can_see: false, bio: undefined, cars: undefined, stats: undefined }, opts);
  expect(html).toContain('noindex');
  expect(html).not.toContain('Montaña');
  expect(html).toContain('Cuenta privada');
});

it('the public photo becomes the og:image through ?photo=1, and decodes to the same bytes', () => {
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9, 1, 2, 3]);
  const photo = `data:image/jpeg;base64,${toBase64(bytes)}`;
  expect(profileImage({ ...base, photo }, opts.site)).toBe('https://car-guy.vercel.app/u/trueno_ae85?photo=1');
  expect([...photoBytes(photo)!]).toEqual([...bytes]);
  expect(photoBytes('http://x')).toBeNull();
});

it('toBase64 matches Buffer for every padding case', () => {
  for (const n of [0, 1, 2, 3, 10, 257]) {
    const b = Uint8Array.from({ length: n }, (_, i) => (i * 37) % 256);
    expect(toBase64(b)).toBe(Buffer.from(b).toString('base64'));
  }
});
