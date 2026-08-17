# Auditoría del Cognitive Twin

Fecha: 2026-08-03
Ruta auditada: `app/cognitive/page.tsx`

## Veredicto corto

Cognitive no es todavía el centro operativo del sistema. Es una pantalla autenticada que consume el informe real de `useCognitiveEngineData`, muestra una recomendación y ofrece un grafo derivado, pero la jerarquía sigue siendo la de un dashboard: primero aparecen métricas, rings, timeline y módulos; las relaciones, la evidencia y el aprendizaje quedan debajo o en componentes separados.

## Lo que sí es real

- `app/api/ai/cognitive-engine/route.ts` obtiene señales y datos del usuario con filtros de propiedad y produce el informe consumido por la página.
- `CognitiveTwinRecord`, `BehavioralSignal` y `TwinEvolutionLog` están persistidos en Prisma (`prisma/schema.prisma:1411-1485`).
- `ActionPlan`, `RecommendedAction`, `OutcomeEvent`, `NovoSignalLedger` y `NovoSignalSourcePreference` sostienen el loop de plan, acciones, resultados y control de señales (`prisma/schema.prisma:700-820`).
- `app/api/cognitive/loop/plan/route.ts` lee outcomes y señales excluidas/corregidas antes de generar el siguiente plan.
- `app/api/cognitive/loop/response/route.ts` registra respuestas idempotentes y actualiza el estado de la recomendación.
- `app/api/cognitive/loop/signals/route.ts` permite corregir, excluir y restaurar señales.
- `app/api/cognitive/graph/route.ts` exige sesión y plan Pro, limita la consulta a datos del usuario y obtiene señales de los últimos 30 días y cambios de los últimos 7 días.
- `lib/cognitive-graph.ts` genera un grafo determinista pequeño desde datos persistidos, sin `Math.random()` ni llamada LLM por render.
- `components/cognitive/cognitive-graph-view.tsx` permite arrastrar, seleccionar y resaltar vecinos; el layout usa una semilla hash estable.
- `components/cognitive/signal-ledger-controls.tsx` expone corrección y exclusión, aunque todavía no está integrado como parte del inspector del grafo.

## Parcial o desconectado

- La página presenta `TwinCommandCenter`, métricas, timeline, `CognitiveMetricsStrip`, grafo, bitácora, módulos y sistemas integrados como bloques consecutivos. No existe una primera sección única que responda “qué merece atención ahora” con hechos, interpretación, acción y controles.
- `CognitiveGraphView` solo usa tipos `root | identity | energy | bottleneck | signal | metric`. No modela objetivos, proyectos, compromisos, acciones, outcomes, fuentes, memorias o estrategias.
- El endpoint del grafo no acepta `lens`, `focusNodeId`, `depth`, `since` ni `limit`; por tanto no hay proyecciones Now/Goals/Patterns/Memory/Sources ni navegación contextual.
- El grafo no tiene inspector, breadcrumbs, búsqueda, foco por doble click, teclado, filtros, vista alternativa o corrección/exclusión contextual.
- `TwinEvolutionLog` solo alimenta una marca `isNew` y `DecisionFeed`; no existe una timeline de aprendizaje que explique qué cambió, qué resultado lo causó y cómo afectará la próxima recomendación.
- La actividad del agente existe en el protocolo de runs, pero Cognitive no muestra una superficie unificada para fases reales, confirmaciones, ejecución y verificación.
- `lastRefresh` se calcula como `new Date()` cada vez que hay datos, no como timestamp fiable del servidor.
- `EnergyTimelineChart` está correctamente documentado como estimación, pero la composición todavía la hace parecer una métrica biométrica al estar junto a `FocusScoreRing` y `BurnoutRiskMeter`.
- El estado Pro del grafo se resuelve con un mensaje y un enlace a `/settings`; no abre directamente el tab de facturación ni conserva la fuente `landing-intent`.

## Riesgos de falsedad o confusión

- `app/cognitive/page.tsx` conserva copy de proveedor (`Gemini Live`, `Groq Live`, `Local Synthesis`) en el encabezado y footer. Esto describe el generador, no el estado operativo del Twin y compite con la jerarquía.
- `components/cognitive/share-cognitive-card.tsx` todavía incluye copy de “Riesgo de fatiga”, aunque el proyecto ya marca la fatiga como no disponible cuando no hay una fuente explícita.
- `components/cognitive/primitives.tsx` expone `TelemetryPill` con `fatigueScore`; requiere revisión de alcance para no reintroducir indicadores psicológicos no sustentados.
- El grafo muestra etiquetas de señales y conteos, pero no clasificación visible de evidencia (`observed`, `deterministic`, `inference`, `uncalibrated`) ni confiabilidad.

## Arquitectura actual observada

```text
Prisma
  -> /api/ai/cognitive-engine
  -> useCognitiveEngineData
  -> Cognitive page
       -> TwinCommandCenter
       -> metrics / timeline / cards
       -> CognitiveGraphView -> /api/cognitive/graph -> lib/cognitive-graph
       -> DecisionFeed
```

La arquitectura no es todavía la proyección única que pueda servir a varias lenses y a una vista alternativa accesible.

## Prioridad de trabajo

1. Crear un contrato de snapshot y proyección server-side que conserve ownership, evidencia y densidad limitada.
2. Hacer que la recomendación principal se base en el loop persistido (`ActionPlan`/`RecommendedAction`) y mostrar Facts/Interpretation/Recommendation/Confidence.
3. Añadir lenses sobre el mismo snapshot, inspector y vista alternativa textual antes de cambiar el renderer.
4. Conectar outcomes y estrategia aprendida a la timeline y al ranking.
5. Elegir e instalar una librería de grafo solo después de fijar el contrato. La opción recomendada es Sigma + Graphology para WebGL y culling, pero la implementación actual puede sobrevivir con SVG para el primer slice si se mantiene en 35 nodos.
6. Pulir visual, motion, mobile y reduced motion.

## Evidencia ejecutada

- Lectura de `app/cognitive/page.tsx`, `components/cognitive/*`, `lib/cognitive-graph.ts`, `app/api/cognitive/graph/route.ts` y los modelos relevantes de `prisma/schema.prisma`.
- `package.json` no contiene `sigma`, `graphology`, `react-flow` ni `cytoscape`; sí contiene `recharts`, `framer-motion`, `motion` y `gsap`.
- Búsqueda de `Math.random` en la superficie Cognitive: no aparece en `lib/cognitive-graph.ts` ni en `components/cognitive/cognitive-graph-view.tsx`.
- Tests existentes cubren reglas, correcciones, biometría y piezas de Cognitive, pero no cubren lenses, inspector, foco contextual, vista alternativa ni el recorrido Cognitive completo.
# Follow-up implementation evidence — 2026-08-03

The first Command Center slice is now connected to the existing persisted loop. `app/api/cognitive/graph/route.ts` accepts the bounded `lens`, `focus` and `depth` query parameters and returns the legacy graph plus a new `CognitiveGraphSnapshot`. `lib/cognitive-graph/projection.ts` reads owned goals, projects, tasks, signal-ledger entries, source preferences, recommendations, outcomes and evolution logs; it excludes user-excluded sources and emits facts/inferences separately. `components/cognitive/cognitive-command-surface.tsx` exposes the Now/Goals/Patterns/Memory/Sources lenses, a recommendation rationale, an attention queue, an inspector and a signal-exclusion action.

Evidence: `lib/cognitive-graph/__tests__/graph-contract.test.ts` passes 3/3 tests for deterministic positioning, lens filtering and evidence classification; focused ESLint passes on all changed graph and surface files; Impeccable detector reports no findings for the new surface and cognitive page. The full repository type-check and `npm run build` were attempted and each exceeded five minutes without diagnostics, so production readiness remains open until a bounded build/type-check run completes.
