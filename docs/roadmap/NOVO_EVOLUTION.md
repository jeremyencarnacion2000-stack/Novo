# Evolución de Novo

Actualizado: 2026-11-02. Basado en la [auditoría actual](../architecture/CURRENT_STATE.md), sin sustituir los planes operativos previos.

| Etapa | Existente | Mejora / nueva capacidad | Dependencias y riesgo | Aceptación |
| --- | --- | --- | --- | --- |
| 0. Estado y fluidez | Hub, timer, chat, pruebas, auditorías | Inventario fiable; eliminar trabajo invisible; medir escritura, scroll, gestos y paneles por página | Entorno de dependencias y sesión autenticada; preservar exit/foco/drafts y glass | Pruebas de ciclo y cifras reproducibles de interacción; navegación rápida no basta |
| 1. Una conversación útil | Dos rutas de chat, skills de correo, actividad y permisos | Convergencia gradual de contexto/herramientas; mensajes bajo demanda | Contratos SSE/adjuntos/turnos; evitar pérdida de historial o scopes | Web y Companion leen el mismo correo completo y preparan una respuesta revisable; envío sólo confirmado |
| 2. Trabajo local práctico | Hooks, carpetas autorizadas, memoria de proyectos, runtime Codex | Elección Codex en chat real; diagnóstico de proyecto y resultado recuperable | CLI/sesión/sandbox local, aislamiento de backend e historial | Elegir plan funciona sin API key; cambiar modo cancela/ignora respuestas antiguas |
| 3. Voz | Dictado y capacidades de síntesis existentes | ES/EN, VAD, respuesta interrumpible y conmutación texto/voz | Permisos de micrófono, hardware, licencias de pesos; ver investigación | Inicio manual, detener/interrumpir, sin envío involuntario; latencia/RAM/CPU medidas |
| 4. Seguimiento útil | Planner determinista, señales y claims de refresco | Scheduler certificado, memoria selectiva/retención y alertas relevantes | Inngest/cron, cuotas y fuentes conectadas | Un cambio de proyecto se incorpora una vez; ningún evento de escritorio dispara IA por sí solo |
| 5. Continuidad | Registro de dispositivos, conversación compartida y Capacitor | Checkpoint de tarea y handoff con capacidades/offline | Consentimiento y revocación, conflictos de revisiones | Empezar en Windows y retomar en Android sin reconstruir información ni duplicar acciones |

Entregas de base: trabajo oculto del Hub, recuperación parcial del contexto y respuesta Codex verificada en Companion 0.2.13. La siguiente entrega implementa el historial web bajo demanda, con protección de persistencia y cuenta; [evidencia y límites](../performance/2026-11-02-conversation-history.md). La convergencia de orquestadores y recuperación selectiva de contexto por intención permanecen pendientes. Frameworks nuevos, wake word continuo y control general del PC quedan sujetos a evidencia de utilidad y autorización específica.

La [medición de interacción autenticada](../performance/2026-11-01-interaction-fluency.md) separa el estado publicado de los ajustes locales y enumera la aceptación pendiente por superficie. Priorizar la pintura de dashboard/Hoy y apertura móvil; el chat observado tiene un coste de frames muy inferior. No reducir el glass globalmente para uniformar números.
