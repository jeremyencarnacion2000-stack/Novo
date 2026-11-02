# Matriz de capacidades

Fecha: 2026-11-01. «Implementada sin verificar» significa que se encontró el camino de código, pero no se ejecutó de extremo a extremo en esta auditoría. Las pruebas unitarias no certifican un servicio externo. Consultar el [registro de implementación](../engineering/IMPLEMENTATION_LOG.md) para evidencia nueva.

| Capacidad | Estado observado | Evidencia / validación pendiente |
| --- | --- | --- |
| Navegación, Hub y Pomodoro | Verificada localmente; producción pendiente | 11 pruebas de Hub y pruebas de navegación/foco/morph; panel inicial y contenido Pomodoro cerrados diferidos |
| Fluidez dentro de páginas | Medida en producción; mejoras locales pendientes de publicar | Dashboard/Hoy, chat, centro cognitivo y menú móvil observados con sesión real. 53 pruebas web dirigidas pasan; ver [mediciones y límites](../performance/2026-11-01-interaction-fluency.md) |
| Texto grande, contraste, transparencia, movimiento | Parcial: cambios locales pendientes | Settings y política de movimiento; falta publicar y revisar dispositivos reales |
| Objetivo → plan → acción → outcome | Implementada sin verificar en esta sesión | `canonical-planner`, `action-state-machine`, `tests/novo-loop-isolated.e2e.ts` |
| Memoria de proyectos local/GitHub/Vercel | Implementada sin verificar | `lib/project-assistant`; demostrar una identidad compartida con fuentes reales |
| Contexto Twin con procedencia/exclusiones | Implementada sin verificar | `signal-ledger`, `ambient-twin-runtime`, `twin-context` |
| Gmail: búsqueda, cuerpo completo, propuesta de envío | Cableado de pregunta/historial corregido; validación externa pendiente | Web y Companion usan el lector de evidencia con pregunta/historial; siguen en orquestaciones distintas. Regresiones de seguimiento/fallos pasan; no se envió correo ni se certificó una búsqueda real |
| Acciones con permisos, auditoría, retry seguro | Implementada sin verificar externamente | Executor/MCP y esquemas; verificar cada adaptador con cuenta de prueba |
| Chat cuenta Novo en Companion | Implementada sin verificar en vivo | `NovoChatController`, `novo_chat_start`, `/api/companion/chat` |
| Elegir Codex con plan ChatGPT | UI/aislamiento y compilación verificados; respuesta real pendiente | 34 pruebas dirigidas, TypeScript, Vite y cargo check de biblioteca/tests pasan. `account/read` reconoce ChatGPT localmente sin generación. Falta instalar binario nuevo y probar una respuesta; no comparte automáticamente herramientas/Twin/historial Novo |
| Hooks de Codex/Claude y aprobaciones | Implementada sin verificar con evento real | `companion/windows/hook`, configuración de hooks; instalar no garantiza recibir eventos |
| Carpetas autorizadas y contexto de agentes | Implementada sin verificar en vivo | Runtime de workspace/work-context, exclusiones y scopes |
| Contexto de navegador | Colector general ausente | Hay contrato ventana/URL; no se encontró extensión/native messaging ni collector automático de DOM/tab activo |
| Widget Windows separado | Fuente inactiva | `widget.rs`/`widget.ts` no están conectados al runtime/build normal; la isla Tauri es la representación operativa existente |
| Dictado manual | Implementada sin verificar por hardware | Dictado del chat/browser; disponibilidad depende del motor y permisos |
| Voz conversacional con VAD/interrupción | Parcial / planificada | Hay dictado y speech helpers; falta pipeline unificado medido ES/EN |
| Wake word local | Ausente del flujo certificado | Candidato opcional; requiere consentimiento, modelo y presupuesto de CPU |
| Control general de Windows por UI Automation | Ausente del flujo certificado | Preferir adaptadores API antes de introducir control visual |
| Diagnóstico/preparación de arreglo de proyecto | Implementada sin verificar en vivo | `project_work`, workspace aislado, proceso limitado, artefactos |
| Sincronización y revocación de dispositivo | Implementada sin verificar en vivo | Token/scopes, registro de dispositivo, revalidación al terminar turno |
| Continuidad de tarea offline entre dispositivos | No demostrada / planificada | Conversaciones/observaciones compartidas no prueban handoff offline |
| Proactividad determinista | Parcial | Señales, claims y scheduler; comprobar ejecución sin navegador abierto |
| Presupuesto/coste por tarea completada | Parcial | Métricas en algunas llamadas; faltan streams y planning de correo |
| Framework adicional de agentes/memoria | No necesario ahora | Ya hay planner, executor y memoria; evitar duplicarlos |

No se certificó como «completa y verificada» una capacidad externa por mera presencia de código. Los fixtures/demo se mantienen fuera de la evidencia de uso real.
