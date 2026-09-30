/** The vehicle form's pure rules (IMP 29092026 Phase 3). */
import { addPhotos, movePhoto, normalizeGallery, removePhoto, setCover } from '@/lib/domain/gallery';
import { bodyTypeFromLegacy, legacyTypeFor } from '@/lib/domain/refdata';
import { convertTankText, isYearInRange, tankCaption, yearError, yearList } from '@/lib/domain/vehicleForm';
import { parseDecimal } from '@/lib/domain/economy';

describe('body type → legacy type', () => {
  it.each([
    ['sedan', 'carro'], ['hatchback', 'carro'], ['suv', 'jeepeta'], ['pickup', 'camioneta'], ['minivan', 'guagua'],
    ['van', 'guagua'], ['truck', 'camion'], ['motorcycle', 'motor'], ['utv', 'otro'], ['other', 'otro'], [null, 'carro'],
  ])('%s → %s', (body, legacy) => expect(legacyTypeFor(body)).toBe(legacy));

  it('a pre-v6 car preselects the body its type implies; carro says nothing', () => {
    expect(bodyTypeFromLegacy('jeepeta')).toBe('suv');
    expect(bodyTypeFromLegacy('carro')).toBeNull();
    expect(legacyTypeFor(bodyTypeFromLegacy('camioneta'))).toBe('camioneta');
  });
});

describe('year', () => {
  const now = new Date('2026-09-29T12:00:00Z');
  it('the wheel runs from next year down to 1950', () => {
    const years = yearList(now);
    expect(years[0]).toBe(2027);
    expect(years.at(-1)).toBe(1950);
    expect(isYearInRange(2027, now)).toBe(true);
    expect(isYearInRange(2028, now)).toBe(false);
  });
  it('typed years outside it are refused; empty is fine', () => {
    expect(yearError('1985', now)).toBeNull();
    expect(yearError('', now)).toBeNull();
    expect(yearError('1949', now)).toEqual({ min: 1950, max: 2027 });
    expect(yearError('20x5', now)).not.toBeNull();
  });
});

describe('tank unit', () => {
  it('the number follows the toggle and comes back', () => {
    const inL = convertTankText('12.5', 'gal', 'l', parseDecimal);
    expect(inL).toBe('47.3');
    expect(convertTankText(inL, 'l', 'gal', parseDecimal)).toBe('12.5');
    expect(convertTankText('abc', 'gal', 'l', parseDecimal)).toBe('abc');
  });
  it('the caption', () => {
    expect(tankCaption(45, 'l')).toEqual({ typed: '45', other: '11.9', otherUnit: 'gal' });
    expect(tankCaption(null, 'gal')).toBeNull();
  });
});

describe('gallery', () => {
  const g = normalizeGallery(['a', 'b', 'c'], null);
  it('the first photo is the cover until another is chosen', () => {
    expect(g).toEqual({ ids: ['a', 'b', 'c'], cover: 'a' });
    expect(setCover(g, 'c').cover).toBe('c');
    expect(addPhotos({ ids: [], cover: null }, ['x']).cover).toBe('x');
  });
  it('removing the cover promotes the next photo, or the one before at the end', () => {
    expect(removePhoto(g, 'a')).toEqual({ ids: ['b', 'c'], cover: 'b' });
    expect(removePhoto(setCover(g, 'c'), 'c')).toEqual({ ids: ['a', 'b'], cover: 'b' });
    expect(removePhoto({ ids: ['a'], cover: 'a' }, 'a')).toEqual({ ids: [], cover: null });
    expect(removePhoto(g, 'b')).toEqual({ ids: ['a', 'c'], cover: 'a' });
  });
  it('moves one step, and the ends stay put', () => {
    expect(movePhoto(g, 'b', -1).ids).toEqual(['b', 'a', 'c']);
    expect(movePhoto(g, 'c', 1).ids).toEqual(['a', 'b', 'c']);
  });
});
