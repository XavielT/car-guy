import { agoParts, expiryTone } from '@/lib/domain/miCarro';

describe('Mi carro status tones', () => {
  it('expiry: red when passed, amber within 14 days, green after, quiet without a date', () => {
    expect(expiryTone(-1)).toBe('vencido');
    expect(expiryTone(0)).toBe('proximo');
    expect(expiryTone(14)).toBe('proximo');
    expect(expiryTone(15)).toBe('ok');
    expect(expiryTone(null)).toBe('neutral');
  });
  it('ago: today, yesterday, days, months', () => {
    expect(agoParts(0)).toEqual({ unit: 'today', n: 0 });
    expect(agoParts(1)).toEqual({ unit: 'yesterday', n: 1 });
    expect(agoParts(12)).toEqual({ unit: 'days', n: 12 });
    expect(agoParts(90)).toEqual({ unit: 'months', n: 3 });
    expect(agoParts(null)).toBeNull();
    expect(agoParts(-3)).toBeNull();
  });
});
