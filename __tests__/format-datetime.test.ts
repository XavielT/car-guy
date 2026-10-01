/** IMP 01102026 note 5: Cuenta → "última sincronización" says the time too, in either language. */
import { dateTimeLabel } from '@/lib/format';
import { __setLanguageForTests } from '@/lib/i18n';

const ISO = new Date(2026, 8, 30, 15, 58).toISOString(); // 30 Sep 2026 3:58 PM, local time

afterEach(() => __setLanguageForTests('es'));

it('Spanish: day, month, year · the time', () => {
  __setLanguageForTests('es');
  const s = dateTimeLabel(ISO);
  expect(s).toMatch(/^30 sept?\.?( de)? 2026 · 3:58\s?p\.\s?m\.$/i);
});

it('English: the same moment', () => {
  __setLanguageForTests('en');
  expect(dateTimeLabel(ISO)).toMatch(/Sep.*30.*2026 · 3:58\s?PM/);
});

it('an unreadable value is shown as is', () => {
  expect(dateTimeLabel('ayer')).toBe('ayer');
});
