# VERIFICACIÓN — nota por nota (PROMPT-08, modo «Release A»)

Estado al 2026-11-05, rama `imp-03112026`. **Una fila sin evidencia es un defecto**: abajo cada fila dice qué se verificó, con qué, y qué NO. Leyenda: ✔ verificado con la evidencia citada · ◐ construido y probado en pruebas/navegador, **falta** una prueba real (dispositivo, modelo real, personas) · ✘ no hecho.

## Lo que cuenta para «Release A» (P5–P8, Y8–Y13)
| ID | Qué se pidió | Veredicto | Evidencia | Qué falta |
|---|---|---|---|---|
| P5 | Los viajes no se registran solos | ◐ **causa medida; arreglo construido y publicado en 2.7.0, sin prueba de manejo** | `trips-diagnosis.md`: en una semana el sistema mató la app 6 veces (3 por CPU excesiva en caché, 2 «too many empty procs», 1 memoria), siempre en caché, nunca por el usuario; H0.1–H0.5 con file:line | Disparadores nativos + prueba de manejo |
| P5a | Disparadores del SO (Activity Recognition, Bluetooth, geofence, arranque) | ◐ (Activity Recognition + arranque; **sin** Bluetooth ni geocerca) | `modules/trip-trigger` (Kotlin; compila; el APK 2.7.0 lleva el servicio, los receptores y los permisos), `lib/trips/nativeTrigger.ts` + `native-trigger.test.ts`, asistente `/preparar` con comprobación real de cada paso, pantalla `/viajes/estado`; ver `trip-trigger.md` | **Un manejo real**: ¿llega `vehicle-enter`?, ¿arranca el servicio?, ¿cuánto tarda Google?; Bluetooth y geocerca |
| P5b | Los dos teléfonos (Android nativo + atajo de iPhone con su límite) | ◐ | `/conducir?auto=start` (solo si la ubicación ya está permitida) y la sección «iPhone» de `/instalar` con el límite dicho | Probarlo en un iPhone (no hay uno aquí) |
| P6 | Velocidad poco precisa | ◐ | `lib/trips/speed.ts` (SpeedEngine), `__tests__/trips/speed-baseline.test.ts`, `speed-replay.test.ts`, `speed.test.ts`; tabla vieja-vs-nueva en `speed-before-after.md` (metas cumplidas para teléfonos con Doppler; los fallos sin Doppler están anotados ahí) | Un manejo real con un segundo teléfono (`docs/CALIBRATION-DRIVE.md`) |
| P6a | Una sola fuente para aguja, máxima, promedio/distancia y mapa | ✔ (en código y pruebas) | Los cuatro consumen `SpeedEngine`/`segmentSpeedsKmh`: `live-store.test.ts`, `present.test.ts`, `geojson.test.ts`, `stats.test.ts`; la versión anterior se conserva para comparar en `__tests__/helpers/speed/legacy.ts` | — |
| P6b | Líneas de frecuencia finas en vez del mapa de calor | ◐ | `routeFrequency` en `lib/trips/geojson.ts` + `geojson.test.ts`; leyenda `components/trips/FrequencyLegend.tsx`; commit `28d3d56` | Capturas «Por dónde manejas» a zoom 10/13/16 (no se tomaron) |
| P7 | Resúmenes mensuales y anuales | ◐ | `lib/domain/recap.ts` + `__tests__/domain/recap.test.ts` (28: vacío, delgado, normal, varios carros, DST, fin de año, **totales = Cifras**, año de datos en ~50 ms); visor + imagen: `evals/ux/recap.mjs` 16/16 (PNG 1080×1920 generado, axe con contraste); notificaciones: `__tests__/notifications/recap-plan.test.ts` | Hoja de compartir a WhatsApp/Instagram en el teléfono; no hechas: rachas, lugares, collage, PDF |
| P8 | Más fácil de entender | ◐ | `ux-audit.md` (antes/después medidos), `__tests__/domain/nextStep.test.ts` (18), `__tests__/features/search-tasks.test.ts` (13 quehaceres), `__tests__/nav/model.test.ts`, `evals/ux/tasks.mjs` 23/23 a 390 y 1280 (15 quehaceres con toques, ≤ 4 acciones, 1 tarjeta, funciones = registro, axe) | **La prueba en frío con 3 personas** (`COLD-START-TEST.md`), autoguardado de borradores |
| Y8 | Línea de tiempo + `ApplicationExitInfo` | ◐ (la sonda nativa `lastExitReasons()` ya existe y sale en el diagnóstico) | `lib/trips/timeline.ts` + `__tests__/trips/timeline.test.ts` (5), salida en «Exportar diagnóstico»; las razones de salida se leyeron con `adb` (`trips-diagnosis.md`) | La sonda nativa `lastExitReasons()`, la pantalla de estado |
| Y9 | Calibración por carro | ✔ (navegador) / ◐ (carretera) | `lib/trips/calibration.ts` + `__tests__/trips/calibration.test.ts` (15, incl. «steady» sin Doppler); pantalla `app/vehiculo/[id]/calibracion.tsx`, comprobación en navegador 12/12 (`cal-e2e`) | Manejo real; el factor del odómetro tiene regla probada pero **no tiene pantalla** |
| Y10 | Arnés de repetición con manejos de verdad conocida | ✔ | `__tests__/helpers/speed/{simDrive,replay,legacy}.ts`, `speed-replay.test.ts`, `speed-before-after.md` | Trazas reales exportadas de Xaviel |
| Y11 | El conjunto de funciones lo elige la persona | ✔ | `lib/features/featureSet.ts` + `featureSetStore.ts`, hoja `components/features/FeatureSetSheet.tsx`, `registry.ts` (`group`/`level` en las 41 funciones), `__tests__/features/*` | — |
| Y12 | Prueba en frío con 3 personas | ✘ (kit listo, sin correr) | `COLD-START-TEST.md`, `ux-findings.md` (plantilla) | Correrla |
| Y13 | Privacidad de la imagen compartida | ✔ | `lib/domain/recapShare.ts` + pruebas en `recap.test.ts` («toShareModel: privacy by omission»: sin gastos por defecto; nunca odómetro, placa, chasis, vencidos, fechas; nombres solo si se activan); la imagen exportada omite «Lo más grande» | — |

## Resto de IDs (modo final; se anota el estado real, no se verificó todo)
| ID | Veredicto | Evidencia / motivo |
|---|---|---|
| P1, P1b | ◐ | Puerta (`serveAi`: JWT → admin → interruptor → consentimiento → topes → fila de uso): `__tests__/ai/gateway.test.ts` + **nuevo** `__tests__/ai/gateway-coverage.test.ts` (las 10 funciones `cg-*` pasan por la puerta; `cg-ai-status` no llama a ningún proveedor). `sql/042`, `043`, `044` aplicados en x-core por Xaviel; 8 funciones desplegadas. **Falta**: `tools/smoke-ai.mjs` y `evals/ai/run.mjs` contra las funciones desplegadas (necesitan una cuenta admin de prueba) |
| P1a | ✔ | `docs/KEYS-INVENTORY.md` |
| P2, P2a, P2c–P2g, P2h, P9, Y14 | ◐ | Construido y probado con modelo simulado: `__tests__/ai/*.test.ts` (capture, express, fuel-roundtrip, queue, obd-*, insights-*, sale, places, triage-*, documents-server…); `ai-workflow-map.md`; navegador con red simulada (`evals/ai/e2e`). **Ninguna llamada a un modelo real se ha medido** (sin cuenta de prueba) |
| P2b | ✔ | Hecho en el chat del 03-nov |
| P3 | ✔ | `C:\dev\SGC` y `C:\dev2\csd-app` solo se leyeron |
| P4, P4a, P4b | ✔ | `lib/theme/layout.ts` + `__tests__/theme/layout.test.ts`, `components/layout/*`, `docs/LAPTOP.md`, capturas `f7-*`; compacto idéntico en 8 pantallas (0.000 %) en la fase 7. Abiertos de la fase 7: maestro/detalle en Garaje/Documentos/Contactos/Recordatorios/OBD, gráficas+CSV, panel de captura |
| Y1 | ◐ | `tools/check-bundle-env.mjs dist --forbidden-only`: ✔ limpio (130 archivos) en el `dist/` de esta sesión; `__tests__/tools/secret-shapes.test.ts`. **No** se corrió sobre el APK ni `gitleaks` (no está instalado). Un barrido con `git grep` de `sk-ant-`, `ghp_`, `AZURE_SPEECH_KEY=` no encontró nada en archivos de código; `google-services.json` trae una clave `AIza…` de **Firebase para Android**, que es configuración pública por diseño (restringible por paquete), no un secreto |
| Y2, Y3 | ◐ | Topes/interruptor/consentimiento: `gateway.test.ts`, `sql/042`+`044` (con `tools/local-rls/scenario_042/043`); falta ver el costo real |
| Y4 | ◐ | Micrófono en el registro de permisos ADR-59 y `Permissions-Policy`; voz probada con simulación; **falta clave de STT** y APK |
| Y5 | ✔ | `__tests__/ai/places.test.ts`, `non-features.test.ts` (nada de Google en viajes) |
| Y6 | ◐ | `cg-ai-triage` + `triage-server/client.test.ts` |
| Y7 | ◐ | `evals/ai/{documents,insights}.json` + `evals-fixtures/score.test.ts`; sin correr contra modelo real |
| Y15 | ◐ | **2.7.0 «Sensei» publicada** (GitHub release `v2.7.0`, `/api/apk` ya la ofrece, portfolio actualizado, OTA a `production`). Honesta: los viajes automáticos con la app cerrada están construidos pero **no probados en la calle**; el changelog lo dice |

## Seguridad / regresión (lo que se corrió hoy)
- `tsc` limpio; `npm run lint`: 0 errores y 2 advertencias antiguas; jest: **209 de 211 suites pasan** (3569 pruebas; las 4 que fallan son de `__tests__/db/track.test.ts` y `__tests__/ui/skeletons.test.ts`, ya rojas en la línea base, no tocadas); build web limpio.
- Playwright (red simulada): `evals/ux/tasks.mjs` 23/23 (390 y 1280), `evals/ux/recap.mjs` 16/16, `cal-e2e` 12/12.
- **No corrido en esta sesión**: suite `tools/local-rls` completa, `verify-x-core` (falta `.env.local`), `tools/smoke-apk.mjs`, gitleaks, prueba en el teléfono de la hoja de compartir.

## Para pasar de «Release A lista» a «publicada»
Falta lo de P5/P5a/P5b; luego APK nuevo (el módulo nativo cambia la huella), `releases/fingerprint.json`, `check-bundle-env` sobre el APK, `smoke-apk`, y **tu OK** antes de publicar nada.

## Publicación 2.7.0 (2026-11-05)
- APK de producción construido en EAS (`release-apk`, versionCode 23, runtime `575e0ee0…`), firmado con la llave de EAS (`a16450a0`), `check-bundle-env` limpio, versionName 2.7.0, el módulo `trip-trigger` presente (clases, manifiesto y permisos). **No se instaló en el teléfono de Xaviel** (no estaba conectado al terminar); se instalará desde el portfolio.
- `main` en el commit de la publicación; GitHub release `v2.7.0` con `car-guy.apk` y `car-guy-v2.7.0.apk`; OTA a `production` con el runtime del APK (`OTA_RUNTIME_VERSION`, `app.config.js`); `releases/fingerprint.json` registrado.
- Hecho además: pantalla «Prepara tu teléfono», estado de la detección, atajo de iPhone, borradores, factor del odómetro, `COSTS.md` (proyección, no medida).
- Siguen sin hacerse: Bluetooth/geocerca, rachas/lugares/PDF de los resúmenes, paneles maestro/detalle de escritorio, resumen semanal, modelos reales (sin cuenta de prueba ni clave de STT), `local-rls` completo, `verify-x-core`, `gitleaks`, prueba en frío con 3 personas, manejo con segundo teléfono para velocidad.
