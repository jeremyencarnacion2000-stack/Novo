# Revisión estética de Novo · 18 de octubre de 2026

## Dirección

Conservar crema, carbón y verde profundo. El cristal expresa una capa de controles
que flota sobre el contenido. Las listas, mensajes, documentos y gráficos deben
seguir siendo tranquilos y legibles. La selección indica dónde estás; la actividad
real de un proceso conserva su indicador propio.

## Qué aporta la referencia de Apple

Fuentes primarias consultadas:

- [Meet Liquid Glass, WWDC25](https://developer.apple.com/videos/play/wwdc2025/219/),
  especialmente 3:38–5:24, 6:00–7:29, 13:13–15:40 y 18:06–18:53.
- [Materials, Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/materials).
- [Tab bars, Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/tab-bars).

Apple combina refracción, relleno, luz y sombra para mantener separación y
legibilidad. Los menús ganan cuerpo cuando crecen. Los elementos interiores usan
rellenos finos y realce en lugar de apilar otra superficie de cristal. El material
regular es apropiado para navegación con texto; el transparente requiere un fondo
adecuado y protección de contraste. La respuesta al toque es inmediata, y el
control mantiene su relación espacial con lo que abre.

La adaptación web de Novo conserva una lente transparente, tinte ligero y
protección localizada de texto e iconos, sin analizar el fondo por fotograma. No reproduce el motor óptico
privado de Apple ni cambia automáticamente el tema según el contenido al hacer
scroll. El indicador compartido viaja mediante un resorte interrumpible; los
estados de movimiento reducido o desactivado evitan ese desplazamiento elástico.

## Aplicado en esta entrega

| Frente | Cambio | Coste |
| --- | --- | --- |
| Barra móvil y menú | Lente visible con tinte del 5,5% en la barra y 18% en el panel; dispersión suave para distinguir el contenido del menú. | Mantiene el límite global de cinco lentes |
| Selección móvil y lateral | Se restaura la lente del indicador compartido; configuración y opciones interiores conservan selección fina. | Lentes prioritarias dentro del mismo presupuesto |
| Texto de navegación | Colores sólidos para texto principal/secundario; se elimina la doble opacidad del panel. | Nulo |
| Barra lateral y configuración | Recuperan los materiales de Apariencia del usuario. | Blur CSS configurado en el contenedor |
| Accesibilidad | Estado actual, foco y objetivos de 44px; modo sólido sólo al solicitarlo en Novo o con colores forzados. La preferencia general de Windows no apaga el cristal. | Libera lentes con la opción explícita |
| CSS | Consolidación del bloque duplicado de controles; se eliminan brillos cromáticos y filtros por hover en cada botón. | Reduce composición |

El controlador existente de apertura/cierre sigue siendo dueño de la geometría.
La raíz del diálogo no incorpora otro filtro, recorte ni opacidad que rompa la
refracción durante el cambio de forma.

## Cola de mejoras del resto de la app

Inventario de fuentes de componentes, pendiente de implementar y revisar visualmente
en cada flujo. El orden privilegia comprensión y coherencia antes que decoración.

| Prioridad | Superficie y archivo | Intervención propuesta | Criterio de aceptación | Coste |
| --- | --- | --- | --- | --- |
| P1 | Chat · `components/ai/modern-chatbot/index.tsx` | Sustituir fondos negro/blanco fijos por tokens de tema; unificar controles con el compositor. | Ambos temas, conversación larga, adjuntos y errores mantienen jerarquía y contraste. | Bajo |
| P1 | Conectores / configuración · `components/connectors/connectors-client.tsx`, `components/settings/settings-shared.tsx` | Sustituir texto útil al 30–35% por un secundario legible. | Descripciones de conexión y recuperación legibles sobre los fondos admitidos. | Nulo |
| P2 | Hoy · `app/today/page.tsx` | Reducir etiquetas diminutas, mayúsculas y negrita extrema; abrir estadísticas y aplanar grupos repetidos. | Acción siguiente visible, sin tarjetas anidadas ni color de urgencia sin causa. | Reduce coste |
| P2 | Conectores · `components/connectors/connectors-client.tsx` | Unificar bloques grandes de preparación/aprendizaje, quitar blobs desenfocados y repetición de instrucciones. | Estado de cada servicio y acción de recuperación visibles primero. | Reduce coste |
| P2 | Configuración · `components/settings/settings-modal.tsx` | Unificar título localizado, tipografía y encabezado con `/settings`. | La misma identidad al abrir desde móvil o barra lateral. | Nulo |
| P2 | Pestañas de contenido · `components/ui/tabs.tsx` | Unificar geometría y contraste; evaluar selección compartida conservando semántica y teclado de Radix. | Foco, selección y contenido diferenciados sin otra lente por pestaña. | Bajo |
| P3 | Menús / selectores · `components/ui/dropdown-menu.tsx`, `components/ui/select.tsx` | Igualar radio, separadores, relleno y selección. Cristal sólo en el contenedor que flota. | Opciones completas, sin recortes; teclado y estados deshabilitados intactos. | Bajo |
| P3 | Materiales heredados · `app/globals.css` | Revisar `.liquid-glass-hover`, que actualmente conserva blur en reposo, y tarjetas que repiten el mismo filtro. | No se pierde separación funcional al reducir composición. | Reduce coste |

## Política de rendimiento y alcance

- No ampliar el presupuesto de cinco filtros de refracción.
- Priorizar barra, menú, Hub y controles flotantes. Conservar el Hub con una lente
  y sus capas de tinte/ribete; no añadir lentes a su contenido.
- No usar muestreo continuo del fondo, animaciones de blur por fotograma ni loops
  decorativos en reposo.
- Comprobar claro, oscuro y fondo saturado; móvil pequeño, móvil y escritorio;
  selección, foco, apertura/cierre, interrupción y preferencias de accesibilidad.
- La revisión de fuentes no implica que todos los puntos de la cola estén resueltos.

## Verificación de la entrega inicial (antes de la restauración)

- 54 pruebas de navegación, presencia, material, accesibilidad y política de
  movimiento; ESLint de los archivos TypeScript modificados sin incidencias.
- Límites de contraste del relleno y selección ≥4,5:1 para ambos temas sobre
  extremos blanco/negro. Son límites de composición de tokens, no una medición
  píxel a píxel del motor óptico nativo de Apple.
- Componentes reales en una fixture con contenido sintético: 320, 390 y 1440px;
  apertura/cierre, indicador seleccionado, temas y transparencia reducida.
  Sin desbordamiento horizontal ni errores de página; objetivos de la barra
  móvil de al menos 44×44px. La raíz del panel conserva `backdrop-filter: none`.
- La comprobación visual detectó y corrigió la antigua regla que hacía
  transparente el sidebar y la transición de texto que conservaba un color
  claro durante un cambio inmediato a material claro.
- La compilación completa y TypeScript se comprueban en el despliegue de Vercel
  del mismo commit antes de integrar en producción.


## Corrección: conservar el Liquid Glass solicitado

La primera entrega produjo una regresión visual: fondos del 84–94% tapaban la
lente y la preferencia de Windows por reducir transparencias la desactivaba por
completo. Los límites de contraste de esos rellenos opacos no verificaban que el
cristal siguiera presente. Esa solución queda sustituida.

- Se mantiene el render óptico bajo la preferencia de Windows; se respetan la
  reducción explícita de cristal de Novo y los colores forzados del sistema.
- Se restauran el tinte ligero, la lente del indicador activo y el acabado óptico
  CSS cuando el presupuesto de refracción está ocupado.
- Se protegen texto e iconos con sombras pequeñas opuestas al tema, sin cubrir
  todo el panel con un relleno opaco. Esto requiere inspección visual por fondo;
  no se atribuye una garantía universal de 4,5:1 a una superficie transparente.
- Se suavizan la distorsión y la separación cromática de navegación, manteniendo
  la refracción visible y el resorte compartido existente.
- La prueba de regresión reprodujo la pérdida de lente bajo las preferencias de
  Windows antes de corregirla. El navegador confirma `osReduced: true`, lente
  SVG activa y panel transparente; también confirma el cierre y ausencia de
  errores de página.
- Verificación de la corrección: 58 pruebas aprobadas y ESLint sin incidencias.
  La máquina local requirió repetir la suite con `--testTimeout=20000` tras un
  timeout de 5 segundos; no se modificaron las esperas ni aserciones del producto.
