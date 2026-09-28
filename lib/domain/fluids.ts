/**
 * The fluids guide (IMP 28092026 Phase 5): one card per thing you check under
 * the hood, with the owner's own photo of where it is on *this* car. The
 * "cómo revisar" texts are the checklist's (docs/imp-17092026/01-research/
 * 02-maintenance-checklists-dr.md §A) so the guide and the check say the same.
 *
 * `fluidForItem` is how the inspection runner finds the card for an item:
 * by the item's label, since the seeded templates have no fluid key.
 * ("Refrigerante" → coolant.)
 */

import type { FluidGuideItem } from '../db/types';

/** The schema's kinds (fluid_guide_item.kind), minus the catch-all. */
export type FluidKind = Exclude<FluidGuideItem['kind'], 'otro'>;

export const FLUID_KINDS: { kind: FluidKind; label: string; how: string; match: RegExp }[] = [
  {
    kind: 'aceite',
    label: 'Aceite de motor',
    how: 'Motor frío y en piso plano: la varilla debe marcar entre Min y Max. Fíjate en el color.',
    match: /aceite de motor|nivel de aceite/i,
  },
  {
    kind: 'coolant',
    label: 'Refrigerante',
    how: 'Solo con el motor frío: el nivel debe quedar entre Min y Max en el tanque plástico. Nunca abras el tapón del radiador caliente.',
    match: /refrigerante|coolant/i,
  },
  {
    kind: 'frenos',
    label: 'Líquido de frenos',
    how: 'El depósito entre Min y Max; el color debe ser claro o ámbar.',
    match: /l[ií]quido de frenos/i,
  },
  {
    kind: 'direccion',
    label: 'Líquido de dirección',
    how: 'Si es hidráulica, revisa la varilla o el depósito en sus marcas Hot/Cold.',
    match: /direcci[oó]n/i,
  },
  {
    kind: 'atf',
    label: 'Aceite de transmisión (ATF)',
    how: 'Solo si tiene varilla: motor caliente en ralentí y en P; revisa nivel y color. Oscuro o con olor a quemado es señal de problema.',
    match: /transmisi[oó]n|atf/i,
  },
  {
    kind: 'washer',
    label: 'Agua del parabrisas',
    how: 'Rellena el depósito.',
    match: /parabrisas|limpiavidrios/i,
  },
  {
    kind: 'bateria',
    label: 'Batería',
    how: 'Bornes apretados y sin costra blanca o verde.',
    match: /bater[ií]a/i,
  },
  {
    kind: 'filtro_aire',
    label: 'Filtro de aire',
    how: 'Sácalo y míralo a contraluz: si no pasa luz o está negro, toca cambiarlo. En caminos de polvo, revisa el doble de seguido.',
    match: /filtro de aire/i,
  },
];

export function fluidInfo(kind: string) {
  return FLUID_KINDS.find((f) => f.kind === kind) ?? null;
}

/** The fluid card an inspection item points at, from its label ("Refrigerante" → refrigerante). */
export function fluidForItem(label: string): FluidKind | null {
  return FLUID_KINDS.find((f) => f.match.test(label))?.kind ?? null;
}

/** "Presión de gomas" items get the OEM psi next to them. */
export function isTirePressureItem(label: string): boolean {
  return /presi[oó]n de gomas/i.test(label);
}
