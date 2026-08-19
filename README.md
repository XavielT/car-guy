# Tu Combustible RD

App móvil (Expo / React Native) para registrar cargas de combustible en República Dominicana: gasto en RD$, galones (o m³ de GNV) y consumo real km/gal.

Plan completo, reglas de dominio y precios MICM semilla: [docs/PLAN.md](docs/PLAN.md).

## Qué hace

- Vehículos con tipo de combustible (Premium, Regular, Gasoil Regular/Óptimo, GLP, GNV)
- Cargas con fecha, odómetro, estación, tanque lleno o parcial
- Cuenta automática: llena dos de tres (volumen, precio/unidad, total)
- Consumo brim-to-brim entre tanques llenos
- Tablero del mes, historial, cifras por tipo y mes a mes
- Precios oficiales de referencia (editables). Datos solo en el teléfono

## Correrla

```bash
npm start
```

Luego abre Expo Go en el teléfono, o `w` para web.

## Instalar en Android

El identificador Android es `com.xavieltucombustiblerd.app`. No lo cambies después de publicar: Android lo usa para reconocer que una nueva versión pertenece a la misma app.

Para generar un APK instalable de prueba o un AAB para Google Play, instala EAS CLI e inicia sesión en Expo:

```bash
npm install --global eas-cli
eas login
eas build:configure
eas build --platform android --profile preview
```

El perfil `preview` genera un APK instalable. El perfil `production` genera el paquete de publicación y aumenta automáticamente el `versionCode`. EAS guarda la keystore de Android de forma remota; conserva esa misma keystore para que las actualizaciones sean aceptadas como la misma aplicación.

## Datos al actualizar

Las cargas, vehículos y precios se guardan localmente en `AsyncStorage` bajo la clave `tu-combustible-rd/v1`. Instalar una nueva versión encima de la anterior conserva esos datos, siempre que se mantengan el mismo `android.package`, la misma firma/keystore y no se borren los datos de la aplicación. No uses `adb install -r` con un paquete firmado con otra keystore.

Antes de cambiar el formato de los datos, agrega una migración en `lib/storage.ts` y conserva la lectura de las versiones anteriores. Desinstalar la app o usar "Borrar todos los datos" sí elimina la información local.

## Unidades

Kilómetros en el tablero, galones en la bomba, pesos dominicanos. GNV se registra en m³.
