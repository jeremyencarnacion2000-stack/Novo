# Novo — Launch readiness

Fecha: 2026-08-08

| Gate | Estado | Evidencia / bloqueo |
|---|---|---|
| Kernel persistente | Verde | Prisma, Loop routes y Activity Protocol |
| Ownership e idempotencia | Verde | MCP audit, transiciones y tests A/B |
| Actividad AI veraz | Verde | `lib/ai/activity.ts`, SSE/polling y terminales |
| Twin adaptativo visible | Verde local | Workers Observe/Understand/Propose/Verify/Learn/Adapt, política persistida, Focus Agent y Cognitive reactivos |
| Onboarding <60s | Rojo | Falta medir y simplificar el flujo actual |
| Funnel de activación | Amarillo | Eventos Loop existen; taxonomía completa pendiente |
| MCP estrella | Amarillo | Infraestructura lista; falta demo reproducible con repo externo |
| Today dominante | Amarillo | Requiere revisión de jerarquía en runtime autenticado |
| Cognitive accionable | Amarillo | Graph/lenses/inspector y adaptaciones visibles; falta captura visual autenticada |
| Pagos Live | Amarillo | Checkout/webhook/lifecycle en código; sin compra o webhook real validado |
| Mercado | Rojo | No hay entrevistas, cohortes ni resultados |
| Calidad técnica | Verde local | 71 suites, 220 tests, 2 snapshots; lint y TypeScript verdes; build con 4 GB genera 130/130 páginas |
| Producción | Amarillo | Smoke anónimo: `/landing` 200 y status cognitivo 401; validar rutas autenticadas con sesión real |

## Bloqueadores antes de lanzamiento comercial

1. Medir y reducir first-value time.
2. Completar instrumentación de funnel y cohortes.
3. Ejecutar piloto observado y registrar outcomes.
4. Validar checkout/webhooks en Test Mode y luego Live con control del fundador.
5. Capturar evidencia autenticada de Today/Cognitive/MCP en móvil y reduced motion.

## Bloqueo operativo de esta sesión

El guard de base de datos aislada pasa, pero `npm run test:e2e:isolated` falla antes de sus assertions porque la rama Neon de prueba rechaza autenticación al crear el primer usuario sintético. No se tocaron datos de producción. El build actual sí termina con `NODE_OPTIONS=--max-old-space-size=4096`; la suite completa pasa 71/71 suites.

No se recomienda ampliar módulos ni declarar PMF antes de completar los gates de producto y las validaciones autenticadas.
