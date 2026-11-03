# Novo: estado real de la arquitectura

Auditoría: 2026-11-01. Base inspeccionada: `cd0af5f`, con los cambios locales pendientes de Codex y accesibilidad. El checkout principal está en otro commit (`b47e8c8`); no se deben mezclar ni desplegar como si fueran iguales. Esta auditoría examina código y documentación; las pruebas nuevas y sus límites se registran en [IMPLEMENTATION_LOG](../engineering/IMPLEMENTATION_LOG.md).

Entrega: [capacidades](CAPABILITY_MATRIX.md), [deuda](TECHNICAL_DEBT.md), [arquitectura objetivo](TARGET_ARCHITECTURE.md), [evaluación de ecosistema/voz](../research/ECOSYSTEM_EVALUATION.md), [hoja de ruta](../roadmap/NOVO_EVOLUTION.md) y [registro de cambios y evidencia](../engineering/IMPLEMENTATION_LOG.md).

Actualización de entrega: PR #29 integrada en `main` (`c37432f`) y publicada en `productivitynovo.vercel.app`; PR #30 integrada como `f5d5a42`. CI web pasa tipos, lint y regresiones. [Companion 0.2.13](https://github.com/jeremyencarnacion2000-stack/Novo/releases/tag/companion-v0.2.13) publicado e instalado, con versión del ejecutable comprobada y proceso activo. El detector, proceso limitado y parser de producción devuelven una respuesta del plan ChatGPT. El usuario también confirmó una respuesta en la ventana instalada y aportó captura de ChatGPT Codex contestando a «hola»; esto no certifica toda la interacción nativa. Gmail fue renovado por el usuario y el chat web ya consulta correos reales con atribución Gmail; no se envió correo.

PR #31 (`b882c82`) publicada y verificada con la sesión autorizada: listado de 75 metadatos sin mensajes, detalle bajo demanda y ninguna escritura de historiales por lectura. PR #32 (`80bcc3a`) publica el dictado al borrador del chat con envío manual, cancelación por cuenta/selección y aviso de error sanitizado. CI final: tipos, lint, 329 suites / 1349 pruebas / dos snapshots aprobados. Vercel READY y alias canónico comprobados; la sesión real recibe una transcripción simulada sin ejecutar, enviar ni guardar nada. No se certifica el micrófono físico. [Evaluación y adaptación del ecosistema](../research/ECOSYSTEM_EVALUATION.md).

Actualización local 2026-11-03: Companion incorpora un catálogo determinista para tareas y estado cognitivo, propuestas de tarea con aprobación dentro del Companion y controles nativos acotados de ventanas Windows. La autorización del dispositivo anuncia capacidades nuevas sólo a clientes v2; clientes anteriores conservan su contrato. Dictado web y Companion requieren consentimiento explícito antes de usar reconocimiento que podría enviar audio fuera de Novo. La migración aditiva aún no está aplicada y ningún cambio de producción está certificado por esta actualización. Wake word, STT local, TTS y la calibración física siguen pendientes; la escucha continua permanece apagada.

## Capas existentes

| Capa | Implementación encontrada | Límite actual |
| --- | --- | --- |
| Experiencia | Next.js 16.3.5, React 19.2.8, Tailwind 4, Radix, Framer Motion; `app/client-layout.tsx`, `components/ContextHub.tsx` | Varios proveedores globales y paneles persistentes; medir la sesión autenticada, no extrapolar desde la landing |
| Servidor | App Router en `app/api`, validación Zod en rutas recientes | Contratos y manejo de errores no uniformes en rutas antiguas |
| Identidad | NextAuth JWT + adaptador Prisma, Google/Spotify/credenciales; `lib/auth.ts`, `lib/google-account.ts` | Consentimiento y renovación reales requieren validación con cuenta |
| Persistencia | Prisma 5.22, PostgreSQL/Neon, transporte configurable; `lib/prisma.ts`, `lib/database-transport.ts` | Cuota gratuita y tamaño de lecturas son restricciones operativas |
| Twin | Planner determinista, señales, procedencia, exclusiones, correcciones y outcomes; `lib/cognitive` | Código existente no demuestra utilidad/calibración longitudinal |
| Memoria de proyectos | Identidad por repositorio/proyecto, carpetas/dispositivos, revisiones y tombstones; `lib/project-assistant` | Verificar identidad cruzada y actualización con servicios reales |
| Chat web | `components/ai/modern-chatbot/context.tsx` → `/api/ai/stream`; listado de metadatos y detalle seleccionado | Orquestación separada del Companion; historiales abiertos conservados en memoria, sin política nueva de expulsión |
| Chat Companion | `/api/companion/chat` → `lib/ai/chat-service.ts` | Recibe mejoras de correo/proyectos que el chat web no comparte automáticamente |
| Acciones | `lib/ai/executor.ts`, `/api/ai/execute`, scopes, auditoría e idempotencia; correo en `lib/gmail-message.ts` | Las escrituras externas deben conservar propuesta revisada y confirmación explícita |
| Actividad | `lib/ai/activity.ts`, eventos secuenciados, cancelación y recuperación | Unificar consumidores sin perder arrendamientos ni estado terminal |
| Trabajo en segundo plano | Inngest, crons Vercel, claims persistidos de refresco; `lib/inngest`, `vercel.json`, workflow `project-assistant-refresh.yml` | Cron cloud observado correctamente; falta certificar actualización de cada proveedor/proyecto |
| Escritorio | Tauri 2 + Rust + TypeScript/Vite; `companion/windows` | Conexión de hooks, contexto autorizado y respuesta del modelo son capacidades distintas |
| Móvil | Capacitor Android/iOS carga la aplicación HTTPS en `/app` | No equivale a un agente nativo con control del sistema |

## Coucou

Identificado: [Louis-CFM/coucou](https://github.com/Louis-CFM/coucou), revisión declarada `a7bd575e90253673e7e08370a78f1261eb53ac2f`. `companion/windows/THIRD-PARTY-LICENSE.txt` conserva la licencia MIT y atribución a Louis Raillé. Novo sustituye los recursos de personaje/audio reservados. Mantener este aviso al distribuir. Manifiestos, README, release y ejecutable instalado coinciden en 0.2.13; el instalador incluye el aviso de licencia, comprobado en la instalación.

Novo reutiliza ventana/isla, hooks de agentes, integraciones, preferencias y runtime nativo. Sobre esa base añade cuenta Novo, chat compartido, captura consentida, carpetas/contexto de trabajo, scopes y trabajo durable. No se encontró evidencia de un Windows Widget de Windows App SDK independiente: la superficie actual es el Companion Tauri.

`widget.rs` y `widget.ts` contienen otra superficie pequeña, pero no están conectados al registro nativo ni a los inputs normales de Vite. Tampoco se encontró una extensión de navegador/native messaging: la forma `ChatContext::Window` no demuestra por sí misma captura automática de tabs/DOM. El runtime delegado Claude devuelve indisponible explícitamente; no anunciarlo como operativo.

## Contexto, memoria y coste

`lib/ai/context-builder.ts` reúne aproximadamente 18 fuentes por turno. La entrega limita el prefetch de rutinas, conserva lecturas sanas ante fallos independientes y declara campos desconocidos; la comprobación de exclusiones sigue fallando cerrada. Aún falta recuperación selectiva por intención y un presupuesto global del contexto. `lib/cognitive/ambient-twin-runtime.ts` realiza unas 15 lecturas; ya existen claims de refresco de 15 minutos que conviene reutilizar.

La memoria de trabajo vive en turnos/contexto; señales/outcomes representan memoria episódica; preferencias y entidades de proyectos representan memoria semántica; skills de runtime y acciones representan memoria procedural. No constituyen todavía una política única de retención y borrado para todas las fuentes.

El refresco de proyectos tiene mecanismos Inngest y un workflow GitHub programado cada 15 minutos, que llama al endpoint protegido. La ejecución `41378587708` responde `success:true`, `processed:63`, `failed:0`, `skipped:0`; son cuentas procesadas, no 63 proyectos ni prueba de salud de todos los proveedores. El cron de contexto ambiental configurado en Vercel es diario; es un mecanismo distinto.

Hay clasificación determinista y routing, pero no una medición uniforme de tokens, coste y escalados en todos los streams. No añadir una llamada de IA para decidir si cada comando necesita IA.

## Documentación previa que sigue siendo referencia

- [Verdad del producto](../novo-product-truth.md): separar kernel real, producto parcial y demos.
- [Control cognitivo](../novo-cognitive-control-plane.md) y [bucle ambiental](../novo-ambient-loop-architecture.md): contratos de planificación y permisos.
- [Asistente operativo](../superpowers/specs/2026-10-14-active-assistant-operability.md) y [correo/continuidad](../superpowers/plans/2026-10-19-mail-companion-readiness.md).
- [Recuperación de base gratuita](../operations/free-database-recovery.md): la fecha prevista de renovación no prueba recuperación real.
- [Auditoría de rendimiento de octubre](../app-performance-audit-2026-10-08.md): verificó aislamiento de suscripciones; dejó pendiente la medición autenticada y el build de producción.

## Continuación: salida de voz

El candidato del Companion añade reproducción nativa Microsoft, selector de voz, selección automática de español y lectura automática opcional. Helena está instalada y la síntesis en memoria funciona en este Windows. El usuario puede detener la respuesta desde el chat; cambiar contexto invalida el audio pendiente. La escucha «Novo», Whisper/Silero y el ciclo conversacional manos libres siguen pendientes; el trabajo de TTS no los declara completados. Se reconstruyeron los instaladores NSIS/MSI 0.2.14 con esta revisión; la instalación y las pruebas audibles siguen pendientes.

La base correcta de Novo quedó identificada en `shiny-firefly-37692190/main`. La migración de solicitudes de acción ya está aplicada por Prisma y verificada; la rama temporal de prueba fue eliminada con aprobación del usuario. El servidor compatible está preparado para publicación.
