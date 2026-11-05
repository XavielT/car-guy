# Viajes automáticos con la app cerrada — módulo `trip-trigger` (PROMPT-09, pasos 3–4)

## Por qué
`trips-diagnosis.md`: en una semana el sistema mató la app 6 veces, siempre en caché, 3 por CPU excesiva. El servicio «vigilando» (Balanced, 15 s/50 m) vivía solo con la app abierta, y aun así gastaba CPU en segundo plano. Resultado: si no abrías la app, no se registraba nada.

## Cómo funciona ahora (Android)
1. **Disparador del sistema.** Google Play services (Activity Recognition, transiciones `IN_VEHICLE` entrar/salir) avisa a `TransitionReceiver` aunque la app esté cerrada. Se registra en `armAuto()` y se vuelve a registrar tras reiniciar o actualizar la app (`BootReceiver`: `BOOT_COMPLETED`, `LOCKED_BOOT_COMPLETED`, `MY_PACKAGE_REPLACED`).
2. **Grabador nativo.** Al entrar al vehículo, el receptor arranca `TripRecorderService` (servicio en primer plano tipo `location`). Está permitido: Android exime del bloqueo de inicio en segundo plano a los eventos de *activity recognition transition*, y con «ubicación todo el tiempo» concedida el servicio de ubicación conserva el acceso (docs de Android, «Restrictions on starting foreground services from the background»). Solo escribe fixes crudos (`session-<t>.jsonl` en `files/trip-trigger/`). Se detiene 2 min después de «salió del vehículo», tras 6 min sin moverse, a las 8 h, o al apagar Automático.
3. **La app los reproduce.** Al abrir (y en cada `armAuto()`), `ingestNativeSessions()` pasa los fixes por **la misma** máquina (`feed(..., { replay: true })`): mismas reglas de inicio/fin, mismo SpeedEngine, mismo `finalize`. No hay una segunda lógica de viajes.
4. **Sin duplicados.** Si el servicio de la app está grabando, avisa al módulo (`holdForJs`, 3 min, renovado por cada lote) y el grabador nativo no arranca o cede. Si el grabador nativo sigue corriendo cuando abres la app, se detiene, se reproduce lo grabado y la app sigue sola. Se recuerda el último `t` ingerido para no repetir fixes.
5. **«Nativo primero».** Con el disparador registrado, el servicio «vigilando» de la app ya **no** corre en segundo plano (era la fuente del CPU); solo se usa mientras un viaje está grabándose. Si el disparador no se puede registrar (sin Play services, sin permiso, APK viejo), queda el camino anterior intacto.

## Qué se ve en el diario
Todos los eventos nativos pasan al diario de 14 días (`kind: 'native'`): `vehicle-enter`, `vehicle-exit`, `recorder-start/stop` (con motivo), `start-failed` / `foreground-failed` (con la excepción), `ingested`, `handover`, `arm`, `re-register:*`. «Exportar diagnóstico» ahora trae también `exitReasons` (ApplicationExitInfo leído por el módulo) y el resumen `timeline.summary.native`. Así, el primer viaje real dice si falló el disparador o el arranque del servicio.

## Permisos que pide la app (pantalla «Prepara tu teléfono», `/preparar`)
Avisos · Ubicación · Ubicación «todo el tiempo» · **Detectar cuando manejas** (`ACTIVITY_RECOGNITION`, nuevo) · Sin límite de batería · Inicio automático (Xiaomi). Cada paso lee el estado real y avanza solo al volver de Ajustes.

## Qué NO está
- **Bluetooth del carro y geocerca de casa/trabajo**: no se hicieron (solo Activity Recognition + arranque). Son disparadores adicionales posibles sobre el mismo grabador.
- **Prueba de manejo real**: pendiente. Lo verificado es que el Kotlin compila (`:trip-trigger:compileReleaseKotlin`), el reproductor/parser y el diario tienen pruebas (`native-trigger.test.ts`), y la lógica de la máquina es la ya probada. Falta ver una salida real: ¿llega `vehicle-enter`?, ¿arranca el servicio?, ¿cuánto tarda Google en decir «en vehículo»? (la transición suele tardar 1–3 min tras empezar a moverse; esos minutos iniciales se pierden salvo los que el grabador ya tenga).
- **Atajo de iPhone** (`/conducir?auto=start`): sigue pendiente.
- **Ajuste de umbrales con trazas reales** y tarjeta de salud: pendientes hasta tener trazas.
