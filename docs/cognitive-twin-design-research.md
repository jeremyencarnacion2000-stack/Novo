# Investigación de diseño: Cognitive Twin

Fecha: 2026-08-03

## Alcance y bloqueo de Mobbin

No hay una skill o servidor Mobbin MCP disponible en esta sesión. No se inventan capturas ni patrones atribuidos a Mobbin. La investigación se completó con páginas públicas de producto y documentación oficial; cuando Mobbin esté disponible, se debe repetir la comparación visual con sus siete búsquedas objetivo.

## Referencias públicas

- [TheBrain](https://thebrain.com/): una red visual centrada en el pensamiento activo, donde notas, archivos, proyectos y enlaces se conectan alrededor de un contexto local. Su lección para Novo es seleccionar un centro y ocultar el resto de la red hasta que sea relevante.
- [TheBrain, Made with TheBrain](https://thebrain.com/made-with-thebrain): muestra la idea de red como espacio de trabajo y no como gráfico ornamental.
- [Heptabase](https://heptabase.com/): whiteboards y tarjetas para pasar de una vista espacial a contenido detallado sin convertir todo en una tabla.
- [Apple Human Interface Guidelines: Motion](https://developer.apple.com/design/human-interface-guidelines/motion): movimiento para comunicar estado, feedback e instrucción; no como decoración continua.
- Linear: referencia de densidad contenida, jerarquía fuerte, command menu y estados operativos visibles sin llenar cada superficie de controles.
- Salud y finanzas: patrón común de separar dato medido, estimación, cambio y recomendación. Novo debe declarar el origen y la confiabilidad en el inspector.

## Búsquedas Mobbin pendientes para repetir

1. AI assistant home with proactive recommendation and one primary action.
2. Personal health or wellness insights with trends and explanations.
3. Knowledge graph explorer with a selected-node detail panel.
4. Analytics page with progressive disclosure and drill-down.
5. Activity timeline with AI actions and confirmation states.
6. Command-center interface with contextual recommendations.
7. Interactive map with filters, search and focus mode.

## Patrones que se aplicarán

### Jerarquía

Una recomendación principal ocupa el primer viewport. Debajo se muestran hechos y el bloqueo que la justifica. Métricas, timeline e historial quedan en lenses o drawers secundarios.

### Contexto local

El grafo inicia con 20–35 nodos en escritorio y 8–15 en móvil. El nodo seleccionado pasa al centro; el resto se filtra por relaciones y relevancia.

### Inspector

Seleccionar un nodo abre un panel lateral en escritorio y bottom sheet en móvil. El panel muestra nombre, tipo, estado, relevancia, evidencia, conexiones, historial y acciones permitidas. La corrección y exclusión se ejecutan desde ahí.

### Progressive disclosure

La interfaz avanza en cuatro niveles: qué necesita atención, por qué, qué relaciones lo explican y qué aprendió el sistema. No se muestran todos los datos en la primera vista.

### Feedback y actividad

Los eventos reales del run se presentan como fases operativas: recuperar contexto, detectar bloqueos, priorizar, preparar acción, esperar confirmación, verificar. Nunca se muestra chain-of-thought.

### Movimiento

Hover 100–160 ms, selección 160–220 ms, inspector 220–300 ms y foco 280–420 ms. Se animan transform/opacity y solo las relaciones activas. Reduced motion elimina pulsos, camera fly y edge motion.

## Lo que se evita

- Grafos completos sin contexto.
- Scores con precisión falsa o lenguaje médico.
- Gradientes violetas y neón como sustituto de evidencia.
- Cinco columnas de tarjetas iguales.
- Animación permanente del Twin.
- Labels en todos los nodos y flechas en todas las relaciones.
- Un chatbot como centro de la página.

## Traducción a Novo

TheBrain aporta el foco local; Heptabase aporta la transición entre mapa y detalle; Linear aporta velocidad y jerarquía; Apple aporta movimiento y feedback. Novo combina esas ideas con una diferencia propia: cada relación visible debe enlazar con una señal, outcome, fuente o permiso real.
# Producto y validación del núcleo

El brief estratégico adjunto cambia el criterio de diseño: el grafo, los indicadores y el movimiento solo son útiles si hacen visible el closed loop de ejecución entre fundador y agentes. Por eso la superficie prioriza una recomendación, hechos, inferencias, evidencia y acción; el resto usa progressive disclosure. La validación debe centrarse en acciones prioritarias verificadas y en si outcomes distintos producen recomendaciones posteriores distintas.
