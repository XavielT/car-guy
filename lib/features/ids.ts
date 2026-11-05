/** Every function the app offers, by id (IMP 16102026 ADR-62). Pure: the dictionaries and the registry both import it. */
export const FEATURE_IDS = [
  'obd',
  'repair',
  'repairs',
  'fuel',
  'trip',
  'service',
  'expense',
  'odometer',
  'event',
  'mod',
  'photo',
  'check',
  'reminders',
  'tasks',
  'contacts',
  'garage',
  'album',
  'events',
  'build',
  'ficha',
  'fluids',
  'editvehicle',
  'members',
  'tripsettings',
  'docs',
  'book',
  'share',
  'track',
  'trips',
  'juntes',
  'community',
  'stats',
  'prices',
  'account',
  'notifications',
  'permissions',
  'welcome',
  'install',
  'versions',
  'legal',
  'support',
  'feedback',
] as const;

export type FeatureId = (typeof FEATURE_IDS)[number];

export type FeatureSection = 'vehiculo' | 'registrar' | 'diagnostico' | 'viajes' | 'cuenta';
export const FEATURE_SECTIONS: FeatureSection[] = ['registrar', 'diagnostico', 'vehiculo', 'viajes', 'cuenta'];

/** ADR-73: the topics of "Qué quiero ver" (+ `basics`, always shown) and how essential a function is. */
export type FeatureGroup = 'fuel_expenses' | 'maintenance' | 'documents' | 'trips' | 'project' | 'track' | 'community' | 'basics';
export const FEATURE_TOPICS: Exclude<FeatureGroup, 'basics'>[] = ['fuel_expenses', 'maintenance', 'documents', 'trips', 'project', 'track', 'community'];
export type FeatureLevel = 'core' | 'regular' | 'advanced';
