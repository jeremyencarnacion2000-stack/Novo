# Arquitectura objetivo incremental

La estructura conceptual del Cognitive OS se adapta a los módulos existentes. No requiere otro backend ni otro framework de agentes.

```text
Web / Companion / Capacitor / voz
          ↓ identidad + dispositivo + scopes
Servicio de conversación y actividad compartido
          ↓
Intención determinista → contexto selectivo → modelo cuando hace falta
          ↓                         ↑
Planner / executor             Twin / memoria con procedencia
          ↓                         ↑
Propuesta → autorización → acción → resultado / aprendizaje
          ↓
Adaptadores existentes: Gmail, Calendar, proyectos, MCP, runtime local
```

## Reutilizar

- `lib/ai/chat-service.ts`: convergencia de conversación, manteniendo adaptadores de transporte web/Companion.
- `lib/ai/classifier.ts`, `executor.ts`, `lib/cognitive/canonical-planner.ts`: decisiones simples sin llamada adicional de IA.
- `lib/project-assistant` y `signal-ledger`: identidad/procedencia, revisiones y exclusiones de memoria.
- `lib/ai/activity.ts`: progreso, terminales, retry y cancelación.
- Autenticación/scopes de Companion y MCP, confirmaciones e idempotencia existentes.
- Runtime Tauri de Windows: adaptadores locales con argv fijo, límites, procesos cancelables y contexto autorizado.

## Cambiar por etapas

1. Medir y retirar trabajo oculto; listar metadatos y obtener detalle al necesitarlo.
2. Dar el mismo contrato de contexto/herramientas al chat web y al Companion. La migración necesita pruebas de transporte y permisos antes de sustituir la ruta antigua.
3. Tratar voz como otra entrada al mismo executor: dictado manual primero; VAD y streaming/interrupción después de medir hardware. No activar micrófono o wake word en segundo plano por defecto.
4. Integrar workflows nativos concretos mediante API de aplicación/sistema. UI Automation sólo cuando falte un contrato estructurado, con permiso por capacidad.
5. Handoff con identidad de tarea, checkpoint mínimo y capacidades del dispositivo; no copiar automáticamente toda la conversación o disco.

Primer paso de voz implementado en las rutas de chat: captura existente → transcripción → borrador actual → envío manual → herramientas/confirmaciones del chat. En Companion el reconocimiento requiere ahora consentimiento local explícito porque puede procesar audio fuera de Novo. Los comandos de texto y dictado llegan al mismo envío; tareas requieren una propuesta guardada y aprobación visual. El control de escritorio se mantiene local y usa operaciones Windows permitidas. No se declara terminado el wake word, STT offline, TTS, escucha conversacional ni la convergencia completa.

## Fronteras que deben conservarse

Todo contenido recuperado es dato no confiable. El modelo propone; Zod y el servidor validan. Scopes, ownership, idempotencia y auditoría se aplican también a comandos de voz. Las acciones consecuentes requieren confirmación explícita. Una fuente temporalmente caída debe aparecer como indisponible, no como vacía. El rendimiento no justifica omitir revocación ni controles de cuenta.
