# PROMPT-02 — Permisos y mapa

Continúas el ciclo IMP 16102026. Lee `00-context/BRIEF.md` (reglas permanentes), `00-context/NOTAS-ORIGINALES.md`, `02-specs/SPEC-A-permisos-y-mapa.md`, `permissions-inventory.md` y `findings.md`. **Nada espera una decisión**: default recomendado, registrarlo en `PROGRESS.md`, seguir. Implementa la tabla de permisos **real** de la fase 0 (la de SPEC-A es una guía). **Punto de partida**: ya hay llamadas dispersas, un banner con re-lectura en `components/trips/TripPieces.tsx`, la pantalla `app/viajes/permisos.tsx` y `Recenter`/`UserDot` en `components/map/`; reúne y reutiliza eso detrás del registro, no lo reescribas desde cero. Lee los docs versionados de Expo v57 antes de tocar expo-location/notifications.

## Alcance (N1, N2, N3, X6)

1. **Registro y hook (ADR-59)**: `PermissionDef`, `usePermission`, estados `granted / undetermined / denied_can_ask / denied_blocked / services_off / unavailable / unknown`, implementaciones Android (expo-location, notifications, image-picker/camera, intent launcher) y web (Permissions API con respaldo, códigos de error 1/2/3 de geolocalización, `storage.persist` si aporta). Re-lectura del estado al volver a la app (`AppState` `active` y `visibilitychange`).
2. **Componentes**: `PermissionPrimerSheet` (explica el porqué antes del diálogo del sistema; botones "Permitir" y "Ahora no"), `PermissionGate`, `PermissionChip`, `PermissionBanner`. Textos es/en tipados (ejemplos en SPEC-A). Nunca se pide en frío.
3. **Salida para el usuario cuando falta un permiso (N3)**: en cada lugar donde una función falla por permiso hay un botón: "Permitir" (si se puede volver a preguntar), "Abrir ajustes" (Android, `Linking.openSettings()`), o **pasos exactos con "Ya la activé"** (iPhone web, que no puede abrir ajustes). Segundo plano en Android 11+: flujo en dos pasos con las instrucciones de "Permitir todo el tiempo". Batería/MIUI: lleva a la pantalla de ajustes y reutiliza el checklist MIUI; estado "no verificable".
4. **Pantalla "Permisos y acceso"** (Más → Permisos; la fase 4 también la enlaza desde Herramientas): una fila por permiso aplicable a la plataforma con ícono, para qué sirve, estado y botón de acción; botón "Revisar de nuevo".
5. **Puntos de uso**: Modo conducir (ubicación; Automático → segundo plano + notificaciones), cámara en fotos (carro, fallas, reparaciones futuras), importar fotos antiguas (preferir selector del sistema), recordatorios (notificaciones), mapa del detalle de viaje.
6. **Mapa (N1)**: implementa la matriz de SPEC-A: cámara de respaldo (última posición conocida guardada con "hace X" → centro de viajes recientes → Santo Domingo 18.4861, -69.9312), seguimiento al usuario con permiso, botón "Centrar en mí", chip "Buscando GPS…" con "Reintentar" a los 15 s, chip/botón por cada estado. Persistir `last_fix`. Corrige los `M-n` marcados "fase 2".
7. **X6**: la tarjeta "En iPhone (web) Car Guy solo graba viajes manuales con la pantalla abierta" se compacta sin hueco y comparte espacio con el estado de permisos; "¿Por qué?" abre el detalle en una hoja.
8. **Bienvenida**: último paso "Activa lo que necesitas" para usuarios nuevos; para existentes, el primer aparece en contexto la primera vez (bandera `permissions_primer_v1_seen`).
9. **Nativo**: cualquier cambio en permisos declarados requiere APK (versionCode 22 o el siguiente; `tools/release-apk.sh`, `releases/fingerprint.json`). Los cambios solo de JS salen por OTA según `tools/ota-gate.cjs`.
10. **Pruebas**: unitarias de mapeo de estados (mocks); Playwright con `granted`, `denied`, `prompt`, sin tiles (390×844, UA iPhone) con capturas por estado; componentes Gate/Primer/Chip/Banner; recheck al volver; test que falla si una llamada de permiso se hace fuera del registro.
11. **Docs**: ADR-59 y ADR-64 en `docs/`, `PROGRESS.md`, entradas es/en en Novedades.

## Criterios de aceptación
Cada permiso aplicable se pide con explicación y en contexto; con cualquier permiso negado/bloqueado hay botón en el sitio y fila en Permisos con salida; al volver de ajustes el estado se corrige solo; el mapa nunca queda sin cámara ni con aviso pasivo; capturas de cada estado de SPEC-A; tests en verde; defectos `M-n` de fase 2 cerrados.

## No verificado (déjalo marcado en `findings.md` tras probar)
Comportamiento de permisos en PWA de iOS (¿pregunta en cada apertura?), texto exacto de Ajustes en iOS en español, y si `storage.persist` aporta en iOS. Si no puedes probar en un iPhone real, anótalo y pásalo al checklist manual; no inventes.

## Reporte final
Tabla de permisos implementados con su estado por plataforma, defectos de mapa cerrados, qué quedó "no verificado", y si la publicación fue OTA o APK.
