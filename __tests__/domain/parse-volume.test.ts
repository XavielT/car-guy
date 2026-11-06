import { parseVolume, parseDecimal } from '../../lib/domain/economy';

describe('parseVolume', () => {
  it('reads a comma with three decimals as a decimal, not thousands', () => {
    expect(parseVolume('6,299')).toBeCloseTo(6.299);
    expect(parseDecimal('6,299')).toBe(6299); // money keeps the thousands reading
  });
  it('keeps the usual forms', () => {
    expect(parseVolume('6.299')).toBeCloseTo(6.299);
    expect(parseVolume('12,598')).toBeCloseTo(12.598);
    expect(parseVolume('11,4')).toBeCloseTo(11.4);
    expect(parseVolume('3.15')).toBeCloseTo(3.15);
    expect(parseVolume('')).toBeNull();
    expect(parseVolume('abc')).toBeNull();
  });
});
