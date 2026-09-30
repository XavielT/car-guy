/** "Reportar" appears only on the alert that shows an error to the user — never after a background error. */
import { recordError, recordReportable } from '@/lib/diagnostics';
import { isErrorAlert } from '@/lib/alert';

jest.spyOn(console, 'warn').mockImplementation(() => undefined);

it('a background error (sync, trips) does not add the link to the next confirmation', () => {
  recordError('sync', new Error('network'));
  expect(isErrorAlert([{ text: 'Cancelar', style: 'cancel' }, { text: 'Borrar', style: 'destructive' }])).toBe(false);
});

it('a shown error gets it once, on the alert right after', () => {
  const t = Date.now();
  recordReportable('photo', new Error('boom'));
  expect(isErrorAlert(undefined, t + 100)).toBe(true);
  expect(isErrorAlert(undefined, t + 200)).toBe(false);
});

it('not after the window, and not on a three-choice dialog', () => {
  const t = Date.now();
  recordReportable('photo', new Error('boom'));
  expect(isErrorAlert(undefined, t + 2000)).toBe(false);
  recordReportable('photo', new Error('boom'));
  expect(isErrorAlert([{ text: 'a' }, { text: 'b' }, { text: 'c' }])).toBe(false);
});
