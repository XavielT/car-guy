/**
 * The repair form's pieces (IMP 16102026 Phase 5, N7/X7): the warranty's quick choices follow the repair date, an edit
 * shows the stored warranty as what it is, photo slots turn into role links and back, and the Pendiente picker only
 * appears when there is something to resolve.
 */
import React from 'react';
import { Text } from 'react-native';
import { act, create, type ReactTestInstance } from 'react-test-renderer';

jest.mock('@expo/vector-icons/Ionicons', () => () => null);
jest.mock('@/lib/theme/useTheme', () => ({ useTheme: () => ({ theme: require('@/constants/theme').palette.dark, scheme: 'dark' }) }));
jest.mock('@/components/T', () => ({ T: ({ children }: { children?: React.ReactNode }) => require('react').createElement(require('react-native').Text, null, children) }));
jest.mock('@/components/Field', () => ({ Field: ({ label }: { label: string }) => require('react').createElement(require('react-native').Text, null, `field:${label}`) }));
jest.mock('@/components/DateField', () => ({ DateField: ({ label }: { label: string }) => require('react').createElement(require('react-native').Text, null, `date:${label}`) }));
jest.mock('@/components/PhotoPicker', () => ({ PhotoPicker: () => null }));
jest.mock('@/lib/media/useMediaUri', () => ({ useMediaUri: () => null }));
jest.mock('@/lib/db/serviceOps', () => ({ listOpenPendings: jest.fn() }));
jest.mock('@/components/ui/Sheet', () => ({ useKeyboardHeight: () => 0 }));
jest.mock('@/components/ui', () => {
  const R = require('react');
  const { Pressable: P, Text: Tx, View: V } = require('react-native');
  return {
    PrimaryButton: ({ label, onPress }: { label: string; onPress: () => void }) => R.createElement(P, { onPress }, R.createElement(Tx, null, label)),
    Sheet: ({ visible, children }: { visible: boolean; children?: React.ReactNode }) => (visible ? R.createElement(V, null, children) : null),
  };
});

import { linksToSlots, NO_PHOTOS, PendingPicker, slotsToLinks, WarrantyPicker } from '@/components/service/RepairPieces';
import { listOpenPendings } from '@/lib/db/serviceOps';

const texts = (root: ReactTestInstance) => root.findAllByType(Text).map((n) => [n.props.children].flat().join(''));
const press = (root: ReactTestInstance, label: string) => {
  const node = root.findAll((n) => typeof n.props.onPress === 'function' && String(n.props.accessibilityLabel ?? '').startsWith(label))[0];
  if (!node) throw new Error(`no ${label}`);
  act(() => node.props.onPress({}));
};
const pickRow = (root: ReactTestInstance, text: string) => {
  const node = root.findAll((n) => typeof n.props.onPress === 'function' && n.findAllByType(Text).some((x) => [x.props.children].flat().join('') === text))[0];
  if (!node) throw new Error(`no row ${text}`);
  act(() => node.props.onPress({}));
};

function Harness({ repairDate = '2026-03-15', initial = { date: '', km: '' } }: { repairDate?: string; initial?: { date: string; km: string } }) {
  const [w, setW] = React.useState(initial);
  const [d, setD] = React.useState(repairDate);
  return (
    <>
      <Text onPress={() => setD('2026-04-01')}>move-date</Text>
      <Text>{`state:${w.date}|${w.km}`}</Text>
      <WarrantyPicker repairDate={d} date={w.date} km={w.km} onChange={setW} />
    </>
  );
}

describe('WarrantyPicker', () => {
  it('starts as "Sin garantía" with nothing stored', () => {
    let r!: ReturnType<typeof create>;
    act(() => {
      r = create(<Harness />);
    });
    expect(texts(r.root)).toContain('Sin garantía');
  });

  it('a quick choice fills the end date from the repair date', () => {
    let r!: ReturnType<typeof create>;
    act(() => {
      r = create(<Harness />);
    });
    press(r.root, 'Garantía:');
    pickRow(r.root, '90 días');
    expect(texts(r.root)).toContain('state:2026-06-13|');
    expect(texts(r.root)).toContain('90 días');
  });

  it('and keeps following the repair date when it is edited', () => {
    let r!: ReturnType<typeof create>;
    act(() => {
      r = create(<Harness />);
    });
    press(r.root, 'Garantía:');
    pickRow(r.root, '90 días');
    act(() => r.root.findByProps({ children: 'move-date' }).props.onPress());
    expect(texts(r.root)).toContain('state:2026-06-30|');
  });

  it('"Sin garantía" clears both the date and the km', () => {
    let r!: ReturnType<typeof create>;
    act(() => {
      r = create(<Harness initial={{ date: '2026-06-13', km: '5000' }} />);
    });
    press(r.root, 'Garantía:');
    pickRow(r.root, 'Sin garantía');
    expect(texts(r.root)).toContain('state:|');
  });

  it('"Otra…" opens the date and the km', () => {
    let r!: ReturnType<typeof create>;
    act(() => {
      r = create(<Harness />);
    });
    expect(texts(r.root).some((s) => s.startsWith('date:'))).toBe(false);
    press(r.root, 'Garantía:');
    pickRow(r.root, 'Otra…');
    expect(texts(r.root).some((s) => s.startsWith('date:'))).toBe(true);
    expect(texts(r.root).some((s) => s.startsWith('field:'))).toBe(true);
  });

  it('an edit shows the stored warranty as the quick choice it is', () => {
    let r!: ReturnType<typeof create>;
    act(() => {
      r = create(<Harness initial={{ date: '2026-06-13', km: '' }} />);
    });
    expect(texts(r.root)).toContain('90 días');
  });
});

describe('photo slots', () => {
  it('turns slots into role links, in order', () => {
    expect(slotsToLinks({ before: 'b', after: 'a', invoice: 'i', others: ['o1', 'o2'] })).toEqual([
      { mediaId: 'b', role: 'before' },
      { mediaId: 'a', role: 'after' },
      { mediaId: 'i', role: 'invoice' },
      { mediaId: 'o1', role: 'other' },
      { mediaId: 'o2', role: 'other' },
    ]);
    expect(slotsToLinks(NO_PHOTOS)).toEqual([]);
  });
  it('and back: the first of each named role takes its slot, a second one is an "other"', () => {
    expect(
      linksToSlots([
        { mediaId: 'a', role: 'after' },
        { mediaId: 'a2', role: 'after' },
        { mediaId: 'o', role: 'other' },
        { mediaId: 'i', role: 'invoice' },
      ]),
    ).toEqual({ before: null, after: 'a', invoice: 'i', others: ['a2', 'o'] });
  });
});

describe('PendingPicker', () => {
  it('shows nothing when there is nothing to resolve', async () => {
    (listOpenPendings as jest.Mock).mockResolvedValue([]);
    let r!: ReturnType<typeof create>;
    await act(async () => {
      r = create(<PendingPicker vehicleId="v" value={null} onChange={() => {}} />);
    });
    expect(r.toJSON()).toBeNull();
  });

  it('lists events and tasks, and reports the key chosen', async () => {
    (listOpenPendings as jest.Mock).mockResolvedValue([
      { key: 'event:e1', kind: 'event', id: 'e1', title: 'Desabollar y pintar' },
      { key: 'task:t1', kind: 'task', id: 't1', title: 'Cambiar el agua por coolant' },
    ]);
    const onChange = jest.fn();
    let r!: ReturnType<typeof create>;
    await act(async () => {
      r = create(<PendingPicker vehicleId="v" value={null} onChange={onChange} />);
    });
    press(r.root, 'Pendiente que resuelve:');
    pickRow(r.root, 'Cambiar el agua por coolant');
    expect(onChange).toHaveBeenCalledWith('task:t1', expect.objectContaining({ id: 't1' }));
  });
});
