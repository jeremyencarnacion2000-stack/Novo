# Deuda técnica priorizada

Auditoría de código del 2026-11-01. La prioridad combina efecto sobre uso real, coste y riesgo; no es un benchmark de producción.

| Prioridad | Hallazgo | Cambio mínimo recomendado | Criterio de cierre |
| --- | --- | --- | --- |
| P1 | Web y Companion ejecutan dos orquestadores de chat | Migrar por contratos al servicio compartido, preservando formato SSE, leases, cancelación, adjuntos y confirmaciones | Misma pregunta Gmail/proyecto produce consultas equivalentes en ambas superficies; pruebas de permisos y cancelación |
| Implementada | El chat web descargaba hasta 200 historiales completos | Resumen opt-in y detalle seleccionado en los endpoints existentes; contrato legado conservado | Pruebas de hidratación, autosave, selección/cuenta y borrado; [medición y límites](../performance/2026-11-02-conversation-history.md) |
| P1 | `buildUserContext` aún hace fan-out amplio por turno | Resultados parciales y límites de rutinas ya implementados; falta recuperación selectiva por intención y presupuesto global | Una fuente caída no se presenta como cuenta vacía; bytes/latencia reales por turno registrados |
| Resuelta | Codex reconocía el login pero no respondía en el chat real | Permisos CLI y sesión aislada corregidos, 0.2.13 instalada | Runtime devuelve respuesta; usuario confirma y aporta captura de respuesta en ventana. Cancelación/aislamiento cubiertos por pruebas; hardware adicional pendiente |
| P1 | Cron cloud observado, resultado por proyecto no certificado | Validar proveedor/proyecto concreto con evento observado y retry durable | Proyecto actualizado con PC/navegador cerrado y evidencia de ejecución |
| P1 | CSS compatible de ~1.09 MB importado junto al CSS moderno | Medir hoja emitida y aislar compatibilidad manteniendo WebViews soportados | Una sola definición efectiva, tamaños de transferencia comparados y validación Android/WebView; no retirar fallback sin prueba |
| P2 | Hub monta panel expandido y widget Pomodoro cerrados | Diferir montaje inicial y aislar el contenido del widget hasta abrir/morph | Menos DOM/suscripciones en reposo; mismo timer, borrador, foco y animación reversible |
| P2 | Telemetría de IA no uniforme | Instrumentar fronteras existentes con tokens, latencia, herramientas y resultado sanitizados | Coste por tarea, éxito y escalado consultables sin almacenar contenido privado |
| P2 | Historial de documentación mezcla planes y certificaciones antiguas | Índice del estado actual y registro fechado, sin reemplazar evidencia anterior | Cada afirmación distingue código, test local y servicio real |
| Resuelta | Versiones del Companion divergían entre README y manifiesto | Release 0.2.13, manifiestos, guía y ejecutable instalado alineados | CI Windows y versión de archivo instalada comprobados |
| P2 | Instalación limpia falla en validación de peers por lockfile | Reproducir con la política npm del repo; reparar lock en cambio dedicado si procede | `npm ci` reproducible en CI y equipo limpio; sin resolver versiones arbitrarias |
| P3 | Recursos de voz locales y automatización general todavía sin calibrar | Prototipos optativos medidos en Windows real, reutilizando autorización | ES/EN, latencia, RAM/CPU, interrupción y licencias de modelos verificadas |
| P1 | La conversación de voz del Companion todavía no tiene activación ni respuesta hablada | Mantener dictado manual con consentimiento y no fingir escucha local; integrar detector/STT/TTS sólo con licencias y métricas reales | Cumplir corpus, falsos positivos, CPU/RAM, p95 y cancelación del plan en hardware del usuario |
| P2 | Control local limitado a seis apps conocidas | Verificar permisos y resultados en Windows; ampliar catálogo sólo si el selector inicial no cubre el uso | Enfocar/abrir y cambios de ventana confirmados en PC real; multi-ventana requiere selección |

No se alteran migraciones, credenciales, datos o planes de pago para cerrar deuda de interfaz. No reducir el material liquid glass globalmente para ocultar trabajo de componentes que ni siquiera están visibles.

La entrada de voz de las rutas de chat se encamina al borrador y sólo se procesa al enviarlo; deja de usar el ejecutor aislado. El panel independiente conserva comandos explícitos y su convergencia sigue pendiente. Se elimina el fallback genérico que convertía una frase cualquiera en una tarea; no equivale a certificar todo el catálogo legado ni sus adaptadores de Calendar.

## Estado después de la primera entrega

El coste inicial de paneles ocultos del Hub y el cableado del selector Codex se corrigieron y PR #29 se publicó en producción; ver el registro de pruebas. Se encontró y corrigió otro bloqueo al ejecutar Codex real: formato de permisos CLI y carga de documentos innecesaria para un chat textual. El runtime devuelve respuesta y el usuario la confirmó en la ventana de 0.2.13, con captura. El panel expandido se conserva después del primer uso para proteger borradores y geometría; no se afirma que todas sus suscripciones se suspendan al cerrarlo.

La automatización local de código sigue sin certificarse en el Windows 10 observado: el aislamiento legacy no admite el perfil de lectura mínima de Novo. El chat textual evita cargar documentos y desactiva sus herramientas; no se concede lectura raíz, se cambia a un aislamiento más débil ni se anuncia que esto habilita ejecución de código.

La migración de historiales ya distingue explícitamente el detalle cargado. Los placeholders no se guardan; edición, envío, acciones y retry quedan bloqueados hasta terminar la disponibilidad de cuenta/historial. Las pruebas cubren respuestas tardías, cambio de cuenta, reintento, borrado durante lectura y borrado después de un POST pendiente. Se conserva el contrato completo por defecto para clientes anteriores.

La [medición autenticada de fluidez](../performance/2026-11-01-interaction-fluency.md) confirma un coste alto de pintura en dashboard/Hoy y apertura del menú móvil. Publicadas las correcciones de grandes filtros de color de Ahora, tarjetas duplicadas, muestreo por evento del gesto y scroll/parsing del chat. La inspección DOM en producción confirma degradados sin filtro y ausencia de tarjetas anidadas. Falta medir de nuevo en hardware móvil: no declarar 60 FPS ni atribuir toda la lentitud a la navegación.

El contexto compartido ya conserva lecturas parciales y declara campos desconocidos; el chat web reenvía pregunta/historial al lector de correo. Siguen existiendo dos orquestaciones y un contexto preventivo amplio por turno. La carga inicial de historiales web cambia a recuperación seleccionada; no confundir esta mejora con un presupuesto global de tokens o una migración completa del chat compartido.

En el worktree actual, las acciones de tareas ya usan almacenamiento durable e idempotencia y los comandos de ventana sólo usan apps permitidas por el usuario. La migración está preparada, no desplegada; no publicar la ruta de escritura antes de aplicarla y verificarla. El dictado de Companion queda opt-in y puede depender de servicio externo; wake word, STT offline y TTS no están incluidos.

## Voz local: límites que quedan abiertos

La reproducción Windows dispone de cancelación por solicitud y corte al bloquear/desconectar la sesión. Falta medir su latencia real y comprobar altavoces/dispositivo de salida y comportamiento de bloqueo físico. Las voces se instalan como componentes oficiales de Windows, no se incluyen en el instalador. Permanece pendiente el trabajador de captura/STT, versiones/licencias/hashes de whisper.cpp/Silero, gramática «Novo», corpus ES/EN y piloto de falsos positivos; no habilitar escucha permanente sin superar la aceptación.
