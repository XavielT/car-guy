/**
 * Street and place names on the dark map were grey on near-black (IMP 16102026 M-12). OpenFreeMap's `dark` style is
 * not ours to edit, so after it loads the web map raises the contrast of every label layer: light text, a dark halo.
 * Pure: layers in, paint patches out.
 */
export const LABEL_PAINT = {
  'text-color': '#E6E9EE',
  'text-halo-color': 'rgba(11,15,20,0.92)',
  'text-halo-width': 1.6,
} as const;

type StyleLayer = { id: string; type: string; layout?: Record<string, unknown> | null };

export function labelPatches(layers: StyleLayer[]): { id: string; paint: typeof LABEL_PAINT }[] {
  return layers
    .filter((l) => l.type === 'symbol' && l.layout != null && l.layout['text-field'] != null)
    .map((l) => ({ id: l.id, paint: LABEL_PAINT }));
}
