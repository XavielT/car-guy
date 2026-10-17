/**
 * SelectField, FilterBar and ToggleRow (IMP 16102026 ADR-60, SPEC-B "Pruebas"): the options are not on the screen until
 * the field is opened; choosing closes the sheet and reports the value; the scrim closes without changing it; a filter
 * pill reads "Label: value", counts the active ones and clears them; a yes/no is a switch.
 */
import React from 'react';
import { Switch, Text } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('@expo/vector-icons/Ionicons', () => () => null);
jest.mock('@/lib/theme/useTheme', () => ({ useTheme: () => ({ theme: require('@/constants/theme').palette.dark, scheme: 'dark' }) }));
jest.mock('@/components/T', () => ({ T: ({ children }: { children?: React.ReactNode }) => require('react').createElement(require('react-native').Text, null, children) }));
jest.mock('@/components/ui/Sheet', () => ({ useKeyboardHeight: () => 0 }));
jest.mock('@/components/ui', () => {
  const R = require('react');
  const { Pressable: P, Text: Tx, View: V } = require('react-native');
  return {
    PrimaryButton: ({ label, onPress }: { label: string; onPress: () => void }) => R.createElement(P, { onPress, accessibilityRole: 'button' }, R.createElement(Tx, null, label)),
    Sheet: ({ visible, title, onClose, children }: { visible: boolean; title?: string; onClose: () => void; children?: React.ReactNode }) =>
      visible
        ? R.createElement(V, { sheet: title }, R.createElement(P, { onPress: onClose, accessibilityLabel: 'scrim' }), R.createElement(Tx, null, title), children)
        : null,
  };
});

import { FilterBar } from '@/components/pickers/FilterBar';
import { SelectField } from '@/components/pickers/SelectField';

const OPTIONS = [
  { value: 'gal', label: 'gal' },
  { value: 'l', label: 'L' },
];

const texts = (root: ReactTestInstance) => root.findAllByType(Text).map((n) => [n.props.children].flat().join(''));
const press = (root: ReactTestInstance, match: (n: ReactTestInstance) => boolean) => {
  const node = root.findAll((n) => typeof n.props.onPress === 'function' && match(n))[0];
  if (!node) throw new Error('no pressable matched');
  act(() => node.props.onPress({}));
};
const byLabel = (label: string) => (n: ReactTestInstance) => n.props.accessibilityLabel === label || String(n.props.accessibilityLabel ?? '').startsWith(`${label}: `);
const withText = (s: string) => (n: ReactTestInstance) => {
  try {
    return n.findAllByType(Text).some((x) => [x.props.children].flat().join('') === s);
  } catch {
    return false;
  }
};

function render(el: React.ReactElement): ReactTestRenderer {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(el);
  });
  return r;
}

describe('SelectField', () => {
  it('shows the value, not the options, until it is opened', () => {
    const r = render(<SelectField label="Unidad" value="l" options={OPTIONS} onChange={() => {}} />);
    expect(texts(r.root)).toContain('L');
    expect(texts(r.root)).not.toContain('gal');
  });

  it('choosing an option reports its value and closes the sheet', () => {
    const onChange = jest.fn();
    const r = render(<SelectField label="Unidad" value="l" options={OPTIONS} onChange={onChange} />);
    press(r.root, byLabel('Unidad'));
    expect(texts(r.root)).toContain('gal');
    press(r.root, withText('gal'));
    expect(onChange).toHaveBeenCalledWith('gal');
    expect(texts(r.root)).not.toContain('gal');
  });

  it('closing with the scrim changes nothing', () => {
    const onChange = jest.fn();
    const r = render(<SelectField label="Unidad" value="l" options={OPTIONS} onChange={onChange} />);
    press(r.root, byLabel('Unidad'));
    press(r.root, byLabel('scrim'));
    expect(onChange).not.toHaveBeenCalled();
    expect(texts(r.root)).not.toContain('gal');
  });

  it('allowNone adds a first "Ninguno" row that picks null', () => {
    const onChange = jest.fn();
    const r = render(<SelectField<string | null> label="Material" value="cuero" allowNone options={[{ value: 'cuero', label: 'Cuero' }]} onChange={onChange} />);
    press(r.root, byLabel('Material'));
    press(r.root, withText('Ninguno'));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('numbers and null are values too (a radius, a "none")', () => {
    const onChange = jest.fn();
    const r = render(<SelectField<number> label="Radio" value={300} options={[{ value: 300, label: '300 m' }, { value: 500, label: '500 m' }]} onChange={onChange} />);
    expect(texts(r.root)).toContain('300 m');
    press(r.root, byLabel('Radio'));
    press(r.root, withText('500 m'));
    expect(onChange).toHaveBeenCalledWith(500);
  });
});

describe('FilterBar', () => {
  const make = (value: string, onChange: (v: string) => void) => (
    <FilterBar
      filters={[
        {
          key: 'kind',
          label: 'Tipo',
          value,
          options: [
            { value: '', label: 'Todos' },
            { value: 'a', label: 'Gasolina' },
          ],
          onChange,
        },
      ]}
    />
  );

  it('the pill reads "Tipo: Todos" with no filter, and shows no "Limpiar"', () => {
    const r = render(make('', () => {}));
    expect(texts(r.root).some((s) => s.includes('Tipo') && s.includes('Todos'))).toBe(true);
    expect(texts(r.root).some((s) => s.startsWith('Limpiar'))).toBe(false);
  });

  it('an active filter shows the counter, and "Limpiar" resets it to Todos', () => {
    const onChange = jest.fn();
    const r = render(make('a', onChange));
    expect(texts(r.root).some((s) => s.includes('Gasolina'))).toBe(true);
    press(r.root, (n) => n.props.accessibilityLabel === 'Limpiar filtro');
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('choosing in the sheet changes the filter and closes it', () => {
    const onChange = jest.fn();
    const r = render(make('', onChange));
    press(r.root, (n) => String(n.props.accessibilityLabel ?? '').startsWith('Tipo:'));
    press(r.root, withText('Gasolina'));
    expect(onChange).toHaveBeenCalledWith('a');
  });
});

describe('ToggleRow', () => {
  it('is a switch with its words, and reports the new value', () => {
    const { ToggleRow } = require('@/components/ui/ToggleRow') as typeof import('@/components/ui/ToggleRow');
    const onChange = jest.fn();
    const r = render(<ToggleRow label="Pasajero" value={false} onChange={onChange} />);
    expect(texts(r.root)).toContain('Pasajero');
    const sw = r.root.findByType(Switch);
    act(() => sw.props.onValueChange(true));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
