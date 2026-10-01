/**
 * Every screen that loads data has its skeleton twin (IMP 30092026 note 4,
 * ADR-40). A route file under app/ passes when it renders a component whose
 * name ends in `Skeleton`, or when it is in NO_SKELETON below with its reason.
 * A new route fails here until it has one or says why it needs none.
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

/** Store-backed (data is in memory before the screen mounts), static, auth-only, or a create form with no initial data. */
const NO_SKELETON: Record<string, string> = {
  'app/(tabs)/mas.tsx': 'store-backed',
  'app/carga/nueva.tsx': 'store-backed form',
  'app/carga/[id]/editar.tsx': 'store-backed form',
  'app/carga/[id]/index.tsx': 'store-backed',
  'app/odometro.tsx': 'store-backed form',
  'app/onboarding.tsx': 'static',
  'app/bienvenida/index.tsx': 'static (the welcome slides; the vehicle form is a create form)',
  'app/versiones.tsx': 'static (bundled changelog)',
  'app/apoyar.tsx': 'static text first; the published figures and links fill in',
  'app/comunidad.tsx': 'cache-backed (social_cache): shown at once, refreshed on focus',
  'app/instalar.tsx': 'static',
  'app/notificaciones.tsx': 'settings, instant',
  'app/invitacion/[code].tsx': 'auth flow with its own states',
  'app/comentario.tsx': 'create form',
  'app/cuenta.tsx': 'auth spinner is the state',
  'app/perfil.tsx': 'local settings, instant (lib/profile.ts)',
  'app/nueva-contrasena.tsx': 'auth form',
  'app/vehiculo/nuevo.tsx': 'create form',
  'app/vehiculo/[id]/editar.tsx': 'store-backed form (vehicle detail in memory)',
  'app/viajes/ajustes.tsx': 'settings, instant',
  'app/viajes/permisos.tsx': 'permission states',
  'app/chequeo/guia.tsx': 'static text',
  'app/album/importar.tsx': 'picker flow',
  'app/gasto/nuevo.tsx': 'create form',
  'app/servicio/nuevo.tsx': 'create form',
  'app/documento/nuevo.tsx': 'create form',
  'app/recordatorio/nuevo.tsx': 'create form',
  'app/tarea/nueva.tsx': 'create form',
  'app/hito/nuevo.tsx': 'redirect to /evento/nuevo',
  'app/hito/[id].tsx': 'redirect to /evento/[id] (its twin is there)',
  'app/evento/nuevo.tsx': 'create form',
  'app/mod/nuevo.tsx': 'create form',
  'app/inventario/nuevo.tsx': 'create form',
  'app/wishlist/nuevo.tsx': 'create form',
  'app/contactos/nuevo.tsx': 'create form',
  'app/pista/evento/nuevo.tsx': 'create form',
  'app/pista/sesion/nueva.tsx': 'create form',
  'app/dev/seed.tsx': 'developer tool',
  'app/dev/tokens.tsx': 'developer tool',
  'app/legal/index.tsx': 'static (bundled texts)',
  'app/legal/[doc].tsx': 'static (bundled Markdown)',
  'app/borrar-cuenta.tsx': 'auth flow with its own states',
};

// Tracked and new (not yet committed) route files; a tracked file moved away in the
// working tree (app/(tabs)/cifras.tsx → app/cifras.tsx) is no longer a route.
const routes = execSync("git ls-files --cached --others --exclude-standard 'app/**/*.tsx' 'app/*.tsx'", { encoding: 'utf8' })
  .split('\n')
  .filter((f) => f && existsSync(f) && !/_layout|\+html|\+not-found/.test(f))
  .filter((f, i, all) => all.indexOf(f) === i);

it('found the routes', () => {
  expect(routes.length).toBeGreaterThan(70);
});

it('every exempt route still exists (no stale entries)', () => {
  for (const f of Object.keys(NO_SKELETON)) expect(routes).toContain(f);
});

const needing = routes.filter((f) => !(f in NO_SKELETON));
it.each(needing)('%s renders its skeleton twin', (file) => {
  const src = readFileSync(file, 'utf8');
  expect(/<\w*Skeleton\b/.test(src)).toBe(true);
});

it('Screens with skeleton: N/N (the report line)', () => {
  const withTwin = needing.filter((f) => /<\w*Skeleton\b/.test(readFileSync(f, 'utf8'))).length;
  // Printed for the Phase 3B report; the per-route cases above are the gate.
  console.log(`Screens with skeleton: ${withTwin}/${needing.length}`);
  expect(withTwin).toBe(needing.length);
});
