# Registro de implementación

## 2026-11-01 — Auditoría y primera entrega incremental

Solicitud: reducir pesadez y evolucionar el Cognitive OS conservando el producto. Base: worktree `companion-accessibility`, `cd0af5f`. Se preservan 14 archivos de cambios locales de Codex/accesibilidad de la sesión anterior y el checkout principal con sus modificaciones propias.

### Descubrimiento previo a código

- Auditados frontend, servidor, memoria/acciones, Companion/Coucou y documentación operativa anterior. Ver [estado](../architecture/CURRENT_STATE.md), [matriz](../architecture/CAPABILITY_MATRIX.md) y [deuda](../architecture/TECHNICAL_DEBT.md).
- Encontrado trabajo activo en paneles ocultos del Hub y el widget Pomodoro.
- Encontrada desconexión entre el adaptador Codex pendiente y `buildPrompt`, que es el chat real del Companion.
- Encontradas dos orquestaciones de chat web/Companion y lecturas de historiales completos al listar. Su migración se documenta como trabajo posterior con pruebas de datos/permisos.
- La instalación limpia inicial falló: falta un peer `@react-spectrum/provider` en la resolución del lock. Se prueba la política `--legacy-peer-deps` sin editar manifiestos y con scripts de instalación desactivados.

### Alcance previsto de esta entrega

Hub: diferir el panel expandido hasta usarlo y conservarlo después para no perder borradores; mantener geometría/ref del Pomodoro y montar su contenido sólo abierto o durante el morph. No cambiar curvas ni materiales.

Companion: reutilizar el adaptador local Codex, exponerlo en el chat principal y mantener separado el historial de cuenta. La elección del backend debe fijarse también en el límite nativo para evitar envíos al proveedor equivocado durante cambios de preferencias.

### Implementado y validado localmente

- Hub/Pomodoro: montaje inicial bajo demanda y contenido del widget limitado a abierto/morph. La prueba de regresión falla con el código anterior y pasa después; usa el FocusProvider real y confirma que el timer externo llega de 1500 a 1496 segundos. Se conservan los ciclos repetidos, teclado, borrador fallido/retry y geometría del morph.
- Sonda temporal de la misma prueba JSDOM: 127 → 34 elementos DOM en reposo. Es una reducción del árbol de ese escenario de componente, no una medición de FPS, bytes del bundle o latencia de la aplicación autenticada. La sonda se retiró del código.
- Desplazamiento: Lenis sólo se crea en modo de movimiento completo. Reducido/off libera instancia, frame pendiente y listeners, conservando desplazamiento nativo. No se alteraron las curvas ni los materiales glass.
- Codex: el `buildPrompt` real permite elegir la fuente en Ajustes del asistente. El modo Codex usa comandos nativos exclusivos, estado/historial temporal independiente, cancelación del proceso y rechazo de respuestas tardías. El modo cuenta Novo conserva su controlador. No envía automáticamente Twin, archivos o historial Novo a Codex.
- Accesibilidad pendiente de la sesión anterior: ahora se pudo ejecutar la prueba de los controles reales. Los shims `scrollIntoView`/`getAnimations` son exclusivos de JSDOM; no sustituyen código del navegador.
- Suite web dirigida: 7 suites / 25 pruebas pasan. Incluye Hub, foco, salida de modales, accesibilidad, scroll, política de movimiento y navegación. ESLint de los archivos web modificados y `git diff --check` pasan.
- Companion: 34 pruebas Node dirigidas y TypeScript del frontend pasan. Incluyen selector del chat activo, aislamiento de cuenta/historial, dictado, cambio de modo, respuestas tardías y traducciones.
- Dependencias web restauradas con `npm ci --ignore-scripts --legacy-peer-deps`; Prisma Client generado desde el esquema existente. Ningún manifiesto/lockfile cambió. Leídas las guías locales de Next 16.3.5 de client components/lazy loading.

### Límites de la evidencia

La comprobación TypeScript global web se interrumpió sin resultado al saturar el equipo (~3.4 GiB de RAM total). No se presenta como aprobada. La comprobación Rust nativa de biblioteca y tests pasó con un solo compilador y símbolos de depuración desactivados, después de construir el recurso `coucou-hook.exe` requerido. Compila los tests; no equivale a ejecutarlos ni a instalar un Companion nuevo.

No hay build web de producción, instalación del binario nuevo ni despliegue en esta entrega. No se consumió una respuesta real del plan Codex, no se envió correo, cambió plan de pago, ejecutaron migraciones ni certificó el scheduler. Las siete piezas de documentación pedidas están enlazadas desde la auditoría y la hoja de ruta; la evaluación del ecosistema conserva fuentes y límites por candidato.

### Seguimiento: fluidez dentro de cada página

- Se usa la pestaña Chrome existente mediante la extensión, por indicación del usuario, después del fallo DPAPI al importar cookies y el cierre del navegador de pruebas. La sesión autenticada funciona; no se solicita volver a entrar.
- Medidas reales de dashboard, notificaciones, Hoy, chat, centro cognitivo y menú móvil: [método, cifras y límites](../performance/2026-11-01-interaction-fluency.md). Se retiran todos los estilos/observadores temporales y se restaura el tamaño de ventana. La comparación CSS es una intervención temporal sobre producción, no un despliegue del worktree.
- Ahora: degradados radiales sustituyen tres grandes blur animados, conservando grano, paletas, movimiento y materiales glass. Tres pares de muestras: medianas de 94.7–142.4 ms → 45.4–46.8 ms. Mejora local, todavía por encima del presupuesto de refresco.
- Dashboard: retirados dos Card redundantes; las secciones reales conservan su plano glass. Regresión reproducida (4 tarjetas) y corregida (2, sin anidamiento).
- Gesto compartido de modales: geometría/overlay leídos al iniciar, estilo agrupado por frame, última posición entregada antes del morph y restauración ante `pointercancel`. Fixture Chromium: 52 → 2 lecturas, 107 → 7 mutaciones por ráfaga; mediana de despacho 10.1 → 1.0 ms. No representa FPS de toda la app.
- Chat: caché de Markdown por contenido; lectura anterior no es arrastrada al final por streaming/reacciones; envío propio vuelve a seguir la conversación. Pruebas de regresión para cada comportamiento.
- Codex: `account/read` con `refreshToken:false` confirma el tipo ChatGPT sin generación, frente a un `doctor` global que falla por conectividad ajena a las credenciales. Metadatos locales: tipo `chatgpt`, ~1.7 s; no se registra cuenta, email o token. La ejecución de chat fija `forced_login_method=chatgpt`; el trabajo de proyectos conserva su contrato previo.
- Vite del Companion compila (86 módulos); TypeScript y 34 pruebas Node dirigidas pasan. `cargo check --locked -p novo-companion --lib --tests` pasa. La prueba real de respuesta y el empaquetado/instalación siguen pendientes.
- Cierre web: 13 suites / 53 pruebas pasan juntas; ESLint de todos los archivos web modificados y `git diff --check` pasan. Se regeneran `tailwind-source.css` y `tailwind-legacy.css` con el generador existente (2702 candidatos), también para mantener la compatibilidad WebView. El CSS compilado contiene los degradados nuevos; no se sustituye esta comprobación por un build web completo.

## Continuación — contexto fiable y seguimiento de correo

Plan y rulings: [context-reliability-plan](2026-11-01-context-reliability-plan.md).

- `buildUserContext` conserva resultados sanos ante fallos independientes; registra campos indisponibles y no los presenta como cero actividad. El fallo al comprobar exclusiones permanece cerrado, antes de consultar fuentes privadas. No se cambian datos de usuario ni se añade una llamada de IA.
- Calendar informa errores Google a los consumidores de evidencia sin quitar eventos nativos válidos ni cambiar la respuesta existente de sus consumidores UI. Gmail indisponible se trata como recuperación parcial, tanto si el adaptador rechaza como si devuelve su estado operativo de fallo.
- El chat web ahora entrega pregunta validada, historial y cancelación al mismo lector Gmail que usa el servicio compartido. El seguimiento «¿Hay algo del MESCyT?» se reconoce sólo con contexto reciente de correo; la búsqueda determinista conserva el nombre, eliminando «hay algo». No certifica que exista un correo de esa entidad ni se ejecutó una búsqueda real en la cuenta para estas pruebas.
- Prefetch de rutinas acotado y proyección explícita; listas identificadas como muestras, contadores completos. Serialización compacta: 154231 frente a 307674 bytes para los mismos datos de un fixture sintético (10 rutinas × 7 días × 12 ejercicios). No equivale a reducción de factura/tokens ni a un límite total del prompt.
- Revisión independiente: tres P2 corregidos con regresiones observadas rojas y verdes. Incluye el caso del smooth-scroll intermedio que podía desactivar el seguimiento del chat.
- Suite completa inicial: 1303 pruebas pasan; una falla por configuraciones nativas generadas que no están versionadas. Se regeneraron con los comandos existentes de Capacitor para Android/iOS. Repetición final tras corregir regresiones: 326 suites / 1309 pruebas y dos snapshots pasan, en 137 segundos.
- ESLint de los archivos nuevos del frente de contexto/Gmail/scroll pasa. La comprobación TypeScript limitada a este módulo y sus imports se agota con heap de 1 GB; la puerta de tipos del build continúa habilitada. No se afirma compilación web aprobada.
- Antes de publicar se detecta `main` remoto más reciente: `91817f3` (#28, contraste del indicador liquid glass). Se integra en la rama de trabajo sin tocar el checkout principal, se regenera compatibilidad CSS y pasan las siete suites de navegación/sidebar (34 pruebas). No se sustituye ese ajuste nuevo por la base antigua.
- PR #29 y compilaciones remotas iniciadas. CI TypeScript identifica una inferencia demasiado amplia del ref en el fixture del gesto; se explicita HTMLDivElement, sin casts ni cambios al gesto de producción. La suite local de interfaz no sustituye esta comprobación estática.
- La segunda comprobación web remota pasa TypeScript, lint completo y regresiones; Vercel compila la preview `novo-desktop-f3ete49t4.vercel.app`. Se verifica la landing sin sesión, sin trasladar cookies de producción a otra URL.
- Windows ejecuta 257 pruebas nativas de la aplicación correctamente. El harness independiente falló por no incluir `codex_plan`, ahora usado por el detector de sesión. Se incorpora el módulo real y sus pruebas, con plataforma de prueba sin candidatos CLI reales: 15 pruebas del harness pasan localmente. El empaquetado del instalador se vuelve a comprobar en CI.

## Cierre de publicación — 2026-11-01

- PR #29 integrada en `main`, commit `c37432f98f4ee15913bea97a052cc33d8078e954`. CI `41382683535` aprueba tipos, lint y regresiones; Windows `41382683446` aprueba frontend, pruebas nativas/harness y empaquetado.
- Vercel publica `novo-desktop-doa6u2wqz.vercel.app`, con alias canónico `productivitynovo.vercel.app` y estado READY. La sesión Chrome existente verifica dashboard y una conversación nueva, preservando los borradores anteriores. El DOM confirma tres campos de color sin filtro blur y ninguna tarjeta redundante anidada.
- Prueba real de correo: «¿MESCyT me respondió por correo?». Stream HTTP 200; respuesta de renovación, sin mensajes inventados. La consulta de estado Gmail devuelve `connected:true`, `hasScope:true`, `state:reauthorization_required`: Google rechaza el grant guardado. No se envía correo ni se considera certificada su lectura completa.
- Instalador compilado desde `91603c8` instalado localmente: salida 0, binario distinto, proceso activo. Se conserva una copia del ejecutable anterior, sin copiar credenciales; cuenta, preferencias y carpetas autorizadas permanecen en su ubicación. La prueba visual de Codex se detiene porque Windows no entrega captura/geometría de la ventana. Se pide dejar pantalla encendida/desbloqueada; no se intenta eludir el bloqueo.
- Refresco cloud: el workflow existente `project-assistant-refresh.yml` llama al endpoint protegido cada 15 minutos. Run `41378587708` responde éxito con 63 cuentas procesadas y cero fallos del lote. No certifica 63 proyectos ni la salud individual de cada fuente.
- La descarga pública aún era 0.2.12 y el README mencionaba 0.2.10. Se alinean manifiestos npm/Tauri/Cargo y guía en 0.2.13, sin cambiar dependencias ni sobrescribir releases anteriores. Self-check de versiones y `cargo metadata --locked --no-deps` pasan; el instalador 0.2.13 requiere su build de Windows antes de publicarse.

## 2026-11-02 — Verificación real y bloqueo CLI corregido antes del release

- Gmail: Google mostró el aviso de aplicación no verificada. Se dejó la pantalla al usuario, que completó la renovación. Después, Novo muestra la conexión sana y el chat responde a la consulta sobre MESCyT con correos concretos, fechas y contenido, citando Gmail. No se enviaron correos ni se aprobaron permisos nuevos automáticamente.
- Una sonda temporal importa los módulos de producción `codex`, `codex_plan` y `process`; no duplica el runtime ni copia credenciales. Detecta ChatGPT correctamente, pero reproduce un fallo real anterior a la generación: CLI 0.165 conserva las comillas en claves dotted de overrides de filesystem. El test de regresión falla (nueve overrides frente a una tabla).
- Corregido en el constructor compartido: una tabla TOML de filesystem, con las rutas como valores/entradas de esa tabla. Se reúnen también dependencias de sólo lectura, Node/npm y la sonda de aislamiento; no se sobrescriben las denegaciones ni se amplían permisos.
- El segundo bloqueo es del aislamiento legacy en Windows 10: exige lectura raíz al cargar AGENTS.md. El chat del plan sólo necesita texto, por lo que usa `project_doc_max_bytes=0` y desactiva shell, ejecución unificada, apply-patch, lectura de imágenes, generación de imágenes y hooks. Se mantienen lectura mínima, ausencia de red de comandos, proceso efímero, límites y cancelación. El modo de trabajo de proyectos conserva sus comprobaciones y no recibe estos cambios de herramientas.
- El detector, `chat_answer`, proceso limitado y decoder reales devuelven exactamente `NOVO_OK` en 8.5 segundos con la sesión ChatGPT local. No equivale todavía a una respuesta pulsada en la ventana instalada ni a certificar ejecución de código en este Windows 10.
- Regresiones rojas/verdes para formato CLI y chat sin documentos/herramientas; se comprueban también lectura de dependencias, escritura sólo del workspace y denegación de secretos en la misma tabla. Suite del harness: 18 aprobadas, cero fallos. Se requiere un build nuevo del instalador con esta revisión antes de publicar 0.2.13.
- Aislamiento adicional: tanto la consulta de cuenta como el proceso de respuesta eliminan secretos, configuración Git heredada y variables `CODEX_*` del agente padre, salvo `CODEX_HOME`, que mantiene el login protegido. Se deshabilitan también herramientas de navegador, control del equipo y su transporte de Code Mode en el chat. El test detectó la herencia del pipe antes de corregirla. Suite final: 19 pruebas aprobadas; repetición del detector y respuesta de producción: `NOVO_OK` en 11.7 segundos, sin transportar las herramientas de la sesión padre.
- Revisión independiente final aprobada. CI Windows `41388958083`, fuente `25ee243e5b969e094f85a2fd0bf7b9b323afb306`: frontend, 30 pruebas de hooks, 261 de aplicación y 19 del harness aprobadas; empaquetado EXE/MSI completado. Alias de cada instalador cotejado por SHA-256.
- [Release `companion-v0.2.13`](https://github.com/jeremyencarnacion2000-stack/Novo/releases/tag/companion-v0.2.13) publicada como latest con cuatro assets, sin sobrescribir 0.2.12. Instalación local devuelve 0; `ProductVersion` del archivo instalado es 0.2.13, el proceso responde y conserva el aviso de terceros. Se respalda sólo el ejecutable anterior; no se copian credenciales. La entrada de inicio automático existente apunta a esta misma ruta.
- La conversación de Gmail se recupera al abrir otra pestaña de Novo. La prueba visual del Companion sigue pendiente: el control nativo no puede resolver los elementos ni capturar ventanas, incluso después de que el usuario dejó Windows desbloqueado. Se ofrece comprobar manualmente el selector y una respuesta, sin presentar el runtime como prueba completa de GUI.
- Cierre posterior: PR #30 integrada como `f5d5a42`; se comprobó que su árbol Companion coincide con el código del instalador publicado. El usuario completó la prueba manual y confirmó «Ya respondió». La captura aportada muestra el modo ChatGPT Codex, el mensaje «hola» y una respuesta real en la ventana. Queda verificada esa interacción; no se amplía la certificación a ejecución de código, todos los controles nativos o FPS.

## 2026-11-02 — Continuación: historiales seleccionados y persistencia segura

- Releído el documento maestro adjunto actualizado. Se continúa la etapa de base en el worktree existente, desde `3495bee`, rama `codex/novo-history-on-demand`. El checkout principal y sus cambios propios se conservan.
- [Plan de ejecución](../superpowers/plans/2026-11-02-conversation-history-loading.md): listado opt-in sin mensajes en Prisma y lectura del detalle seleccionado, con el contrato anterior disponible. Se reutilizan endpoints, revisiones y normalizador; no se añaden dependencias ni migraciones.
- Proveedor web: estado explícito de historial sin leer, cancelación de lecturas por selección/cuenta, disponibilidad compartida para envío/acciones/edición, fuentes/adjuntos/feedback preservados y compositor persistente con carga/reintento localizado.
- Regresiones observadas rojas y verdes: metadatos sin descargar nunca se guardan vacíos; cambio de cuenta ignora callbacks/rollback antiguos; un borrado espera a la creación pendiente. Se verifica por mutación controlada que quitar el guard de una acción tardía hace fallar su test; restaurarlo pasa. Todas las acciones de prueba son fixtures.
- Medición sintética: 200 historiales de 20 mensajes más adjuntos, 4,500,381 bytes → 55,850 para listado más primer detalle, 98.76% menos. [Método y límites](../performance/2026-11-02-conversation-history.md). No se afirma ahorro facturado, token global o FPS.
- Suite completa antes de ajustes de revisión: 328 suites / 1330 pruebas / dos snapshots aprobados. Revisión independiente: dos importantes y uno de compatibilidad aceptados, reproducidos y corregidos en una pasada: selección repetida del mismo ID, edición/retry antes de hidratar la cuenta y fecha `createdAt` de mensajes antiguos. Después: siete suites / 45 pruebas dirigidas y lint aprobados.
- CI detectó una firma pública incorrecta: `deleteConversation` era asíncrona pero su interfaz decía `void`; se corrige a `Promise<void>` para poder esperar el borrado real en pruebas y consumidores. El fallo de tipos se registra separado de los tests de ejecución; el build sigue requiriendo aprobar tipos antes de publicar.
- Cierre de historiales: PR #31 integrada como `b882c82`; CI `41397618757` aprueba tipos, lint, 328 suites / 1336 pruebas / dos snapshots. Producción `novo-desktop-59ujysgcw.vercel.app` READY y alias canónico comprobado. QA autenticada de sólo lectura: 75 resúmenes sin mensajes, un detalle inicial con fuentes, un GET al cambiar de chat y ninguna escritura de historial. No se enviaron mensajes o correos para esta prueba.

## 2026-11-02 — Utilidades del ecosistema: dictado revisable en el chat

- Se vuelven a consultar los quince repositorios oficiales mediante `/browse`: identidad/redirección, archivo, licencia declarada y fecha UTC de push. Se leen los README actuales de Leon y Pipecat; la matriz distingue patrones adaptados de dependencias instaladas.
- Se adapta la separación de entrada, interpretación y ejecución usando componentes existentes. El micrófono de `/chat` y `/ai` añade la transcripción al borrador actual y conserva adjuntos; no llama al ejecutor separado ni envía automáticamente. Al pulsar Enviar reutiliza el contexto y las confirmaciones del chat.
- Cuenta/selección/cierre invalidan transcripciones tardías y detienen el micrófono. Se retira del clasificador compartido el fallback que convertía frases genéricas en tareas. Los comandos explícitos del panel independiente se conservan.
- Regresiones observadas rojas antes del cambio: dictado no llegaba al compositor, una transcripción de otra cuenta podía ejecutarse y cuatro frases comunes se clasificaban como tareas. Las pruebas usan captura/transcripción simuladas; no certifican la calidad del micrófono o STT físico. Sin modelos, frameworks, permisos o dependencias nuevos.
- Validación dirigida final: cuatro suites / 21 pruebas aprobadas y lint de archivos modificados sin avisos. Revisión independiente aprobada; repitió las 20 pruebas iniciales. Se reprodujo además un fallo silencioso del modo sin panel y se añadió aviso de dictado con error sanitizado. El head inicial pasó tipos, lint, 329 suites / 1348 pruebas y build; el ajuste de recuperación requiere una comprobación nueva antes de publicar.
