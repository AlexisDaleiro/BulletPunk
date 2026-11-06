# Refugio, controles y presentación del combate

Implementación de los puntos 5, 6, 7 y 8. Los cambios están en el proyecto local; no se publicó el frontend. Las 136 pruebas automáticas y la compilación de producción pasan.

## Dirección visual

- Sombras de contacto reforzadas, bordes metálicos iluminados y marcas de material por sector.
- Indicadores de adquisición de blanco y recarga de enemigos visibles; pequeñas marcas para terminales, cofres y estaciones cercanas.
- Luces locales de combate limitadas por presupuesto; disparos enemigos con una punta distinta a la del jugador.
- Las señales de amenaza comprueban visión y obstáculos. Los perfiles bajos conservan estas señales; no revelan enemigos ocultos.

## Refugio

El inicio muestra un refugio ilustrado, el operativo y su apariencia, el banco de armas y trofeos ligados a las estadísticas existentes. La tarjeta de la incursión muestra operativo, piso, hora, vida, escudo y armas. En otra cuenta o dispositivo, la vista previa solo lee campos de la fila propia; no reclama la sesión ni descarga el mundo completo.

La imagen final y su prompt están documentados en [Arte del refugio](arte-refugio.md). La animación respeta movimiento reducido y se detiene en el perfil Fluido.

## Controles y práctica

En **Opciones → Controles** se puede arrastrar cada botón, usar flechas con el botón seleccionado, abrir el editor a pantalla completa, cambiar tamaño, opacidad y zona muerta, o activar el modo zurdo. Este último intercambia los lados de los pads y refleja los botones. Las posiciones se adaptan a la pantalla y respetan los márgenes de seguridad. Los ajustes son locales al dispositivo.

La **Sala de práctica** incluye las diez armas, blancos regenerables, coberturas y un terminal para probar interacción. La munición de reserva se repone y las habilidades se recuperan rápidamente. No otorga XP, estadísticas ni cosméticos y no reemplaza el punto guardado. Si se entra desde una incursión activa, primero se guarda y suspende; un error de confirmación permite reintentar sin descartarla.

## Perfiles gráficos

| Perfil | Resolución máxima | Partículas | Motas ambientales | Luces de escenario | Vapor / reflejos |
| --- | --- | --- | --- | --- | --- |
| Fluido | 1× | 64 | 0 | 8 | No |
| Equilibrado | 1,5× | 112 | 12 | 18 | Sí |
| Cinemático | 2× | 160 | 24 | 36 | Sí |

La resolución también respeta la densidad del dispositivo y el límite elegido por el jugador. El suavizado sigue aplicándose al recargar.

El ajuste automático reúne 180 fotogramas de juego y reduce un perfil cuando el percentil 90 supera 25 ms; espera diez segundos antes de otra reducción. No cambia la simulación ni la preferencia guardada. La pantalla informa del perfil efectivo; volver a elegir un perfil restaura ese perfil. Se puede desactivar el ajuste automático.

## Optimizaciones

- Índice por zonas para la fase inicial de colisiones; conserva la comprobación exacta de impactos y su orden.
- Índice de segmentos de paredes y reutilización de la visibilidad cuando posición, dirección, alcance y mapa siguen iguales.
- Reutilización de hasta 200 nodos de efectos y geometría compartida de impactos, destellos y proyectiles.
- Descarte visual conservador de entidades fuera de cámara, sin cambiar visibilidad lógica, IA o colisiones.
- El ciclo de dibujo se detiene con menús, orientación bloqueada o pestaña oculta, y se reanuda al jugar. La interfaz del refugio anima sus propias capas.

Las decisiones siguen las recomendaciones de [rendimiento de PixiJS](https://pixijs.com/8.x/guides/concepts/performance-tips): medir, limitar complejidad y reutilizar geometría.

## Medición reproducible

`npm run benchmark:spatial` compara el barrido completo con el índice, con 250 cuerpos, 400 segmentos y semilla 789. Incluye la reconstrucción del índice. Una ejecución local con Node v24.19.0, tras calentamiento y 40 muestras, produjo:

| Medida | Barrido completo | Índice por zonas |
| --- | --- | --- |
| Candidatos comprobados | 100.000 | 1.148 |
| Impactos exactos | 135 | 135 |
| Mediana | 0,638 ms | 0,263 ms |
| Percentil 95 | 3,081 ms | 0,400 ms |

Es una medición del algoritmo, no una promesa de FPS en teléfonos. Las pruebas de interfaz móvil se realizaron con emulación táctil en Chrome; falta medir temperatura, batería y FPS sostenidos en dispositivos físicos.

## Verificación

- Pruebas de geometría comparan impactos exactos y polígonos de visión con las versiones completas, incluyendo bordes y coordenadas negativas.
- Pruebas de controles: límites, persistencia, escala, espejo y saneamiento de ajustes.
- Práctica: entrar, cambiar arma, regenerar blancos y salir sin sumar progreso ni alterar el guardado; continuar después la incursión original.
- Cuenta real temporal: la vista previa remota recuperó vida y armas en un nuevo contexto móvil; la práctica conservó revisión, ID y estadísticas. La cuenta temporal se eliminó al terminar.
- Estrés visual: pool limitado a 200; cero avisos para un enemigo oculto aun con visibilidad gráfica obsoleta; tres amenazas visibles tanto en Cinemático como en Fluido; cero luces decorativas de combate en Fluido; los proyectiles inactivos no vuelven a dibujarse.
- Capturas de revisión: `docs/capturas/29-refugio-desktop.png` a `38-incursion-refugio-mobile.png`. El menú guardado se comprobó a 640×320, 740×360 y 844×390; los ajustes también se pueden usar en vertical.

Comprobaciones locales: `npm test`, `npm run build` y `npm run benchmark:spatial`.
