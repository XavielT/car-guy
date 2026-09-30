// Tests run in Spanish unless a test switches (lib/i18n __setLanguageForTests): the device
// language would otherwise depend on the machine running jest.
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'es', languageTag: 'es-DO', regionCode: 'DO' }],
  getCalendars: () => [{ timeZone: 'America/Santo_Domingo', uses24hourClock: false }],
}));
