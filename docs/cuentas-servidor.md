# Cuentas y progreso en servidor

## Estado de las dos entregas

- Proyecto **BulletPunk** creado en **AlexisDaleiro's Org**, región São Paulo (`sa-east-1`). La cotización al crearlo fue US$0 al mes en el plan gratuito; controlar límites y consumo si cambia el uso o el plan.
- Proyecto: `ofrdykvobkvfbwlljbhx`. [Panel de Supabase](https://supabase.com/dashboard/project/ofrdykvobkvfbwlljbhx).
- Migraciones de cuentas, validación y `20261105033037_run_checkpoints.sql` aplicadas al servidor.
- Función `delete-account` publicada y probada con autenticación real.
- Cliente del juego conectado mediante `.env.local`, excluido de Git. `.env.example` documenta las variables necesarias para otro entorno.
- Registro y recuperación por correo **pendientes de habilitación por decisión del usuario**. No se desactivó la verificación de correo. Las cuentas ya confirmadas pueden entrar y guardar progreso; el invitado sigue disponible.
- Segunda entrega implementada: **Continuar**, **Guardar y salir**, guardado del mundo completo y traspaso explícito de la sesión entre PC y móvil. Una cuenta conserva una incursión en curso; el invitado la conserva solo en su navegador.

## Uso

El botón **Mi cuenta**, arriba a la derecha del inicio, abre acceso y administración. Una cuenta conectada conserva perfil, estadísticas, cosméticos, estilos por operativo, último operativo, volumen y silencio. Resolución, suavizado e indicador de FPS permanecen en el dispositivo.

El perfil de invitado conserva las claves locales anteriores. Al entrar a una cuenta no se sobrescribe ese perfil. Al salir vuelve a mostrarse el invitado. Una cuenta nueva y sin actividad puede importar el perfil local con confirmación y vista previa; la importación es única y la base de datos impide reutilizarla en otra cuenta mientras exista la importación anterior.

La pantalla informa de carga, guardado confirmado, cambios pendientes, desconexión y conflictos. Al detectar cambios de otro dispositivo, se ofrecen **Usar datos del servidor** y **Conservar mis cambios**. Un reinicio de progreso invalida los reportes de la generación anterior; no se pueden aplicar para restaurar datos borrados.

Cerrar sesión guarda y suspende una incursión activa antes de cambiar el perfil. Si falla la conexión, conserva la copia pendiente vinculada al propietario; otro dispositivo solo puede recuperar lo confirmado por el servidor. Las operaciones pendientes conservan el ID de su propietario y solo se envían cuando vuelve a entrar esa cuenta. Un error de carga sin caché confirmado bloquea el despliegue y las modificaciones del perfil, en lugar de subir valores vacíos.

## Qué se guarda durante una incursión

Cada incursión tiene un UUID y reportes acumulados con número de secuencia. Se encolan instantáneas al cambiar de piso, pausar, elegir una evolución y aproximadamente cada 15 segundos mientras se juega. Al morir o abandonar se envía el cierre. Los reportes no bloquean el ciclo del combate.

El servidor suma solo la diferencia respecto del último reporte, calcula desbloqueos y cuenta la incursión terminada una sola vez. Los reintentos de una operación o de un reporte no vuelven a otorgar estadísticas ni recompensas.

El punto guardado incluye semilla y versión del generador, piso, posición y movimiento, vida, escudo, armas y cargadores, reservas, recarga, implantes, habilidades activas y sus tiempos, créditos, llaves, XP y evoluciones. Conserva enemigos y su IA, botín presente, cofres y compras usados, terminales, puertas, secretos, obstáculos dañados o destruidos, trampas, alarmas, ruido, proyectiles activos y mapa explorado. También conserva las tres opciones de evolución pendientes. Los efectos puramente decorativos no forman parte del guardado.

La captura ocurre después de vaciar la cola de destrucción del paso de simulación. Al restaurar se regenera el mapa base y se valida su huella, se aplican sus cambios y se reconstruyen solo las entidades guardadas, con referencias remapeadas. No se repuebla el piso ni se vuelven a otorgar recompensas. Se conservan la copia y un mensaje de error si el formato o el mundo son incompatibles.

**Guardar y salir** espera la confirmación del servidor y libera la sesión antes de volver al inicio. **Continuar** recupera el último punto confirmado. Crear otra incursión requiere confirmar el descarte del guardado anterior. Morir, abandonar o reiniciar cierra la incursión una sola vez y retira su continuación. Cerrar o recargar la página ya no la finaliza automáticamente; `pagehide` conserva una copia local y trata de sincronizarla, sin prometer que el navegador complete una petición al salir.

Cada sesión renueva una concesión de 40 segundos, con latidos aproximadamente cada 8 segundos. El cliente detiene la incursión si pasan 25 segundos sin confirmación, y necesita conexión para continuar con una cuenta. Otro dispositivo pide confirmar **Continuar aquí y cerrar la otra sesión** cuando la concesión sigue activa. El servidor valida propietario, generación, cliente y revisión en cada escritura; una sesión sustituida deja de poder guardar. Los dos dispositivos pueden mostrar brevemente su simulación hasta detectar el traspaso, pero solo el autorizado puede confirmar avances.

Una respuesta perdida se reintenta con el mismo ID de operación. Las estadísticas y la instantánea se confirman en la misma transacción. Una copia local pendiente solo se aplica sobre el mismo punto base del servidor; si este cambió, se requiere elegir explícitamente la copia del servidor. Nunca se mezcla automáticamente el mundo de dos dispositivos.

Un cierre forzado puede perder lo ocurrido desde el último punto persistido. El inicio indica el piso y la hora de confirmación. Los cambios pendientes necesitan que el dispositivo conserve su almacenamiento hasta que se envíen al servidor. La XP y las evoluciones siguen perteneciendo a esa incursión, sin convertirse en ventajas permanentes.

## Modelo implementado

Se usa un documento de perfil compatible con el formato local v2 dentro de `bp_profiles`, con revisión y generación de progreso, en lugar de normalizar cada estadística en una tabla distinta. Esto conserva el contrato que usan los menús. El cliente no puede modificar directamente ese documento en la base de datos.

- `bp_profiles`: documento de perfil, preferencias, revisión y generación.
- `bp_checkpoints`: una instantánea versionada por usuario, revisión, cliente autorizado, vencimiento y cierre.
- `bp_runs`: último reporte acumulado de cada incursión y si ya finalizó.
- `bp_operations`: IDs de operaciones aceptadas, para reintentos idempotentes.
- `bp_legacy_imports`: importaciones de perfiles locales.
- `bp_cosmetic_catalog`: catálogo y requisitos usados por el servidor.

El RPC público `bp_checkpoint` usa `SECURITY INVOKER` y delega en funciones del esquema privado `bp_private`. Las tablas no conceden escritura directa y el guardado permite leer solo la fila propia. Las concesiones y los contadores se verifican bajo bloqueo de filas en un orden constante.

Las funciones autenticadas `bp_load_profile`, `bp_apply_profile`, `bp_report_run`, `bp_import_local` y `bp_reset_progress` validan la sesión y el propietario. Las tablas permiten leer solo los registros propios y no conceden escritura directa al cliente. Los desbloqueos y las estadísticas se calculan dentro de transacciones del servidor.

Las funciones de mutación son `SECURITY DEFINER` intencionalmente, con `search_path` vacío, parámetros validados, propietario comparado contra `auth.uid()` y acceso anónimo revocado. El asesor de Supabase informa de esas funciones autenticadas por diseño. `bp_operations` no tiene política de lectura porque es un registro privado del servidor. Referencias de los avisos: [funciones privilegiadas](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) y [RLS sin política](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

La función de eliminación verifica el token mediante Auth y comprueba que el propietario solicitado sea ese mismo usuario. Utiliza la clave administrativa solo dentro del servidor y elimina los datos relacionados por cascada. Ninguna clave administrativa se incorporó al juego. El asesor también informa que la detección de contraseñas filtradas está desactivada en Auth; revisar su disponibilidad y configuración antes de abrir el registro público: [seguridad de contraseñas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Como el combate ocurre en el cliente, estos reportes no demuestran legitimidad frente a un cliente modificado. El diseño cubre aislamiento, validación, sincronización y reintentos; no es todavía un sistema de partidas verificadas para rankings o compras.

## Configuración del cliente y del alojamiento

Variables de compilación:

```dotenv
VITE_SUPABASE_URL=https://ofrdykvobkvfbwlljbhx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<clave pública publishable del proyecto>
VITE_AUTH_EMAIL_ENABLED=false
```

La URL y la clave pública ya están en `.env.local` de este workspace. El SDK de autenticación administra la sesión. No poner claves secretas o `service_role` en variables `VITE_`: Vite las incorpora al código enviado al navegador.

Para publicar el frontend en otro alojamiento, cargar esas variables allí y reconstruir el sitio. El despliegue del servidor Supabase no actualiza por sí mismo un sitio estático publicado por separado. No se realizó una publicación del frontend en este trabajo.

Sin configuración válida, el juego conserva el modo invitado y la pantalla de cuentas explica que el servicio no está configurado.

## Habilitar el correo cuando haya dominio y proveedor

1. Configurar un proveedor SMTP y un remitente autorizado en Supabase → Authentication → Email/SMTP. Introducir las credenciales directamente en el panel del proveedor, no en el juego.
2. Configurar **Site URL** y las URLs de redirección de verificación y recuperación para el dominio real del juego. La redirección vuelve a la raíz de la aplicación; recuperación agrega `?account=recovery`.
3. Mantener activada la confirmación de correo y establecer una longitud mínima de contraseña de al menos 8 caracteres también en el servidor. El cliente ya aplica ese mínimo para registro y recuperación.
4. Probar registro, recepción del mensaje, confirmación, acceso, enlace de recuperación y nueva contraseña con cuentas de prueba.
5. Establecer `VITE_AUTH_EMAIL_ENABLED=true` y reconstruir/publicar el cliente. Hasta entonces los formularios de registro y recuperación explican que están pendientes y no envían mensajes.

`supabase/config.toml` incluye la configuración para desarrollo local; ese archivo no cambia automáticamente los ajustes del proyecto remoto. El envío de prueba integrado de Supabase tiene restricciones y no sustituye un proveedor de correo para producción: [guía oficial de SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

## Verificación realizada

- Pruebas locales con Postgres real mediante PGlite: dos usuarios, permisos de lectura y escritura, helpers privados, cosméticos bloqueados, tipos inválidos, conflictos de revisión, reportes repetidos, finalización, importación única, reinicio e invalidación de reportes anteriores.
- Pruebas de la cola: desconexión, recarga, caché de invitado separado, preferencias de cuenta sin transferir calidad gráfica, respuestas tardías de otra cuenta, carga fallida y resolución explícita de conflictos.
- Navegador contra el proyecto real: acceso de dos cuentas temporales confirmadas, importación local, cambio de alias y estilo, volumen, reportes de incursión, recarga, recuperación desde un segundo contexto móvil, corte y vuelta de conexión, cierre de sesión, aislamiento entre cuentas y denegación de acceso cruzado.
- Eliminación real de una cuenta temporal mediante su propia sesión y la función publicada. Las cuentas temporales se eliminan al terminar la revisión; no se crearon cuentas de jugadores reales ni se enviaron correos a terceros.
- Segunda entrega: Postgres verifica exclusión, traspaso, vencimiento, liberación, revisión obsoleta, reintentos, cierre, sustitución explícita y reinicio de generación. En navegador se comparó el mundo PC → móvil, incluyendo munición infinita, obstáculos parcialmente dañados, proyectiles y referencias, botín, niebla y mejoras pendientes. También se probó una copia pendiente tras desconexión, una respuesta perdida después del commit, continuación en piso 2 y cierre por muerte/abandono sin duplicar estadísticas.
- La verificación y recuperación por correo no se probaron con un proveedor real porque su configuración queda pendiente. Tampoco se probó una publicación del frontend en un dominio de producción.

Para repetir las pruebas locales: `npm test` y `npm run build`. Las migraciones están versionadas en `supabase/migrations`; probarlas en una base vacía antes de aplicarlas a otro entorno.
