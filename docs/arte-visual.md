# BulletPunk / Protocol Zero

La identidad visual combina pintura cinematográfica, industria abandonada, lluvia, metal grafito, turquesa y ámbar. Los seis operativos tienen retratos propios y detalles de equipo que se reflejan en sus siluetas durante la partida.

## Ilustraciones

Los artes originales se generaron con la herramienta integrada `image_gen`. El proyecto utiliza versiones WebP a calidad 90 y resolución original; los siete archivos suman aproximadamente 2,6 MB. Los prompts completos y las rutas están en [art-direction-prompts.json](art-direction-prompts.json).

| Archivo en `public/art/splash/` | Identidad |
| --- | --- |
| `title.webp` | Distrito industrial bajo la lluvia, infiltración nocturna |
| `nix.webp` | Infiltración, jade y grafito, eco fantasmal |
| `brasa.webp` | Asalto, cobre y ámbar, blindaje de ruptura |
| `vector.webp` | Reconocimiento, lavanda y azul noche, óptica de precisión |
| `sutura.webp` | Supervivencia, marfil y rosa, reparación biótica |
| `volt.webp` | Control, azul eléctrico y mostaza, interferencia |
| `morsa.webp` | Apoyo pesado, oliva y latón, arnés mecanizado |

## Movimiento e interfaz

El inicio anima cuatro capas: desplazamiento lento del arte, bruma, lluvia y trama ambiental. Las animaciones se eliminan con `prefers-reduced-motion`. Al cerrar el menú se retiran sus elementos del documento. La selección mantiene el retrato grande, las estadísticas, la habilidad, la pasiva y la debilidad; el panel permite desplazarse en pantallas bajas. Las tarjetas se enfocan con teclado y muestran el operativo seleccionado.

Los botones usan esquinas recortadas, indicadores de estado y una respuesta de pulsación. El botón principal usa ámbar. En móvil, los controles táctiles siguen la misma paleta y el aviso inicial explica el giro por deslizamiento y el disparo automático.

## Partida

Los sectores añaden señalización pintada, rejillas y detalles propios: advertencias militares, charcos urbanos y circuitos de laboratorio. Las luces tienen reflejos estrechos; la linterna combina tonos cálidos y turquesas. Las armaduras tienen sombras de contacto, bordes iluminados y detalles propios de cada operativo. Los proyectiles combinan estela, halo y núcleo claro, y los impactos incorporan destellos angulares.

Las decoraciones del escenario se construyen una vez por piso y permanecen bajo la niebla. Los detalles no modifican colisiones, alcance ni detección de enemigos. Las partes estáticas de los personajes siguen compartiendo texturas; los proyectiles conservan su sistema de reutilización.

## Capturas

- `capturas/09-inicio-desktop.png` y `09-inicio-mobile.png`
- `capturas/10-operativos-desktop.png` y `10-operativos-mobile.png`
- `capturas/11-partida-desktop.png` y `11-partida-mobile.png`
