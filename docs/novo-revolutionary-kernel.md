# Novo: prueba del núcleo revolucionario

## Veredicto operativo

Novo no necesita otra capa de módulos para ser distinto. La diferencia defendible debe ser un registro compartido de intención, ejecución y resultados entre un fundador y sus agentes de IA.

La promesa inicial queda acotada a:

> Novo mantiene al fundador y a sus agentes trabajando sobre el bloqueo correcto.

El Cognitive Twin es la implementación interna; el valor visible es recuperar contexto, elegir la siguiente acción de mayor impacto, ejecutarla con permiso, verificarla y adaptar la siguiente recomendación.

## Kernel que debe funcionar siempre

```text
Objetivo importante
  -> contexto real
  -> bloqueo detectado
  -> siguiente acción
  -> ejecución humana o de agente
  -> evidencia verificable
  -> outcome
  -> recomendación adaptada
```

No se considera avance del producto que solo aumente nodos, métricas, animaciones o mensajes si no mejora este ciclo.

## Evidencia de producto que debemos medir

- Activación: objetivo definido, recomendación recibida y acción aceptada.
- Tiempo hasta el primer valor.
- Acciones prioritarias verificadas por semana.
- Porcentaje de recomendaciones iniciadas y completadas.
- Resultados de agentes recuperados automáticamente.
- Número de planes posteriores que cambian por outcomes.
- Retorno D1/D7 y conversión a pago.

La métrica operativa principal es **acciones prioritarias verificadas que Novo ayudó a completar**, no mensajes ni puntuaciones cognitivas.

## Moat a construir

1. Outcome Graph: qué se intentó, por qué, quién lo ejecutó, qué ocurrió y qué cambió.
2. Personal Execution Policy: tamaño de acción, horario, formato, agente y condiciones de éxito aprendidos.
3. Interoperabilidad neutral: Codex, Claude y otros agentes leen y actualizan el mismo estado con ownership y auditoría.
4. Gobernanza de confianza: permisos, evidencia, correcciones, exclusiones, confirmaciones y reversibilidad.

## Gate de validación de 14 días

Trabajar con diez fundadores técnicos que usen agentes. Cada uno debe completar al menos un ciclo cerrado y pagar para continuar. Continuar la apuesta solo si hay activación, repetición, acciones verificadas, recomendaciones que cambian por outcomes y señales de dependencia.

Si la gente entiende el producto pero no siente urgencia, si prefiere mantener el estado en otra herramienta o si el MCP aporta valor pero el Twin no, se cambia el wedge antes de añadir superficie.

## Decisiones de alcance

Se congelan nuevos módulos, nuevas integraciones no esenciales, más scores, más gráficos, gamificación y rediseños globales. Se mantienen objetivos, check-in mínimo, una recomendación, MCP, ejecución, verificación, aprendizaje, explicabilidad, permisos, pagos e instrumentación.

El Centro Cognitivo implementado en `app/cognitive` debe ser la demostración visible del kernel: una recomendación dominante, sus hechos e inferencias, el bloqueo relacionado, la acción permitida y el cambio aprendido.
