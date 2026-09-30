import type { Dict } from '../dict';

export const enPart6: Pick<Dict, 'statusChanged' | 'statusSince' | 'garageV2' | 'specSuggestions'> = {
  statusChanged: (label: string, note?: string | null) =>
    `Changed to ${label.toUpperCase()}${note?.trim() ? ` · ${note.trim()}` : ''}`,

  statusSince: (date: string) => `since ${date}`,

  garageV2: {
    modes: { covers: 'Covers', grid: 'Grid', list: 'List' },
    modeLabel: (mode: string) => `View as ${mode}`,
    sort: 'Sort',
    done: 'Done',
    sortHint: 'Sort mode · use the arrows',
    pin: 'Pin to top',
    unpin: 'Unpin from top',
    pinned: 'Pinned to top',
    moveUp: (name: string) => `Move ${name} up`,
    moveDown: (name: string) => `Move ${name} down`,
    add: '+ Add',
    km: (km: string, mods: string) => `${km} · ${mods}`,
    coverCount: (n: number) => `1/${n}`,
  },

  specSuggestions: [
    'Tire pressure',
    'Oil type',
    'Tire size',
    'Battery',
    'Spark plugs',
    'Wiper blades',
    'Air filter',
  ],
};
