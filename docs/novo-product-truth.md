# Novo — Product truth

Fecha de auditoría: 2026-08-04

## Veredicto

Novo tiene un kernel técnico demostrable para mantener un objetivo, generar una recomendación bounded, registrar transiciones, ejecutar una acción interna o confirmada y adaptar una recomendación posterior. Todavía no es un sistema cerrado validado comercialmente: el valor de mercado, el tiempo a primer valor del onboarding y la conversión de pago requieren evidencia de fundadores reales.

## Wedge

Solo founders y equipos AI-native de 2–5 personas que usan Codex, Claude Code o Cursor y pierden continuidad entre objetivos, tareas, calendario, código y resultados.

Mensaje: **Novo mantiene a tus agentes y a ti trabajando sobre el bloqueo correcto.**

## Evidencia técnica comprobada

- `prisma/schema.prisma` contiene `Goal`, `RecommendedAction`, `OutcomeEvent`, `AiActivityRun`, `AnalyticsEvent`, `McpPersonalAccessToken`, `McpAuditLog` y `Subscription`.
- `app/api/cognitive/loop/plan/route.ts` lee objetivos/tareas/señales propias, aplica reglas bounded y persiste el plan y la recomendación.
- `app/api/cognitive/loop/response/route.ts` valida transiciones y persiste outcomes.
- `lib/cognitive/events.ts` registra eventos sanitizados en `AnalyticsEvent`.
- `lib/ai/activity.ts` persiste runs, secuencias, terminales, cancelación, reconexión y fallback; `components/ai/novo-activity-surface.tsx` consume actividad operativa sin chain-of-thought.
- `app/api/mcp/route.ts` aplica scopes, ownership, Zod, rate limit y mutations idempotentes; `lib/mcp/audit.ts` persiste auditoría sanitizada.
- `tests/novo-loop-isolated.e2e.ts` cubre closed loop, aislamiento A/B, recuperación/duplicados, exclusiones, MCP y Calendar idempotente sobre `DATABASE_URL_TEST`.
- Evidencia documentada: `docs/novo-system-validation.md`, `docs/novo-proof-presence-progress.md`.

## Matriz de superficies

| Superficie | Clasificación | Uso en kernel | Estado | Acción |
|---|---|---:|---|---|
| Objetivos, tareas y check-in | Kernel | Alto | Persistido y usable | Principal |
| Novo Loop / Today | Kernel | Alto | Recomendación y transiciones reales | Simplificar a una acción dominante |
| MCP | Kernel | Alto | Scopes, ownership, auditoría e idempotencia | Validar con piloto |
| Actividad AI | Kernel | Alto | Eventos server-side y recuperación | Ampliar telemetría de primer valor |
| Cognitive Graph | Supporting | Medio/alto | Snapshot explicable y lenses; captura visual auth pendiente | Mantener accionable, no statistics-first |
| Chat AI | Supporting | Medio | Comparte contrato de actividad parcialmente | Migración gradual |
| Calendario | Supporting | Medio | Confirmación e idempotencia | Probar credenciales reales en Test Mode |
| Pagos/Lemon Squeezy | Supporting | Medio | Checkout/webhook/lifecycle en código | Verificar variables Live y eventos reales |
| Analytics profundas | Supporting | Bajo | Varias métricas históricas | Mover detrás del kernel |
| Diario, música, hábitos, gratitud, social, gamificación | Distracting/Legacy | Bajo | Superficies existentes | Congelar u ocultar del flujo principal; no borrar datos |
| Scores de energía/fatiga/burnout | Incomplete/Legacy | Negativo si parecen hechos | Compatibilidad histórica | No mostrar como biometría; retirar de decisiones |

## Qué está completo, parcial o decorativo

**Completo con evidencia:** persistencia ownership-scoped; reglas deterministas bounded; estados proposed/modified/accepted/started/completed y ramas de postponement/abandonment/failure/dismissal; outcomes; aprendizaje mínimo basado en outcomes; actividad ordenada y terminal; MCP protegido e idempotente; landing pública SSR.

**Parcial:** onboarding todavía pide cinco señales de perfil antes de producir valor; no hay prueba de que el primer plan ocurra en menos de 60 segundos; migración visual completa del chat al protocolo común; captura autenticada en navegador; calibración de confianza; cohortes y unit economics de mercado.

**Mocked/hardcoded o demo-only:** cualquier historial explícitamente marcado como demo en `app/onboarding/page.tsx` y endpoints de demo; no debe presentarse como actividad real. La existencia de una ruta o componente no prueba ejecución ni persistencia.

**Desconectado o no demostrado:** eventos de funnel como `onboarding_started`, `context_added`, `first_action_completed`, `checkout_opened` y `subscription_activated` no forman todavía una taxonomía única consultable; el código existente registra eventos de Loop, pero no permite afirmar el funnel completo.

## Riesgos

- Producto: demasiadas superficies visibles diluyen el wedge.
- Datos: señales legacy no deben convertirse en diagnósticos o porcentajes.
- Seguridad: rate limiting en memoria es process-local; mantener límites y auditoría en cada mutación.
- Billing: no se ha ejecutado una compra real ni se deben inventar pagos.
- Performance: el grafo debe mantenerse bounded; evitar miles de nodos DOM y regeneraciones por render.

## Orden recomendado

1. Reducir onboarding al primer objetivo/contexto/acción y medirlo.
2. Normalizar funnel y métricas de acción verificada.
3. Ejecutar piloto observado con 10 founders; no declarar PMF.
4. Validar MCP estrella con repositorio y tests reales.
5. Solo después pulir visuales secundarios y superficies legacy.

## Requiere al fundador

Reclutar pilotos, observar sesiones, entrevistar sobre el problema actual, decidir precio Founder Pro, validar checkout en Test Mode y registrar resultados. El repositorio no puede inventar esas respuestas.
