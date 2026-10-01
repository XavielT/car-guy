# Política de privacidad de Car Guy

**Versión 2026-10** · vigente desde el 1 de octubre de 2026

## 1. Quién es el responsable

**Xaviel Terrero**, en la República Dominicana, responsable de Car Guy (proyecto personal). Contacto: **xavieldev@gmail.com**.

## 2. Lo esencial

- Sin cuenta, **tus datos se quedan en tu dispositivo** (SQLite en el teléfono, o el almacenamiento del navegador en la web). No los recibimos.
- Con cuenta, se copian a nuestro servidor para sincronizarlos y para lo que tú compartas.
- **No vendemos tus datos, no mostramos anuncios y no hacemos perfiles publicitarios.**

## 3. Qué datos tratamos

- **Ubicación precisa**, incluso **en segundo plano** (con la app cerrada o sin usarse), **solo cuando activas los viajes automáticos**, y en primer plano cuando inicias un viaje o usas el modo conducir. Sirve para detectar y registrar viajes, calcular distancia y velocidad y dibujar la ruta.
- **Datos del vehículo**: marca, modelo, año, kilometraje, cargas de combustible, mantenimiento, chequeos, mods, pista, gomas, costos, documentos y notas. **La placa y el VIN son opcionales.**
- **Viajes**: fecha, duración, distancia, velocidades y la ruta (puntos GPS).
- **Fotos y archivos**: del vehículo, recibos, documentos y tu foto de perfil.
- **Cuenta** (solo si creas una): tu correo, un identificador de usuario y, si los pones, tu nombre y avatar.
- **Comentarios** que nos envías desde la app: el mensaje, una captura de pantalla si la adjuntas, el correo si lo escribes y **información del dispositivo** (modelo, versión del sistema, versión de la app, pantalla en la que estabas y datos técnicos de diagnóstico, sin placas, VIN ni tu correo de sesión). No usamos el identificador de publicidad.
- **Aceptación de estos textos**: versión, fecha, idioma y plataforma.
- **Ajustes** de la app (idioma, unidades, preferencias).

## 4. Para qué y con qué base

- Para **prestar el servicio** que pides: guardar tu historial, sincronizarlo, compartirlo con quien tú elijas y responder tus comentarios.
- Con tu **consentimiento** para la ubicación (que la app te pide antes de activarla), las fotos y los comentarios. Puedes retirarlo cuando quieras desde la app o los ajustes del teléfono.

## 5. Dónde se guardan

- **En tu dispositivo**, siempre.
- **Con cuenta**, en **Supabase** (base de datos y almacenamiento de archivos privado), alojado en **AWS, región us-west-2, Estados Unidos**. Ese servidor lo comparten otras apps del mismo desarrollador; los datos de Car Guy están separados y protegidos por reglas de acceso por usuario.
- La **web de Car Guy** y sus funciones de servidor están en **Vercel**, que registra las solicitudes (incluida la dirección IP).

## 6. Terceros que intervienen

- **Supabase** y **Vercel**, como proveedores que guardan y sirven los datos por nosotros.
- **OpenFreeMap / OpenStreetMap**: los mapas se descargan de sus servidores; esas solicitudes **exponen tu dirección IP** y la zona del mapa que estás viendo.
- **GitHub**: el APK de Android se descarga de GitHub Releases, que ve tu dirección IP.
- **Las personas que tú eliges**: los miembros de un garaje compartido ven ese carro, y una ficha pública la ve cualquiera con el link (con lo que tú decidas mostrar).

No compartimos tu ubicación con nadie más.

## 7. Transferencias internacionales

Los servidores están **fuera de la República Dominicana** (Estados Unidos). Al crear una cuenta aceptas que tus datos se guarden allí.

## 8. Cuánto tiempo los guardamos

- **En el dispositivo**: hasta que los borres (en la app, con "Borrar datos locales", o al desinstalarla). Los **puntos GPS de cada viaje se guardan 30 días** en el dispositivo; el resumen del viaje se queda.
- **En el servidor**: mientras tengas la cuenta. Al **eliminar la cuenta** se borran tus datos, tus archivos y tu acceso; pueden quedar en las copias de seguridad automáticas del proveedor hasta que esas copias se renuevan.
- **Comentarios**: mientras sean útiles para arreglar o mejorar la app; los enviados con tu cuenta se borran al eliminarla.

## 9. Tus derechos (Ley 172-13)

Conforme a la **Ley 172-13 de Protección de Datos de Carácter Personal** de la República Dominicana, tienes derecho a **acceder** a tus datos, **rectificarlos**, **cancelarlos** (suprimirlos) y **oponerte** a su tratamiento.

- En la app puedes ver y corregir todo lo que registras, **exportarlo** y **eliminar tu cuenta** (Más → Cuenta → Eliminar cuenta).
- Para cualquier otra solicitud, escribe a **xavieldev@gmail.com**. Respondemos en los plazos que fija la ley.

## 10. Ubicación en segundo plano

- Solo se usa cuando **activas los viajes automáticos**. Antes de pedir el permiso, la app explica para qué es.
- Mientras se graba un viaje, Android muestra una **notificación permanente**.
- Puedes apagarlo en la app (Viajes → Ajustes) o en los ajustes del teléfono; los viajes manuales siguen funcionando.
- **No se comparte** con terceros.

## 11. Seguridad

Conexiones cifradas (TLS), reglas de acceso por usuario en la base de datos, almacenamiento de archivos privado y enlaces firmados para las fotos. Ningún sistema es infalible; si detectamos un incidente que te afecte, te avisaremos.

## 12. Menores de edad

Car Guy no está dirigido a menores de 13 años, y para crear una cuenta hay que tener 18 años o más. Si sabemos que un menor nos dio datos, los borramos.

## 13. Cambios

Si esta política cambia de forma importante, la app te lo avisa y te pide aceptarla de nuevo. La versión y la fecha están arriba.
