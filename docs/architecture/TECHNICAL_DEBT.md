# Deuda técnica priorizada

Auditoría de código del 2026-11-01. La prioridad combina efecto sobre uso real, coste y riesgo; no es un benchmark de producción.

| Prioridad | Hallazgo | Cambio mínimo recomendado | Criterio de cierre |
| --- | --- | --- | --- |
| P1 | Web y Companion ejecutan dos orquestadores de chat | Migrar por contratos al servicio compartido, preservando formato SSE, leases, cancelación, adjuntos y confirmaciones | Misma pregunta Gmail/proyecto produce consultas equivalentes en ambas superficies; pruebas de permisos y cancelación |
| P1 | Lista de conversaciones obtiene hasta 200 historiales JSON completos | Metadatos al listar y detalle al seleccionar; revisar todos los clientes antes de cambiar el contrato | Listado sin mensajes; selección con carreras canceladas; persistencia no vacía historial todavía no cargado |
| P1 | `buildUserContext` aún hace fan-out amplio por turno | Resultados parciales y límites de rutinas ya implementados; falta recuperación selectiva por intención y presupuesto global | Una fuente caída no se presenta como cuenta vacía; bytes/latencia reales por turno registrados |
| P1 | Runtime Codex responde y 0.2.13 está instalada; falta comprobar GUI | Verificar selector/respuesta cuando el control de ventanas permita interacción | Respuesta real en ventana, cancelación/cambio de modo e historial aislado |
| P1 | Cron cloud observado, resultado por proyecto no certificado | Validar proveedor/proyecto concreto con evento observado y retry durable | Proyecto actualizado con PC/navegador cerrado y evidencia de ejecución |
| P1 | CSS compatible de ~1.09 MB importado junto al CSS moderno | Medir hoja emitida y aislar compatibilidad manteniendo WebViews soportados | Una sola definición efectiva, tamaños de transferencia comparados y validación Android/WebView; no retirar fallback sin prueba |
| P2 | Hub monta panel expandido y widget Pomodoro cerrados | Diferir montaje inicial y aislar el contenido del widget hasta abrir/morph | Menos DOM/suscripciones en reposo; mismo timer, borrador, foco y animación reversible |
| P2 | Telemetría de IA no uniforme | Instrumentar fronteras existentes con tokens, latencia, herramientas y resultado sanitizados | Coste por tarea, éxito y escalado consultables sin almacenar contenido privado |
| P2 | Historial de documentación mezcla planes y certificaciones antiguas | Índice del estado actual y registro fechado, sin reemplazar evidencia anterior | Cada afirmación distingue código, test local y servicio real |
| Resuelta | Versiones del Companion divergían entre README y manifiesto | Release 0.2.13, manifiestos, guía y ejecutable instalado alineados | CI Windows y versión de archivo instalada comprobados |
| P2 | Instalación limpia falla en validación de peers por lockfile | Reproducir con la política npm del repo; reparar lock en cambio dedicado si procede | `npm ci` reproducible en CI y equipo limpio; sin resolver versiones arbitrarias |
| P3 | Recursos de voz locales y automatización general todavía sin calibrar | Prototipos optativos medidos en Windows real, reutilizando autorización | ES/EN, latencia, RAM/CPU, interrupción y licencias de modelos verificadas |

No se alteran migraciones, credenciales, datos o planes de pago para cerrar deuda de interfaz. No reducir el material liquid glass globalmente para ocultar trabajo de componentes que ni siquiera están visibles.

## Estado después de la primera entrega

El coste inicial de paneles ocultos del Hub y el cableado del selector Codex se corrigieron y PR #29 se publicó en producción; ver el registro de pruebas. Se encontró y corrigió otro bloqueo al ejecutar Codex real: formato de permisos CLI y carga de documentos innecesaria para un chat textual. El runtime ya devuelve una respuesta y el instalador 0.2.13 está publicado e instalado; falta la prueba de botones. El panel expandido se conserva después del primer uso para proteger borradores y geometría; no se afirma que todas sus suscripciones se suspendan al cerrarlo.

La automatización local de código sigue sin certificarse en el Windows 10 observado: el aislamiento legacy no admite el perfil de lectura mínima de Novo. El chat textual evita cargar documentos y desactiva sus herramientas; no se concede lectura raíz, se cambia a un aislamiento más débil ni se anuncia que esto habilita ejecución de código.

La migración de historiales requiere un estado explícito de «detalle cargado». El autosave actual recorre todas las conversaciones tituladas: representarlas como `messages: []` antes de cargarlas podría reemplazar mensajes reales usando una revisión válida. Proteger guardado, envío, acciones y retry, y probar cambios rápidos de selección/cuenta y borrado durante la lectura antes de publicar el cambio.

La [medición autenticada de fluidez](../performance/2026-11-01-interaction-fluency.md) confirma un coste alto de pintura en dashboard/Hoy y apertura del menú móvil. Publicadas las correcciones de grandes filtros de color de Ahora, tarjetas duplicadas, muestreo por evento del gesto y scroll/parsing del chat. La inspección DOM en producción confirma degradados sin filtro y ausencia de tarjetas anidadas. Falta medir de nuevo en hardware móvil: no declarar 60 FPS ni atribuir toda la lentitud a la navegación.

El contexto compartido ya conserva lecturas parciales y declara campos desconocidos; el chat web reenvía pregunta/historial al lector de correo. Siguen existiendo dos orquestaciones y la carga de hasta 200 historiales al listar conversaciones. No sustituir sus mensajes por arrays vacíos sin proteger autosave y selección de cuenta, como se explicó arriba.
