# PROGRESS — ciclo IMP 16102026

Claude Code actualiza este archivo al terminar cada fase. Aquí no se espera ninguna decisión: lo no definido se resuelve con el default recomendado y se anota en "Decisiones tomadas".

## Estado
| Fase | Estado | Versión / commit | Fecha |
|------|--------|------------------|-------|
| 0 Kickoff y diagnóstico | **✔ hecha** (solo documentación; ningún cambio de producto) | rama `imp-16102026`, commit de la fase 0 | 2026-10-16 |
| 1 Fix pack | **✔ código y pruebas** · pendiente: aplicar `sql/040` y publicar 2.5.2 (sin credenciales en esta máquina) | rama `imp-16102026-phase-1` | 2026-10-16 |
| 2 Permisos y mapa | **✔ código y pruebas** · sin publicar (sin credenciales; ver abajo) | rama `imp-16102026-phase-2` | 2026-10-16 |
| 3 SelectField | **✔ código y pruebas** · sin publicar (sin credenciales) | rama `imp-16102026-phase-3` | 2026-10-17 |
| 4 Herramientas | **✔ código y pruebas** · sin publicar (sin credenciales) | rama `imp-16102026-phase-4` | 2026-10-17 |
| 5 Reparaciones | **✔ código y pruebas** · **`sql/041` sin aplicar** (y `sql/040`) · sin publicar | rama `imp-16102026-phase-5` | 2026-10-17 |
| 6 Regresión y release | **✔ regresión y docs** · release 2.6.0 **preparado, no publicado** (sin credenciales) | rama `imp-16102026-phase-6` (contiene todo) | 2026-10-17 |

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

## Fase 3 — SelectField (2026-10-17)

**Hecho:** un solo componente para elegir un valor (ADR-60): `SelectField` (campo + hoja que se cierra al elegir; búsqueda con más de 8 opciones; "Otro…" y "Ninguno"; rejilla de colores; `MultiSelectField` para varias), `ToggleRow` para los sí/no y `FilterBar` para filtros de lista ("Tipo: Todos ▾" + contador + "Limpiar"). Se migraron los selectores del inventario (`picker-inventory.md`): formularios de vehículo, carga, recordatorio, álbum, build (modificación, deseos, inventario), pista, DIY, memoria, aceite, viajes, juntes, comunidad/perfil/admin, ajustes (tema, idioma, modo de viajes), bienvenida, Modo conducir (vehículo y modo en la hoja; Pasajero como interruptor).

**Filtros migrados a `FilterBar`:** Historial (tipo), Garaje (estado), Viajes (vehículo + mostrar), Pista (vehículo), Inventario de build (tipo). El combustible de Precios y de Cifras ahora es `FuelPicker` (un `SelectField`).

**Interruptores (`ToggleRow`):** Pasajero (Modo conducir), Tanque lleno (carga), Solo reserva (indicador de combustible, 2 sitios), Mapa en línea (ajustes de viajes), y los demás booleanos del inventario.

**Se quedan como pestañas (navegación, no valor)** — lista nombrada en `__tests__/pickers/no-inline-selectors.test.ts`: Ficha/Memoria, Modificaciones/Specs/Wishlist, Amigos/Seguidores/Solicitudes…, Entrar/Crear cuenta, Línea de tiempo/Cuadrícula; los atajos de década del `YearWheel` (acción) y la galería `app/dev/tokens.tsx`. También se quedan, por no ser una elección entre opciones con nombre: la respuesta tri-estado de cada ítem del chequeo (`chequeo/[templateId]/run.tsx`, entrada rápida) y el selector de foto de perfil (`perfil.tsx`, rejilla de imágenes).

### Decisiones tomadas (fase 3)
25. **Rama `imp-16102026-phase-3`**; los cambios de fase 1 y 2 siguen en sus ramas (esta sale de la de fase 2).
26. **"Todos" siempre es la primera opción de un filtro** y es el valor que significa "sin filtro"; el estado vive en la pantalla (sobrevive a volver a la lista) y un cambio es un `setState` — sin recarga ni parpadeo.
27. **Un selector de dos opciones también es `SelectField`** (unidad del tanque, modo de viajes): coherencia sobre un toque menos. Los sí/no son los que usan interruptor.
28. **Conducir**: el vehículo ya no cicla con un toque (no se veía la lista); es un `SelectField dark` en la hoja inactiva, y durante un viaje vehículo y modo quedan como `StatusChip` de solo lectura.
29. **La hoja de reclasificar categoría de una modificación** pasó a `SelectSheet` (misma interacción; ✔ en la categoría actual).
30. **Guarda contra regresión** en vez de una regla de lint: una prueba (`no-inline-selectors`) que falla si una pantalla renderiza `Chip`/`Segmented` fuera de la lista de navegación; y que la lista no se pudra.

### Pruebas (fase 3)
`__tests__/pickers/select-field.test.tsx` (9: el valor se ve y las opciones no hasta abrir; elegir reporta y cierra; el fondo cierra sin cambiar; "Ninguno" elige `null`; números como valor; la píldora del filtro, contador y "Limpiar"; elegir en la hoja; el interruptor) y `no-inline-selectors.test.ts` (2). Total: 2 217 verdes de 2 228; los 11 rojos son los mismos de entorno de siempre (CRLF, rutas de Windows). `tsc` solo los 4 TS2882; lint: 0 errores nuevos en lo tocado (los 3 de `lib/` ya estaban). Capturas 390×844 con UA de iPhone: `screens/f3-*.png` (formulario cerrado, hoja de combustible, tipo, color, filtro de Viajes).

### No verificado (fase 3)
Android real (hojas con teclado, `back` cierra sin cambiar); iPhone real; Historial/Garaje/Pista con datos (las pruebas cubren el componente y el tipado; las capturas de esas pantallas necesitan un garaje con datos); contraste de la píldora activa con el tema claro.

## Fase 4 — Herramientas, atajos, testigos y buscador (2026-10-17)

**Hecho (ADR-62):** registro único de funciones (`lib/features/`: 41 funciones), hub **Herramientas** (`app/herramientas.tsx`, entrada en Más y dos botones en el encabezado de Inicio, esqueleto gemelo), buscador es/en tolerante a errores, fila de atajos en el vehículo, tira de pestañas con degradado y "Todas las secciones" (X4), testigos que abren su función con texto al mantener presionado, testigo **CHECK** (ámbar con un código OBD sin resolver), OBD como "Diagnóstico OBD" (subtítulo, aviso de primera vez, enlace desde Eventos y Tareas vacíos), tarjeta "Descubre" y pointer de 2 pasos a Herramientas. Medición de toques: `feature-map.md` → "Después de la fase 4".

### Decisiones tomadas (fase 4)
31. **Rama `imp-16102026-phase-4`**, sale de la de fase 3.
32. **"Registrar reparación" no queda `hidden`**: ya existe (`/servicio/nuevo?kind=reparacion`, Historial → "+"); el registro la ofrece desde ya y la fase 5 cambia la pantalla, no la entrada.
33. **OBD no exige carro** (`needsVehicle:false`, `passVehicle:true`): buscar un código funciona sin carro; con uno activo se lleva `vehicleId`.
34. **Los testigos abren la acción, no la lista de recordatorios** (SPEC-C): Aceite → registrar servicio, Refrigerante → registrar evento, Batería → registrar reparación, Gomas → Build, Marbete y seguro → Documentos, Chequeo → chequeo, Combustible → echada, CHECK → OBD. Los recordatorios siguen a un toque desde "Pendientes" y a dos desde el hub. El testigo de **Freno** no existe en la tira (no hay datos de freno); GPS/REC/PASAJERO no son testigos de la tira (son chips de Conducir): no se inventaron.
35. **El tour de 2 pasos se muestra a quien ya tiene un carro** y no lo ha visto, no solo a quien actualiza: no hay forma local de distinguir una actualización de una instalación nueva una vez leídas las Novedades. Espera a que se cierre la hoja de Novedades.
36. **Una sola tarjeta de empuje en Inicio** (tour → OBD → Descubre), nunca dos; todo se guarda en `settings` locales (no se sincronizan).
37. **Los cuatro sub-destinos** (Guía de fluidos, Editar el carro, Miembros del garaje, Ajustes de viajes) son funciones del registro para que estén a 2 toques; el resto de pantallas internas se queda como detalle.
38. **Telltales ≥ 44 pt**: `hitSlop` vertical 10 (lámpara 24 pt → 44) y pestañas de 44 pt de alto; el botón de Herramientas/lupa del encabezado es de 36 pt + `hitSlop` 4 (44).

### Pruebas (fase 4)
`__tests__/features/registry.test.ts` (24: guardia rutas ↔ registro, ids con copy es/en, OBD destacada/atajo/testigo, `featureHref`, 9 búsquedas del PROMPT con sinónimos es/en, acentos, errores de tecleo, "nada" sin resultados, profundidad ≤ 2 sobre Inicio/Más/hub) y `surfaces.test.tsx` (9: atajos presentes en orden y navegando con el carro, bordes de la tira y centrado de la pestaña activa, cada testigo resuelve su función y su texto es/en, Descubre salta lo usado/descartado). i18n paridad, esqueleto gemelo del hub. Chromium 390 px: hub, búsqueda "luz del tablero" y "check engine" → Diagnóstico OBD, sin resultados, sin carro ("Elige el carro"), carro creado en la app → atajos y tira a 320/360/390 px.

### No verificado (fase 4)
Android/iPhone reales; la tarjeta Descubre/tour con el estado de Novedades en un teléfono con datos de una versión anterior; el testigo CHECK con un código OBD guardado (cubierto por tipos y por el contador, no por captura); el badge de permiso en el hub en Android.

## Fase 5 — Registrar reparaciones (2026-10-17)

**Qué ya existía:** `ServiceRecord` con `kind='reparacion'`, costos de piezas y mano de obra, taller como contacto, garantía por fecha/km, lista de piezas y una foto; formulario en `app/servicio/nuevo.tsx`; un solo camino (Historial → "+"). **Qué se agregó** (ADR-61): schema **v12** (`lib/db/migrationV12.ts`) y **`sql/041_repairs_done_by_media.sql`** — `done_by`, `system` y la tabla `service_media` (fotos con rol); modo reparación del formulario; cerrar Pendientes con "Deshacer"; "Resolver con una reparación"; entradas (Inicio, Eventos, OBD, Herramientas, atajos); pantalla **Reparaciones**; detalle con quién/taller/fotos por rol/factura/garantía con cuenta regresiva/Pendiente vinculado; costos ("de ellas, reparaciones"), CSV de reparaciones, sección en el libro; aviso de garantía por vencer; datos de prueba.

**SQL:** `sql/041_repairs_done_by_media.sql` está **escrito, NO aplicado** (sin credenciales de Supabase en esta máquina). Es aditivo (2 columnas y 1 tabla en `carguy`), re-ejecutable, con RLS de miembros como `part`, y con el rollback al final. **Aplicar con `node tools/apply-sql.mjs sql/041_repairs_done_by_media.sql` (y `sql/040` antes) ANTES de publicar la app**; después `npm run types:gen` (los tipos de `lib/cloud/database.types.ts` se editaron a mano, igual que lo que generará) y `node tools/verify-x-core.mjs`. El escenario de RLS `tools/local-rls/scenario_041.sql` está enganchado en `run.sh` pero **no se corrió**: no hay PostgreSQL local (el script es de Linux/WSL).

### Decisiones tomadas (fase 5)
39. **Rama `imp-16102026-phase-5`**, sale de la de fase 4. Versión de esquema local 12.
40. **`service_record.system` (columna nueva) además de `done_by`**: el PROMPT pide "sistema afectado" y no había dónde guardarlo (una reparación no lleva ítems del catálogo, que reiniciarían recordatorios). Es una categoría de servicio (`motor`, `frenos`, …), nullable.
41. **Las fotos conservan su dueño (`media.owner_*`) y ganan un enlace con rol** (`service_media`); no se tocó `media`. Los lectores usan los enlaces y suman las fotos solo-dueño como "Otras" (un teléfono viejo que sincroniza, el formulario de mantenimiento con su foto única).
42. **El formulario de mantenimiento/mejora no cambió** (foto única, mismos campos); solo el tipo "reparación" entra al modo nuevo. Sin selector de tipo en modo reparación (el detalle reclasifica, ahora con `SelectField`).
43. **"Yo mismo" borra taller y mano de obra al guardar** (no solo los oculta): un registro propio nunca arrastra el texto de un taller.
44. **Un Pendiente es un evento con `pending` o una tarea abierta**; si la tarea ya es la `sourceTaskId` de la reparación, se cierra una vez y no se ofrece deshacer.
45. **Garantía rápida cuenta desde la fecha de la reparación y la sigue** si se edita la fecha; "Otra…" abre fecha y km. Aviso local **7 días antes** (si ese momento ya pasó, solo queda el distintivo dentro de la app con el botón de permitir notificaciones).
46. **OBD → "Nueva reparación con este código" abre el formulario** (con título `Código P0301` y el vínculo al guardar) en vez de crear un registro vacío; `createRepairForDtc` queda sin uso en pantallas.
47. **El libro del carro incluye la sección Reparaciones; la página pública no** (nombres de talleres y costos no salen sin que el dueño los pida: el interruptor de costos de la página gobierna solo lo que ya mostraba).
48. **"De ellas, reparaciones"** es una línea informativa (no una cubeta nueva): `mantenimiento` sigue sumando reparación + mantenimiento para no mover las cifras de nadie.
49. **Datos de prueba**: una reparación propia (AE85) y una de "Taller de ejemplo" sin teléfono con garantía vigente (DS3), solo en `lib/dev/garage.ts`; los totales fijados en las pruebas del sembrado se actualizaron (AE85 461 186,40).

### Pruebas (fase 5)
`migrate-v12` (5: columnas y CHECKs, backfill de `done_by`, fotos → enlaces con id derivado, sin bump de `updated_at`), `repairs` (10: `done_by`/`system`, enlaces con rol y reemplazo, cerrar un evento y una tarea, **deshacer**, solo-una-vez con `sourceTaskId`), `repairs-sync` (5: orden de sync, bajar a otro teléfono, fila de un teléfono viejo, enlace que llega antes que su registro, subir en forma de nube), `domain/repairs` (10: garantía, lista, filtros, resumen por taller), `service/repair-pieces` (10: garantía rápida y "Otra…", ranuras ↔ enlaces, selector de Pendiente), `export/repairs` (6: costos, CSV, libro), notificaciones de garantía (3), paridad de esquema y de `updated_by` con `sql/041`, y las pruebas de versión (12). Total: 2 301 verdes de 2 315 antes de actualizar el sembrado; ver el cierre abajo. Chromium 390 px con UA de iPhone: formulario propio y de taller, hoja de quién/garantía, detalle, lista y hub (`screens/f5-*.png`), con un carro creado en la propia app.

### No verificado (fase 5)
SQL 041 contra PostgreSQL (ni aplicado ni el escenario de RLS); el CHECK de `ALTER TABLE ADD COLUMN` en `expo-sqlite` nativo y en el wasm de la web (la prueba corre en `node:sqlite`; la web se construyó y el formulario guardó una reparación en Chromium, que sí usa el wasm); fotos reales (el selector del navegador no se automatizó: las ranuras y los enlaces están probados por unidades); el aviso de garantía en un teléfono; sincronizar con la nube real; el comparador antes/después con dos fotos; "Resolver con una reparación" desde las tarjetas en el navegador (cubierto por `repairs.test.ts`).

## Fase 6 — Regresión y release 2.6.0 "Kōbō" (2026-10-17)

**Hecho:** trazabilidad N1–N9 y X1–X7 contra evidencia (`VERIFICACION.md`: nada en rojo; lo que depende del teléfono, de la nube o de credenciales está marcado), regresión completa, revisión cruzada a–e, ADR-59…64 completos (`00-context/03-architecture-decisions.md`), versión **2.6.0** (`package.json`, `package-lock.json`, `app.json`), `CHANGELOG.md` y `lib/changelog.generated.ts`, checklist manual y esta lista de ideas.

**Arreglado en esta fase (lo encontró la revisión, no estaba pendiente de antes):**
- El tipo del formulario de servicio ("Tipo": mantenimiento / reparación / mejora) y el "Reclasificar" del detalle eran filas de `Pressable` hechas a mano: la guarda de la fase 3 solo veía `Chip`/`Segmented`. Ahora son `SelectField`, y **la guarda también falla con un grupo de `Pressable` de rol tab/radio** fuera de una lista nombrada.
- "¿Aceite sintético?" y "Se me olvidó registrar una carga anterior" eran casillas a mano: ahora son `ToggleRow` (booleano → interruptor, ADR-60).

### Regresión
- `tsc`: solo los 4 TS2882 de siempre. `eslint`: 0 errores nuevos (los 3 errores de `lib/` —`shareQueries`, `tireStats`, `gaugeSweep`— ya estaban en `main`).
- `jest` completo: **2 324 verdes de 2 335**; las 11 rojas son las de entorno de la línea base de este equipo (4 de archivos legales generados y 1 del changelog por CRLF, 2 de `delete-vehicle` y 1 de `album` por `node:sqlite` en Windows, 3 de `skeletons` por el glob de `git ls-files`). Ninguna es del ciclo.
- Paridad es/en ✔ · guarda de pickers (13) ✔ · guarda del registro de funciones (24) ✔ · ida y vuelta del vehículo ✔ · skeletons: el glob de la prueba no corre en Windows; se revisó a mano que el hub, Reparaciones y las demás pantallas nuevas renderizan su gemelo.
- Build web ✔. Capturas a **320, 360 y 390 px** de Inicio, Vehículo (Resumen, Build, Eventos), Editar vehículo, Modo conducir, Herramientas, Permisos y Reparaciones: `04-tracking/screens/regresion/` — **sin desborde horizontal en ninguna** (comprobado por script).
- N5 de punta a punta en el navegador (wasm real): marcar → guardar → recargar la página → sigue marcado.

### Revisión cruzada (detalle en `VERIFICACION.md`)
a) ningún `SelectField` rompe valores guardados · b) el sync no pisa valores nuevos (prueba nueva: una fila de la nube sin `oil_synthetic`/`done_by`/`system` no los borra) · c) reparación offline ✔; **RLS pendiente de correr** · d) cada permiso tiene salida (prueba nueva `permissions/way-out.test.ts`, 16) · e) no queda selección en línea fuera del picker.

### Release 2.6.0 — preparado, NO publicado
Es un release **nativo (APK)**: la huella ya cambió con Firebase (`releases/fingerprint.json` sigue en 2.5.0) y el ciclo trae permisos y migraciones nuevas. Lo que falta, y por qué no se hizo aquí:
1. **Aplicar el SQL en `x-core`** (sin credenciales en esta máquina): `node tools/apply-sql.mjs sql/040_vehicle_oil_synthetic.sql` y luego `…/041_repairs_done_by_media.sql`; `npm run types:gen`; `node tools/verify-x-core.mjs`. **Antes de publicar.** (`local-rls` ya corrió completo el 2026-10-18 en PostgreSQL 16 de WSL — instalado con `apt` como root en Ubuntu-24.04 —, con 040 y 041 aplicados dos veces; `apply-sql.mjs` se arregló para Windows y su dry-run de ambos pasa.)
2. **Construir y publicar el APK** con `bash tools/release-apk.sh --publish` desde WSL/Linux: necesita `.env.expo.local` (token de EAS), `~/Android/Sdk` y `gh` — nada de eso existe en esta máquina Windows. El script comprueba la firma (`a16450a0`), `versionName`, el bundle con la nube, y al final `node tools/ota-gate.cjs record 2.6.0` actualiza `releases/fingerprint.json` (hay que commitearlo). Antes de correrlo, cambiar el encabezado del CHANGELOG de `(sin publicar)` a la fecha de ese día (el script lee la sección `## 2.6.0 `).
3. **Web (Vercel):** se despliega al hacer push/merge a `main` de este árbol; el build web local pasó. Verificar `car-guy.vercel.app` tras el merge.
4. **Llave FCM** (pendiente de ciclos anteriores): subirla a expo.dev.
5. Después del APK, los cambios solo de JS salen por `--ota` (`tools/ota-gate.cjs` no corre en Windows: usar Git Bash/WSL).
Las ramas de fase están apiladas (`imp-16102026-phase-1 → … → phase-6`, cada una sale de la anterior): **la 6 contiene todo**; falta decidir el merge a `main` (PR o fast-forward).

### Decisiones tomadas (fase 6)
50. **Versión 2.6.0** (no existía): `2.5.2` nunca se publicó por separado; sus notas quedan en su sección del CHANGELOG y llegan igual en las Novedades de quien venga de 2.5.1.
51. **El encabezado del CHANGELOG queda "(sin publicar)"** hasta el día del release: el script de release no escribe la fecha y publicar con una fecha inventada sería peor.
52. **No se publicó ni se simuló nada**: sin `gh`, sin `.env.expo.local`, sin `x-core`. Todo lo demás del release está listo y probado.
53. **Los booleanos que seguían siendo casillas a mano pasan a `ToggleRow`**; las casillas de consentimiento legal, de selección múltiple de fotos y del chequeo siguen siendo casillas (no son un ajuste).

### Ideas para el próximo ciclo (quedaron fuera)
- **Wake Lock en iPhone** (pantalla encendida en Modo conducir) y **Web Push en la PWA** (avisos de recordatorios y garantías sin la app abierta; iOS 16.4+).
- **Aviso de garantía y recordatorios también para iPhone**: hoy las notificaciones locales son solo Android; en la PWA queda el distintivo dentro de la app.
- **Fotos de una reparación: retirar el `media` huérfano** al quitar una foto (hoy solo se borra el enlace).
- **Mano de obra sugerida** cuando el taller repite (el último precio de ese taller), y "otros costos" en la reparación.
- **Testigos de freno / presión de gomas** si algún día hay datos (hoy no existen, el mapa de SPEC-C los listaba).
- **Escenarios de RLS en CI** (PostgreSQL en un contenedor) para que `local-rls` no dependa de WSL.
- **Declarar `*.css` para `maplibre-gl`** (los 4 TS2882 de siempre) y arreglar los 3 errores de lint de `main`.
- **Filtros de Historial/Garaje/Pista con datos reales en capturas**: hoy solo están cubiertos por pruebas del componente.
- **Un script que mida los toques por función con datos reales** (hoy se mide por estructura + Chromium sin datos).
