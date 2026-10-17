import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import { FEATURE_ALBUM, FEATURE_BUILD, FEATURE_DIY, FEATURE_FEEDBACK, FEATURE_SHARE, FEATURE_TRACK, FEATURE_TRIPS } from '../flags';
import { FEATURE_DRIVE_MODE, FEATURE_EVENTS, FEATURE_LEGAL } from '../flagsV8';
import { FEATURE_JUNTES, FEATURE_SOCIAL, FEATURE_SUPPORT } from '../flagsV10';
import type { FeatureId, FeatureSection } from './ids';

/**
 * The one list of what the app can do (IMP 16102026 ADR-62, SPEC-C). The Herramientas hub, the search, the vehicle's
 * shortcuts, the cluster's telltales and the "Descubre" card all read it, and `__tests__/features/registry.test.ts`
 * fails when a screen under app/ is neither covered by a feature nor named in `INTERNAL_ROUTES` with its reason —
 * which is how a function stops being hidden the day it is added (OBD was two taps down a 33-row list).
 *
 * Titles and one-line descriptions live in the dictionaries (`t.features.items[id]`); the keywords are here, in both
 * languages, because the search matches whatever the person types ("check engine" in a Spanish app finds OBD).
 */
export type TelltaleId = 'check' | 'oil' | 'coolant' | 'fuel' | 'battery' | 'tire' | 'brake' | 'document' | 'weekly';

export type FeatureDef = {
  id: FeatureId;
  icon: ComponentProps<typeof Ionicons>['name'];
  /** Expo-router path; `[id]` is the active vehicle's id. May carry a query (`?kind=reparacion`). */
  href: string;
  section: FeatureSection;
  needsVehicle: boolean;
  /** Works without a car (a lookup), but takes the active one along when there is one. */
  passVehicle?: boolean;
  /** Folders of `app/` this function owns: `carga/*` covers every screen under it. */
  covers: string[];
  keywords: { es: string[]; en: string[] };
  /** Shown in the vehicle's shortcut row, in this order (lower first). */
  shortcut?: number;
  /** The big row at the top of the hub, in this order. */
  featured?: number;
  /** The telltale that opens it. */
  telltale?: TelltaleId;
  /** The flag that turns the whole function off. */
  enabled: boolean;
  /** Registered but not offered yet. */
  hidden?: boolean;
  /** Needs a system permission the hub can warn about. */
  permission?: 'location_foreground' | 'notifications' | 'photos';
};

export const FEATURES: FeatureDef[] = [
  // — Registrar —
  {
    id: 'fuel',
    icon: 'flash-outline',
    href: '/carga/nueva',
    section: 'registrar',
    needsVehicle: true,
    covers: ['carga/*'],
    featured: 3,
    shortcut: 3,
    telltale: 'fuel',
    enabled: true,
    keywords: {
      es: ['echada', 'gasolina', 'combustible', 'llenado', 'tanque', 'carga', 'gasoil', 'bomba'],
      en: ['fill up', 'fillup', 'fuel', 'gas', 'petrol', 'tank', 'refuel'],
    },
  },
  {
    id: 'repair',
    icon: 'build-outline',
    href: '/servicio/nuevo?kind=reparacion',
    section: 'registrar',
    needsVehicle: true,
    covers: [],
    featured: 2,
    shortcut: 1,
    telltale: 'battery',
    enabled: true,
    keywords: {
      es: ['reparacion', 'arreglo', 'taller', 'falla', 'averia', 'mecanico', 'factura', 'dano', 'cambio de pieza'],
      en: ['repair', 'fix', 'shop', 'garage', 'breakdown', 'mechanic', 'invoice', 'receipt'],
    },
  },
  {
    id: 'service',
    icon: 'construct-outline',
    href: '/servicio/nuevo?kind=mantenimiento',
    section: 'registrar',
    needsVehicle: true,
    covers: ['servicio/*', 'catalogo/*'],
    telltale: 'oil',
    enabled: true,
    keywords: {
      es: ['servicio', 'mantenimiento', 'cambio de aceite', 'aceite', 'filtro', 'frenos', 'gomas', 'catalogo', 'factura'],
      en: ['service', 'maintenance', 'oil change', 'oil', 'filter', 'brakes', 'tires', 'catalog', 'invoice'],
    },
  },
  {
    id: 'expense',
    icon: 'cash-outline',
    href: '/gasto/nuevo',
    section: 'registrar',
    needsVehicle: true,
    covers: ['gasto/*'],
    enabled: true,
    keywords: {
      es: ['gasto', 'peaje', 'seguro', 'marbete', 'parqueo', 'lavado', 'multa', 'pago', 'factura'],
      en: ['expense', 'toll', 'insurance', 'parking', 'wash', 'fine', 'payment', 'invoice'],
    },
  },
  {
    id: 'odometer',
    icon: 'speedometer-outline',
    href: '/odometro',
    section: 'registrar',
    needsVehicle: true,
    covers: [],
    enabled: true,
    keywords: {
      es: ['odometro', 'kilometraje', 'kilometros', 'km', 'millas', 'contador'],
      en: ['odometer', 'mileage', 'kilometers', 'miles', 'km'],
    },
  },
  {
    id: 'event',
    icon: 'flag-outline',
    href: '/evento/nuevo',
    section: 'registrar',
    needsVehicle: true,
    covers: ['evento/*', 'hito/*'],
    shortcut: 4,
    telltale: 'coolant',
    enabled: FEATURE_EVENTS,
    keywords: {
      es: ['evento', 'hito', 'accidente', 'choque', 'sobrecalentamiento', 'temperatura', 'pendiente', 'historia', 'recuerdo'],
      en: ['event', 'milestone', 'accident', 'crash', 'overheating', 'temperature', 'pending', 'story', 'memory'],
    },
  },
  {
    id: 'mod',
    icon: 'hammer-outline',
    href: '/mod/nuevo',
    section: 'registrar',
    needsVehicle: true,
    covers: ['mod/*'],
    shortcut: 5,
    enabled: FEATURE_BUILD,
    keywords: {
      es: ['mod', 'modificacion', 'mejora', 'tuning', 'upgrade', 'pieza nueva', 'instalar'],
      en: ['mod', 'modification', 'upgrade', 'tuning', 'part', 'install'],
    },
  },
  {
    id: 'photo',
    icon: 'images-outline',
    href: '/album/importar',
    section: 'registrar',
    needsVehicle: true,
    covers: ['album/*', 'foto/*'],
    shortcut: 6,
    enabled: FEATURE_ALBUM,
    permission: 'photos',
    keywords: {
      es: ['foto', 'fotos', 'imagen', 'galeria', 'importar', 'camara'],
      en: ['photo', 'photos', 'picture', 'gallery', 'import', 'camera'],
    },
  },
  {
    id: 'trip',
    icon: 'navigate-outline',
    href: '/conducir',
    section: 'registrar',
    needsVehicle: false,
    covers: [],
    featured: 4,
    enabled: FEATURE_DRIVE_MODE,
    permission: 'location_foreground',
    keywords: {
      es: ['viaje', 'conducir', 'manejar', 'gps', 'ruta', 'iniciar viaje', 'grabar'],
      en: ['trip', 'drive', 'driving', 'gps', 'route', 'start trip', 'record'],
    },
  },
  // — Cuidado y diagnóstico —
  {
    id: 'obd',
    icon: 'pulse-outline',
    href: '/obd',
    section: 'diagnostico',
    needsVehicle: false,
    passVehicle: true,
    covers: ['obd/*'],
    featured: 1,
    shortcut: 2,
    telltale: 'check',
    enabled: FEATURE_DIY,
    keywords: {
      es: ['obd', 'luz del tablero', 'luz de check', 'check engine', 'falla', 'codigo', 'codigos', 'p0300', 'escaner', 'diagnostico', 'se prendio una luz', 'motor'],
      en: ['obd', 'dashboard light', 'check engine', 'engine light', 'fault', 'code', 'codes', 'dtc', 'p0300', 'scanner', 'diagnostic'],
    },
  },
  {
    id: 'check',
    icon: 'clipboard-outline',
    href: '/chequeo',
    section: 'diagnostico',
    needsVehicle: true,
    covers: ['chequeo/*', 'inspeccion/*'],
    telltale: 'weekly',
    enabled: true,
    keywords: {
      es: ['chequeo', 'revision', 'semanal', 'inspeccion', 'lista', 'gomas', 'luces', 'freno'],
      en: ['check', 'checkup', 'weekly', 'inspection', 'checklist', 'tires', 'lights', 'brake'],
    },
  },
  {
    id: 'reminders',
    icon: 'alarm-outline',
    href: '/recordatorios',
    section: 'diagnostico',
    needsVehicle: true,
    covers: ['recordatorio/*', 'recordatorios/*'],
    enabled: true,
    keywords: {
      es: ['recordatorio', 'recordatorios', 'proximo', 'vence', 'vencido', 'alerta', 'aviso', 'refrigerante', 'bateria'],
      en: ['reminder', 'reminders', 'due', 'overdue', 'alert', 'notice', 'coolant', 'battery'],
    },
  },
  {
    id: 'tasks',
    icon: 'checkbox-outline',
    href: '/tareas',
    section: 'diagnostico',
    needsVehicle: true,
    covers: ['tarea/*', 'tareas/*'],
    enabled: true,
    keywords: {
      es: ['tarea', 'tareas', 'pendientes', 'por hacer', 'lista de cosas'],
      en: ['task', 'tasks', 'todo', 'to do', 'pending'],
    },
  },
  {
    id: 'contacts',
    icon: 'people-outline',
    href: '/contactos',
    section: 'diagnostico',
    needsVehicle: false,
    covers: ['contactos/*'],
    enabled: FEATURE_DIY,
    keywords: {
      es: ['contacto', 'contactos', 'taller', 'mecanico', 'tienda', 'telefono', 'proveedor'],
      en: ['contact', 'contacts', 'shop', 'mechanic', 'store', 'phone', 'supplier'],
    },
  },
  // — Tu carro y sus números —
  {
    id: 'garage',
    icon: 'car-sport-outline',
    href: '/garaje',
    section: 'vehiculo',
    needsVehicle: false,
    covers: ['vehiculo/nuevo', 'vehiculo/[id]'],
    enabled: true,
    keywords: {
      es: ['garaje', 'vehiculo', 'carro', 'agregar carro', 'nuevo carro', 'editar', 'ex', 'vendido', 'miembros'],
      en: ['garage', 'vehicle', 'car', 'add car', 'new car', 'edit', 'sold', 'members'],
    },
  },
  {
    id: 'album',
    icon: 'albums-outline',
    href: '/vehiculo/[id]?tab=album',
    section: 'vehiculo',
    needsVehicle: true,
    covers: ['vehiculo/[id]/album/*'],
    enabled: FEATURE_ALBUM,
    keywords: {
      es: ['album', 'fotos', 'linea de tiempo', 'recuerdos', 'galeria'],
      en: ['album', 'photos', 'timeline', 'memories', 'gallery'],
    },
  },
  {
    id: 'events',
    icon: 'time-outline',
    href: '/vehiculo/[id]?tab=eventos',
    section: 'vehiculo',
    needsVehicle: true,
    covers: [],
    enabled: FEATURE_EVENTS,
    keywords: {
      es: ['eventos', 'historia', 'accidentes', 'hitos', 'pendientes del carro'],
      en: ['events', 'story', 'accidents', 'milestones'],
    },
  },
  {
    id: 'build',
    icon: 'cube-outline',
    href: '/vehiculo/[id]?tab=build',
    section: 'vehiculo',
    needsVehicle: true,
    covers: ['vehiculo/[id]/build', 'wishlist/*', 'inventario/*', 'ruedas/*', 'goma/*'],
    enabled: FEATURE_BUILD,
    telltale: 'tire',
    keywords: {
      es: ['build', 'mods', 'modificaciones', 'specs', 'wishlist', 'deseos', 'inventario', 'aros', 'gomas', 'ruedas', 'piezas'],
      en: ['build', 'mods', 'modifications', 'specs', 'wishlist', 'inventory', 'wheels', 'tires', 'parts'],
    },
  },
  {
    id: 'ficha',
    icon: 'document-text-outline',
    href: '/vehiculo/[id]?tab=ficha',
    section: 'vehiculo',
    needsVehicle: true,
    covers: ['vehiculo/[id]/ficha'],
    enabled: FEATURE_DIY,
    keywords: {
      es: ['ficha', 'ficha tecnica', 'fluidos', 'torques', 'vin', 'chasis', 'memoria', 'especificaciones', 'aceite recomendado'],
      en: ['spec sheet', 'specs', 'fluids', 'torque', 'vin', 'chassis', 'memory', 'recommended oil'],
    },
  },
  {
    id: 'fluids',
    icon: 'water-outline',
    href: '/vehiculo/[id]/fluidos',
    section: 'vehiculo',
    needsVehicle: true,
    covers: [],
    enabled: FEATURE_DIY,
    keywords: {
      es: ['fluidos', 'aceite', 'refrigerante', 'liquido de frenos', 'transmision', 'que aceite le echo', 'capacidades'],
      en: ['fluids', 'oil', 'coolant', 'brake fluid', 'transmission', 'what oil', 'capacities'],
    },
  },
  {
    id: 'editvehicle',
    icon: 'create-outline',
    href: '/vehiculo/[id]/editar',
    section: 'vehiculo',
    needsVehicle: true,
    covers: [],
    enabled: true,
    keywords: {
      es: ['editar carro', 'editar vehiculo', 'cambiar datos', 'placa', 'color', 'apodo', 'vender', 'estado del carro'],
      en: ['edit car', 'edit vehicle', 'change details', 'plate', 'color', 'nickname', 'sell', 'car status'],
    },
  },
  {
    id: 'members',
    icon: 'person-add-outline',
    href: '/garaje/miembros',
    section: 'vehiculo',
    needsVehicle: false,
    covers: ['garaje/*'],
    enabled: FEATURE_SHARE,
    keywords: {
      es: ['miembros', 'garaje compartido', 'invitar', 'familia', 'pareja', 'permisos de edicion'],
      en: ['members', 'shared garage', 'invite', 'family', 'partner', 'edit access'],
    },
  },
  {
    id: 'docs',
    icon: 'folder-open-outline',
    href: '/documentos',
    section: 'vehiculo',
    needsVehicle: true,
    covers: ['documento/*', 'documentos/*'],
    telltale: 'document',
    enabled: true,
    keywords: {
      es: ['documentos', 'papeles', 'seguro', 'marbete', 'matricula', 'licencia', 'vencimiento', 'factura'],
      en: ['documents', 'papers', 'insurance', 'registration', 'license', 'expiry', 'invoice'],
    },
  },
  {
    id: 'book',
    icon: 'book-outline',
    href: '/vehiculo/[id]/libro',
    section: 'vehiculo',
    needsVehicle: true,
    covers: [],
    enabled: FEATURE_SHARE,
    keywords: {
      es: ['libro', 'libro del carro', 'pdf', 'historial completo', 'vender', 'imprimir'],
      en: ['book', 'car book', 'pdf', 'full history', 'sell', 'print'],
    },
  },
  {
    id: 'share',
    icon: 'share-social-outline',
    href: '/vehiculo/[id]/compartir',
    section: 'vehiculo',
    needsVehicle: true,
    covers: ['compartidos', 'invitacion/*'],
    enabled: FEATURE_SHARE,
    keywords: {
      es: ['compartir', 'ficha publica', 'enlace', 'invitar', 'codigo de invitacion', 'garaje compartido'],
      en: ['share', 'public page', 'link', 'invite', 'invite code', 'shared garage'],
    },
  },
  {
    id: 'stats',
    icon: 'stats-chart-outline',
    href: '/cifras',
    section: 'vehiculo',
    needsVehicle: true,
    covers: ['reporte', 'exportar'],
    enabled: true,
    keywords: {
      es: ['cifras', 'estadisticas', 'consumo', 'gastos', 'grafica', 'reporte', 'exportar', 'csv', 'economia'],
      en: ['stats', 'statistics', 'economy', 'spending', 'chart', 'report', 'export', 'csv'],
    },
  },
  {
    id: 'prices',
    icon: 'pricetag-outline',
    href: '/precios',
    section: 'vehiculo',
    needsVehicle: false,
    covers: ['precios/*'],
    enabled: true,
    keywords: {
      es: ['precios', 'combustible', 'micm', 'galon', 'gasolina', 'gasoil'],
      en: ['prices', 'fuel', 'micm', 'gallon', 'gas'],
    },
  },
  // — Viajes y comunidad —
  {
    id: 'trips',
    icon: 'map-outline',
    href: '/viajes',
    section: 'viajes',
    needsVehicle: false,
    covers: ['viaje/*', 'viajes/*'],
    enabled: FEATURE_TRIPS,
    permission: 'location_foreground',
    keywords: {
      es: ['viajes', 'recorridos', 'rutas', 'automatico', 'historial de viajes', 'mapa de calor'],
      en: ['trips', 'routes', 'automatic', 'trip history', 'heat map'],
    },
  },
  {
    id: 'tripsettings',
    icon: 'settings-outline',
    href: '/viajes/ajustes',
    section: 'viajes',
    needsVehicle: false,
    covers: [],
    enabled: FEATURE_TRIPS,
    permission: 'location_foreground',
    keywords: {
      es: ['ajustes de viajes', 'modo automatico', 'modo manual', 'segundo plano', 'xiaomi', 'bateria', 'no graba'],
      en: ['trip settings', 'automatic mode', 'manual mode', 'background', 'xiaomi', 'battery', 'not recording'],
    },
  },
  {
    id: 'track',
    icon: 'stopwatch-outline',
    href: '/pista',
    section: 'viajes',
    needsVehicle: false,
    covers: ['pista/*'],
    enabled: FEATURE_TRACK,
    keywords: {
      es: ['pista', 'track', 'drag', 'drift', 'sesion', 'tiempos', 'carrera'],
      en: ['track', 'drag', 'drift', 'session', 'lap times', 'race'],
    },
  },
  {
    id: 'juntes',
    icon: 'people-circle-outline',
    href: '/juntes',
    section: 'viajes',
    needsVehicle: false,
    covers: ['juntes/*', 'junte/*'],
    enabled: FEATURE_JUNTES,
    permission: 'location_foreground',
    keywords: {
      es: ['juntes', 'junte', 'reunion', 'caravana', 'quedada', 'mapa en vivo'],
      en: ['meetups', 'meetup', 'convoy', 'live map', 'cruise'],
    },
  },
  {
    id: 'community',
    icon: 'chatbubbles-outline',
    href: '/comunidad',
    section: 'viajes',
    needsVehicle: false,
    covers: ['perfil', 'u/*'],
    enabled: FEATURE_SOCIAL,
    keywords: {
      es: ['comunidad', 'amigos', 'seguidores', 'perfil', 'usuario', 'seguir', 'bloquear'],
      en: ['community', 'friends', 'followers', 'profile', 'username', 'follow', 'block'],
    },
  },
  // — App y cuenta —
  {
    id: 'account',
    icon: 'person-circle-outline',
    href: '/cuenta',
    section: 'cuenta',
    needsVehicle: false,
    covers: ['nueva-contrasena', 'borrar-cuenta'],
    enabled: true,
    keywords: {
      es: ['cuenta', 'iniciar sesion', 'correo', 'contrasena', 'sincronizar', 'respaldo', 'borrar cuenta'],
      en: ['account', 'sign in', 'email', 'password', 'sync', 'backup', 'delete account'],
    },
  },
  {
    id: 'notifications',
    icon: 'notifications-outline',
    href: '/notificaciones',
    section: 'cuenta',
    needsVehicle: false,
    covers: [],
    enabled: true,
    permission: 'notifications',
    keywords: {
      es: ['notificaciones', 'avisos', 'hora', 'recordatorios'],
      en: ['notifications', 'alerts', 'time', 'reminders'],
    },
  },
  {
    id: 'permissions',
    icon: 'shield-checkmark-outline',
    href: '/permisos',
    section: 'cuenta',
    needsVehicle: false,
    covers: [],
    enabled: true,
    keywords: {
      es: ['permisos', 'acceso', 'ubicacion', 'camara', 'fotos', 'bateria', 'gps no funciona'],
      en: ['permissions', 'access', 'location', 'camera', 'photos', 'battery', 'gps not working'],
    },
  },
  {
    id: 'welcome',
    icon: 'sparkles-outline',
    href: '/bienvenida?again=1',
    section: 'cuenta',
    needsVehicle: false,
    covers: ['bienvenida/*', 'onboarding'],
    enabled: true,
    keywords: { es: ['bienvenida', 'tutorial', 'ayuda', 'como se usa'], en: ['welcome', 'tutorial', 'help', 'how to'] },
  },
  {
    id: 'install',
    icon: 'download-outline',
    href: '/instalar',
    section: 'cuenta',
    needsVehicle: false,
    covers: [],
    enabled: true,
    keywords: { es: ['instalar', 'apk', 'pwa', 'pantalla de inicio', 'descargar'], en: ['install', 'apk', 'pwa', 'home screen', 'download'] },
  },
  {
    id: 'versions',
    icon: 'newspaper-outline',
    href: '/versiones',
    section: 'cuenta',
    needsVehicle: false,
    covers: [],
    enabled: true,
    keywords: { es: ['versiones', 'novedades', 'que hay de nuevo', 'cambios'], en: ['versions', 'whats new', 'changes', 'release notes'] },
  },
  {
    id: 'legal',
    icon: 'reader-outline',
    href: '/legal',
    section: 'cuenta',
    needsVehicle: false,
    covers: ['legal/*'],
    enabled: FEATURE_LEGAL,
    keywords: { es: ['legal', 'terminos', 'privacidad', 'eliminar mis datos'], en: ['legal', 'terms', 'privacy', 'delete my data'] },
  },
  {
    id: 'support',
    icon: 'heart-outline',
    href: '/apoyar',
    section: 'cuenta',
    needsVehicle: false,
    covers: [],
    enabled: FEATURE_SUPPORT,
    keywords: { es: ['apoyar', 'donar', 'cafe', 'ayudar al proyecto'], en: ['support', 'donate', 'coffee', 'help the project'] },
  },
  {
    id: 'feedback',
    icon: 'chatbox-ellipses-outline',
    href: '/comentario',
    section: 'cuenta',
    needsVehicle: false,
    covers: [],
    enabled: FEATURE_FEEDBACK,
    keywords: { es: ['comentario', 'comentarios', 'reportar', 'problema', 'error', 'sugerencia', 'queja'], en: ['feedback', 'report', 'problem', 'bug', 'suggestion', 'complaint'] },
  },
];

/**
 * Screens that are not a function of their own, with the reason. A new screen under app/ that is in neither
 * `FeatureDef.covers` nor here fails `registry.test.ts`.
 */
export const INTERNAL_ROUTES: Record<string, string> = {
  '(tabs)/index': 'tab bar: Inicio',
  '(tabs)/historial': 'tab bar: Historial',
  '(tabs)/mas': 'tab bar: Más',
  'admin/*': 'administration, visible only to an admin',
  'dev/*': 'developer tools',
  herramientas: 'the hub itself',
  'junte/[code]': 'a deep link (/j/…)',
  'u/[handle]': 'a public profile link',
  'invitacion/[code]': 'a deep link from an invitation',
  'nueva-contrasena': 'a link from the password e-mail',
};

/** The features this build offers, in registry order. */
export function activeFeatures(): FeatureDef[] {
  return FEATURES.filter((f) => f.enabled && !f.hidden);
}

export function featureById(id: FeatureId): FeatureDef {
  const found = FEATURES.find((f) => f.id === id);
  if (!found) throw new Error(`unknown feature ${id}`);
  return found;
}

/** The href with the active vehicle's id in `[id]` (and as `vehicleId` for the screens that read it). */
export function featureHref(def: FeatureDef, vehicleId: string | null): string {
  if (def.href.includes('[id]')) return def.href.replace('[id]', vehicleId ?? '');
  if ((def.needsVehicle || def.passVehicle) && vehicleId && !def.href.startsWith('/odometro') && !def.href.startsWith('/carga')) {
    const sep = def.href.includes('?') ? '&' : '?';
    return `${def.href}${sep}vehicleId=${vehicleId}`;
  }
  return def.href;
}

/** `app/` file path without the extension (`vehiculo/[id]/album/index` → `vehiculo/[id]/album`). */
export function routeKey(file: string): string {
  return file
    .replace(/^app\//, '')
    .replace(/\.tsx$/, '')
    .replace(/(?<!^\(tabs\))\/index$/, '')
    .replace(/^index$/, '');
}

function matches(pattern: string, key: string): boolean {
  return pattern.endsWith('/*') ? key === pattern.slice(0, -2) || key.startsWith(pattern.slice(0, -1)) : key === pattern;
}

/** The feature that owns an `app/` route file: its own href, or one of its `covers`. */
export function coveringFeature(file: string): FeatureDef | undefined {
  const key = routeKey(file);
  return FEATURES.find((f) => {
    const own = f.href.split('?')[0].replace(/^\//, '');
    return matches(own, key) || own === key.replace(/^\(tabs\)\//, '') || f.covers.some((c) => matches(c, key));
  });
}

/** Why a route is not a function, or undefined. */
export function internalReason(file: string): string | undefined {
  const key = routeKey(file);
  const hit = Object.keys(INTERNAL_ROUTES).find((p) => matches(p, key));
  return hit ? INTERNAL_ROUTES[hit] : undefined;
}

/** The function a cluster telltale opens (SPEC-C §5). */
export function featureForTelltale(id: TelltaleId): FeatureDef | undefined {
  return FEATURES.find((f) => f.telltale === id && f.enabled && !f.hidden);
}

/** Lamp icon → the telltale id the registry knows it by. */
export const LAMP_TELLTALE: Record<string, TelltaleId> = {
  oil: 'oil',
  coolant: 'coolant',
  tire: 'tire',
  battery: 'battery',
  document: 'document',
  checklist: 'weekly',
  fuel: 'fuel',
  engine: 'check',
};
