# Inventario de permisos (N2, N3) — Fase 0, 2026-10-16

Qué declara la app frente a qué usa de verdad. Android = APK (Redmi). iPhone = web/PWA (**no hay binario iOS**: `app.json` solo trae `ios.supportsTablet`; los textos de `Info.plist` que generan los plugins no se usan en ningún build).

## 1. Declarado

### 1.1 En `app.json` (`expo.android.permissions` y plugins)
| Origen | Qué declara | Efecto en el manifiesto de Android |
|--------|-------------|------------------------------------|
| `android.permissions` | `REQUEST_INSTALL_PACKAGES` | instalar el APK descargado (`lib/updates/apk.ts:90`, `expo-intent-launcher` `ACTION_VIEW`) |
| plugin `expo-location` | `isAndroidBackgroundLocationEnabled: true`, `isAndroidForegroundServiceEnabled: true`, `androidForegroundServiceIcon`, textos `locationAlwaysAndWhenInUsePermission` / `locationWhenInUsePermission`, `motionUsagePermission` | `ACCESS_FINE/COARSE_LOCATION` (del módulo) + `ACCESS_BACKGROUND_LOCATION` + `FOREGROUND_SERVICE` (+ tipo `location`) por las dos banderas. Los textos y `motionUsagePermission` son **solo iOS** (sin build iOS = sin efecto) |
| plugin `expo-media-library` | `granularPermissions: ["photo"]`, `photosPermission`, `savePhotosPermission: false` | `READ_MEDIA_IMAGES` (Android 13+) y, por el manifiesto del módulo, `READ_EXTERNAL_STORAGE` / `WRITE_EXTERNAL_STORAGE` / `READ_MEDIA_VISUAL_USER_SELECTED` |
| `expo-task-manager`, `expo-sqlite`, `expo-font`, `expo-sharing`, `expo-localization`, `@react-native-community/datetimepicker` | — | sin permisos |
| `@maplibre/maplibre-react-native` | — | `INTERNET`, `ACCESS_COARSE/FINE_LOCATION` (manifiesto del módulo) |
| **No hay** plugin de `expo-notifications` ni de `expo-image-picker` | — | ver 1.2 |

### 1.2 Que llegan por el manifiesto de las librerías (deducido de `node_modules/*/android/src/main/AndroidManifest.xml`; no hay carpeta `android/` en el repo)
| Permiso | Lo trae | ¿Está en `app.json`? |
|---------|---------|----------------------|
| `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED` | `expo-notifications` | **no** (implícito) |
| `CAMERA`, `READ/WRITE_EXTERNAL_STORAGE` | `expo-image-picker` | **no** (implícito) |
| `READ/WRITE_EXTERNAL_STORAGE`, `INTERNET` | `expo-file-system` | no (implícito) |
| `ACCESS_NETWORK_STATE` | `expo-updates` | no (implícito) |
| `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` | `modules/miui-autostart` (módulo propio) | no (implícito) |
| `ACCESS_FINE/COARSE_LOCATION`, `INTERNET` | `expo-location`, MapLibre | no (implícito) |

El manifiesto **fusionado real** solo se conoce tras `expo prebuild`/Gradle (`tools/build-test-apk.sh` lo hace); no se corrió aquí. Fase 2: tras el APK de prueba, `aapt dump permissions` (o `adb shell dumpsys package com.xaviel.carguy.test`) y pegar el resultado en esta tabla.

### 1.3 Web / iPhone PWA
No hay declaración (no hay `manifest` de permisos); el navegador pregunta en el primer uso de cada API: `navigator.geolocation` (+ `navigator.permissions.query`), `<input type="file">` (cámara/fotos), `navigator.clipboard.writeText` (con gesto del usuario), `navigator.storage.persist()`.

## 2. Usado: cada llamada real

| Permiso | Dónde se llama (archivo:línea) | Qué hace | ¿Cuándo? |
|---------|--------------------------------|----------|----------|
| **Ubicación en primer plano** (`location_foreground`) | `lib/trips/live.ts:58-61` `ensurePermission` | `get` → `request` solo si `canAskAgain` → en nativo `hasServicesEnabledAsync` (`services`) | al **iniciar un viaje manual** (`startManualTrip`, desde `app/conducir.tsx:154` y `app/(tabs)/index.tsx` `beginTrip`) — **en frío**, sin explicación |
| | `lib/trips/live.ts:122` `resumeManualTrip` | `get` (si ya hay permiso, retoma el watch tras un reinicio) | al abrir la app con un viaje abierto |
| | `lib/trips/myPosition.ts:71` | `get`; si `!granted` → `denied` y no pide nada (**M-1**) | al abrir Modo conducir |
| | `lib/trips/auto.ts:90-93` `autoReadiness` | `get` fg; `fg.android.accuracy === 'coarse'` → `approximate`; `get` bg | al armar Automático y en el banner |
| | `lib/trips/diagnostics.ts:130-131` | instantánea fg/bg para los diagnósticos | pantalla de diagnóstico |
| | `components/trips/TripPieces.tsx:136-160` `useLocationPermission` | `get` + `AppState` `active` → releer + `ask()` (pide o `Linking.openSettings()` en nativo) | Viajes → Ajustes, Permisos, banner |
| | `app/viajes/permisos.tsx:59-76` | `get`/`request` fg y luego bg, con aviso de divulgación (`confirmBackgroundDisclosure`) y pedido de notificaciones antes | al activar Automático |
| | `app/conducir.tsx:157-160`, `app/(tabs)/index.tsx:278-283` | alerta "abre ajustes" si `startManualTrip` devuelve `permission` | tras fallar el inicio |
| | `components/social/PrivacyZonesEditor.tsx:38` | `request` al tocar "Agregar mi ubicación ahora" | acción explícita (con contexto) |
| | `app/juntes/nuevo.tsx:39` | `request` al tocar "Usar mi ubicación ahora" | acción explícita (con contexto) |
| **Ubicación en segundo plano** (`location_background`) | `lib/trips/auto.ts:93` (leer), `app/viajes/permisos.tsx:76` (pedir), tarea en `expo-task-manager` (`TRIP_TASK`) | Android 11+: segundo paso; el sistema lleva a ajustes ("Permitir todo el tiempo") | al elegir Automático |
| **Notificaciones** (`notifications`) | `lib/notifications/index.ts:99-110` `hasPermission`/`requestPermission` (canales creados antes: `:76`, `:83`), `:263` al activar, `app/notificaciones.tsx:39,65,75,84` (+ `Linking.openSettings()` en :84), `app/viajes/permisos.tsx` (`requestNotificationPermission` antes de segundo plano) | pide al activar recordatorios (primera vez que el usuario dice sí) y antes de Automático (para la notificación fija del servicio, Android 13+) | en contexto ✔ (el único permiso que ya se pide con explicación previa) |
| | **Push de juntes**: `api/junte-push.ts` + RPCs `register_push_token`/`unregister_push_token` (`sql/039`) | el registro del token **no está en la app** todavía (solo en el SQL y la API; "once Firebase is in the build") | — |
| **Cámara** (`camera`) | `lib/media/index.ts:174` (`pickCandidates({camera:true})`), `lib/profile.ts:204` (`pickProfilePhoto(true)`) → `ImagePicker.launchCameraAsync` | **no hay** `requestCameraPermissionsAsync` ni lectura del estado en todo el repo; en web `PhotoPicker` oculta la cámara y deja el `<input type="file">` | al tocar "Tomar foto" |
| | manejo del fallo: `components/PhotoPicker.tsx:74-86`, `app/perfil.tsx:58` | un error cae en la alerta genérica `photoPickError`/`photoErrorRetry` con "Reintentar": **sin** "Abrir ajustes" ni "Elegir de la galería" | permiso denegado |
| **Fotos** (`photos`) | `lib/media/library.ts:19-27` `ensurePhotoPermission` (`requestPermissionsAsync(false, ['photo'])`) y `presentPermissionsPicker` | acceso a la galería para explorar por mes con fecha real | **`app/album/importar.tsx:78` lo llama al montar la pantalla** (en frío, sin primer) |
| | `lib/media/index.ts:175` `launchImageLibraryAsync` | selector del sistema, **sin permiso** | al elegir foto en formularios |
| | `lib/media/library.web.ts:13` | sustituto web (sin permiso) | — |
| **Batería / autoarranque** (`battery_unrestricted`) | `modules/miui-autostart` (`getBatteryState`, `openBatterySettings`, `openSettings`), `components/trips/TripPieces.tsx:244-247`, `lib/trips/diagnostics.ts:63` | no se puede pedir por API: se lee el estado (`isIgnoringBatteryOptimizations`) y se abre la pantalla de ajustes | al activar Automático / banner |
| **Instalar APK** | `lib/updates/apk.ts:90` | `ACTION_VIEW` con el `content://` del APK; Android pide "instalar apps desconocidas" la primera vez | al tocar "Actualizar" |
| **Almacenamiento persistente** (web) | `app/(tabs)/_layout.tsx:27-34` → `lib/platform/capabilities.ts:58-61` `navigator.storage.persist()` | una vez, tras crear el primer vehículo; la respuesta se guarda en `setting.storage_persist` | **ya existe** (SPEC-A lo marcaba "evaluar") |
| **Portapapeles** (web) | `app/vehiculo/[id]/ficha.tsx:173`, `components/track/TrackPieces.tsx:178` `navigator.clipboard.writeText` | con un toque del usuario | acción explícita |
| **Mantener pantalla encendida** | `expo-keep-awake` (`app/conducir.tsx:493`, `app/(tabs)/index.tsx:661`) | sin permiso | — |
| **Movimiento** | `motionUsagePermission` en `app.json` | **no se usa ninguna API de movimiento** (`git grep "expo-sensors\|DeviceMotion"` = 0) | declarado y sin uso (solo iOS; sin efecto) |
| Micrófono, contactos del teléfono, calendario | — | no se usan (los "contactos" de la app son propios, `lib/domain/contacts.ts`) | — |

## 3. Cruce

### Usado pero no declarado en `app.json` (llega implícito por una librería)
- `CAMERA` (expo-image-picker), `POST_NOTIFICATIONS` + `RECEIVE_BOOT_COMPLETED` (expo-notifications), `READ/WRITE_EXTERNAL_STORAGE` (varias), `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` (módulo propio). Funciona, pero no hay una sola lista de lo que la app pide: cualquier actualización de una librería puede quitar o agregar permisos sin que el repo lo muestre. Fase 2: declararlos explícitamente (`android.permissions`) y/o con los plugins `expo-image-picker` (con `cameraPermission`) y `expo-notifications`, y fijar con una prueba de `expo config`.
- Web/iPhone: ningún permiso es "declarable"; solo se pueden **anticipar** con el primer.

### Declarado pero no usado
- `motionUsagePermission` (plugin `expo-location`): sin uso, solo iOS.
- Textos `locationAlwaysAndWhenInUsePermission` / `locationWhenInUsePermission`: solo iOS (no hay build iOS); para Android no tienen efecto (el texto que ve el usuario lo pone la app, no el sistema).
- `READ_EXTERNAL_STORAGE`/`WRITE_EXTERNAL_STORAGE` (legacy, de varias librerías): la app usa el selector del sistema para fotos; `ensurePhotoPermission` pide solo `photo` (granular). Revisar con el manifiesto fusionado si pueden quitarse con `tools:node="remove"` (es nativo → APK).
- `READ_MEDIA_VISUAL_USER_SELECTED` (Android 14): se usa solo si el usuario elige "fotos seleccionadas"; sí tiene sentido.

### Pedidos "en frío" (contra el principio 1 de SPEC-A)
1. Ubicación fg al **iniciar viaje** (`live.ts:58-60`), sin explicación y tarde (M-3).
2. Fotos al **abrir** Importar (`app/album/importar.tsx:78`).
3. Cámara: no se pide, se delega a `launchCameraAsync` (comportamiento en Android si está negada: por verificar en Expo v57), y el fallo es una alerta genérica.
4. En web la cámara y las fotos las gestiona el navegador/Safari al abrir el `<input>`: no se pueden anticipar, pero sí explicar antes ("el teléfono te va a preguntar").

### Faltan caminos de salida (N3)
- Sin ruta de "Abrir ajustes" para: cámara denegada, fotos denegadas, notificaciones denegadas fuera de `app/notificaciones.tsx`.
- Ubicación: banner + `permisos.tsx` existen solo dentro de Viajes; Modo conducir, Juntes y Zonas privadas no tienen salida (solo `throw new Error('permission')` silencioso en `PrivacyZonesEditor.tsx:39-53` y `juntes/nuevo.tsx:40`).
- No existe una pantalla general "Permisos".
- Android: `services_off` solo existe en `live.ts:61` (nativo); en web nunca.
- iPhone web: `canAskAgain` es siempre `true` (shim de expo-location, M-6): ningún estado "bloqueado".

## 4. Corrección de la tabla de SPEC-A (registro de permisos)

La tabla de SPEC-A se escribió sin ver el código. Cambios para PROMPT-02 (**ya aplicados** a `02-specs/SPEC-A-permisos-y-mapa.md` en la fase 0):

| id | Corrección |
|----|------------|
| `location_foreground` | Android: `expo-location` (hoy se pide en `live.ts:58`, no al abrir Modo conducir). Añadir sub-estado **precisión aproximada** (Android 12+, `fg.android.accuracy === 'coarse'` → `approximate` en `auto.ts:92`), que SPEC-A no contemplaba. Web: `canAskAgain` del shim siempre `true`: el estado `denied_blocked` hay que derivarlo de `permissions.query` (M-6). |
| `location_background` | Existe y funciona (`permisos.tsx` con divulgación destacada de Play, `auto.ts`). Solo hay que **moverlo** al registro; no reescribir. |
| `notifications` | Ya se pide en contexto (`notificaciones.tsx`, antes de Automático). "Web push": **no hay registro de token en la app** → la fila web queda `unavailable`; Android 13+: añadir la dependencia de la notificación fija del servicio. |
| `camera` | **No es `expo-camera`** (no está en `package.json`): es `expo-image-picker.launchCameraAsync`, sin permiso explícito. El registro debe leer `ImagePicker.getCameraPermissionsAsync()` y pedir con `requestCameraPermissionsAsync()` **antes** de abrir la cámara (verificar nombres y comportamiento en los docs de Expo v57). En web: el navegador. |
| `photos` | Solo hace falta para **explorar la galería por mes** (`ensurePhotoPermission`); elegir fotos en formularios usa el selector del sistema sin permiso. Pedirlo **al tocar "Importar de la galería"**, no al montar (`importar.tsx:78`). |
| `battery_unrestricted` | Existe como módulo propio (`modules/miui-autostart`): estado `unrestricted`/`optimized`/`unknown` ya se lee. La fila "no verificable" de SPEC-A queda como "verificable en APK ≥ 2.4.3; `unknown` en APKs viejos". |
| `storage_persist` | **Ya implementado** (`capabilities.ts:58`, `_layout.tsx:27-34`); entra al registro solo como lectura. |
| nuevo: `install_unknown_apps` | `REQUEST_INSTALL_PACKAGES` (actualizador APK) — Android lo gestiona con la pantalla del sistema; incluirlo para que la pantalla de Permisos lo muestre. |
| nuevo: `services_off` | Android: `hasServicesEnabledAsync()` es un estado de **teléfono**, no de permiso (ya usado en `live.ts:61`). |

## 5. Notas para la fase 2
- Leer antes `docs.expo.dev/versions/v57.0.0/sdk/location|notifications|imagepicker|media-library` (regla de `AGENTS.md`); en esta fase no se hizo porque no se escribió código.
- Firebase/FCM: `google-services.json` ya está en el repo (commit `bff18a0`); el registro del token y su permiso van con "junte chat on", fuera de este ciclo.
- Al terminar la fase 2, `grep` de llamadas directas a `Location.*Permissions*`, `requestPermissionsAsync` y `Linking.openSettings` fuera de `lib/permissions/**` debe dar 0 (prueba de arquitectura).
