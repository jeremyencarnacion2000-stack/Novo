# Matriz de capacidades

Fecha: 2026-11-03. «Implementada sin verificar» significa que se encontró el camino de código, pero no se ejecutó de extremo a extremo en esta auditoría. Las pruebas unitarias no certifican un servicio externo. Consultar el [registro de implementación](../engineering/IMPLEMENTATION_LOG.md) para evidencia nueva.

| Capacidad | Estado observado | Evidencia / validación pendiente |
| --- | --- | --- |
| Navegación, Hub y Pomodoro | Pruebas aprobadas; publicada en producción | 11 pruebas de Hub y pruebas de navegación/foco/morph; panel inicial y contenido Pomodoro cerrados diferidos; PR #29 en producción |
| Fluidez dentro de páginas | Mejoras publicadas; pendiente medición final por dispositivo | Dashboard/Hoy, chat, centro cognitivo y menú móvil observados con sesión real. CI completo aprobado; ver [mediciones y límites](../performance/2026-11-01-interaction-fluency.md). No se certifican 60 FPS |
| Texto grande, contraste, transparencia, movimiento | Publicada; verificación de hardware parcial | Settings y política de movimiento cubiertos por pruebas; falta revisar todos los dispositivos reales |
| Historial de chat bajo demanda | Implementado y probado; publicación/lectura real se registran por separado | Listado web de metadatos y detalle seleccionado; controles de carga/retry y protección de autosave/cuenta. Fixture: 4,500,381 → 55,850 bytes contando un detalle; no representa factura ni FPS |
| Objetivo → plan → acción → outcome | Implementada sin verificar en esta sesión | `canonical-planner`, `action-state-machine`, `tests/novo-loop-isolated.e2e.ts` |
| Memoria de proyectos local/GitHub/Vercel | Implementada sin verificar | `lib/project-assistant`; demostrar una identidad compartida con fuentes reales |
| Contexto Twin con procedencia/exclusiones | Implementada sin verificar | `signal-ledger`, `ambient-twin-runtime`, `twin-context` |
| Gmail: búsqueda, cuerpo completo, propuesta de envío | Lectura real web confirmada tras renovar; envío sin probar | Google rechazaba el grant guardado; el usuario completó la renovación. La pregunta real sobre MESCyT devuelve mensajes concretos, fechas y contenido, con Gmail como fuente. No se envió correo; web/Companion aún tienen orquestaciones distintas |
| Acciones con permisos, auditoría, retry seguro | Implementada sin verificar externamente | Executor/MCP y esquemas; verificar cada adaptador con cuenta de prueba |
| Chat cuenta Novo en Companion | Cuenta OAuth verificada; turno real pendiente | 0.2.15 instalado; usuario confirma conexión y el servidor verifica el dispositivo con los permisos nuevos. No equivale a probar una respuesta del chat de cuenta |
| Comandos directos de tareas y estado Twin en Companion | Servidor publicado, 0.2.15 instalado y permisos reales verificados; acciones pendientes | Migración aplicada, con prueba sintética de idempotencia y propiedad. Listar tareas y snapshot cognitivo filtran propietario; crear tarea requiere aprobación visual. La cuenta ya está reautorizada |
| Control local de apps Windows | Instalado y reautorizado, limitado a apps elegidas | Catálogo inicial: Chrome, Edge, Firefox, VS Code, Bloc de notas y Explorador. Abrir/enfocar/minimizar/maximizar/restaurar; scopes separados; exe, rutas y HWND quedan locales. Falta verificar operaciones de ventana reales |
| Elegir Codex con plan ChatGPT | Verificada: runtime y respuesta en ventana instalada | Release 0.2.13 instalada; el usuario confirma respuesta y aporta captura de «hola» contestado en ChatGPT Codex. Sonda de producción: `NOVO_OK` en 8.5–11.7 s. CI: 261 pruebas de app, 30 de hooks y 19 del harness aprobadas. No carga documentos/herramientas locales ni hereda transportes del padre; Twin/historial Novo no se transfieren automáticamente. Resto de interacción/hardware todavía parcial |
| Hooks de Codex/Claude y aprobaciones | Implementada sin verificar con evento real | `companion/windows/hook`, configuración de hooks; instalar no garantiza recibir eventos |
| Carpetas autorizadas y contexto de agentes | Implementada sin verificar en vivo | Runtime de workspace/work-context, exclusiones y scopes |
| Contexto de navegador | Colector general ausente | Hay contrato ventana/URL; no se encontró extensión/native messaging ni collector automático de DOM/tab activo |
| Widget Windows separado | Fuente inactiva | `widget.rs`/`widget.ts` no están conectados al runtime/build normal; la isla Tauri es la representación operativa existente |
| Dictado manual | Implementada sin verificar por hardware | Dictado del chat/browser; disponibilidad depende del motor y permisos |
| Dictado web al chat actual | Publicada; pruebas automatizadas y receptor real verificados, audio simulado | PR #32: transcripción al borrador, texto/adjuntos conservados y envío manual por el mismo chat. Cambio de cuenta/selección/cierre invalida resultados; sin ejecutor separado en `/chat` y `/ai`. QA con sesión: cero envíos/acciones/guardados al recibir dictado. No certifica STT físico |
| Dictado manual en Companion | Instalado con consentimiento explícito; audio físico pendiente | El permiso local está apagado por defecto y el motor de voz del navegador no inicia hasta permitirlo en Configuración; sigue siendo un servicio que puede procesar audio fuera de Novo, no STT offline |
| Voz conversacional con VAD/interrupción | Parcial / planificada | Hay dictado y speech helpers; falta pipeline unificado medido ES/EN |
| Wake word local «Novo» | No implementada | No activar escucha continua hasta integrar detector local y aprobar medición física de falsos positivos, CPU, memoria y latencia |
| Voz de respuesta | Implementada e instalada; síntesis española en memoria verificada | Windows Microsoft, español automático, leer/detener y lectura automática opcional en Novo/Codex. Falta comprobar audio audible y latencia de cancelación |
| Conversación manos libres | No implementada | Faltan captura nativa, STT/VAD y bucle de escucha; el dictado disponible es manual revisable |
| Control general de Windows por UI Automation | No implementado; controles nativos acotados sí están en código | No hay automatización de formularios, shell, cierre de procesos ni UI Automation general |
| Diagnóstico/preparación de arreglo de proyecto | Implementada; ejecución de código sin certificar en este Windows 10 | `project_work`, workspace aislado, proceso limitado, artefactos. El aislamiento legacy requiere lectura raíz que Novo no concede; no confundir una respuesta textual Codex con automatización local de código |
| Sincronización y revocación de dispositivo | Vinculación y revalidación verificadas; revocación pendiente | Registro activo con 15 scopes y revalidaciones reales 200 tras reconectar en 0.2.15. No acredita todavía toda la sincronización ni revocación de un dispositivo activo |
| Continuidad de tarea offline entre dispositivos | No demostrada / planificada | Conversaciones/observaciones compartidas no prueban handoff offline |
| Proactividad determinista | Cron cloud observado; eficacia por proyecto pendiente | Workflow programado cada 15 minutos; run `41378587708` procesa 63 cuentas sin fallo del lote. No demuestra que todos los conectores estén sanos ni que cada proyecto se actualice |
| Presupuesto/coste por tarea completada | Parcial | Métricas en algunas llamadas; faltan streams y planning de correo |
| Framework adicional de agentes/memoria | No necesario ahora | Ya hay planner, executor y memoria; evitar duplicarlos |

No se certificó como «completa y verificada» una capacidad externa por mera presencia de código. Los fixtures/demo se mantienen fuera de la evidencia de uso real.

## Reproducción local de respuestas — conservada en Companion 0.2.15

| Capacidad | Estado y evidencia |
| --- | --- |
| Voz Microsoft española | Helena instalada en este PC mediante Windows; síntesis fija en memoria comprobada sin altavoces |
| Leer/detener respuesta en Novo y Codex | Instalado, con identidad de solicitud y cancelación al cambiar contexto; botón observado en la ventana actualizada |
| Lectura automática | Opt-in desactivado por defecto; el historial cargado permanece silencioso |
| Micrófono / wake word / STT local | No se activaron; implementación y piloto físico pendientes |
| Cancelación ≤250 ms y calidad audible | Objetivos pendientes de medición; no se deducen de pruebas simuladas |
