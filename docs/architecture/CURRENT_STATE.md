# Novo: estado real de la arquitectura

Actualización 2026-11-06: `3ad0d09` corrige lectura de una respuesta antigua cuando falla continuar un proyecto tras abrir su app; tres regresiones rojas pasan después. **CI de la candidata aprobado: 438 frontend/281 app/30 hooks/21 harness/6 Python y build.** NSIS cotejado, preferencias respaldadas y autorización de instalación solicitada; todavía no ejecutado. C: recuperó 17,6 GiB; se verificaron otra vez instalación y reversión. Cuatro replays nuevos con Small: EN sintético correcto a 2 923 ms, ES aún rechazado a 9 735 ms; no se cambia modelo ni filtros. La instalación sigue en `c64098a`, sin nueva prueba física. [Evidencia y aceptación pendiente](../engineering/2026-11-06-voice-review.md).

Actualización de rendimiento 2026-11-05: **140 procesos automáticos sobre 12 controles sintéticos**, sin nuevas pruebas humanas. El contexto corto baja la mediana de Tiny Q5_1 de 3 938 a 1 501 ms, pero pierde resultados correctos y acepta otros erróneos; no se cambian parámetros del producto. Instrumentación numérica y corrección del lector empaquetadas en candidata `2b91b0d`, CI Windows aprobado (434 frontend/281 nativas/30 hooks/21 harness). Instalador cotejado y preparado, **sin instalar** por almacenamiento insuficiente y autorización de esa candidata pendiente. La instalación continúa en `c64098a`. [Métricas, comparación y límites](../engineering/2026-11-05-voice-optimization.md).

Estado de aceptación al 2026-11-05: candidata local **0.2.17 `c64098a` instalada con autorización**, rollback 0.2.16 cotejado y recursos verificados. El usuario confirmó apertura/enfoque de Codex por texto y lectura audible desde el chat. El dictado español fijo sigue rechazando la orden; el circuito completo con voz/Twin no pasa. Hay cuatro muestras habladas independientes y un control sin habla. La corrección posterior del corte de lectura al guardar ajustes pasa 433 pruebas frontend y build, pero aún no está en ese instalador. [Evidencia actual](../engineering/2026-11-04-voice-calibration.md). Los apartados fechados anteriores conservan su contexto histórico.

Auditoría: 2026-11-01. Base inspeccionada: `cd0af5f`, con los cambios locales pendientes de Codex y accesibilidad. El checkout principal está en otro commit (`b47e8c8`); no se deben mezclar ni desplegar como si fueran iguales. Esta auditoría examina código y documentación; las pruebas nuevas y sus límites se registran en [IMPLEMENTATION_LOG](../engineering/IMPLEMENTATION_LOG.md).

Actualización 2026-11-04: en la rama `codex/companion-local-voice`, Companion 0.2.16 incorpora dictado manual offline para español/inglés mediante whisper.cpp/Silero fijados y verificados. Pasan 417 pruebas del frontend, el build TypeScript/Vite y 4 pruebas nativas enfocadas. El CI Windows generó instaladores EXE/MSI desde `e4259e6` (run [41781602456](https://github.com/jeremyencarnacion2000-stack/Novo/actions/runs/41781602456)); sus SHA-256 están registrados en [IMPLEMENTATION_LOG](../engineering/IMPLEMENTATION_LOG.md). El usuario instaló la candidata y se verificaron versión 0.2.16 en Windows y proceso activo; no es release público. Faltan las pruebas físicas de micrófono, latencia y consumo.

Entrega: [capacidades](CAPABILITY_MATRIX.md), [deuda](TECHNICAL_DEBT.md), [arquitectura objetivo](TARGET_ARCHITECTURE.md), [evaluación de ecosistema/voz](../research/ECOSYSTEM_EVALUATION.md), [hoja de ruta](../roadmap/NOVO_EVOLUTION.md) y [registro de cambios y evidencia](../engineering/IMPLEMENTATION_LOG.md).

Entrega actual verificada (2026-11-03): [Companion 0.2.15](https://github.com/jeremyencarnacion2000-stack/Novo/releases/tag/companion-v0.2.15) publicado e instalado. El usuario confirmó la reconexión; el servidor confirmó emisión del token, verificación, registro del PC y verificaciones posteriores con HTTP 200. El dispositivo está activo con 15 scopes, incluidos chat, tareas y escritorio. Los ajustes conservaron exactamente su contenido tras instalar y reiniciar, antes de reautorizar. Esto acredita la conexión; no certifica todavía tareas, ventanas o micrófono de extremo a extremo.

Actualización de entrega: PR #29 integrada en `main` (`c37432f`) y publicada en `productivitynovo.vercel.app`; PR #30 integrada como `f5d5a42`. CI web pasa tipos, lint y regresiones. [Companion 0.2.13](https://github.com/jeremyencarnacion2000-stack/Novo/releases/tag/companion-v0.2.13) publicado e instalado, con versión del ejecutable comprobada y proceso activo. El detector, proceso limitado y parser de producción devuelven una respuesta del plan ChatGPT. El usuario también confirmó una respuesta en la ventana instalada y aportó captura de ChatGPT Codex contestando a «hola»; esto no certifica toda la interacción nativa. Gmail fue renovado por el usuario y el chat web ya consulta correos reales con atribución Gmail; no se envió correo.

PR #31 (`b882c82`) publicada y verificada con la sesión autorizada: listado de 75 metadatos sin mensajes, detalle bajo demanda y ninguna escritura de historiales por lectura. PR #32 (`80bcc3a`) publica el dictado al borrador del chat con envío manual, cancelación por cuenta/selección y aviso de error sanitizado. CI final: tipos, lint, 329 suites / 1349 pruebas / dos snapshots aprobados. Vercel READY y alias canónico comprobados; la sesión real recibe una transcripción simulada sin ejecutar, enviar ni guardar nada. No se certifica el micrófono físico. [Evaluación y adaptación del ecosistema](../research/ECOSYSTEM_EVALUATION.md).

Primera entrega 2026-11-03: PR #33 publicó el catálogo determinista de tareas/estado cognitivo, las propuestas con aprobación dentro del Companion y los controles nativos acotados de ventanas. La migración aditiva se aplicó y verificó; se instaló Companion 0.2.14 conservando los ajustes. Después, 0.2.15 completó la reconexión real descrita arriba. La autorización anuncia capacidades nuevas sólo a clientes v2; las conexiones antiguas requieren reautorización. Dictado web y Companion requieren consentimiento independiente antes de reconocimiento que podría procesar audio fuera de Novo. TTS Microsoft local está implementado; wake word, STT local y la calibración física siguen pendientes, con escucha continua apagada.

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

Identificado: [Louis-CFM/coucou](https://github.com/Louis-CFM/coucou), revisión declarada `a7bd575e90253673e7e08370a78f1261eb53ac2f`. `companion/windows/THIRD-PARTY-LICENSE.txt` conserva la licencia MIT y atribución a Louis Raillé. Novo sustituye los recursos de personaje/audio reservados. Mantener este aviso al distribuir. El release público sigue en 0.2.15; el ejecutable local instalado es la candidata 0.2.17. El instalador incluye los avisos de licencia. Las voces Microsoft pertenecen a Windows y no se redistribuyen.

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

Companion conserva reproducción Microsoft, selector de voz y lectura automática opcional. El usuario confirmó SAPI con Helena es-ES/David en-US y lectura desde el chat instalado; faltan interrupción física y latencia de inicio. La candidata instalada `c64098a` corrige FIFO y aviso prematuro de escucha y añade elección local de idioma. Sus cuatro muestras habladas no certifican precisión ES/EN; el control sin habla se excluye del corpus hablado. Small recuperó una orden española; el mejor ensayo con confianza aceptable tardó 12,4 s, fuera de aceptación. La escucha «Novo» sigue desactivada y sin implementar. [Calibración y límites](../engineering/2026-11-04-voice-calibration.md).

La base correcta de Novo quedó identificada en `shiny-firefly-37692190/main`. La migración de solicitudes de acción ya está aplicada por Prisma y verificada; la rama temporal de prueba fue eliminada con aprobación del usuario. El servidor compatible está publicado en `productivitynovo.vercel.app`; el endpoint nuevo devuelve 401 sin credenciales, como corresponde. La reconexión real ya está verificada: PR #38 conserva los nombres de modelos OIDC entre bundles y PR #37 confirma expresamente reemplazar el acceso del PC aunque falte la credencial local. Las acciones con datos reales continúan pendientes de aceptación.

## Desarrollo de asistencia de escritorio — 2026-11-04

Desarrollo en `codex/companion-desktop-flow`: catálogo Windows general y exclusiones locales implementados; apertura/control y lectura de títulos separados. Las pruebas reales descubren 73 apps, verifican Codex/Bloc de notas y recuperan ClickHome (1 proyecto, 12 fragmentos). Una continuación real del chat termina con pregunta y respeta la indisponibilidad de Twin en el modelo actual. La candidata de esta rama `c64098a` está instalada como 0.2.17; la apertura/enfoque de Codex desde texto fue confirmada por el usuario. No se fusionó ni publicó. [Evidencia y límites](../engineering/2026-11-04-desktop-assistance-evidence.md).
