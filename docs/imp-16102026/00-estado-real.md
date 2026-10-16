# Estado real del repo — Fase 0 (2026-10-16)

Verificado clonando/leyendo el repo local en `main` (commit `2691f64`), rama de trabajo `imp-16102026`. **No había commits nuevos** respecto al BRIEF: los números del paquete no cambian.

## Confirmación de los números del BRIEF
| Dato | BRIEF | Repo real | Dónde se vio |
|------|-------|-----------|--------------|
| Versión | 2.5.1 | **2.5.1** | `package.json`, `app.json` |
| Schema SQLite local | v10 | **v10** (última entrada `{ version: 10, up: migrationV10() }`) | `lib/db/migrations.ts:300`, `lib/db/migrationV10.ts` |
| Último SQL de nube | `sql/039` | **`sql/039_junte_chat_push.sql`** (`999_cleanup_test_users.sql` y `rollback.sql` aparte) | `ls sql/` |
| Último ADR | 58 | **ADR-58** («Fix pack 2.4.3 first; social on its own cloud files») | `docs/imp-01102026/00-context/03-architecture-decisions.md:114` |
| Commit base | `2691f64` | **`2691f64`** `chore(gitignore): keep service-account keys (credentials/) local` | `git log` |
| Chat de juntes | apagado | `FEATURE_JUNTE_CHAT = false` | `lib/flagsV10.ts:18` |
| `FEATURE_DIY` (OBD) | `true` | `true` | `lib/flags.ts:30` |

Numeración que usa este ciclo (sin cambios): **schema v11** (v12 para reparaciones), **`sql/040…`** (`sql/041…`), **ADR-59…64**, versión **2.6.0**.

## Cómo se aplican los SQL a `x-core`
`node tools/apply-sql.mjs sql/NNN_nombre.sql [--dry-run] [--shared]`
- Solo acepta rutas dentro de `sql/`. Lee `ACCESS_TOKEN` de `.env.supabase` (gitignored; no se imprime ni se pasa por línea de comandos). Proyecto `nakgrkcqyuycadeuenuw`, vía la Management API (`/database/query`).
- Imprime un resumen antes de enviar; `--dry-run` no envía; un archivo que **modifica** algo de Music Hub (DDL o DML en `public`/`auth`/`storage`) se rechaza sin `--shared` (por eso existen archivos `*.shared.sql`: 021, 024, 027, 036).
- Después: `npm run types:gen` (regenera `lib/cloud/database.types.ts`), `node tools/verify-x-core.mjs` (comprobación de x-core), `tools/local-rls` para RLS en local.
- **Esta fase no aplicó ningún SQL** (no hay cambios de producto; además no hay `.env.supabase` en esta máquina).

## Cómo se publica
- `tools/release-apk.sh` — APK universal local con checks; `--publish` crea el release de GitHub (`car-guy.apk` estable + `car-guy-vX.Y.Z.apk`); `--skip-build`; `--ota` = solo JS vía EAS Update al canal `production` (ADR-52), con `--publish` crea el release sin APK (no "latest").
- `tools/ota-gate.cjs check` decide `ota` o `apk <razón>` comparando el fingerprint nativo actual (`npx expo-updates runtimeversion:resolve --platform android`) con `releases/fingerprint.json`; `record <ver>` lo guarda tras un APK.
- `releases/fingerprint.json` hoy: `{"version":"2.5.0","android":"1232e3203eb74bdcded780b90d94ae09fa02b1bc"}`. Según el BRIEF el fingerprint actual ya es otro (`ff2d7e1…`, por la config de Firebase) → **el próximo release nativo debe ser APK**; los cambios de permisos de este ciclo también son nativos.
- `fingerprint.config.js` ignora el parche `patches/expo-location+57.0.20.patch` (solo toca el shim web).
- `tools/build-test-apk.sh` — APK de prueba (`APP_VARIANT=test`, paquete `com.xaviel.carguy.test`, canal `preview`).
- **Observación de entorno (Windows):** `node tools/ota-gate.cjs check` falla aquí con `spawnSync npx ENOENT` (`execFileSync('npx')` sin `.cmd`/shell). No se calculó el fingerprint actual en esta máquina; se anota para la fase 6 (ejecutar el gate en el entorno donde Xaviel publica, o llamar `npx.cmd`).

## Línea base (antes de cualquier cambio)
Entorno: Windows 11, Node **20.20.0** por defecto (nvm). Los tests usan `node:sqlite` (Node ≥ 22.5), así que se corrieron con **Node 22.16.0** puesto solo en el `PATH` de la sesión (sin `nvm use`, no se tocó la configuración global).

| Chequeo | Resultado | Detalle |
|---------|-----------|---------|
| `npm ci` | ✔ | 758 paquetes; `postinstall` (patch-package + copy-maplibre-worker) ✔ |
| `tsc --noEmit` | ✘ **4 errores TS2882** | `import 'maplibre-gl/dist/maplibre-gl.css'` sin declaración en `components/map/{HeatMap,JunteMap,LiveMap,TripMap}.web.tsx:1`. Preexistente; no bloquea Metro. |
| `npm run lint` (`expo lint`) | ✔ 0 errores, 1 aviso | `app/cuenta.tsx:30` `dateLabel` sin usar |
| `jest` con Node 20 | ✘ 28 suites / 8 tests | `No such built-in module: node:sqlite` (entorno) |
| `jest` con Node 22.16 | ✘ **5 suites / 11 tests de 2 116** (124 suites ✔, 2 105 tests ✔) | ver abajo |
| Build web (`expo export -p web`) | ✔ | sale a `dist/` (no se corrió `tools/finalize-web.mjs`; `npm run build` usa sintaxis bash que cmd.exe no entiende) |

Los 11 tests rojos son de entorno, no del producto:
- `__tests__/changelog/parse.test.ts` (1) y `__tests__/legal/markdown.test.ts` (4): comparan archivos generados con la salida del generador; `git config core.autocrlf = true` en esta máquina convierte a CRLF `lib/changelog.generated.ts`, `CHANGELOG.md` y los HTML legales → diferencia de 548 líneas.
- `__tests__/ui/skeletons.test.ts` (3): `found the routes` recibe 0 rutas (el glob de archivos no encuentra nada con rutas de Windows).
- `__tests__/db/delete-vehicle.test.ts` (2) y `__tests__/db/album.test.ts` (1): `column index out of range` en `lib/db/vehicleOps.ts:285` (`deleteVehicleCascade` usa parámetros numerados `?1 ?2 ?3`; el `node:sqlite` de Node 22.16 los trata distinto de `expo-sqlite`). Probablemente pasan con un Node más nuevo (no se verificó; no hay CI en el repo que lo confirme); se revisa en la fase 6.

No se arregló nada de esto (regla de la fase: no tocar salvo que bloquee). Para las fases 1–6: usar Node 22 (≥ 22.16) y `git config core.autocrlf false` o `--renormalize` antes de correr `npm test`; los 11 deben quedar igual de rojos (o verdes) antes y después de cada fase.

## Últimos 15 commits (`git log --format='%h %ad %s' --date=short`)
```
2691f64 2026-10-02 chore(gitignore): keep service-account keys (credentials/) local
591f7bf 2026-10-02 Merge junte-chat-push: chat by @handle + push (sql/039, api/junte-push); chat still off
bff18a0 2026-10-02 feat(push): Firebase config for com.xaviel.carguy and .test (project car-guy-7052a)
e220f46 2026-10-02 chore(types): regenerate after sql/039 (applied to x-core)
fe62f09 2026-10-02 feat(juntes): chat by @handle + push notifications (sql/039, api/junte-push)
faf6eac 2026-10-02 docs(next): refresh for 2.5.1 + the iPhone GPS fix
17b743f 2026-10-02 Merge fix/iphone-trip-gps: precise GPS for iPhone web trips
3d49db5 2026-10-02 fix(trips): iPhone web trips ask for the precise GPS
43f0ccf 2026-10-02 docs(imp-01102026): 2.5.1 OTA reached his Redmi (note 6 closed); test users cleaned
64527b5 2026-10-02 docs(imp-01102026): 2.5.0 released and on the Redmi; 2.5.1 OTA waits for his go
38e45c1 2026-10-02 Merge 2.5.1 (OTA): juntes singulars; build-test-apk.sh restores node_modules
99c9357 2026-10-02 release: v2.5.0 — record the APK's runtime fingerprint for --ota
461eadc 2026-10-02 release prep: 2.5.1 (OTA) — juntes: "1 conectado", "1 carro"
d5134c8 2026-10-02 fix(tools): build-test-apk.sh puts node_modules back after Gradle
b7d662c 2026-10-02 Merge IMP 01102026 Phases 2–6 — schema v10, gauge, updates, social, juntes (2.5.0 Nakama)
```

## Otras cosas del repo que importan a este ciclo
- **Expo v57**: `AGENTS.md` exige leer los docs versionados antes de escribir código. Esta fase no escribe código de producto; las fases 1–6 deben leer `docs.expo.dev/versions/v57.0.0/` (expo-location, expo-notifications, expo-image-picker, expo-media-library) antes de tocar permisos. No había acceso de red del agente a esos docs en esta fase → ver `PROGRESS.md` → "No verificado".
- **Pila de la app**: Expo SDK 57, expo-router 57, `expo-sqlite` (web con wasm), MapLibre (`@maplibre/maplibre-react-native` 11.4 y `maplibre-gl` 6.11.2 en web), sync a Supabase `x-core`/schema `carguy`.
- **Android efectivo**: no hay carpeta `android/` (prebuild generado); ver `permissions-inventory.md` para el manifiesto fusionado deducido de los módulos.
- **Dispositivos**: `adb devices` no lista ninguno → no se pudo hacer `logcat` ni `dumpsys package` (pasa al checklist manual, ver `findings.md` → "No verificado").
- **Herramientas auxiliares usadas en esta fase** (fuera del repo, en carpeta temporal): `playwright-core` + el Chromium ya instalado por Playwright para reproducir el mapa; un servidor estático mínimo sobre `dist/`. No se añadió ninguna dependencia al proyecto.
