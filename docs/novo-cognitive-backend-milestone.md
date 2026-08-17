# Novo Cognitive Twin — Backend milestone

Fecha: 2026-08-08

## Resultado

El Twin mantiene un loop persistente y auditable sobre los sistemas existentes:

`Observe → Understand → Propose → Verify → Learn → Adapt`

Las acciones reales del usuario siguen el flujo separado y confirmado del Novo
Loop: `Act → Verify → Outcome → Learn`.

## Backend

- `processTwinSignalHandler` ejecuta etapas checkpointed con Inngest y crea un
  `twin_inference` `ActivityRun`.
- Cada etapa emite eventos reales al Activity Protocol; no hay timers ni frases
  rotatorias simuladas.
- Confianza, nivel de trust, energía, fricción, evolución y política adaptativa
  se persisten en `CognitiveTwinRecord` y `TwinEvolutionLog`.
- La política está limitada a propuestas conocidas y requiere confirmación;
  nunca convierte JSON persistido en una capacidad ejecutable.
- Un fallo durable cierra el ActivityRun como `failed` antes de relanzar el
  error para conservar los retries de Inngest.
- Focus Agent consume la política persistida y registra los IDs aplicados en
  `ActionPlan.inputs`, haciendo que la adaptación cambie la siguiente
  recomendación.

## Continuidad frontend

- Cognitive consulta el estado de inferencia y renderiza el mismo ActivityRun.
- SSE `twin.updated` y polling actualizan Twin, grafo y propuestas.
- Cognitive muestra comportamiento propuesto, razón, calibración y frontera de
  confirmación.
- El grafo expone `memory:adaptation-policy` con evidencia de evolución.
- `/api/cognitive/agent-actions` expone la salida segura como
  `proposal_only`/`confirmationRequired`.

## Verificación local

- Jest: 71 suites, 220 tests, 2 snapshots.
- ESLint: 0 errores; quedan 6 warnings preexistentes.
- TypeScript incremental: pasa.
- Producción: `NODE_OPTIONS=--max-old-space-size=4096 npm run build` pasa,
  incluyendo 130/130 páginas.
- Smoke runtime: `/landing` devuelve 200 y el status cognitivo devuelve 401 sin
  sesión.

## Límite externo

La E2E aislada está preparada con guard de no solapamiento, pero la rama Neon de
prueba rechaza autenticación al crear el primer usuario sintético. No se tocó
producción; falta ejecutar esa E2E cuando exista una credencial válida para la
base aislada y capturar QA autenticada de móvil/desktop.
