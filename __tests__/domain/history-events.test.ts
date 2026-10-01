import type { HistoryEntry } from '@/lib/db/types';
import { historyIcon, historyKindLabel, historySubtitle, historyTitle } from '@/lib/domain/history';

const row = (over: Partial<HistoryEntry>): HistoryEntry => ({
  id: 'e1',
  vehicleId: 'c3',
  kind: 'evento',
  occurredAt: '2026-06-01T12:00:00.000Z',
  odometerKm: null,
  title: 'Choque',
  subtitle: 'accidente|accidente|moderado|pintar el guardafango|',
  amountDop: 45000,
  ...over,
});

describe("Historial 'evento' rows (history_feed v6, ADR-44)", () => {
  it('type · severity · pending, the cost left to the amount column', () => {
    expect(historySubtitle(row({}))).toBe('Accidente · Moderado · pendiente: pintar el guardafango');
  });

  it('a resolved pending reads resuelto', () => {
    expect(historySubtitle(row({ subtitle: 'otro|multa|leve|pagar|2026-09-15T00:00:00.000Z' }))).toBe('Multa · Leve · resuelto');
  });

  it('its own kind label, title and the event type’s icon', () => {
    expect(historyKindLabel('evento')).toBe('Eventos');
    expect(historyKindLabel('hito')).toBe('Hitos');
    expect(historyTitle(row({}))).toBe('Choque');
    expect(historyIcon(row({}))).toBe('car-outline');
    expect(historyIcon(row({ subtitle: 'otro|sobrecalentamiento|leve||' }))).toBe('thermometer-outline');
    expect(historyIcon(row({ kind: 'hito', subtitle: 'compra' }))).toBeNull();
  });
});
