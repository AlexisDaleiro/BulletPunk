# Evolución de campo y personalización

## Elección por experiencia

Los enemigos normales otorgan 20 XP y los élites 60 XP. El operativo comienza en nivel 1, sin mejoras gratuitas. Alcanzar 60 XP permite subir al nivel 2 y elegir entre tres mejoras; los siguientes ascensos requieren 90, 120, 150 XP y así sucesivamente. Cambiar de piso conserva la experiencia y no concede una mejora por sí mismo.

La simulación y el tiempo de incursión permanecen detenidos hasta elegir. La oferta depende de la semilla y del nivel de experiencia alcanzado, incluye una evolución exclusiva disponible del operativo y evita repetir las evoluciones únicas ya elegidas. La experiencia sobrante se conserva. Si una recompensa permite ganar varios niveles, se eligen las mejoras consecutivamente antes de reanudar el combate. El HUD muestra el nivel, la experiencia actual y una barra hacia el próximo ascenso.

La experiencia y las mejoras se conservan al descender y se reinician al comenzar o reiniciar una incursión. Las definiciones originales de los operativos permanecen intactas. Las mejoras acumulables que alcanzan su límite dejan de ofrecerse; siempre quedan alternativas útiles para niveles de experiencia avanzados.

| Operativo | Evolución | Efecto |
| --- | --- | --- |
| Nix | Eco señuelo | Silueta sonora que atrae a las patrullas desde el punto de activación. |
| Nix | Disparo espectral | Disparar conserva Paso Fantasma. |
| Brasa | Descarga de ruptura | Daño de área al activar la sobrecarga, bloqueado por paredes. |
| Brasa | Placas superpuestas | 40 puntos adicionales de escudo temporal. |
| Vector | Ventana letal | 35% más de daño durante el barrido. |
| Vector | Lectura invasiva | Interrumpe 1 s a enemigos visibles cercanos. |
| Sutura | Drones de barrera | Regenera también escudo durante la reparación. |
| Sutura | Adrenalina biótica | Velocidad y daño adicionales durante la reparación. |
| Volt | Arco de retorno | El EMP causa daño. |
| Volt | Resonancia | Pulso más amplio e interrupción más larga. |
| Morsa | Fortaleza móvil | Mayor mitigación y movimiento normal durante Anclaje. |
| Morsa | Cinta de emergencia | Completa el cargador con la munición disponible en reserva. |

Las seis mejoras compartidas permiten extender la habilidad, acortar su recarga, curarse al activarla, aumentar el daño de disparos o reforzar la vida y el escudo máximos durante esa incursión.

## Archivo cosmético

Acceso desde **Operativos → Personalizar** o desde **Perfil → Personalizar**. Se guardan por separado las elecciones de cada operativo. Se pueden previsualizar opciones bloqueadas; equiparlas requiere cumplir el logro. Los estilos se aplican al siguiente despliegue y conservan las estadísticas de combate.

| Categoría | Desbloqueo | Requisito |
| --- | --- | --- |
| Apariencia | Espectro | 5 eliminaciones acumuladas. |
| Apariencia | Ceniza | Alcanzar el piso 2. |
| Arma | Cobre cepillado | Terminar una incursión, incluida una retirada. |
| Arma | Ionizado | 10 eliminaciones acumuladas. |
| Marco | Circuito | 15 eliminaciones acumuladas. |
| Marco | Laurel de élite | Alcanzar el piso 3. |
| Pose | En combate | 8 eliminaciones acumuladas. |

La pose de combate tiene una ilustración nueva para cada uno de los seis operativos. Los archivos optimizados están en `public/art/splash/*-combat.webp`, generados con ImageGen; los prompts están en [combat-pose-prompts.json](combat-pose-prompts.json). Los acabados de armas se muestran en una vista previa propia y en el modelo equipado. Los marcos, poses y apariencias aparecen también en la selección del operativo.

El perfil pasa a versión 2. Los perfiles anteriores conservan nombre, estadísticas y operativo seleccionado y reciben los cosméticos que ya habían ganado por sus estadísticas. El guardado es local al navegador.

## Presentación en combate

- Los diez modelos de arma se identifican por su arma concreta, incluso cuando comparten categoría. El cañón dibujado, la guía y el origen del proyectil usan la misma longitud.
- Metal, madera, hormigón, escudo y armadura tienen partículas y sonidos propios. Al perder el último punto de escudo se dispara un estallido reconocible. El cuerpo reacciona brevemente al daño.
- Cada operativo tiene cadencia de pasos, balanceo, peso y manejo de cargador propios. Nix deja fragmentos de su silueta; Brasa proyecta placas de energía; Sutura tiene tres drones; Vector muestra su barrido; Volt emite un pulso; Morsa despliega apoyos de anclaje.
- Ventiladores, vapor, monitores y balizas animan los sectores. Las señales de combate cercanas cambian monitores y luces, respetando las paredes. Los efectos ambientales están debajo de la niebla y usan geometría y texturas reutilizadas.
- El modo de movimiento reducido mantiene quietos los elementos ambientales y sustituye los destellos intermitentes por luces estables.

## Validación

Se comprueban ofertas deterministas, acumulación y límites, aislamiento entre incursiones, migración de perfiles, persistencia, bloqueo de cosméticos, geometría de las diez armas y rotura de escudo. La revisión en navegador cubre PC y móvil, cambios reales de arma, ascensos por experiencia, elecciones consecutivas, conservación de XP al descender, reinicio, impactos reales contra materiales y las doce transformaciones exclusivas de habilidades.
