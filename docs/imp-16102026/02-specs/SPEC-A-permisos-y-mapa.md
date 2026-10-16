# SPEC-A — Permisos y mapa (N1, N2, N3, X6)

## Problema (captura 11:19)
Modo conducir en el iPhone (PWA) muestra "Sin permiso de ubicación: el mapa no sabe dónde estás." como texto pasivo. El usuario no puede hacer nada desde ahí, y la app dice que "el navegador te pide la ubicación al iniciar" (es decir, recién al empezar un viaje). Falta: pedir el permiso en el momento correcto, explicarlo, y dar siempre una salida si falta.

## Lo que ya existe (repo, 2026-10-16)
- `app.json` declara: `REQUEST_INSTALL_PACKAGES`, textos de ubicación (siempre / en uso), fotos (granular), `motionUsagePermission`. No declara notificaciones ni cámara explícitas (verificar contra plugins).
- Llamadas dispersas: `lib/trips/live.ts:58` (pide fg con `canAskAgain`), `auto.ts:90`, `myPosition.ts:71`, `diagnostics.ts:130`, `components/trips/TripPieces.tsx:138–153` (banner con `Linking.openSettings()` y re-lectura con `AppState`), `app/viajes/permisos.tsx` (flujo de segundo plano, MIUI, batería), `app/conducir.tsx:144/160`, `app/(tabs)/index.tsx:281`, `components/social/PrivacyZonesEditor.tsx:38`, `app/juntes/nuevo.tsx:39`, `lib/media/library.ts:20`, `lib/notifications/index.ts:110`, `app/notificaciones.tsx:84`.
- Web: `lib/trips/webGeo.ts` + `patches/expo-location+57.0.20.patch` (GPS preciso en iPhone web), `lib/trips/myPosition.ts`.
- Mapa: `components/map/` (`LiveMap`, `Recenter`, `UserDot`, variantes `.web`).
- El aviso de la captura sale de `t.drive.gpsDenied` en `app/conducir.tsx:144` y es texto pasivo.
**Este ciclo no reescribe todo eso desde cero: lo reúne detrás de un registro central, reutiliza el banner y la pantalla `viajes/permisos` como punto de partida y agrega lo que falta (primer, estados completos, pantalla general, mapa con respaldo y botones).**

## Principios
1. Nunca pedir en frío: primero una hoja de explicación ("primer") con el porqué, luego el diálogo del sistema. En iPhone un "No permitir" no se puede volver a preguntar desde la app; por eso el primer importa.
2. Pedir en el momento de uso (al abrir Modo conducir, al activar Automático, al tomar foto), no todo al arrancar.
3. Si falta un permiso, el lugar donde falla muestra un botón (no un texto). Además existe una pantalla central.
4. Al volver a la app (AppState `active` / `visibilitychange`) se vuelve a leer el estado y la UI se corrige sola.
5. Sin permiso la app sigue siendo útil: el mapa se ve (posición de respaldo) y los viajes manuales explican qué falta.

## Registro de permisos
> **Corregida en la fase 0 (2026-10-16)** contra el código real: ver `permissions-inventory.md` (§2 llamadas, §3 cruce, §4 correcciones). Cambios: la cámara es `expo-image-picker` (no `expo-camera`) y hoy no se pide ni se lee; fotos solo para explorar la galería por mes y se pide al montar `album/importar`; notificaciones ya se piden en contexto; `storage_persist` y `battery_unrestricted` ya existen; web: `canAskAgain` siempre `true`; Android: precisión aproximada y servicios apagados son estados reales; no hay registro de token push en la app.

| id | Para qué | Android (APK) | iPhone web / PWA | Cuándo se pide (hoy → objetivo) | Si se niega |
|----|----------|---------------|------------------|-------------------------------|-------------|
| `location_foreground` | Mapa, Modo conducir, viajes manuales, zonas privadas, juntes | expo-location foreground (`live.ts:58`); sub-estado **aproximada** (`auto.ts:92`) y **servicios apagados** (`hasServicesEnabledAsync`, `live.ts:61`) | `navigator.geolocation` + `permissions.query`; `canAskAgain` del shim siempre `true` → `denied_blocked` se deriva de `query` | hoy: al INICIAR un viaje, en frío → objetivo: al abrir Modo conducir, con primer | Mapa en posición de respaldo + botón "Activar ubicación"; bloqueado → ajustes / pasos |
| `location_background` | Detección automática de viajes | expo-location background (Android 11+: paso aparte, "Permitir todo el tiempo"); **ya existe** con divulgación de Play (`app/viajes/permisos.tsx`) | No existe (la web no puede) | hoy: al activar Automático → se mantiene, movido al registro | Modo vuelve a "Solo manual" + banner con botón |
| `notifications` | Recordatorios, garantía, notificación fija del servicio (Android 13+) | `POST_NOTIFICATIONS` (implícito, expo-notifications); **ya se pide en contexto** (`notificaciones.tsx`, antes de Automático) | Sin registro de token push en la app → `unavailable` | hoy: ✔ en contexto → se mantiene | Avisos solo dentro de la app + botón / ajustes |
| `camera` | Fotos de carro, fallas, reparaciones, avatar | `expo-image-picker.launchCameraAsync` (no hay `expo-camera`); **hoy sin pedido ni lectura**, el fallo cae en una alerta genérica | `<input type=file>` (el navegador pide solo) | hoy: ninguno → objetivo: leer `getCameraPermissionsAsync` y pedir antes de abrir (nombres a verificar en docs Expo v57) | "Elegir de la galería" + botón de ajustes |
| `photos` | **Explorar la galería por mes** con fecha real (Importar) | `requestPermissionsAsync(false,['photo'])` (granular); elegir fotos en formularios usa el selector del sistema **sin permiso** | Selector del sistema | hoy: al montar `album/importar` (en frío) → objetivo: al tocar "Importar de la galería" | "Elegir de a una" (selector) + ajustes |
| `battery_unrestricted` | Que Android/MIUI no mate la detección automática | **Ya existe** (`modules/miui-autostart`: estado `unrestricted/optimized/unknown`, abre ajustes) | N/A | al activar Automático | Estado + guía |
| `storage_persist` | Que el navegador no borre datos locales | N/A | **Ya existe** (`capabilities.ts:58`, `(tabs)/_layout.tsx:27`): una vez tras el primer vehículo | solo lectura en el registro | Aviso discreto |
| `install_unknown_apps` | Instalar el APK de una actualización | `REQUEST_INSTALL_PACKAGES` (pantalla del sistema) | N/A | al tocar "Actualizar" (`lib/updates/apk.ts`) | Mensaje + ajustes |

PROMPT-00 auditó lo que la app **realmente** declara y usa (hecho: `permissions-inventory.md`); PROMPT-02 implementa esta tabla corregida. Falta el manifiesto fusionado real (`aapt dump permissions` sobre el APK de prueba).

## API propuesta
```ts
type PermissionId = 'location_foreground' | 'location_background' | 'notifications'
  | 'camera' | 'photos' | 'battery_unrestricted' | 'storage_persist' | 'install_unknown_apps';
type PermissionStatus = 'granted' | 'undetermined' | 'denied_can_ask'
  | 'denied_blocked' | 'services_off' | 'unavailable' | 'unknown';
interface PermissionDef {
  id: PermissionId; titleKey: string; whyKey: string;
  platforms: ('android' | 'web')[]; usedBy: FeatureId[];
  check(): Promise<PermissionStatus>;
  request(): Promise<PermissionStatus>;          // solo tras el primer
  openSettings?(): Promise<void>;                // Android: Linking.openSettings()
  manualSteps?: string[];                        // claves i18n con pasos (iPhone web)
}
usePermission(id): { status; request; openSettings; recheck; steps }
<PermissionGate id feature fallback> // envuelve una función; muestra primer o CTA
<PermissionPrimerSheet id>          // hoja de explicación antes del diálogo
<PermissionChip id>                 // botón compacto para mapas/barras
<PermissionBanner ids>              // banner de lo que falta
```
Estados: `denied_can_ask` = se puede volver a preguntar (Android `canAskAgain`, web "prompt" tras un cierre); `denied_blocked` = solo ajustes; `services_off` = servicios de ubicación del teléfono apagados (distinto de permiso de la app); `unavailable` = sin hardware o contexto inseguro (no HTTPS).

## Web / iPhone (VERIFICAR en el iPhone real; marcado como no verificado)
- `navigator.permissions.query({name:'geolocation'})` existe en Safari 16+; úsalo para leer el estado sin disparar el diálogo. Si falla, sondea con `getCurrentPosition` solo después del primer.
- Errores de `getCurrentPosition`: código 1 = permiso negado (en iOS también puede significar Servicios de ubicación apagados), 2 = posición no disponible, 3 = tiempo agotado. Distingue en el mensaje y ofrece "Reintentar".
- Una web no puede abrir los ajustes de iOS. Mostrar pasos exactos con imagen o texto: Ajustes → Privacidad y seguridad → Localización (Servicios de localización) → Sitios web de Safari (o la entrada de Car Guy si está en el inicio) → "Preguntar" / "Al usar la app". Verifica el texto exacto en el teléfono y corrige los textos.
- Las PWA de iOS pueden volver a preguntar en cada apertura según la versión: documentarlo en `findings.md` tras probarlo; si ocurre, no tratar el nuevo diálogo como error.
- Requiere HTTPS (Vercel ya lo cumple).

## Android (APK)
- `canAskAgain === false` → botón "Abrir ajustes" (`Linking.openSettings()`).
- Segundo plano en Android 11+: primero foreground, luego `requestBackgroundPermissionsAsync`; el sistema lleva a ajustes ("Permitir todo el tiempo"); explicarlo en el primer con los pasos exactos en español.
- Batería/autoarranque (MIUI): `expo-intent-launcher` a la pantalla de ajustes correspondiente; no se puede leer el estado → "no verificable" y guía escrita (reutiliza el checklist MIUI).
- Cualquier cambio en permisos declarados (app.json/manifest) es **nativo → requiere APK nuevo**; la decisión OTA/APK la toma el script de release.

## Mapa: matriz de estados
| Estado | Cámara | Chip / CTA | Texto |
|--------|--------|------------|-------|
| granted + fix | Sigue al usuario; botón "Centrar en mí"; punto del usuario (avatar si ya existe) | — | — |
| granted + sin fix aún | Posición de respaldo | Chip "Buscando GPS…" con spinner y botón "Reintentar" tras 15 s | — |
| undetermined | Respaldo | Botón "Activar ubicación" → primer → diálogo | "Para mostrarte en el mapa…" |
| denied_can_ask | Respaldo | Botón "Permitir ubicación" | Qué se pierde |
| denied_blocked | Respaldo | Botón "Abrir ajustes" (Android) / "Cómo activarla" con pasos (iPhone) + "Ya la activé" (recheck) | — |
| services_off | Respaldo | "Activa los servicios de ubicación del teléfono" + pasos | — |
| unavailable | Respaldo | Explicación (no HTTPS / sin GPS) | — |
Cámara de respaldo, en orden: última posición conocida guardada (con "hace X") → centro de los viajes recientes → Santo Domingo (18.4861, -69.9312). No usar la casa ni datos personales.

## Copy de ejemplo (es; crear también en.ts)
- Primer ubicación: "Para mostrarte en el mapa y grabar tus viajes, Car Guy necesita tu ubicación mientras la app está abierta." Botones: "Permitir ubicación" / "Ahora no".
- Bloqueado (iPhone): "La ubicación está bloqueada para Car Guy. Actívala en Ajustes y vuelve aquí; te muestro cómo." + pasos + "Ya la activé".
- Automático sin segundo plano: "El modo Automático necesita que ubicación esté en 'Permitir todo el tiempo'. Sin eso, Car Guy solo graba viajes manuales."

## Pantalla "Permisos" (Más → Permisos y acceso; también badge en Herramientas si falta algo)
Lista con ícono, nombre, para qué sirve, estado (Permitido / Falta / Bloqueado / No verificable) y botón "Dar permiso" o "Abrir ajustes" o "Cómo activarla". Solo muestra lo que aplica a la plataforma. Un botón "Revisar de nuevo" fuerza `recheck`.

## Bienvenida
Usuarios nuevos: un último paso del tutorial ("Activa lo que necesitas") con las filas de permisos relevantes, sin forzar. Usuarios existentes: el primer aparece en contexto la primera vez que usan cada función; bandera `permissions_primer_v1_seen`.

## X6
La tarjeta "En iPhone (web) Car Guy solo graba viajes manuales…" en Modo conducir se compacta (sin hueco vacío) y comparte espacio con el estado de permisos; "¿Por qué?" abre el detalle en una hoja.

## Pruebas
- Unitarias: mapeo de estados por plataforma (mocks de expo-location, Permissions API, códigos de error).
- Playwright (web, viewport 390×844, UA iPhone): permisos `granted`, `denied`, `prompt`; sin red de tiles; verifica cámara, chip y CTA por estado, con capturas.
- Componentes: Gate, Primer, Chip, Banner; recheck al volver a la app (simular `visibilitychange`).
- Manual (checklist): iPhone y Redmi.
