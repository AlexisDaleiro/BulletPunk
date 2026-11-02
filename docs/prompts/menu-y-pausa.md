# Prompt: pantalla de inicio, perfil, opciones y menú de pausa

Pegá todo lo de abajo en una sesión nueva. Antes de escribir código, usá el skill `superpowers:brainstorming` y confirmame el diseño; después implementá por hitos (como los milestones 1–6 del git log), con un commit por hito.

---

## Objetivo

Hoy el juego arranca directo en el piso 1 (`levels.start()` al final de `src/main.ts`) y la muerte hace `location.reload()`. Quiero un flujo de producto completo:

1. **Pantalla de inicio** con: JUGAR, ELEGIR PERSONAJE, PERFIL, OPCIONES.
2. **Menú de pausa in-game** con: continuar, opciones, reiniciar run, volver al menú, y un resumen de la run.
3. **Pantalla de game over** con reintentar / volver al menú (reemplaza el texto de muerte de `HudSystem` + `location.reload()`).

## Contexto del código (ya verificado, no lo redescubras)

- Stack: Vite + TypeScript + Pixi 8, ECS propio (`src/ecs`), pipeline de sistemas armado en `src/main.ts`. Sin dependencias de UI y sin `localStorage` en ningún lado todavía.
- `Game` (`src/core/Game.ts`) tiene `paused: boolean`: mientras es true, `frame()` retorna sin simular **ni renderizar**. Hoy solo lo toca `initLandscape` (`src/input/landscape.ts`) con `game.paused = portrait`.
- El HUD es Pixi (`HudSystem`, capa `renderer.hud`), así que **se congela con la pausa**. Los menús tienen que ser overlay **DOM (HTML/CSS)** encima del canvas, no Pixi. Ya hay precedente: `#rotate` en `index.html` y `TouchControls` (DOM + `src/input/touch.css`).
- `LevelManager` crea al jugador una sola vez (`createPlayer` en `src/entities/player.ts`, color `COLORS.cyan` y arma `PLASMA_PISTOL` hardcodeados) y lo conserva entre pisos. `GameState` guarda piso, créditos, llaves, toasts. No existe método de "reiniciar run".
- `SoundManager` es 100% procedural (sin archivos), master gain fijo en 0.5, `muted` + tecla M. No hay música ni volumen configurable.
- `InputManager` escucha `keydown/pointerdown/...` en `window`. No maneja Escape. Un click sobre un botón del menú **dispararía el arma** (`mouseDown`) si no se filtra.
- Seed: `?seed=N` en la URL, si no `Date.now()`.
- Estética: monoespaciada, fondo `#05060a`, cian `#00e5ff`, magenta `#ff0055`, ámbar `#ffe600` (ver `COLORS` en `src/config.ts`). Textos del juego en inglés MAYÚSCULAS; mantené ese idioma en la UI.
- Tests: `node --test "src/**/*.test.ts"`, `npm run typecheck`. Se prueba la lógica pura, no el DOM.

## Requisitos

### A. Arquitectura
- UI en `src/ui/` como overlay DOM con un router mínimo de pantallas (`title`, `character`, `profile`, `options`, `pause`, `gameover`). Sin framework; HTML/CSS planos, estilos en un `.css` importado (como `touch.css`).
- Ciclo de vida de la run explícito: `startRun(characterId, seed?)`, `restartRun()`, `quitToMenu()`. Esto requiere refactorizar `main.ts` para separar "armar el mundo/sistemas" de "empezar una run", y agregar un reset real: destruir también al jugador, `GameState` a valores iniciales (piso, créditos, llaves, toasts), `LevelManager.player = null`, limpiar `HudSystem.dead`. Verificá que implantes y estado de tienda no sobrevivan al reinicio.
- **Pausa por razones, no por booleano**: hoy `game.paused = portrait` desbloquearía el juego al rotar el celular con el menú abierto. Reemplazalo por un conjunto de razones (`menu`, `portrait`, `hidden`) y `paused = razones.size > 0`.
- Antes de jugar el canvas puede mostrar el fondo vacío o un fondo atenuado; no hace falta modo demo.

### B. Pantalla de inicio
- Título del juego, y botones: **JUGAR** (arranca con el último personaje elegido), **PERSONAJE**, **PERFIL**, **OPCIONES**. Si hay una run en curso (volviste desde pausa), mostrar CONTINUAR.
- Navegable con mouse, teclado (flechas/Enter/Esc) y touch.
- El primer tap/click de JUGAR en touch debe seguir pidiendo fullscreen + landscape (`initLandscape`) y desbloquear audio.

### C. Selección de personaje
- Datos en un archivo (`src/characters/characters.ts`): `id`, nombre, color, descripción corta, vitales (hp/shield), arma inicial y opcionalmente un pasivo, reutilizando los componentes/`weapons.ts`/`implants.ts` existentes. `createPlayer` debe recibir la definición en vez de hardcodear cian + pistola.
- 3 operativos para empezar, con diferencias reales pero chicas (no rompas el balance de `PLAYER_VITALS`). Preview del gráfico con `createOperativeGraphic(color)`.
- Opcionalmente bloquear personajes por progreso del perfil (ej. llegar al piso N); si es mucho, dejalo todos desbloqueados y decímelo.

### D. Perfil
- Nombre editable (validado: longitud, caracteres), personaje favorito, y estadísticas persistentes: runs jugadas, mejor piso, tiempo total, créditos máximos. Si querés kills, hay que enganchar `HealthSystem`; decime si lo hacés.
- Guardar al terminar cada run (muerte o abandono), no solo al salir.
- Botón para borrar datos, con confirmación.

### E. Opciones
- **Sonido**: volumen general (slider), mute. Cablearlo a `SoundManager` (hoy el 0.5 está fijo); mantener la tecla M sincronizada con la opción.
- **Gráficos**: `MAX_PIXEL_RATIO` configurable (calidad/resolución), mostrar FPS, y antialias si cambiarlo requiere recarga, indicarlo en la UI. No inventes opciones que no tengan efecto real.
- **Controles**: pantalla de solo lectura con el mapa de teclas actual (WASD, mouse, R, Space/Shift, E, Q, C, M). Rebind queda fuera de alcance.
- Todo se guarda en `localStorage` con un módulo `Settings` (valores por defecto, sanitización de datos corruptos/viejos, versión del esquema), con `try/catch` en cada acceso (puede estar bloqueado). Se aplican en vivo; las opciones son las mismas desde inicio y desde pausa (un solo componente).

### F. Menú de pausa
- **Esc o P** alterna pausa; en touch, botón de pausa chico en una esquina que no choque con minimapa ni joysticks.
- Auto-pausa al perder foco o `visibilitychange` (la pestaña oculta).
- Contenido: CONTINUAR, OPCIONES, REINICIAR RUN (con confirmación), MENÚ PRINCIPAL (con confirmación, cuenta como run abandonada en el perfil), y un resumen: piso, créditos, implantes, tiempo, seed (con botón de copiar para repetir la run vía `?seed=`).
- Al reanudar: `InputManager` debe soltar teclas/botones (hay `releaseAll`, exponelo) para que no queden movimientos o disparos pegados; descartar el `deltaMS` acumulado para que no haya salto.
- Los eventos del overlay no deben llegar al `InputManager` (no disparar al hacer click en un botón). El audio ya se desbloquea en `pointerdown`/`keydown`, no lo rompas.
- La cola de toasts/HUD no avanza en pausa (ya pasa porque no hay `render`).

### G. Game over
- Overlay con piso alcanzado, créditos, seed, REINTENTAR (mismo personaje, seed nueva) y MENÚ. Sacar el `location.reload()` y el `setTimeout` de `HudSystem`; que dispare un evento/callback hacia la UI.

### H. Móvil
- Todo debe entrar en landscape de ~667×375 sin scroll, botones ≥ 44 px, respetar `safe-area-inset-*` (el viewport ya usa `viewport-fit=cover`). Sin hover como único feedback.

## Fuera de alcance
Música, rebind de teclas, i18n, cuentas online/ranking, modo demo de fondo, nuevas armas o mecánicas de combate.

## Criterios de terminado
- `npm run typecheck` y `npm test` en verde, con tests nuevos para: sanitización/migración de `Settings`, validación de nombre y acumulación de estadísticas de `Profile`, y definiciones de personajes (todas referencian armas/pasivos válidos).
- Verificado en el navegador (preview con el dev server): flujo completo inicio → personaje → jugar → pausa (Esc) → opciones → reanudar → morir → reintentar → menú; y lo mismo en viewport móvil landscape. Sin errores en consola; recargar la página conserva opciones y perfil.
- Pausar con el menú abierto y rotar a portrait no reanuda el juego.
- Resumen final con: qué decidiste por mi, qué quedó afuera y qué dejaste con límites conocidos.
