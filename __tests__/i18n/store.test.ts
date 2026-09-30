/**
 * The language store (ADR-39): device language when 'system', a stored choice
 * wins, the foreground re-check follows a device change, and `t` outside React
 * reads whatever is current at the moment of use.
 */
import { __setLanguageForTests, currentLanguage, deviceLanguage, initLanguage, localeTag, refreshSystemLanguage, setLanguagePreference, t } from '@/lib/i18n';
import { dateLabel, monthTitle, money } from '@/lib/format';

const mockStore = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: async (k: string) => mockStore.get(k) ?? null,
    setItem: async (k: string, v: string) => void mockStore.set(k, v),
  },
}));
let mockDevice = 'es';
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: mockDevice }] }));

afterEach(() => {
  mockStore.clear();
  mockDevice = 'es';
  __setLanguageForTests('es', 'system');
});

it('system → the device language; anything but English is Spanish', () => {
  mockDevice = 'en';
  expect(deviceLanguage()).toBe('en');
  mockDevice = 'fr';
  expect(deviceLanguage()).toBe('es');
});

it('a stored choice wins over the device, and survives a restart', async () => {
  mockDevice = 'en';
  setLanguagePreference('es');
  await new Promise((r) => setTimeout(r, 20)); // the lazy storage import + write
  __setLanguageForTests('en', 'system'); // "restart" with an English device
  expect(await initLanguage()).toBe('es');
  expect(currentLanguage()).toBe('es');
});

it('the foreground re-check follows the device only while on system', () => {
  __setLanguageForTests('es', 'system');
  mockDevice = 'en';
  refreshSystemLanguage();
  expect(currentLanguage()).toBe('en');
  setLanguagePreference('es');
  mockDevice = 'en';
  refreshSystemLanguage();
  expect(currentLanguage()).toBe('es');
});

it('t outside React reads the current language at the moment of use', () => {
  const save = () => t.common.save;
  __setLanguageForTests('es');
  const es = save();
  __setLanguageForTests('en');
  expect(save()).not.toBe(es);
  expect(save()).toBe('Save');
});

it('formats dates in the language; money is RD$ in both', () => {
  __setLanguageForTests('es');
  expect(localeTag()).toBe('es-DO');
  const esDate = dateLabel('2026-09-25');
  const esMonth = monthTitle(2026, 8);
  const esMoney = money(1234.5);
  __setLanguageForTests('en');
  expect(localeTag()).toBe('en-US');
  expect(dateLabel('2026-09-25')).toMatch(/Sep/);
  expect(esDate).toMatch(/sept?/i);
  expect(monthTitle(2026, 8)).toMatch(/^September 2026$/);
  expect(esMonth).toMatch(/^Septiembre/);
  expect(money(1234.5)).toBe(esMoney);
  expect(esMoney).toMatch(/^RD\$ 1,234\.50$/);
});
