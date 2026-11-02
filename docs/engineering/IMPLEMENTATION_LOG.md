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
