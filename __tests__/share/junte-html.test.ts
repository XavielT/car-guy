/** IMP 01102026 Phase 6: the junte invite page — escaped, noindex, open-in-app with the code, nothing when ended. */
import { JUNTE_CODE_RE, renderJunteHtml } from '@/lib/share/junteHtml';

const card = { title: 'Subida <a> Jarabacoa', starts_at: '2026-10-04T13:00:00Z', ends_at: null, meet_label: 'Bomba de la 27', status: 'planned', owner_handle: 'trueno_ae85', owner_name: 'Xaviel', going: 3 };
const opts = { url: 'https://car-guy.vercel.app/j/abcd2345', code: 'abcd2345', site: 'https://car-guy.vercel.app' };

it('an invite: escaped title, noindex, carguy://junte/<code>, who and how many', () => {
  const html = renderJunteHtml(card, opts);
  expect(html).toContain('Subida &lt;a&gt; Jarabacoa');
  expect(html).toContain('noindex');
  expect(html).toContain('carguy://junte/abcd2345');
  expect(html).toContain('@trueno_ae85');
  expect(html).toContain('3 van');
});

it('an ended junte has no join links', () => {
  const html = renderJunteHtml({ ...card, status: 'ended' }, opts);
  expect(html).toContain('ya terminó');
  expect(html).not.toContain('carguy://junte/');
});

it('codes are 8 lowercase letters/digits', () => {
  expect(JUNTE_CODE_RE.test('abcd2345')).toBe(true);
  expect(JUNTE_CODE_RE.test('ABCD2345')).toBe(false);
  expect(JUNTE_CODE_RE.test("x' or 1")).toBe(false);
});
