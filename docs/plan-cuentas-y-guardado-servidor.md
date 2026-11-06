# Plan de cuentas y guardado en servidor

Estado: la implementación de cuentas y progreso en servidor está descrita en [Cuentas y progreso en servidor](cuentas-servidor.md). El proyecto Supabase ya está creado; el correo público queda pendiente por decisión del usuario. Las dos entregas están implementadas, incluida la continuación de incursiones y el control de sesión. El frontend actualizado permanece en este workspace; correo y publicación en un dominio de producción quedan pendientes. El resto de este documento conserva el plan y sus criterios de aceptación.

## Resultado buscado

Cada jugador tiene una cuenta y un progreso propio. Puede cerrar sesión, entrar con otra cuenta en el mismo dispositivo y recuperar su perfil desde otro celular o PC. El juego identifica qué cambios están guardados en el servidor y cuáles siguen pendientes.

El plan se organizó en dos entregas: **cuentas y progreso permanente primero**, y **continuación de incursiones después**. La experiencia y las evoluciones siguen perteneciendo a cada incursión; guardarlas para reanudar no las convierte en mejoras permanentes.

## Punto de partida anterior a la implementación

- Cliente Vite + TypeScript + Pixi.js, sin servidor de cuentas en el repositorio.
- `ProfileStore` modifica un perfil único en memoria y lo guarda en `localStorage`.
- `SettingsStore` guarda los ajustes en el navegador.
- `RunController` registra estadísticas al terminar, reiniciar, abandonar o recibir `pagehide`. No existe un identificador persistente de incursión ni un guardado para continuarla.
- `LevelManager` puede reconstruir un piso a partir de una semilla, pero la semilla no conserva enemigos eliminados, objetos recogidos, puertas abiertas ni cambios del escenario.
- No encontré configuración de despliegue que obligue a cambiar de proveedor de alojamiento. El cliente puede seguir publicándose como sitio estático.

## Arquitectura propuesta

**Cliente actual → Supabase Auth para identificar al jugador → Postgres para sus datos.** Las operaciones que otorgan progreso pasan por funciones de servidor, con validación y transacciones.

Supabase es una recomendación para este proyecto: reúne autenticación y base de datos con permisos por usuario, y permite conservar el cliente actual. Su [documentación de Auth](https://supabase.com/docs/guides/auth) describe los métodos de acceso y la integración con la base de datos.

La base de datos aplica permisos por fila para que un jugador acceda solo a sus registros. El cliente lleva una clave pública y la sesión del usuario; las claves privilegiadas quedan exclusivamente en el servidor. Véanse [permisos por fila](https://supabase.com/docs/guides/database/postgres/row-level-security) y [tipos de claves](https://supabase.com/docs/guides/getting-started/api-keys).

No se necesita un servidor que reciba actualizaciones de cada fotograma. El combate sigue ejecutándose en el dispositivo; la sincronización ocurre fuera del ciclo de simulación.

## Entrega 1: cuentas y progreso permanente

### 1. Acceso y cambio de usuario

- Crear cuenta con correo y contraseña, verificar el correo, iniciar sesión, recuperar contraseña y cerrar sesión.
- Conservar **Jugar como invitado**, identificado como progreso local.
- Usar un identificador de cuenta estable; el alias visible no sirve como identidad ni necesita ser único.
- Al iniciar sesión, cargar el perfil correcto antes de habilitar su uso en una incursión. Un error de carga no debe crear un perfil vacío que sobrescriba el existente.
- Al cerrar sesión, guardar y suspender la incursión activa, cancelar peticiones anteriores y retirar de pantalla y memoria los datos privados de esa cuenta.
- La interfaz incluye estados de carga y errores recuperables. El SDK de autenticación administra la sesión; el juego no implementa su propio sistema de contraseñas.
- Incorporar Google en una ampliación posterior, con un flujo definido para vincularlo a una cuenta existente y evitar perfiles duplicados.

**Criterio de cierre:** crear dos cuentas, alternarlas en un navegador y recuperar cada una en otro dispositivo sin mezclar progreso.

Para abrir el registro por correo al público hay que configurar envío de correos de producción, dominio remitente y URLs de verificación y recuperación. El SMTP de prueba de Supabase tiene restricciones y no está destinado a producción, según su [guía de correo](https://supabase.com/docs/guides/auth/auth-smtp).

### 2. Modelo de datos y permisos

| Datos | Propósito | Quién puede cambiarlos |
| --- | --- | --- |
| `profiles` | ID de cuenta, alias, último operativo, versión y fechas. | El propietario, con validación de los campos permitidos. |
| `player_progress` | Eliminaciones, incursiones, mejor piso, tiempo y récord de créditos. | Funciones de servidor que procesan reportes de incursión. |
| `character_stats` | Estadísticas por operativo. | El mismo procesamiento de servidor. |
| `unlocked_cosmetics` | Cosméticos desbloqueados y origen del desbloqueo. | El servidor, aplicando el catálogo y los requisitos. |
| `character_looks` | Apariencia, arma, marco y pose elegidos para cada operativo. | Operación validada: todos los elementos deben estar desbloqueados para esa cuenta. |
| `player_preferences` | Preferencias que conviene compartir, inicialmente volumen y silencio. | El propietario. |
| `run_sessions` | ID de incursión, propietario, semilla, operativo, estado, revisión y último reporte aceptado. | Operaciones de servidor autenticadas. |
| `legacy_imports` | Registro único de una importación del progreso local previo. | El proceso de importación. |

Todas las tablas de jugador llevan su ID de cuenta. Los permisos se prueban tanto para lectura como para escritura. Las estadísticas y los desbloqueos no se editan subiendo un JSON completo del perfil desde el navegador.

La resolución, los FPS y el suavizado permanecen en el dispositivo: una configuración adecuada para PC puede funcionar mal en un celular. No son progreso del personaje.

**Criterio de cierre:** una cuenta no puede leer, modificar ni borrar registros de otra, aunque altere una petición manualmente.

### 3. Guardado y sincronización

- Introducir una capa de almacenamiento para conservar las operaciones de `ProfileStore` sin acoplar los menús directamente al proveedor.
- Separar estado local inmediato, operaciones pendientes y última revisión confirmada por el servidor. Dar una respuesta inmediata al usuario y mostrar el estado real de guardado.
- Guardar alias y personalización al modificarlos, agrupando cambios rápidos para evitar peticiones innecesarias.
- Asignar un ID único a cada incursión. Enviar reportes acumulados, numerados, al cambiar de piso, pausar y aproximadamente cada 15 segundos mientras haya cambios. Al terminar se envía un reporte final.
- Validar el propietario, el formato, los valores y las transiciones permitidas. Procesar cada reporte de forma atómica; un reintento no duplica eliminaciones, tiempo, recompensas ni incursiones.
- Calcular los incrementos respecto del último reporte aceptado. No volver a sumar el total de la incursión en cada envío ni sumar de nuevo los incrementos al finalizar.
- Aceptar reportes repetidos como reintentos sin efecto adicional; ignorar reportes viejos. Un reporte final cierra la incursión una sola vez. Definir el cierre de sesiones abandonadas a partir del último reporte aceptado para los casos en que no llegue el evento de cierre del navegador.
- Mantener una cola local separada por ID de cuenta para reintentar cuando vuelva la conexión. Nunca enviar operaciones de A usando la sesión de B.
- Resolver actualizaciones simultáneas con revisiones del servidor. Las estadísticas de incursiones distintas se agregan por transacción; una elección cosmética desactualizada no sobrescribe silenciosamente una revisión más nueva.
- Mostrar **Guardando**, **Guardado en servidor** y **Sin conexión · cambios pendientes**, según corresponda. No indicar éxito antes de la confirmación remota.
- El invitado sigue usando un espacio local separado. El caché de una cuenta nunca se convierte automáticamente en el perfil de invitado.

**Criterio de cierre:** un cambio aparece al entrar en otro dispositivo; un corte de conexión y un reintento no pierden ni duplican los reportes aceptados. Los cambios todavía pendientes requieren conservar el dispositivo y su almacenamiento local hasta sincronizarse.

### 4. Importar el progreso que ya existe

- Detectar el perfil local anterior y ofrecer una vista previa al crear una cuenta con progreso vacío.
- Pedir al jugador que elija importar o empezar de cero. No importar el mismo navegador automáticamente a cada cuenta que se registre.
- Validar los datos, registrar la importación una sola vez y conservar una copia local hasta recibir confirmación.
- Si la cuenta ya tiene progreso en servidor, cargarlo sin fusionar automáticamente los totales locales. Una herramienta de fusión puede incorporarse después con reglas explícitas.
- Marcar el origen como progreso importado: el perfil local es editable por el jugador y no constituye prueba de resultados legítimos.

**Criterio de cierre:** repetir la importación, recargar o iniciar otra cuenta no duplica ni transfiere el progreso ya importado.

### 5. Integración con las pantallas

- Inicio: acceso a la cuenta, alias, cerrar sesión y estado de sincronización.
- Acceso: crear cuenta, entrar, recuperar contraseña y seguir como invitado.
- Perfil: identificar progreso local o cuenta conectada y mostrar fecha del último guardado confirmado.
- Pausa: guardar el reporte de progreso sin prometer todavía que se puede recuperar la incursión completa.
- Separar **reiniciar progreso** de **eliminar cuenta**. Ambas acciones requieren una confirmación clara; eliminar la cuenta también elimina sus datos asociados mediante una operación autorizada de servidor.

**Criterio de cierre:** el jugador entiende qué cuenta está usando, si sus cambios llegaron al servidor y qué significa salir del juego.

## Entrega 2: continuar una incursión

Esto agrega **Continuar incursión** después de cerrar la página o cambiar de dispositivo. Los reportes de estadísticas de la primera entrega no son suficientes para reconstruir el mundo.

1. Crear un formato de guardado versionado que incluya semilla, versión del generador, piso, personaje, posición, vida, escudos, armas, cargadores y reservas, implantes, créditos, llaves, tiempo, XP, evoluciones y estado de habilidades.
2. Conservar también enemigos vivos y su estado relevante, botín y objetos recogidos, contenedores, puertas, terminales, obstáculos destruidos y mapa explorado. No guardar objetos de Pixi, texturas ni identificadores temporales del motor como si fueran persistentes.
3. Implementado: capturas después del paso de simulación al cambiar de piso, pausar, elegir evolución y cada 15 segundos. Se conservan proyectiles activos y sus impactos, ruido, alarmas, trampas y tiempos de habilidades. El menú muestra la hora del último punto confirmado.
4. Restaurar primero el mundo y después el personaje y su progreso, sin volver a otorgar botín, XP o recompensas ya procesadas. Conservar las elecciones de mejora pendientes y su oferta cuando corresponda.
5. Autorizar una sola continuación activa de la misma incursión mediante una concesión temporal renovable y una versión emitida por el servidor. Transferirla a otro dispositivo invalida las escrituras de la sesión anterior.
6. Aceptar una instantánea solo si pertenece al usuario y corresponde a una sesión y versión válidas. Mostrar un mensaje claro si una actualización del juego no puede restaurar un guardado antiguo; nunca descartarlo silenciosamente.
7. Al morir o abandonar, cerrar la incursión y retirar la opción Continuar. La subida de estadísticas sigue siendo idempotente.

**Criterio de cierre:** guardar en móvil, cerrar, entrar desde PC y continuar desde el punto confirmado sin enemigos, cofres, monedas o recompensas duplicados. La misma incursión no puede avanzar en dos dispositivos a la vez.

## Seguridad y operación necesarias para publicar

- Entornos separados de desarrollo y producción, migraciones de base de datos y configuración de dominio y redirecciones.
- Verificación de sesión en servidor; el ID de usuario se obtiene de ella, no de un campo libre enviado por el cliente.
- Permisos por usuario, validación de catálogos, límites de tamaño y frecuencia de peticiones y registro de errores sin contraseñas ni tokens.
- Copias de seguridad y una restauración probada; controlar uso y alertas de consumo antes de abrir el registro al público.
- Revisar costes de base de datos, usuarios activos y correo al elegir el plan del proveedor. No se fija un importe ni se contrata un servicio en esta propuesta.
- El servidor puede validar reportes y calcular los desbloqueos, pero el combate sigue ejecutándose en el cliente. Esto no demuestra que una partida sea legítima frente a un cliente modificado. Rankings competitivos o compras necesitan un diseño de confianza adicional.

## Orden de implementación

| Paso | Entregable verificable |
| --- | --- |
| 1 | Proyecto de desarrollo, esquema, permisos y pruebas con dos usuarios. |
| 2 | Registro, verificación, acceso, recuperación y cierre de sesión en el menú. |
| 3 | Perfil remoto, caché por cuenta, personalización validada y preferencias. |
| 4 | Reportes de incursión, cálculo de progreso, reintentos e idempotencia. |
| 5 | Importación local, aislamiento entre cuentas y estados de sincronización. |
| 6 | Pruebas completas en PC y móvil; correo, dominio, restauración y despliegue de la primera entrega. |
| 7 | Formato y restauración de incursiones; puntos de guardado y control de continuación simultánea. |

## Pruebas de aceptación

- Dos usuarios en el mismo navegador conservan datos diferentes; ninguno puede consultar los del otro.
- Una cuenta en PC y móvil recupera estadísticas, operativo y personalización.
- Verificar correo y restablecer contraseña funciona con las URLs de producción.
- Una respuesta perdida y un reintento no duplican una incursión ni una recompensa.
- Cerrar sesión con cambios pendientes no envía esos cambios a la siguiente cuenta.
- Dos dispositivos aportan incursiones distintas sin perder incrementos de estadísticas.
- Un perfil remoto que no carga no es sustituido por valores vacíos.
- La migración local se aplica como máximo una vez y no suma datos a una cuenta existente sin decisión explícita.
- Sin conexión, la pantalla informa de cambios pendientes y conserva el caché de su propietario.
- Eliminar una cuenta no borra ni altera otra.
- En la segunda entrega, restaurar un punto de guardado no duplica enemigos eliminados, botín, XP ni mejoras.

## Archivos que cambiarían al implementarlo

Puntos principales existentes: `src/profile/ProfileStore.ts`, `src/profile/Profile.ts`, `src/settings/SettingsStore.ts`, `src/run/RunController.ts`, `src/main.ts` y las pantallas de inicio, perfil y pausa.

Se añadirían módulos de autenticación y sincronización, pantallas de acceso y recuperación, migraciones de base de datos, funciones de servidor y pruebas de permisos e integración. Para la segunda entrega también cambiarían `LevelManager`, el estado de la incursión y los sistemas que necesitan exportar y restaurar estado persistente.
