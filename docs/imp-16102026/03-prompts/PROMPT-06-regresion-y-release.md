# PROMPT-06 — Regresión y release v2.6.0 "Kōbō" 工房

Continúas el ciclo IMP 16102026. Lee `00-context/BRIEF.md` (reglas permanentes), `00-context/NOTAS-ORIGINALES.md` y `04-tracking/PROGRESS.md`. **Nada espera una decisión**: default recomendado, registrarlo y seguir. Si el número real de versión no es 2.6.0 (p. ej. porque ya existe), usa el siguiente minor correcto.

## Pasos
1. **Trazabilidad**: abre `NOTAS-ORIGINALES.md` y verifica una por una N1–N9 y X1–X7 con evidencia (test, captura o archivo:línea). Escribe la tabla de verificación en `docs/imp-16102026/VERIFICACION.md`. Si algo falla, **arréglalo aquí**; no lo dejes como pendiente.
2. **Regresión**: typecheck, lint, tests completos, build web, prueba de i18n (es/en con las mismas claves), prueba de auditoría de skeletons, prueba de guardia del registro de funciones, prueba de guardia de pickers, test de ida y vuelta de campos del vehículo; capturas a 320, 360 y 390 px de Inicio, vehículo (Resumen, Build, Eventos), Editar vehículo, Modo conducir, Herramientas, Permisos, Reparaciones.
3. **Revisión cruzada**: confirma que (a) ningún `SelectField` rompió valores guardados, (b) el sync no pisa valores nuevos, (c) la reparación respeta RLS y offline, (d) cada permiso tiene salida cuando falta, (e) no hay selección en línea fuera del picker.
4. **Docs**: ADR-59…64 en `docs/`, ARCHITECTURE y CHANGELOG al día, Novedades es/en en lenguaje de usuario ("Ahora puedes registrar reparaciones", "Herramientas", "Permisos"), `PROGRESS.md` completo.
5. **Release 2.6.0**: este es un release **nativo** (permisos nuevos y la huella ya cambiada por Firebase): APK con `tools/release-apk.sh` (versionCode siguiente, `releases/fingerprint.json` actualizado, asset estable `car-guy.apk` en GitHub Releases); luego los cambios solo de JS posteriores salen por OTA (`tools/ota-gate.cjs`). Verifica el despliegue web en Vercel y que `sql/040` y `sql/041` estén aplicados en `x-core` antes de anunciar. Actualiza `CHANGELOG.md` (es), `docs/NEXT.md` y `npm run changelog`. No pidas confirmación; si algo requiere credenciales que no tienes (llave FCM, claves de `x-core`), deja todo listo y dilo en el reporte.
6. **Lista para Xaviel**: actualiza `05-manual-checklist.md` con lo que solo él puede probar (iPhone real, Redmi, MIUI, pago/cuentas) y marca qué quedó "no verificado".
7. **Notas técnicas para el próximo ciclo**: ideas que surgieron y quedaron fuera (Wake Lock en iPhone, Web Push en la PWA, etc.) en `PROGRESS.md` → "Ideas".

## Criterios de aceptación
`VERIFICACION.md` con todas las notas en verde; suite completa verde; versión publicada; web desplegada; checklist manual actualizado.

## Reporte final (lenguaje claro, para Xaviel)
Qué cambió en la app en 8–10 líneas, versión y canal (OTA/APK), qué debe probar él, y qué quedó marcado como no verificado.
