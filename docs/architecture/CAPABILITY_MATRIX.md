# Matriz de capacidades

Fecha: 2026-11-01. «Implementada sin verificar» significa que se encontró el camino de código, pero no se ejecutó de extremo a extremo en esta auditoría. Las pruebas unitarias no certifican un servicio externo. Consultar el [registro de implementación](../engineering/IMPLEMENTATION_LOG.md) para evidencia nueva.

| Capacidad | Estado observado | Evidencia / validación pendiente |
| --- | --- | --- |
| Navegación, Hub y Pomodoro | Pruebas aprobadas; publicada en producción | 11 pruebas de Hub y pruebas de navegación/foco/morph; panel inicial y contenido Pomodoro cerrados diferidos; PR #29 en producción |
| Fluidez dentro de páginas | Mejoras publicadas; pendiente medición final por dispositivo | Dashboard/Hoy, chat, centro cognitivo y menú móvil observados con sesión real. CI completo aprobado; ver [mediciones y límites](../performance/2026-11-01-interaction-fluency.md). No se certifican 60 FPS |
| Texto grande, contraste, transparencia, movimiento | Publicada; verificación de hardware parcial | Settings y política de movimiento cubiertos por pruebas; falta revisar todos los dispositivos reales |
| Objetivo → plan → acción → outcome | Implementada sin verificar en esta sesión | `canonical-planner`, `action-state-machine`, `tests/novo-loop-isolated.e2e.ts` |
| Memoria de proyectos local/GitHub/Vercel | Implementada sin verificar | `lib/project-assistant`; demostrar una identidad compartida con fuentes reales |
| Contexto Twin con procedencia/exclusiones | Implementada sin verificar | `signal-ledger`, `ambient-twin-runtime`, `twin-context` |
| Gmail: búsqueda, cuerpo completo, propuesta de envío | Lectura real web confirmada tras renovar; envío sin probar | Google rechazaba el grant guardado; el usuario completó la renovación. La pregunta real sobre MESCyT devuelve mensajes concretos, fechas y contenido, con Gmail como fuente. No se envió correo; web/Companion aún tienen orquestaciones distintas |
| Acciones con permisos, auditoría, retry seguro | Implementada sin verificar externamente | Executor/MCP y esquemas; verificar cada adaptador con cuenta de prueba |
| Chat cuenta Novo en Companion | Implementada sin verificar en vivo | `NovoChatController`, `novo_chat_start`, `/api/companion/chat` |
| Elegir Codex con plan ChatGPT | Release 0.2.13 instalada; respuesta real del runtime confirmada, GUI pendiente | El arreglo produce `NOVO_OK` en 8.5–11.7 s usando detector, proceso limitado y decoder de producción. CI: 261 pruebas de app, 30 de hooks y 19 del harness aprobadas; EXE/MSI publicados. El chat no carga documentos de proyectos ni herramientas locales, ni hereda transportes del agente padre; no comparte automáticamente Twin/historial Novo |
| Hooks de Codex/Claude y aprobaciones | Implementada sin verificar con evento real | `companion/windows/hook`, configuración de hooks; instalar no garantiza recibir eventos |
| Carpetas autorizadas y contexto de agentes | Implementada sin verificar en vivo | Runtime de workspace/work-context, exclusiones y scopes |
| Contexto de navegador | Colector general ausente | Hay contrato ventana/URL; no se encontró extensión/native messaging ni collector automático de DOM/tab activo |
| Widget Windows separado | Fuente inactiva | `widget.rs`/`widget.ts` no están conectados al runtime/build normal; la isla Tauri es la representación operativa existente |
| Dictado manual | Implementada sin verificar por hardware | Dictado del chat/browser; disponibilidad depende del motor y permisos |
| Voz conversacional con VAD/interrupción | Parcial / planificada | Hay dictado y speech helpers; falta pipeline unificado medido ES/EN |
| Wake word local | Ausente del flujo certificado | Candidato opcional; requiere consentimiento, modelo y presupuesto de CPU |
| Control general de Windows por UI Automation | Ausente del flujo certificado | Preferir adaptadores API antes de introducir control visual |
| Diagnóstico/preparación de arreglo de proyecto | Implementada; ejecución de código sin certificar en este Windows 10 | `project_work`, workspace aislado, proceso limitado, artefactos. El aislamiento legacy requiere lectura raíz que Novo no concede; no confundir una respuesta textual Codex con automatización local de código |
| Sincronización y revocación de dispositivo | Implementada sin verificar en vivo | Token/scopes, registro de dispositivo, revalidación al terminar turno |
| Continuidad de tarea offline entre dispositivos | No demostrada / planificada | Conversaciones/observaciones compartidas no prueban handoff offline |
| Proactividad determinista | Cron cloud observado; eficacia por proyecto pendiente | Workflow programado cada 15 minutos; run `41378587708` procesa 63 cuentas sin fallo del lote. No demuestra que todos los conectores estén sanos ni que cada proyecto se actualice |
| Presupuesto/coste por tarea completada | Parcial | Métricas en algunas llamadas; faltan streams y planning de correo |
| Framework adicional de agentes/memoria | No necesario ahora | Ya hay planner, executor y memoria; evitar duplicarlos |

No se certificó como «completa y verificada» una capacidad externa por mera presencia de código. Los fixtures/demo se mantienen fuera de la evidencia de uso real.
