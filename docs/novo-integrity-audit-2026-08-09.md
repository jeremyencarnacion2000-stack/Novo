# Auditoría de integridad de Novo — 2026-08-09

## Veredicto

Novo ya tiene un circuito cognitivo persistente y verificable. No es una demo
plana: guarda señales, estado, recomendaciones, confirmaciones, outcomes,
actividad y cambios del Twin; esos cambios vuelven a Today, Cognitive, Chat y
Activity. La entrega todavía no constituye un “cerebro humano” completo: el
aprendizaje es una política operativa acotada y explicable, no una memoria
general ni un sistema autónomo sin confirmación.

Durante esta auditoría se corrigieron tres defectos de integridad:

1. La columna `onboardingCompletedAt` existía en Prisma pero no en una
   migración aplicada. Los Twins históricos se rellenan con `updatedAt`.
2. `/onboarding` permitía reiniciar Day 1 a usuarios ya inicializados.
3. Analytics aceptaba un `userId` enviado por el cliente y permitía cerrar una
   sesión ajena; ahora toda escritura usa exclusivamente el usuario autenticado.
4. El grafo convertía una confianza del Twin en escala 0–100 como si fuera
   0–1, mostrando confianza alta con evidencia insuficiente.

## Mapa del circuito

| Etapa | Estado | Evidencia |
|---|---|---|
| Signals | REAL | `BehavioralSignal`, `NovoSignalLedger`, check-ins, tareas, foco y conectores. Pausa y exclusión por fuente están persistidas. |
| Memory | REAL / PARTIAL | `CognitiveTwinRecord`, `TwinEvolutionLog`, `TwinSnapshot`, ledger y outcomes son durables. No existe memoria semántica general de texto privado. |
| Interpretation | REAL | `processTwinSignalHandler` aplica reglas deterministas y separa hechos de inferencias. Sus seis etapas generan `AiActivityEvent`. |
| Recommendation | REAL | `choosePrimaryRecommendation` usa estado, prioridades, fechas, feedback, correcciones, exclusiones y política adaptativa. |
| Action | REAL | `RecommendedAction` exige transición válida; Calendar y MCP usan confirmación, scopes, idempotencia y auditoría. |
| Verification | REAL / PARTIAL | Los estados `started/completed/failed/abandoned` y la verificación de Calendar son durables. No todos los proveedores pueden verificar efectos externos. |
| Outcome | REAL | `OutcomeEvent` es idempotente y diferencia aceptación, finalización, ayuda, intrusión, abandono y fallo con motivo. |
| Learning | REAL / PARTIAL | Duración exitosa, feedback, señales repetidas, fricción y ventanas de foco cambian decisiones posteriores. Falta un lifecycle formal candidate → emerging → validated → retired. |

## Twin e identidad cognitiva

- REAL: hechos/inferencias están separados en `RecommendedAction` y en el
  contrato del grafo; evidencia incluye fuente, fecha, clasificación,
  confiabilidad, corrección y exclusión.
- REAL: Cognitive muestra “Así es como Novo te entiende”, confianza cualitativa,
  evidencias, fecha, impacto, relaciones y controles contextuales.
- REAL: una corrección o exclusión del ledger sobrevive recarga y se consulta al
  crear el siguiente plan.
- PARTIAL: los patrones se agregan desde señales y `TwinEvolutionLog`, pero su
  estado no es todavía una entidad explícita con confirmación/retirada propias.
- PARTIAL: el selector de cronotipo de Cognitive sigue siendo preferencia local
  de presentación. El cronotipo aprendido sí vive en el Twin y cambia por
  actividad; la preferencia manual y el modelo aprendido aún son dos fuentes.

## Grafo cognitivo

- REAL: una sola proyección server-side, con ownership por `userId`, lenses,
  foco, profundidad, evidencia, relaciones, inspector y layout determinista.
- REAL: no se usa `Math.random`; el layout se deriva de hashes estables.
- REAL: el mapa cerebral WebGL/Three.js rota por gesto, permite selección por
  raycast y ofrece lista accesible/reduced-motion como alternativa.
- REAL: nuevos `TwinEvolutionLog` y cambios de política generan nodos `memory`,
  `pattern` y `strategy`, por lo que el grafo sí crece con aprendizaje real.
- PARTIAL: la ruta aún no expone `limit` y `since`, aunque el proyector los
  soporta internamente. La densidad pública está limitada a 35 nodos.
- PARTIAL: corregir/excluir está disponible para señales con evidencia; una
  memoria inferida o estrategia no se puede confirmar/retirar directamente.
- PARTIAL: el renderer WebGL se reconstruye al cambiar la rotación; funciona,
  pero requiere optimización antes de escalar a cientos de nodos.

## Focus Agent y superficies

- REAL: Today contiene `NovoLoopCard`; Cognitive contiene recomendación,
  evidencia, actividad del Twin y grafo; Activity recupera runs persistidos;
  Chat usa el mismo protocolo de actividad y confirmaciones.
- REAL: el slice objetivo → check-in → plan → aceptar → iniciar → completar →
  outcome → siguiente plan adaptado está implementado. La duración mediana de
  acciones completadas modifica el siguiente bloque recomendado.
- REAL: Calendar crea efectos externos solo tras confirmación y con frontera
  idempotente; MCP usa tokens hash, scopes, revocación, ownership y audit log.
- PARTIAL: las etapas llamadas “subagentes” son workers/checkpoints explícitos
  del mismo motor, no procesos autónomos independientes. Esto es deliberado para
  conservar seguridad y observabilidad.

## Integraciones y producto

- REAL: Notion, Todoist, Slack, Google Calendar, Gmail y Drive tienen rutas de
  conexión/estado/sync; las fuentes activas aparecen en Connectors y pueden
  alimentar señales. MCP tiene pantalla de tokens para dispositivos.
- PARTIAL: GitHub y otros conectores visibles dependen de credenciales/cuenta o
  permanecen marcados como próximos; no deben contarse como conectados.
- REAL: auth usa sesión server-side; billing crea checkout LemonSqueezy ligado
  al usuario; analytics y profile filtran por propietario.
- REAL: navegación principal enlaza Dashboard, Today, Cognitive, Chat, Activity
  y Connectors tanto en desktop como en móvil.

## Evidencia ejecutada

- Jest: **83 suites, 246 tests, 2 snapshots; todo pasa**.
- Suites cognitivas focalizadas: **33 suites, 107 tests; todo pasa**.
- ESLint: **0 errores**, 6 warnings preexistentes no relacionados.
- TypeScript: `tsc --noEmit --incremental` pasa.
- Prisma: 23 migraciones detectadas; `20260809123000_add_onboarding_completed_at`
  aplicada en producción y el esquema está actualizado.
- Build de producción de Vercel: compilación, TypeScript y generación de
  **130/130** páginas completadas; alias activo en
  `https://productivitynovo.vercel.app`.
- Canary público: Landing y Onboarding responden 200; Twin Sync, Cognitive
  Graph y Analytics rechazan solicitudes sin sesión con 401.

## Riesgos abiertos priorizados

1. Unificar preferencia manual de cronotipo con el Twin persistido sin permitir
   que una preferencia sobrescriba evidencia aprendida silenciosamente.
2. Formalizar lifecycle y confirmación de patrones/memorias inferidas.
3. Exponer límites temporales/densidad en la API del grafo y optimizar el
   renderer para no reconstruir la escena durante cada gesto.
4. Sustituir el SSE en memoria por pub/sub durable si el tráfico usa múltiples
   instancias serverless.
5. Ejecutar el E2E aislado con una credencial válida de una rama Neon de prueba;
   nunca contra datos reales de producción.
