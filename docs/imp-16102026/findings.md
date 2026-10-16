# Hallazgos — Fase 0 (2026-10-16)

Leyenda de "va en": **F1** = no depende del sistema de permisos, se corrige en el fix pack (PROMPT-01) · **F2** = depende del registro de permisos o de la matriz de estados de SPEC-A (PROMPT-02).
Evidencia = `archivo:línea` o captura en `04-tracking/screens/f0-*.png`. Las capturas son de Chromium a 390×844 @2x con el UA de iPhone/iOS 18 (no WebKit real) y el permiso simulado; sirven para la lógica de la app, no para el comportamiento del diálogo de Safari (ver "No verificado").

## Cómo se reprodujo (N1)
Playwright (`playwright-core` + Chromium instalado, fuera del repo) contra el build web (`dist/`), página `/conducir`, `locale es-DO`, `isMobile`, `hasTouch`. Estados simulados: `granted` con fix (geolocalización 18.4861, −69.9312, ±10 m), `granted` sin fix (el navegador nunca responde), `denied` (error código 1 y `permissions.query` = `denied`), `prompt` (`permissions.query` = `prompt` y el diálogo nadie lo contesta), sin red de tiles (se aborta `tiles.openfreemap.org`).

| Caso | Texto en el mapa | Cámara | Captura |
|------|------------------|--------|---------|
| granted + fix | — (punto "?" del avatar, centrado) | sigue al usuario | `f0-granted_fix.png` |
| granted sin fix | "Buscando GPS…" (pastilla, sin botón) | `HOME` fijo (una calle cualquiera de Santo Domingo) | `f0-granted_nofix.png` |
| denied | "Sin permiso de ubicación: el mapa no sabe dónde estás." (pastilla, sin botón) | `HOME` fijo | `f0-denied.png` |
| **prompt** (nunca se preguntó) | **"Sin permiso de ubicación…"** (idéntico a `denied`) | `HOME` fijo | `f0-prompt.png` |
| sin tiles | "Sin mapa en línea: el viaje se graba igual." | caja negra vacía | `f0-no_tiles.png` |

La captura del iPhone de Xaviel (11:19) es el caso `prompt`: **la app nunca le preguntó y le dice que "no hay permiso"**.

---

## Defectos del mapa (N1)

### M-1 — "Nunca se preguntó" se muestra como "Sin permiso" · F2
- **Evidencia:** `lib/trips/myPosition.ts:71-75` — `start()` solo hace `getForegroundPermissionsAsync()`; si `!perm.granted` (incluye `undetermined`/`prompt`) pone `status: 'denied'` y retorna, sin pedir nada. `app/conducir.tsx:143-144` traduce `status==='denied'` a `t.drive.gpsDenied`. Captura `f0-prompt.png` = `f0-denied.png`.
- **Impacto:** quien abre Modo conducir por primera vez ve "Sin permiso" sin que nadie le haya preguntado. Es exactamente la pantalla de referencia de Xaviel.
- **Fix:** el registro distingue `undetermined` de `denied_can_ask`/`denied_blocked`; con `undetermined` el mapa muestra "Activar ubicación" (primer → diálogo), no "sin permiso". (SPEC-A matriz; ADR-59, ADR-64.)

### M-2 — El aviso es texto pasivo y no hay salida desde el mapa · F1 (botón mínimo) + F2 (flujo completo)
- **Evidencia:** `app/conducir.tsx:399-405` — una `View` con `T`, sin `onPress`; no hay `PermissionChip`. "Centrar en mí" solo aparece después de **arrastrar** el mapa (`components/map/LiveMap.web.tsx:130`, `components/map/LiveMap.tsx:83`: `follow && !tracking`); sin fix o sin haberlo movido no hay botón.
- **Impacto:** Xaviel no puede hacer nada desde donde ve el problema (N3).
- **Fix F1:** convertir la pastilla en botón que, con un toque (gesto del usuario), pide el permiso o, si no se puede preguntar, abre ajustes / muestra pasos (PROMPT-01 ya lo pide). **F2:** reemplazarlo por `PermissionChip` con la matriz completa y "Centrar en mí" siempre visible cuando haya fix.

### M-3 — El permiso se pide recién en INICIAR VIAJE y el mapa no se entera · F2
- **Evidencia:** el único pedido en frío del flujo es `lib/trips/live.ts:58-60` (`ensurePermission()` desde `startManualTrip`, llamado en `app/conducir.tsx:154`). `useMyPosition` solo evalúa el permiso al montar y al volver a `active` (`myPosition.ts:67-75`, `106-116`); si se concede dentro de `startManualTrip`, `myPosition` sigue en `denied` hasta que la app pase a segundo plano y vuelva → el punto del usuario no aparece mientras se graba el primer viaje.
- **Impacto:** la copia de `t.drive.webManual` ("el navegador te pide la ubicación al iniciar", `lib/i18n/es.ts:3562`) describe el problema: se pregunta tarde, sin explicación, y la UI no se actualiza.
- **Fix:** pedir al abrir Modo conducir con primer; `useMyPosition` reacciona al cambio de permiso (suscripción a `permissions.onchange` en web, recheck tras `request()` en nativo). (ADR-59/64.)

### M-4 — Un fix "aproximado" nunca se muestra: "Buscando GPS…" para siempre · F1
- **Evidencia:** `lib/trips/myPosition.ts:62-63` — un fix con precisión > 50 m (`freshness.ts:16-17`, `GOOD_ACC_M = 50`) solo llena `approx`, y `approx` **no lo usa ninguna pantalla** (`git grep "\.approx"` en `app/` y `components/` = 0 usos). `app/conducir.tsx:141-144`: sin `pos.fix`, `gpsLine` cae a `t.drive.gpsSearching`. `LiveMap` solo recibe `me` desde `pos.fix` (`conducir.tsx:142`).
- **Impacto:** en interiores/PWA de iPhone (primeros fixes de 65 m o peores, ver `webGeo.ts`) el mapa no se mueve y no avisa por qué. Si solo llegan fixes gruesos, nunca sale de `HOME`.
- **Fix:** dibujar el halo gris de `approx` y centrar la cámara en él (sin seguirlo como "fresco"), con texto "Ubicación aproximada (±N m)". Test sobre `acceptLocation` + componente.

### M-5 — Los errores de geolocalización no se distinguen (códigos 1 / 2 / 3) · F2 (clasificación) con texto mínimo en F1
- **Evidencia:** (a) `myPosition.ts:88-91` y `94-97` convierten cualquier error en `status: 'error'`, y `conducir.tsx:144` lo pinta como "Buscando GPS…" (no hay rama para `error`). (b) El shim web de expo-location solo entrega el **mensaje** del error al callback (`patches/expo-location+57.0.20.patch`: `reason: error.message || 'geolocation error N'`), nunca el código. (c) `node_modules/expo-location/build/ExpoLocation.web.js:75-90` — `getPermissionsAsync(true)` colapsa los códigos 2 (no disponible) y 3 (tiempo agotado) en `{status: GRANTED, granted: false}`, y `live.ts:61` lo interpreta como `reason: 'permission'` → alerta "permiso denegado" para un problema de señal. (d) Safari < 16 no tiene `permissions.query`: `getPermissionsAsync` lanza `UnavailabilityError` (`ExpoLocation.web.js:45-47`) → `status: 'error'` → "Buscando GPS…".
- **Impacto:** el usuario con señal débil, servicios de ubicación apagados o Safari antiguo ve "Buscando…" o "sin permiso" erróneamente, sin "Reintentar".
- **Fix:** capa propia `readGeoError(code|message)` → `denied | unavailable | timeout`; en iOS, código 1 puede ser servicios de ubicación apagados (SPEC-A); "Reintentar" tras 15 s.

### M-6 — En web "denegado" siempre dice que se puede volver a preguntar · F2
- **Evidencia:** `ExpoLocation.web.js:56-62` devuelve `canAskAgain: true` para `denied` (y siempre en todas las ramas); `components/trips/TripPieces.tsx:134-155` (`useLocationPermission.ask`) y `app/viajes/permisos.tsx:134` deciden "Abrir ajustes" solo si `!canAsk && Platform.OS !== 'web'`.
- **Impacto:** en el iPhone con permiso bloqueado el botón "Permitir ubicación" no hace nada (el navegador no vuelve a preguntar) y la app no explica los pasos.
- **Fix:** estado `denied_blocked` en web = `permissions.query === 'denied'`; ahí se muestran los pasos exactos (SPEC-A) y "Ya la activé" → recheck.

### M-7 — Cámara de respaldo fija y arbitraria · F2
- **Evidencia:** `components/map/LiveMap.web.tsx:14,53` y `components/map/LiveMap.tsx:13,36` — `HOME = [-69.93, 18.47]` (comentario "Santo Domingo, until the first fix"), zoom 16, pitch 45, sin última posición conocida ni centro de viajes recientes. En `f0-granted_nofix.png`/`f0-prompt.png` el mapa muestra una calle cualquiera a zoom de barrio.
- **Impacto:** sin permiso (o antes del primer fix) el mapa "se ve roto": enfocado a una esquina sin significado.
- **Fix:** cadena de respaldo de ADR-64: última posición guardada (con "hace X") → centro de viajes recientes → Santo Domingo (18.4861, −69.9312) a zoom ciudad (~12–13), sin inclinación. Guardar la última posición buena (clave en `settings`).

### M-8 — Sin estilo o sin tiles: caja negra vacía; falla silenciosa tras cargar · F1
- **Evidencia:** `components/map/LiveMap.tsx:44` (`if (!style.url) return <View style={styles.fill} />`) y `LiveMap.web.tsx:122-125` (la caja queda vacía); captura `f0-no_tiles.png`. La documentación dice "los mapas muestran el mosaico OSM sin mapa en línea" (`lib/map/config.ts:4`, `app/viaje/[id].tsx:40`, `app/viajes/index.tsx:33`), pero **Modo conducir no lo hace**. Además `components/map/webMap.ts:213-215` ignora los errores de mapa después del primer `load` (tiles que dejan de cargar a mitad de camino no avisan).
- **Impacto:** viaje a una zona sin datos o red lenta: pantalla negra con una frase; "el mapa no sirve".
- **Fix:** en Modo conducir mostrar el mosaico estático/coordenadas y el trazo propio cuando no hay estilo; avisar "Sin mapa en línea" también si los tiles dejan de cargar (contar errores `source`/`tile`), con "Reintentar" que limpia `markMapStyleFailed`.

### M-9 — El interruptor de modo de la hoja oscura usa el tema claro: bloque blanco ilegible · F1
- **Evidencia:** `app/conducir.tsx:295` usa `Segmented` de `components/ui/index.tsx:220-260`, que lee `useTheme()` (el tema de la app); la hoja de Modo conducir es **siempre oscura** (`conducir.tsx:34`, `ink = palette.dark`). Con tema claro (sistema claro o preferencia clara) el `Segmented` se pinta con `theme.bg.raised` blanco y texto `theme.text.muted` → en las capturas `f0-*.png` es un rectángulo blanco sin etiquetas legibles bajo "VER VIAJES →". El `Chip` local de ese archivo (`conducir.tsx:420`) sí usa `ink`; el `Segmented` no.
- **Impacto:** Xaviel no ve las opciones de modo (Automático / Manual / Apagado). Al pasar a `SelectField` (fase 3) hay que pasarle tema oscuro explícito.
- **Fix:** `Segmented`/`SelectField` aceptan un tema (`dark`) o el contenedor oscuro provee un `ThemeProvider` oscuro (como ya hacen `TipCard dark` e `IosWebBanner dark`).

### M-10 — La hoja ocupa ~62 % de la pantalla; el mapa queda en una franja · F1 (con X6)
- **Evidencia:** `conducir.tsx:227` `maxHeight: height * 0.62`; en reposo apila `TipCard` (`:232`), `IosWebBanner` (`:233`), chips, tarjeta del último viaje, "VER VIAJES →", interruptor de modo, texto web, botón INICIAR y descargo. En `f0-granted_fix.png` el mapa visible mide ≈ 320 px de 844; el aviso de GPS flota justo encima del centro del mapa (`top: insets.top + 170`).
- **Impacto:** "el mapa es la pantalla" (docstring de `conducir.tsx:43-52`) deja de ser cierto en el iPhone; con teclado/landscape aún peor. La tarjeta "En iPhone (web)…" ocupa ≈ 150 px con un hueco (X6).
- **Fix:** hoja plegable (altura mínima = chips + INICIAR), `TipCard`/`IosWebBanner` colapsados tras la primera vez, aviso del mapa anclado al borde superior de la hoja.

### M-11 — El punto se "apaga" si estás quieto (no verificado en dispositivo) · F1
- **Evidencia (por lectura):** `myPosition.ts:82-87` pide `distanceInterval: 2` y `timeInterval: 1000`; `freshness.ts:15` `MAX_FIX_AGE_MS = 15 s` y `conducir.tsx:141` calcula `meFresh` con la edad del último fix. Si el dispositivo está detenido y no emite fixes nuevos (Android respeta `distanceInterval`; el watch de Safari solo notifica cuando hay cambio o según el sistema), a los 15 s el punto pasa a gris, la cámara deja de seguirlo y aparece "Última posición: hace N s" (`es.ts:3539`).
- **Impacto probable:** parado en un semáforo o con el carro estacionado el mapa dice que perdió el GPS.
- **Fix:** distinguir "watch vivo, sin movimiento" de "sin señal" (latido con `getCurrentPosition` cada ~10 s cuando está quieto, o aceptar fix si el watch lleva < 30 s sin error). Verificar primero en el Redmi con `adb logcat` (ver "No verificado").

### M-12 — Legibilidad: inclinación 45° y etiquetas de calles rotadas · F1
- **Evidencia:** `LiveMap.web.tsx:53` (`pitch: 45`), `LiveMap.tsx:38,65` (`pitch: 45`, `bearing` = rumbo cuando se sigue). En `f0-granted_fix.png` las etiquetas "AVENIDA LOPE DE VEGA", "CALLE 51", "AVENIDA TIRADENTES" salen giradas/verticales y con poco contraste (gris sobre `#0B0F14`); el estilo `dark` de OpenFreeMap no se retoca (`lib/map/config.ts:16`). La consola de la página registra `Image "wood-pattern" could not be loaded` (el estilo referencia una imagen que no trae; inofensivo pero ruido).
- **Impacto:** "las etiquetas de calles giran de forma rara" y el mapa oscuro es difícil de leer con sol.
- **Fix:** pitch 0 por defecto en web y mientras no haya fix (solo 45° en navegación nativa con rumbo), subir contraste de `text-color`/`text-halo-color` de las capas `symbol` en `load`, y `text-rotation-alignment: viewport` solo para puntos de interés.

### M-13 — "Centrar en mí" no existe como acción explícita y el seguimiento se corta con cualquier gesto · F2
- **Evidencia:** `LiveMap.web.tsx:58` (`dragstart` → `setTracking(false)`), `LiveMap.tsx:57-59`; el botón solo reaparece tras arrastrar (ver M-2). Sin `me` el seguimiento ni siquiera existe (`LiveMap.web.tsx:106` sigue la punta del trazo, no al usuario).
- **Fix:** botón "Centrar en mí" visible siempre (deshabilitado sin fix, que lleva a M-1/M-4), `follow` tras un toque.

### Resumen de defectos del mapa
| Id | Defecto | Va en |
|----|---------|-------|
| M-1 | `prompt` mostrado como "Sin permiso" | F2 |
| M-2 | aviso pasivo, sin botón; sin "Centrar" | F1 + F2 |
| M-3 | permiso pedido al iniciar viaje; la UI no se entera | F2 |
| M-4 | fix aproximado nunca se dibuja ("Buscando GPS…" eterno) | F1 |
| M-5 | errores 1/2/3 no se distinguen; web colapsa 2 y 3 en "denegado" | F2 (+ texto F1) |
| M-6 | web: `canAskAgain` siempre `true` | F2 |
| M-7 | cámara fija `HOME`, sin cadena de respaldo | F2 |
| M-8 | sin tiles/estilo: caja negra; sin mosaico; falla silenciosa | F1 |
| M-9 | interruptor de modo ilegible con tema claro | F1 |
| M-10 | hoja ocupa 62 %; aviso sobre el mapa | F1 |
| M-11 | punto se apaga estando quieto (sin verificar) | F1 |
| M-12 | pitch 45° y etiquetas rotadas/poco contraste | F1 |
| M-13 | "Centrar en mí" ausente/oculto | F2 |

Fase 1 cierra M-4, M-8, M-9, M-10, M-11, M-12 y el botón mínimo de M-2; fase 2 el resto.

---

## N5 — Aceite sintético "siempre sale sin marcar": causa raíz

La casilla **no es un campo del vehículo**. Cuatro hechos en el código, ninguno es de sync ni de nativo-vs-web:

1. **No existe columna.** `git grep -n "synthetic" -- lib/db` solo encuentra `vehicleOps.ts:170,186-203` y ninguna migración (v1–v10) crea `synthetic`/`oil_synthetic` en `vehicle`; el tipo `Vehicle` (`lib/db/types.ts:24+`) no lo tiene.
2. **Solo se aplica al crear, y con un efecto indirecto.** `lib/db/vehicleOps.ts:168-170`: `if (isNew) { await seedVehicleDefaults(saved.id); if (draft.synthetic) await applySyntheticOil(saved.id); }`. `applySyntheticOil` (`:191-205`) estira el recordatorio `aceite_motor` a 10 000 km / 12 meses; no guarda el booleano en ningún sitio. En un vehículo **existente** marcar la casilla no hace nada (ni guarda ni toca el recordatorio).
3. **El editor nunca la carga.** `app/vehiculo/[id]/editar.tsx:36-86` arma `initial` con todos los campos del vehículo **menos `synthetic`**; `components/VehicleForm.tsx:137` hace `useState(initial?.synthetic ?? false)` → siempre `false`.
4. **El tipo de borrador lo permite.** `VehicleDraft.synthetic: boolean` (`VehicleForm.tsx:47`) es obligatorio, por eso el formulario siempre lo manda y el guardado lo ignora en ediciones.

Comprobación genérica: de los campos de `VehicleDraft`, `synthetic` es el **único** que `editar.tsx` no hidrata (diff de claves del borrador contra las del `setInitial`), y el único que `saveVehicleDraft` consume fuera del `upsert` del vehículo. El resto sí hace ida y vuelta, con dos matices menores que el test genérico de la fase 1 debe cubrir: `tankVolume`, `odometerKm` y `purchasePrice` usan `initial?.x ? String(x) : ''` (un `0` guardado reaparece vacío: `VehicleForm.tsx:128-130,139`).

**Fix (fase 1):** columna `vehicle.oil_synthetic INTEGER NOT NULL DEFAULT 0` (schema v11 + `sql/040_vehicle_oil_synthetic.sql`, aditivo, con rollback), campo `oilSynthetic` en `Vehicle`, `editar.tsx` lo hidrata, `saveVehicleDraft` lo escribe y **al cambiarlo** (crear o editar) estira o restaura el recordatorio `aceite_motor`; backfill: vehículos con un `aceite_motor` cuyo `interval_km = 10000` y `notes = t.oil.syntheticNote` → `1`. Test: falla primero (marcar → guardar → reabrir → vacío), luego guardar ✔ → reabrir ✔ → push/pull ✔; más el test genérico de ida y vuelta de `VehicleDraft` ↔ fila ↔ `editar`.

---

## Extras de las capturas (X1, X2, X3, X5)

| Id | Veredicto | Evidencia / causa | Va en |
|----|-----------|-------------------|-------|
| **X1** Fecha de compra desbordada | **Probable, no reproducible en Chromium** | A 390 px Chromium la deja en x 201–370 (no desborda; `scrollWidth = innerWidth`). Falta `minWidth: 0` en la fila de dos campos: `components/VehicleForm.tsx:474-475` (`pair`/`half: {flex: 1}`) y `components/DateField.web.tsx:32-60` (`<input type="date">` con `width: 100%`, padding 16 px + `boxSizing: border-box`); Safari iOS da al `date` un ancho intrínseco mayor que Chromium y un ítem flex sin `min-width: 0` no se encoge. Filas de dos campos con `DateField`: `VehicleForm.tsx:407` (compra) y `:428` (Desde, estado); verificar `juntes/nuevo.tsx:75`. | F1 (test a 320 px + verificar en iPhone) |
| **X2** "hace 0 s" partido | **Confirmado** | `lib/trips/autoStatus.ts:26-30` `agoShort(0)` devuelve `"0 s"`; `lib/i18n/es.ts:381` `tankAgo: hace ${ago}`; `components/fuel/TankLine.tsx:35-43` une las partes con `' · '` en un `T face="mono"` que permite salto de línea: el espacio de `"hace 0 s"` es un punto de corte. Fix: `agoShort` devuelve "ahora"/"now" bajo 5 s y usa espacios no separables (` `) en `hace N s`. | F1 |
| **X3** Swatch "Negro" invisible | **Confirmado** | `lib/domain/refdata/colors.json`: `negro` y `interior-negro` = `#111111` sin `light`; `components/pickers/SwatchGrid.tsx:61` pinta `borderColor: 'transparent'` salvo si `s.light` o está elegido, sobre fondo `#121212` → círculo invisible (captura `f0-form_swatch_dark.png`, exterior e interior). Además las etiquetas largas se truncan ("Marrón / Ca…", "Vino / Burd…", `SwatchGrid.tsx:66`). Fix: borde `theme.lineStrong` siempre en swatches oscuros (luminancia < 0.12) y etiquetas a dos líneas. | F1 y F3 |
| **X5** "875,000" en gris | **Descartado como valor guardado** | Es un `placeholder` literal: `components/VehicleForm.tsx:400` `placeholder="875,000"` (no un valor con estilo de vacío; el valor real sale de `initial?.purchasePrice` en `:139`). Pero el placeholder parece un dato real; cambiarlo a un ejemplo claro ("Ej. 875,000") o quitarlo, y que un `purchasePrice = 0` no se vea vacío (misma familia que N5, solo hidratación). | F1 |

X4 (pestañas cortadas) y X6 (hueco de "¿Por qué?") ya están anotados: X4 en `feature-map.md` (el `ScrollView` horizontal de `app/vehiculo/[id].tsx:314`; se verifica a 390 px en la fase 4), X6 en M-10.

---

## No verificado (pasa a `PROGRESS.md` y al checklist manual)
- **Safari/PWA de iPhone real:** si "No permitir" se puede volver a preguntar, si la PWA vuelve a preguntar en cada apertura, el texto exacto de Ajustes → Privacidad → Localización, y el comportamiento del watch parado (M-11). Todo lo visto aquí es Chromium emulando iPhone.
- **Redmi/Android:** sin dispositivo en adb no se hizo `adb logcat` ni `adb shell dumpsys package com.xaviel.carguy | grep -i permission`. Pendiente: matriz fg/bg, MIUI autoarranque, optimización de batería (cruza con fase 2).
- **X1** en WebKit real (ver arriba).
- **Docs de Expo v57** (expo-location/notifications): no se leyeron en esta fase (no se escribió código); las fases con permisos deben leerlos primero.

---

## Estado tras la fase 1 (2026-10-16)

| Id | Estado | Cómo se probó |
|----|--------|---------------|
| N5 aceite sintético | **corregido** (columna `oil_synthetic`, v11, `sql/040`; el editor la lee; marcar/desmarcar mueve el recordatorio en ambos sentidos) | `__tests__/db/vehicle-roundtrip.test.ts` (falló antes: `synthetic` volvía `undefined`), `domain/oilInterval.test.ts`, `db/migrate-v11.test.ts` |
| ADR-63 (otros campos) | **un campo más fallaba: la fecha de compra** (y "desde" del estado) retrocedía **un día en cada apertura+guardado** del editor en Santo Domingo (UTC-4): el formulario guarda `YYYY-MM-DD` y `dateInputFromIso` lo leía como instante UTC | `__tests__/domain/dateInput.test.ts` (TZ America/Santo_Domingo) y el round-trip de todos los campos (nativo/SQLite, push y pull) |
| X1 | **defensivo**: `minWidth: 0` en las 6 columnas `half` y en 31 columnas inline de dos campos (Inventario, Mod, Wishlist, Pista, Juntes) + `minWidth/maxWidth` en el `<input type=date>` web. Chromium a 320/360/390 no desbordaba antes ni después (script de medición sobre 15 formularios); la causa en Safari sigue sin verificar | `04-tracking/screens/f1_purchase_row_320.png` / `_390.png`; **verificar en el iPhone** |
| X2 | **corregido** (`agoText`: "ahora", "hace 12 s", "hace 5 min", "hace 2 h", "ayer", "hace 3 d", es/en; espacios de no separación; la línea del tanque solo parte en ` · `) | `__tests__/domain/relativeTime.test.ts` |
| X3 | **corregido** (contorno ≥ 3:1 en todo swatch que no contraste; etiquetas a dos líneas) | `__tests__/domain/contrast.test.ts` (todos los colores, dos temas) + `f1_swatch_after.png` |
| X5 | **corregido** (placeholder "Ej.: 875,000"; un `0` guardado ya no reaparece vacío) | round-trip + revisión |
| M-2 | **corregido (versión F1)**: el aviso es un botón (`GpsNoticeButton`): pide la ubicación con un toque, o muestra los pasos / abre ajustes | `__tests__/trips/gpsNotice.test.ts`, `myPosition.test.ts`, capturas `f1-after_prompt*.png`, `f1-after_blocked*.png` |
| M-4 | **corregido** (un fix aproximado mueve el mapa, gris, con "±N m") | `gpsNotice.test.ts` (`mapPosition`), `f1-after_approx.png` |
| M-8 | **corregido** (mapa sin estilo = coordenadas + "Reintentar el mapa"; tiles que dejan de llegar avisan y se recuperan) | `__tests__/trips/tile-health.test.ts`, `f1-after_no_tiles.png` |
| M-9 | **re-diagnosticado y corregido**: la "losa blanca" de las capturas era el *skeleton* de la última tarjeta (se quedaba "cargando" para siempre sin vehículo y seguía el tema claro); el `Segmented` también seguía el tema claro. Ahora ambos son oscuros (`Segmented dark`, placeholder propio) | `f1-final_light_scrolled.png` (tema claro, hoja entera legible) |
| M-10 | **corregido**: INICIAR/TERMINAR queda fijo abajo (antes vivía al final de una lista que se desplazaba, fuera de pantalla en el iPhone: y 749 de 844 px); el aviso de iPhone ocupa una línea (X6) | misma captura; medición del botón |
| M-11 | **cambio aplicado, sin verificar en el Redmi**: el watch de posición ya no filtra por 2 m (`distanceInterval: 0`) | `myPosition.test.ts` (opciones del watch) + checklist manual |
| M-12 | **corregido en web** (plano y norte arriba; nombres de calles claros con halo oscuro); nativo: plano hasta tener posición, 45° al seguir | `__tests__/trips/label-style.test.ts`, capturas. El contraste de etiquetas nativo (MapLibre RN) queda para la fase 2 |
| M-1, M-3, M-5, M-6, M-7, M-13 | **F2** (el botón de F1 ya distingue "nunca preguntado" de "bloqueado" y reacciona al conceder, pero el registro central es de la fase 2) | — |
