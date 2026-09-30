/** Note 7: the station picker's brands, the typed-name normalisation and the recent list. */
import { brandsForFuel, normaliseStation, recentStations, STATION_BRANDS } from '@/lib/domain/stations';

it('the list has Petronan and the other brands, ids unique', () => {
  const names = STATION_BRANDS.map((b) => b.name);
  for (const n of ['Petronan', 'Texaco', 'Shell', 'TotalEnergies', 'Sunix', 'Sigma', 'Nativa', 'United Petroleum', 'Propagas', 'Tropigas']) expect(names).toContain(n);
  expect(new Set(STATION_BRANDS.map((b) => b.id)).size).toBe(STATION_BRANDS.length);
});

it('GLP-only brands only for GLP; GNV sees every non-GLP-only brand', () => {
  expect(brandsForFuel('gasolina').map((b) => b.name)).not.toContain('Propagas');
  expect(brandsForFuel('glp').map((b) => b.name)).toContain('Propagas');
  expect(brandsForFuel('gnv').map((b) => b.name)).not.toContain('Tropigas');
  expect(brandsForFuel('gnv').map((b) => b.name)).toContain('Petronan');
});

it('a typed brand becomes the brand (accents, case, aliases); anything else stays as typed', () => {
  expect(normaliseStation('  petronan ')).toBe('Petronan');
  expect(normaliseStation('PETROMOVIL')).toBe('Petromóvil');
  expect(normaliseStation('total')).toBe('TotalEnergies');
  expect(normaliseStation('La bomba de Juan')).toBe('La bomba de Juan');
  expect(normaliseStation('   ')).toBe('');
});

it('recent stations: newest first, no repeats (accent-insensitive), no blanks or "Otra"', () => {
  const logs = [
    { station: 'Shell', occurredAt: '2026-09-01' },
    { station: 'Petronan', occurredAt: '2026-09-20' },
    { station: '', occurredAt: '2026-09-25' },
    { station: 'petronan', occurredAt: '2026-09-10' },
    { station: 'Otra', occurredAt: '2026-09-28' },
  ];
  expect(recentStations(logs)).toEqual(['Petronan', 'Shell']);
});
