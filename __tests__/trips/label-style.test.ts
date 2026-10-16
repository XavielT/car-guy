/** The dark map's labels were hard to read (IMP 16102026 M-12): every label layer gets light text and a dark halo. */
import { contrastRatio } from '../../lib/domain/contrast';
import { LABEL_PAINT, labelPatches } from '../../lib/map/labelStyle';

it('patches only the symbol layers that carry text', () => {
  const layers = [
    { id: 'background', type: 'background' },
    { id: 'road', type: 'line', layout: {} },
    { id: 'poi-icon', type: 'symbol', layout: { 'icon-image': 'x' } },
    { id: 'road-name', type: 'symbol', layout: { 'text-field': '{name}' } },
    { id: 'place-city', type: 'symbol', layout: { 'text-field': '{name:latin}' } },
  ];
  expect(labelPatches(layers).map((p) => p.id)).toEqual(['road-name', 'place-city']);
});

it('the label colour reads on the map background at 4.5:1 or better', () => {
  expect(contrastRatio(LABEL_PAINT['text-color'], '#0B0F14')).toBeGreaterThanOrEqual(4.5);
});
