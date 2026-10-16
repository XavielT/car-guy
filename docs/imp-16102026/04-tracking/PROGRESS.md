# PROGRESS — ciclo IMP 16102026

Claude Code actualiza este archivo al terminar cada fase. Aquí no se espera ninguna decisión: lo no definido se resuelve con el default recomendado y se anota en "Decisiones tomadas".

## Estado
| Fase | Estado | Versión / commit | Fecha |
|------|--------|------------------|-------|
| 0 Kickoff y diagnóstico | **✔ hecha** (solo documentación; ningún cambio de producto) | rama `imp-16102026`, commit de la fase 0 | 2026-10-16 |
| 1 Fix pack | **✔ código y pruebas** · pendiente: aplicar `sql/040` y publicar 2.5.2 (sin credenciales en esta máquina) | rama `imp-16102026-phase-1` | 2026-10-16 |
| 2 Permisos y mapa | **✔ código y pruebas** · sin publicar (sin credenciales; ver abajo) | rama `imp-16102026-phase-2` | 2026-10-16 |
| 3 SelectField | pendiente | | |
| 4 Herramientas | pendiente | | |
| 5 Reparaciones | pendiente | | |
| 6 Regresión y release | pendiente | | |

## Números reales (confirmados por la fase 0, 2026-10-16)
Versión **2.5.1** · schema local **v10** (`lib/db/migrations.ts:300`) · último `sql/` **039** · último ADR **58** · commit base **`2691f64`** (sin commits nuevos) · canales: APK 2.5.0 (versionCode 21) + OTA 2.5.1; `releases/fingerprint.json` = 2.5.0 `1232e32…`, huella nativa pendiente de APK por Firebase (el gate no se pudo ejecutar en Windows: `spawnSync npx ENOENT`) · SQL a `x-core`: `node tools/apply-sql.mjs`. **Ningún número del paquete cambia**: este ciclo usa schema **v11** (oil_synthetic, fase 1) y **v12** (reparaciones, fase 5), `sql/040` y `sql/041`, **ADR-59…64**, versión **2.6.0**.

Línea base (antes de tocar nada): `tsc` 4 errores TS2882 (CSS de maplibre, preexistentes) · lint 0 errores / 1 aviso (`app/cuenta.tsx:30`) · jest con Node 22.16: 124/129 suites y 2 105/2 116 tests verdes (los 11 rojos son de entorno Windows/Node; detalle en `00-estado-real.md`) · build web ✔. Con Node 20 (el de la máquina) 28 suites fallan por `node:sqlite`.

## Decisiones tomadas (por Claude Code, con default recomendado)
1. **Fuente del paquete** (2026-10-16): estaba en `C:\developer\improvements\car guy improvements\Octubre 2026\imp cg 16102026\` y se copió a `docs/imp-16102026/` (17 archivos). Rama de trabajo: `imp-16102026` (el prompt no daba el nombre de las ramas de fase; las fases siguientes usan `imp-16102026/phase-N-…` como en ciclos anteriores).
2. **Node 22 solo para las pruebas**: se antepuso `…\nvm\v22.16.0` al `PATH` de la sesión; no se ejecutó `nvm use` (no se toca la configuración global del usuario). Recomendación para las fases 1–6: usar Node ≥ 22.16 y `git config core.autocrlf false` (o `git add --renormalize .`) antes de correr `npm test`, porque con `autocrlf=true` fallan 5 tests de archivos generados.
3. **No se arreglaron** los 4 errores de `tsc`, el aviso de lint ni los 11 tests de entorno (regla de la fase). Se anotan; el fix de los TS2882 (declarar `*.css`) es de 1 línea y puede entrar en la fase 1 si estorba.
4. **Aceite sintético**: columna `vehicle.oil_synthetic` (v11 + `sql/040`) en lugar de derivarlo del recordatorio; con backfill heurístico (recordatorio `aceite_motor` a 10 000 km y nota `t.oil.syntheticNote`). Ver `findings.md` → N5.
5. **Reparaciones**: tabla de enlaces aditiva `service_media` (patrón `mod_media`) y columna `service_record.done_by` en lugar de añadir `role` a `media` (compartida por todo; las apps viejas ignoran una tabla que no conocen). Ver `repairs-audit.md` §7.
6. **Clasificación de selectores** (default aplicado, ver `picker-inventory.md`): "Pasajero", "Tanque lleno", "¿Recurrente?", "¿Fijo?", "Activado", "Mapa en línea" y "Solo reserva" son booleanos → interruptor; "Rol" del viaje, visibilidad, período, idioma y tema son selección → `SelectField`. Cuentan como filtro de lista (→ `SelectField`) los 13 de la sección B.
7. **OBD "escondida"**: la regla (≥ 3 toques o un solo camino) deja a OBD a 2 toques (Más → OBD); se añadió el criterio **"enterrada"** (2 toques dentro de una lista de ≈ 33 filas sin atajo en Inicio) y se marca así. Ver `feature-map.md`.
8. **SPEC-A corregida** (paso 7): la tabla del registro de permisos se reescribió con lo que la app realmente declara y usa (`02-specs/SPEC-A-permisos-y-mapa.md`).
9. **Evidencia de iPhone** = Chromium emulando el UA de iPhone y los permisos simulados con `addInitScript`; no es WebKit. Todo lo que dependa del diálogo real de Safari queda en "No verificado".

## Hallazgos clave
- **N5 (aceite sintético)**: no es un campo del vehículo. No hay columna; `saveVehicleDraft` solo estira el recordatorio **al crear** (`vehicleOps.ts:169-170`) y `editar.tsx` no pasa `synthetic` al formulario → siempre desmarcado; en una edición marcar no hace nada. Único campo de `VehicleDraft` sin ida y vuelta.
- **Mapa (N1) — 13 defectos (M-1…M-13)** en `findings.md`. El de la captura del iPhone es **M-1**: el permiso "nunca preguntado" (`prompt`) se muestra como "Sin permiso de ubicación" (`myPosition.ts:71-75`); nadie le pregunta hasta INICIAR VIAJE (`live.ts:58`). Otros: el aviso es texto pasivo (M-2), fix aproximado nunca se dibuja (M-4), errores 1/2/3 sin distinguir y web colapsa 2 y 3 en "denegado" (M-5), `canAskAgain` siempre `true` en web (M-6), cámara fija en una calle cualquiera (M-7), caja negra sin tiles (M-8), el interruptor de modo es ilegible con tema claro (M-9), la hoja ocupa el 62 % (M-10).
- **Selectores (N4)**: 31 `<Segmented`, 99 `<Chip` (90 de ui) + 10 controles a mano; inventario de **104 filas a migrar** (91 formularios/ajustes + 13 filtros), 10 pestañas/navegación y 9 interruptores que se quedan.
- **Permisos (N2/N3)**: 12 sitios llaman a permisos sin registro; 3 pedidos "en frío" (ubicación al iniciar, fotos al abrir Importar, cámara sin pedir); `CAMERA`/`POST_NOTIFICATIONS`/almacenamiento llegan implícitos por librerías; no hay pantalla general de Permisos ni salida a ajustes para cámara/fotos.
- **Funciones (N6)**: 19 escondidas (≥ 3 toques o un solo camino); **OBD enterrada** (Más, fila 17 de ≈ 33), sin testigo; **reparación** a 3 toques y un solo camino. 7 testigos tocables en Inicio, ninguno de OBD/reparación/permisos.
- **Reparaciones (N7)**: ya existe `ServiceRecord kind='reparacion'`; faltan `done_by`, fotos con rol (hoy `photos[0]`), cierre de Pendientes (eventos `pending` y tareas), recordatorio de garantía (no existe) y entradas. OBD ya puede crear una reparación (`createRepairForDtc`).
- **Capturas**: X2 (hace 0 s) y X3 (swatch Negro) **confirmados**; X5 **descartado** (placeholder literal, `VehicleForm.tsx:400`); X1 **probable en Safari** (no reproducible en Chromium; falta `minWidth: 0`); X4 y X6 confirmados por lectura.

## No verificado
- Comportamiento real de Safari/PWA en el iPhone: ¿"No permitir" se puede volver a preguntar?, ¿la PWA pregunta en cada apertura?, texto exacto de Ajustes → Privacidad → Localización, watch parado (M-11), X1 en WebKit.
- Android/Redmi: **sin dispositivo en `adb devices`** → no se hizo `adb logcat` ni `dumpsys package`; matriz de permisos fg/bg, MIUI y batería pendientes (checklist manual).
- Manifiesto fusionado real de Android (los permisos implícitos de librerías se dedujeron de `node_modules/*/AndroidManifest.xml`).
- Docs de Expo v57 (expo-location/notifications/image-picker/media-library): no se leyeron porque no se escribió código; las fases 2 y 3 deben leerlos antes de implementar. En particular, el comportamiento de `launchCameraAsync` sin permiso en Android.
- `tools/ota-gate.cjs check` no corre en Windows (`npx` sin shell): el fingerprint actual no se calculó.
- Que los 3 tests de `deleteVehicleCascade`/álbum pasen con un Node más nuevo (usan `?1 ?2 ?3` con `node:sqlite`).

## Ideas para el próximo ciclo
- Wake Lock para mantener la pantalla encendida en viajes manuales del iPhone (PWA).
- Web Push en la PWA instalada.
- Declarar `*.css` para `maplibre-gl` (cierra los 4 TS2882) y hacer que `tools/ota-gate.cjs` funcione en Windows (`npx.cmd`).
- Registro del token push en la app (hoy solo existe `register_push_token` en SQL/API) junto con "junte chat on".

## Fase 1 — fix pack 2.5.2 (2026-10-16)

**Hecho:** N5 (aceite sintético: columna `oil_synthetic`, schema v11, `sql/040`), X1, X2, X3, X5 y los defectos de mapa de fase 1 (M-2, M-4, M-8, M-9, M-10, M-11, M-12); estado detallado y pruebas en `findings.md` → "Estado tras la fase 1". Versión 2.5.2 (`app.json`, `package.json`, `CHANGELOG.md`, `lib/changelog.generated.ts`). Pruebas: 2 163 verdes de 2 174; los 11 rojos son **exactamente** los de entorno de la línea base (CRLF, rutas de Windows, `node:sqlite`). `tsc` solo los 4 TS2882 de siempre; lint 0 errores.

**Pendiente (necesita credenciales que no hay aquí):**
1. `node tools/apply-sql.mjs sql/040_vehicle_oil_synthetic.sql` — **antes** de publicar (la app 2.5.2 empuja `oil_synthetic`; sin la columna el push de `vehicle` falla). Aditivo, con rollback al final del archivo. Después `npm run types:gen` y `node tools/verify-x-core.mjs`.
2. Release 2.5.2: `tools/release-apk.sh`. La migración v11 es JS, pero la huella nativa ya cambió con Firebase (`releases/fingerprint.json` sigue en 2.5.0) → el gate debe decir "apk"; `tools/ota-gate.cjs` no corre en Windows (`npx` sin shell) — correrlo desde Git Bash con `npx.cmd` o donde publicas. No hay `.env.expo.local`, ni `gh`, ni `.env.supabase`.

### Decisiones tomadas (fase 1)
10. **Rama `imp-16102026-phase-1`** (no `imp-16102026/phase-1…`: git no permite una rama con ese prefijo mientras exista `imp-16102026`).
11. **`dateInputFromIso` respeta las fechas sin hora** — bug real encontrado por el test de ida y vuelta: la fecha de compra retrocedía un día en cada guardado.
12. **Novedades solo en español**: `CHANGELOG.md` no tiene versión en inglés en ningún release anterior (la pantalla de versiones lee ese archivo tal cual); no se creó infraestructura nueva. Los textos nuevos de la app (aviso de ubicación, pasos, "ahora") sí van en es y en.
13. **`distanceInterval: 0`** en el watch de `myPosition` (M-11): un fix por segundo aunque estés quieto, a cambio de algo más de batería con Modo conducir abierto. Verificar en el Redmi.
14. **Pasos de ubicación del iPhone** escritos de memoria (Ajustes › Privacidad y seguridad › Localización › Sitios web de Safari): marcados *no verificados* hasta probarlos en el teléfono; si el texto real difiere, se corrige en `lib/i18n` (`drive.gpsStepsIphone`).
15. **M-9 se re-diagnosticó** (ver `findings.md`); el skeleton de la última tarjeta de Modo conducir se cambió por un placeholder oscuro propio (la regla de "skeleton gemelo" sigue valiendo para pantallas completas).
16. **El Segmented de modo** quedó con `dark`; el resto de `Segmented`/`Chip` se migran a `SelectField` en la fase 3.

### No verificado (fase 1)
- X1 en Safari real; M-11 (punto estático) en el Redmi; que el aviso de iPhone y los pasos se lean bien en el teléfono; la contrastación de etiquetas del mapa nativo.

## Fase 2 — permisos y mapa (2026-10-16)

**Hecho:** registro central `lib/permissions/` (ADR-59), primer antes de cada diálogo, pantalla **Más → Permisos y acceso** (`app/permisos.tsx`), último paso de la bienvenida "Activa lo que necesitas", y el mapa de Modo conducir según ADR-64 (cámara de respaldo, `last_fix`, "Centrar en mí" siempre, errores 1/2/3 con motivo, chip de permiso en la fila de chips). Los M-1, M-3, M-5, M-6, M-7 y M-13 están cerrados (ver `findings.md` → "Estado tras la fase 2"). Docs: `00-context/03-architecture-decisions.md` (ADR-59 y ADR-64), `CHANGELOG.md` (2.6.0 sin publicar).

**Tabla de permisos implementados** (estado por plataforma; Android = APK, iPhone = web/PWA):

| Permiso | Android | iPhone web / PWA | Se pide |
|---------|---------|------------------|---------|
| `location_foreground` | check/request expo-location; aproximada y servicios apagados | Permissions API (+ respaldo `unknown`), códigos 1/2/3; toda negación = bloqueado, con pasos | primer al abrir un chip, al INICIAR (Conducir e Inicio), Zonas privadas, Juntes |
| `location_background` | primer con la divulgación de Play + pasos; Android 11+ abre ajustes | no existe | al elegir Automático (`viajes/permisos`) |
| `notifications` | primer + canal antes del diálogo | no disponible (sin token push en la app) | al activar recordatorios y antes de Automático |
| `camera` | primer, luego `requestCameraPermissionsAsync`, luego `launchCameraAsync` | el navegador (el botón no existe en web) | "Tomar foto" (fotos, perfil) |
| `photos` | primer al tocar el botón (ya no al abrir la pantalla); "algunas fotos" | selector del sistema | Importar de la galería |
| `battery_unrestricted` | estado (módulo MIUI) y botón a la pantalla de batería; `unknown` en APKs viejos | — | fila de Permisos |
| `install_unknown_apps` | no legible: botón a la pantalla del sistema | — | fila de Permisos |
| `storage_persist` | — | `navigator.storage`; fila de Permisos | fila de Permisos (y la petición automática de siempre) |

### Decisiones tomadas (fase 2)
17. **Un solo `usePermissionRequest(id).ensure()`** para todas las pantallas (primer → diálogo / pasos), con `outcome()` para flujos que siguen mientras Android 11+ muestra su página de ajustes.
18. **`unknown` deja intentar** (navegador sin Permissions API, batería en APK viejo): no se bloquea la función; el primer intento lo resuelve.
19. **El primer de segundo plano es la divulgación destacada de Play** (el texto de `welcome.perms.disclosure`), en lugar del Alert que había; ya no hay dos diálogos seguidos.
20. **Android: `services_off` abre la pantalla de ubicación del teléfono** (`LOCATION_SOURCE_SETTINGS`), no la página de la app.
21. **`last_fix`** se guarda en un setting local (no está en la lista de claves sincronizadas) como máximo cada 30 s.
22. **Los módulos nativos del registro se cargan al usarse** (`import()`): lo importa media app y sus pruebas, y `expo-media-library` no carga en jest.
23. **Sin cambio nativo en esta fase**: no se tocó `app.json` ni los permisos declarados (la lista explícita de `android.permissions` queda para la fase 6, con el manifiesto fusionado a la vista). Por tanto este cambio es solo JS: `tools/ota-gate.cjs` decide OTA vs APK (la huella ya cambió con Firebase → APK pendiente); no se publicó nada (sin `.env.expo.local`, sin `gh`).
24. **Recentrar** subió 40 px (no tapa el crédito del mapa). El estado del permiso entró como chip en la fila de chips en lugar de una tarjeta nueva (X6).

### Pruebas (fase 2)
`__tests__/permissions/` 33 pruebas: mapeo de estados por plataforma y códigos de error, el hook (primer antes del diálogo, "Ahora no" no pide, bloqueado muestra pasos, servicios apagados, `unknown`), Chip/Gate/Banner/Row, **re-lectura al volver** (`AppState` y `visibilitychange`), y la prueba de arquitectura (0 llamadas directas fuera de `lib/permissions`). `trips/gpsNotice`, `myPosition` (el watch sigue al permiso), `fallback-camera`. Total: 2 206 verdes de 2 217; los 11 rojos son los de entorno de siempre. Playwright 390×844 con UA de iPhone: capturas `f2-*.png` de prompt → primer → permitir (el navegador no fue consultado antes), ahora no, bloqueado → pasos → volver de ajustes, fix, aproximado, buscando, sin tiles, respaldo con última ubicación y por defecto, y Permisos y acceso.

### No verificado (fase 2)
Ver `findings.md` → "No verificado tras la fase 2": iPhone real (re-pregunta de la PWA, texto exacto de Ajustes, `storage.persist`) y Android real (segundo plano en dos pasos, `services_off`, "algunas fotos", cámara con "no volver a preguntar").
