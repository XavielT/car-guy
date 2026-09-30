/**
 * ATENCIÓN and check photos in words (IMP 29092026 Phase 3, note 3): the run's
 * status, the runner's defaults, and how Historial reads a check row.
 */
import type { HistoryEntry } from '@/lib/db/types';
import { checkStatusTitle, historyPhotoTag, historySubtitle, historyTitle } from '@/lib/domain/history';
import { defaultActionFor, inspectionStatusFor, needsDetail, VERDICTS } from '@/lib/domain/inspections';

const r = (...results: ('ok' | 'atencion' | 'falla' | 'na')[]) => results.map((result) => ({ result }));

describe('inspectionStatusFor', () => {
  it('any falla wins', () => {
    expect(inspectionStatusFor(r('ok', 'atencion', 'falla'))).toBe('con_fallas');
  });
  it('only atenciones → con_avisos', () => {
    expect(inspectionStatusFor(r('ok', 'atencion', 'na'))).toBe('con_avisos');
  });
  it('ok and n/a → ok', () => {
    expect(inspectionStatusFor(r('ok', 'na'))).toBe('ok');
    expect(inspectionStatusFor([])).toBe('ok');
  });
});

it('the buttons read OK · ATENCIÓN · FALLA · N/A', () => {
  expect(VERDICTS).toEqual(['ok', 'atencion', 'falla', 'na']);
});

it('falla and atención open the note and photos; an atención creates nothing by default', () => {
  expect(needsDetail('falla')).toBe(true);
  expect(needsDetail('atencion')).toBe(true);
  expect(needsDetail('ok')).toBe(false);
  expect(needsDetail(undefined)).toBe(false);
  expect(defaultActionFor('falla', 'reminder')).toBe('reminder');
  expect(defaultActionFor('atencion', 'task')).toBe('none');
});

const check = (status: string, photos: number | null): HistoryEntry => ({
  id: 'i1',
  vehicleId: 'v1',
  kind: 'chequeo',
  occurredAt: '2026-09-28T12:00:00.000Z',
  odometerKm: null,
  title: status,
  subtitle: 'tpl_semanal',
  amountDop: null,
  photos,
});

describe('Historial check rows', () => {
  it('names the three statuses', () => {
    expect(historyTitle(check('ok', 0))).toBe('Chequeo · todo bien');
    expect(historyTitle(check('con_fallas', 0))).toBe('Chequeo · con fallas');
    expect(historyTitle(check('con_avisos', 0))).toBe('Chequeo · con avisos');
    expect(checkStatusTitle('algo_raro')).toBe('Chequeo · con fallas');
  });

  it('a check with photos shows "📷 N" instead of its template id', () => {
    expect(historySubtitle(check('con_fallas', 2))).toBe('📷 2');
    expect(historySubtitle(check('con_avisos', 0))).toBeNull();
    expect(historySubtitle(check('ok', null))).toBeNull();
  });

  it('other rows with photos end in the tag', () => {
    const service: HistoryEntry = { ...check('', 3), kind: 'reparacion', title: 'Bomba', subtitle: 'Taller Pérez' };
    expect(historySubtitle(service)).toBe('Taller Pérez · 📷 3');
    expect(historySubtitle({ ...service, subtitle: null })).toBe('📷 3');
    expect(historyPhotoTag({ photos: 0 })).toBeNull();
  });
});
