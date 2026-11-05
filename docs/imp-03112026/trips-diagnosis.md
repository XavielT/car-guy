# Viajes automáticos — diagnóstico (PROMPT-09 paso 1)

Fecha: 2026-11-05. Dispositivo conectado por USB y consultado con `adb` (solo lectura): **Redmi Note 10 Pro (M2101K6G), Android 13, MIUI 14 (`V140`)**, app `com.xaviel.carguy` **2.6.0 (versionCode 22)**, instalada el 2026-10-27 (no incluye ninguna de las fases de esta ronda).

## 1. Lo que dice el teléfono hoy (repetición del volcado del 2026-10-01)
| Qué | 2026-10-01 | 2026-11-05 | Lectura |
|---|---|---|---|
| Permiso de ubicación | ninguno | **fina + aproximada + «todo el tiempo» concedidas** (`USER_SET`) | Resuelto por Xaviel |
| Notificaciones (Android 13) | — | **`POST_NOTIFICATIONS` NO concedido** | La notificación del servicio en primer plano y el aviso «Viaje detectado» no se verían |
| `ACTIVITY_RECOGNITION`, `BLUETOOTH_CONNECT`, `RECEIVE_BOOT_COMPLETED` | — | **la app no los declara** (`app.json` no los tiene) | Esperado: el módulo nativo aún no existe |
| Bucket de standby | RARE | **30 = FREQUENT** | Mejor, pero sigue siendo restringible |
| Lista blanca de ahorro de batería (`deviceidle whitelist`) | no | **no** (la app no aparece) | Optimizada por batería |
| MIUI (ops del proveedor) | autoarranque apagado | `MIUIOP(10008)`: **ignore** (rechazado hace ~1 d 16 h), `10020`/`10021`: ignore, `10017`: ask, `10023`: allow | El autoarranque sigue **denegado** (no se mapeó cada código; 10008 es el que ya se vigilaba) |
| `RUN_ANY_IN_BACKGROUND` | — | allow | Bien |
| **Por qué murió el proceso** (`ApplicationExitInfo`, 6 más recientes) | no existía | ver abajo | **El dato clave** |

### Salidas del proceso (`dumpsys activity exit-info`)
| Cuándo | Razón del sistema | Estado del proceso |
|---|---|---|
| 2026-11-05 09:10 | `OTHER KILLS BY SYSTEM` · **TOO MANY EMPTY PROCS** | vacío/en caché (importance 400) |
| 2026-11-05 07:42 | **EXCESSIVE RESOURCE USAGE · EXCESSIVE CPU USAGE** (`23.3 s de CPU en 300 s`, límite 2 %) | vacío/en caché |
| 2026-11-02 11:52 | **EXCESSIVE CPU USAGE** (`33.5 s en 300 s`, límite 10 %) | vacío/en caché |
| 2026-10-30 17:14 | TOO MANY EMPTY PROCS | vacío/en caché |
| 2026-10-30 09:03 | **EXCESSIVE CPU USAGE** (`25.4 s en 300 s`, límite 2 %) | vacío/en caché |
| 2026-10-29 12:01 | LOW_MEMORY | vacío/en caché |

**Qué significa (y qué no).**
- **Ninguna** salida es `USER_REQUESTED`: nadie «deslizó la app para cerrarla»; **el sistema la mató** seis veces en una semana, siempre con el proceso **en caché (importance 400, `state=empty`)**: o sea, **sin un servicio en primer plano que la sostuviera**. Eso confirma H0.2: cuando el servicio de ubicación no está corriendo, Android o MIUI la recoge y **nada detecta un viaje hasta que se vuelva a abrir**.
- **Tres de las seis son «EXCESIVE CPU»**: el proceso, ya en caché, gastó entre 23 y 34 s de CPU en 5 minutos (≈ 8–11 %) contra un límite de 2–10 %. Es un hallazgo **nuevo** que la hipótesis original no tenía: algo de la app sigue trabajando en segundo plano (un temporizador de JS, una sincronización, una animación o la propia tarea de ubicación) y el sistema la castiga. **No sé aún qué es**: identificarlo es parte del paso 2 (línea de tiempo con cada invocación de la tarea y cada tic) y debe medirse en la próxima versión antes de afirmar la causa.
- No se mapeó cada `MIUIOP`; no hay dato aquí sobre qué viajes se perdieron (la app 2.6.0 no tiene la línea de tiempo del paso 2).

## 2. Las hipótesis de SPEC-H contra el código (rama `imp-03112026`)
| # | Hipótesis | ¿Se confirma? | Dónde |
|---|---|---|---|
| H0.1 | El modo por defecto es Manual | **Sí** | `lib/trips/settings.ts:13` — `settingsRepo.get('trips_enabled', 'manual')`; Automático es opt-in |
| H0.2 | El servicio solo se arma con la app en primer plano; con la app cerrada nada detecta | **Sí, y el teléfono lo confirma** (arriba) | `lib/trips/auto.ts:11-16` (cabecera: «a terminated app is not restarted by the OS»), `armAuto()` en `auto.ts:114`, llamado desde `lib/trips/useTripService.ts:18` y `app/conducir.tsx:26`. **No existe ningún receptor del sistema** (no hay `modules/trip-trigger`; solo `modules/miui-autostart`) |
| H0.3 | Permisos/MIUI/batería | **Parcialmente cambió**: ubicación «todo el tiempo» ya está; siguen mal notificaciones, autoarranque MIUI y batería | tabla 1 |
| H0.4 | La vigilancia (Balanced, 15 s/50 m) es lenta de satisfacer con la regla de inicio | **Confirmado en el código; no medido en un viaje real** | vigilancia: `lib/trips/auto.ts:44-50` (Balanced, `timeInterval 15 000`, `distanceInterval 50`, `deferredUpdatesInterval 60 000`); inicio: `lib/trips/machine.ts:63-81` (`startSpeedMs 5.5`, `startSamples 3`, `startAccM 50`, `startDisplacementM 300`, `startWindowS 120`). La corrección debe probarse con repetición de trazas (paso 5) y no se hizo todavía |
| H0.5 | La PWA de iPhone no puede detectar viajes sola | Sí (ADR-48); no se volvió a probar en un iPhone | — |

**Corrección a SPEC-H**: el bucket de standby de la Redmi ya no es RARE sino FREQUENT, y la ubicación «todo el tiempo» sí está concedida; lo que sigue faltando es **notificaciones, autoarranque MIUI y exención de batería**, además de la falta de cualquier disparador que arranque la grabación con la app cerrada.

## 3. Qué falta de PROMPT-09 (no se hizo en esta sesión) y por qué
Este documento cubre el **paso 1**. El resto exige trabajo nativo y una **prueba de manejo real**, que no se puede dar por hecha desde aquí:
2. Línea de tiempo de 14 días y `lastExitReasons()` nativo (necesita el APK nuevo; es lo que dirá de dónde sale el CPU en caché).
3. Módulo `modules/trip-trigger` en Kotlin (Activity Recognition, Bluetooth, geofence, arranque) y verificar en la documentación de Android 12+ si esos eventos permiten arrancar el servicio de ubicación en segundo plano.
4–8. Asistente de activación con comprobación real de cada paso, tarjeta de salud, ajuste de umbrales **con repetición de trazas reales**, vehículo/rol, pantalla de estado, atajo de iPhone.
9–10. Documentos y la compilación nativa.

Lo único que se puede afirmar hoy, con datos: **el sistema está matando la app, en caché, varias veces por semana, y por eso «si no lo inicio a mano no registra»**; lo siguiente es arreglarlo con un servicio que sobreviva y un disparador del sistema, y medir en la calle.
