# Guardado actual

El juego tiene dos modos de guardado:

| Modo | Dónde se guarda | Qué permite |
| --- | --- | --- |
| Invitado | En este navegador | Conservar perfil y una incursión en este dispositivo. |
| Cuenta conectada | En Supabase, con caché local por cuenta | Recuperar perfil, estilos y continuar la incursión desde otro dispositivo. |

El servidor de **BulletPunk** ya está creado y conectado en este workspace. El registro y la recuperación por correo quedan pendientes de habilitación por decisión del usuario, hasta configurar dominio y proveedor de correo. Las cuentas confirmadas pueden entrar; el invitado sigue disponible.

## Datos que persisten

- Alias y último operativo elegido.
- Estadísticas acumuladas y uso de cada operativo.
- Cosméticos desbloqueados y apariencia, acabado, marco y pose equipados.
- En una cuenta, volumen y silencio también se sincronizan. Resolución, FPS y suavizado permanecen en el dispositivo.

El invitado usa las claves locales anteriores. Cada cuenta tiene su propio caché y su cola de cambios pendientes; entrar o salir no sobrescribe el perfil de invitado. Una cuenta nueva puede importar el progreso local una vez, con confirmación.

El servidor valida los cambios y procesa reportes acumulados de incursión sin duplicar resultados al reintentarlos. El menú indica cuándo el guardado está confirmado y cuándo quedan cambios pendientes. Si un perfil remoto no carga y no hay caché confirmado, el juego bloquea el uso de esa cuenta hasta reintentar.

## Incursiones en curso

**Continuar** retoma el último punto guardado. En pausa, **Guardar y salir** espera la confirmación y conserva el mundo para retomarlo. Se guardan posición, vida, escudo, armas y munición, implantes, habilidades, créditos, llaves, XP, evoluciones y opciones pendientes, además de enemigos, botín, puertas, cofres, trampas, obstáculos y mapa explorado. La experiencia y las evoluciones siguen siendo propias de cada incursión.

Hay guardados al pausar, cambiar de piso, elegir una evolución y aproximadamente cada 15 segundos. La pantalla muestra piso y hora del último punto confirmado. Al morir o abandonar se retira **Continuar**; crear una incursión nueva pide confirmar el descarte de la anterior.

Con una cuenta se necesita conexión para iniciar o recuperar la incursión. Una desconexión conserva una copia pendiente en este dispositivo y detiene el juego si no puede renovar su sesión. Al continuar en otro dispositivo, el servidor exige confirmar el traspaso si la sesión anterior sigue activa y rechaza sus escrituras posteriores. Si las copias divergen, el menú permite elegir explícitamente el guardado del servidor.

Un cierre forzado puede perder lo ocurrido desde el último reporte persistido. Los cambios pendientes necesitan que el dispositivo conserve su almacenamiento hasta que se envíen al servidor.

## Alcance del guardado local

Borrar los datos del navegador elimina el progreso de invitado, los cachés y las operaciones todavía no sincronizadas. El progreso que el servidor ya confirmó se recupera al iniciar sesión en la misma cuenta. Navegación privada, almacenamiento bloqueado o una cuota agotada pueden impedir conservar cambios locales.

Los detalles de configuración, tablas, permisos, pruebas y activación del correo están en [Cuentas y progreso en servidor](cuentas-servidor.md).
