# Novo — revisión de producto y producción · 2026-09-12

## Resultado ejecutivo

La superficie pública de Novo está operativa y conserva una identidad editorial propia; no es un dashboard genérico. La landing responde en producción, mantiene el recorrido completo, tiene navegación accesible, cambio de idioma/tema y no mostró errores de consola en la prueba pública.

La aplicación todavía no debe declararse “production-ready” sin cerrar las verificaciones externas de infraestructura: compra y webhook Live de Lemon Squeezy y una prueba E2E autenticada aislada. El build local completo termina correctamente; el cuello de botella observado es una fase de TypeScript lenta en Windows, no un error de compilación.

## Referencia de diseño revisada

Se revisó la referencia `This UI/UX Redesign Will Teach You More Than 100 Tutorials` mediante la skill `watch`. YouTube entregó subtítulos nativos, aunque el stream de vídeo devolvió HTTP 403 en este entorno; por eso las conclusiones visuales se basan en la transcripción y en la inspección del producto desplegado. Los principios aplicables a Novo son: contraste independiente para iconos sobre imágenes variables, un contenedor suave que preserve legibilidad, jerarquía escaneable, espacio propio para cada superficie y acciones persistentes sólo cuando reducen fricción. El ajuste de motion de esta revisión aplica ese criterio al sistema completo sin convertir la app en un dashboard genérico.

## Evidencia reproducible

| Control | Resultado |
| --- | --- |
| `npm test -- --runInBand` | 187 suites, 641 tests, 2 snapshots: PASS |
| `npm run lint -- --quiet` | PASS |
| `tsc --noEmit --incremental` | PASS |
| Landing producción `/landing` | HTTP 200 · alias `https://productivitynovo.vercel.app` sirve el deployment `dpl_Eh7SGZ1DSrDqnVJP8jBw2tdgyVFb`; HTML coincide con el preview `novo-desktop-2rui0jyi5.vercel.app` |
| Entrada pública `/` sin sesión | Redirige a `/landing` sin montar el shell autenticado |
| Shell/app producción `/chat` | HTTP 200 · superficie server-backed; sin sesión, la web conserva su guard público |
| Resolver app-only `/app` | Sin sesión → login; Twin sin onboarding → `/onboarding`; Twin completo → `/` (shell autenticado) |
| Handoff nativo `/auth/mobile` | Redirige a `/app` o a `/auth/signin?callbackUrl=/app`; el shell Capacitor no expone el landing |
| Consola de landing producción | Sin errores |
| Accesibilidad | Main, navegación, headings, CTA y controles expuestos |
| Rendimiento landing público | Canary posterior al deploy: DNS 0 ms (conexión reutilizada) · TTFB 50 ms · DOM ready 612 ms · carga 841 ms; loader completó y `landing-hero-copy` quedó listo sin errores de consola. Spot-check más reciente: TTFB 62 ms · FCP 1.204 s · DOM interactive 1.171 s · carga 2.295 s, también sin errores de consola |
| Rendimiento landing local optimizado | TTFB 438 ms · DOM ready 3.41 s · carga 3.81 s · 59 requests · ~3.95 MB transferidos (antes ~15.6 MB) |
| Responsive | Revisado en desktop y mobile; sin solapes visibles en las capturas de QA |
| `npm run build` / `npm run build:cap` | PASS · Webpack, TypeScript, 134 páginas prerenderizables y trazas de producción; el port usa el build server-backed |
| `npx cap sync` / `npx cap doctor` | Sync Android+iOS PASS; Doctor: Android healthy, iOS certification blocked only by missing Xcode on this Windows host |
| `npx prisma migrate status` | PASS · las 35 migraciones están aplicadas en la base Neon configurada |
| Vercel Production | READY · `https://productivitynovo.vercel.app` apunta al deployment `dpl_Eh7SGZ1DSrDqnVJP8jBw2tdgyVFb`; build remoto completado |
| `npm audit --omit=dev` | PASS · 0 vulnerabilidades de runtime (Next 16.3.5, Hono 4.13.5, qs 6.16.0, Nodemailer 9.1.1) |
| `depcheck` | Sin dependencias faltantes; las únicas declaraciones no detectadas estáticamente son Capacitor, estilos CSS y dependencias transitivas explícitas de Google/OIDC |

## Cambios aplicados en esta revisión

- Se eliminó `PomodoroProvider` del árbol global: era un contexto legado no consumido por ningún componente activo y duplicaba estado/efectos del sistema de foco.
- Se eliminó el import huérfano de `FocusMode` en el sidebar.
- Las completions de rutinas ahora aceptan `Idempotency-Key`, guardan la intención en `MutationRequest`, reponen el mismo registro ante reintentos y evitan repetir analítica/señales del Twin.
- Checklist, gratitudes, pasos, workout, quick notes y bloques de tiempo siguen la misma frontera durable; los reintentos devuelven el registro propietario original y no agregan filas duplicadas.
- El cierre de una rutina deshabilita el doble clic, conserva la clave de intención en reintentos y valida la respuesta del endpoint.
- El mapa cognitivo pausa su loop WebGL fuera del viewport y lo reanuda al volver a ser visible, conservando resize y liberación de geometrías/materiales.
- El endpoint de grafo mantiene límites de profundidad, cantidad de nodos y ventana temporal; el callback de selección está memoizado para evitar reconstrucciones innecesarias del renderer.
- `syncCompletion` aplica filtros de ownership para rutinas, proyectos, checklists y tareas; una ID ajena ya no puede mutar datos de otro usuario.
- Las sesiones de foco terminadas convergen por idempotencia y no emiten una segunda señal al Twin.
- La frontera común `lib/server-idempotency.ts` también cubre clientes, subjects, clientes/ideas/deals de negocio, cursos/calificaciones y playlists/historial de música; el mismo fingerprint rechaza una clave reutilizada con otro payload.
- Las ejecuciones de IA que crean tareas/eventos aceptan una clave padre; el plan diario deriva claves estables por tarea y trigger/día, por lo que reintentar onboarding o una reconexión no duplica el plan ni vuelve a enviar el evento a Google.
- La creación de conversaciones usa el UUID estable del cliente y converge en el registro existente; los runs de actividad hacen lo mismo al reconectar.
- Deals verifica que el `clientId` pertenezca al usuario antes de incluirlo; una relación ajena ya no puede entrar por ese endpoint.
- Los mensajes directos ahora validan que el destinatario exista y convergen por `Idempotency-Key`, evitando filas duplicadas cuando el cliente reintenta.
- Las rutas heredadas de música, YouTube, onboarding, conversaciones IA, contactos, libros, calendario y cursos dejaron de exponer mensajes crudos del proveedor/base de datos; el cliente recibe un error seguro y utilizable.
- Las rutas de fitness, timeblocks y webhook de calendario ya no devuelven `error.message`, stack ni diagnósticos del proveedor al cliente.
- Las cards y botones conservan el material óptico de Novo con opacidad y borde dependientes del tema, sin añadir blur global que vuelva ilegible el contenido.
- La transición global de controles dejó de usar `transition: all`; ahora sólo interpola color, superficie, borde, sombra, opacidad, transformación y filtro, evitando reflow durante modales y navegación. La regla tiene cobertura en `app/globals.test.ts`.
- Las capas editoriales pesadas del landing se sirven como WebP y la web usa el optimizador de Next; sólo un export estático explícito (`NEXT_PUBLIC_CAPACITOR_STATIC_EXPORT=true`) desactiva ese optimizador.
- El build portable `scripts/next-build.mjs` centraliza `--webpack` y el heap de 4096 MB para que Vercel, Windows y Capacitor compartan el mismo comportamiento.
- Vercel usa ahora `npm ci` y `npm run vercel-build` de forma coherente con el único lockfile del repositorio (`package-lock.json`), evitando que la instalación y el comando de build utilicen gestores distintos.
- La cola offline de IndexedDB conserva la clave de cada creación desde el primer intento hasta la reconciliación online; una caída de red ya no vuelve a crear tareas/checklist al sincronizar.
- Las importaciones de backup generan una clave determinista por elemento y archivo para checklist, rutinas, proyectos, tareas y trackers; reintentar un backup parcial ya no vuelve a insertar los elementos que llegaron al servidor.
- `node-fetch` y sus tipos quedaron limitados a `devDependencies` porque sólo son necesarios para el shim de `jest.setup.ts`; no entran como dependencia runtime de la aplicación y Next/Node usa `fetch` nativo en producción.
- La creación de templates de usuario valida el payload con Zod y registra una `MutationRequest`; una repetición devuelve el template propietario original en lugar de crear otra fila.
- El registro de entradas de trackers se convirtió en un upsert por tracker/día dentro de una transacción con advisory lock de Postgres; el cliente conserva la clave por intento y el toggle rápido valida respuestas HTTP antes de notificar éxito.
- La importación por lotes de rutinas valida límites y payload con Zod y registra una intención atómica; los reintentos recuperan el resultado sin duplicar rutinas, trackers ni checklists, y el cliente conserva la clave mientras reintenta la misma importación.
- El loader editorial conserva las 16 escenas y su timeline GSAP, pero ahora usa un set WebP optimizado de aproximadamente 0.82 MB para reducir el coste de la primera carga.
- El middleware corta rutas de producto sin sesión antes de montar el shell; conserva 401 JSON en APIs y deja públicos landing, autenticación, documentación y assets instalables.
- Todoist y Notion protegen su ventana find-then-create con un advisory lock transaccional compartido entre la ruta manual y el plugin de contexto; esto evita duplicados cuando un heartbeat coincide con una sincronización manual.
- El manifiesto eliminó cinco dependencias directas sin uso detectadas por un escaneo estático; las dependencias requeridas por Capacitor, Google/OIDC y la cadena de Tailwind se conservaron.
- Se retiraron imports muertos de la página de IA, analítica y sidebar del chatbot, y la transición del sidebar dejó de interpolar propiedades geométricas con `transition-all`.
- El orbe canvas del chatbot pausa su `requestAnimationFrame` fuera del viewport o cuando la pestaña queda oculta, y su gradiente usa un alpha válido; el cleanup incluye observer, listener y frame pendientes.
- Se retiraron `components/focus-mode.tsx` y `lib/pomodoro-context.tsx`: no tenían referencias activas y duplicaban el flujo de foco/Pomodoro que ahora vive en `FocusTimerWidget`/`FocusContext`.
- Se apartaron del árbol público 14 renders editoriales PNG/WebP sin referencias, conservando las versiones WebP activas; son aproximadamente 19 MB menos de artefactos heredados que podían terminar en el deploy.
- El endpoint legado `/api/ai/command` ya no conserva una segunda ejecución inalcanzable después de la respuesta de confirmación; también se estabilizaron los logs de Contacts y Calendar para no registrar diagnósticos crudos de proveedores.
- Las ventanas solicitadas por `/api/analytics` se normalizan entre 1 y 365 días; una cuenta nueva recibe métricas finitas en lugar de `NaN`/`null`, y la regresión queda cubierta por pruebas del handler.
- El reset del Cognitive Twin ahora se confirma en servidor dentro de una transacción: elimina aprendizaje derivado (evolution logs, snapshots y acciones del agente), conserva señales de comportamiento para reaprender y no muestra éxito si la persistencia falla.
- El análisis de onboarding valida y limita el transcript antes de llamar a proveedores; la vista previa anónima usa una inferencia local determinista y no envía datos a Groq/OpenRouter. Los fallos autenticados tienen fallback local y no exponen diagnósticos.
- La categorización de notas valida tamaño, devuelve un código estable (`NOTE_CATEGORIZATION_FAILED`) y mantiene los logs libres de respuestas crudas del proveedor.
- El chat flotante limita el historial a 200 entradas/1 MB y serializa su find-or-create con el lock transaccional por usuario; los reintentos concurrentes no abren sesiones paralelas.
- Se retiró la acción heredada `lib/ai-commands.ts`, que no tenía consumidores activos, y se quitó el bloque de “Vision Board / Coming Soon” sin interacción de la página de perfil.
- El parser de documentos de IA ahora exige sesión, valida el multipart y rechaza archivos mayores de 10 MB antes de bufferizar o invocar parsers PDF/DOCX; esto evita un endpoint anónimo de alto consumo.
- Los renders heredados sin referencias se conservan localmente, pero `.vercelignore` los excluye del paquete de Vercel para que no inflen la carga pública.
- El stream principal de IA valida el cuerpo completo con Zod, limita historial/adjuntos y rechaza JSON o payloads sobredimensionados antes de crear actividad; los adjuntos que no son imágenes ya no se persisten como base64 innecesario y el compresor de imágenes tiene fallback ante errores de carga.
- Las rutas heredadas `analyze-image` y `grok/chat` ahora tienen límites de cuerpo, validación Zod y errores 400/413 estables; Google Vision sólo recibe una fuente de imagen HTTP(S) válida y el chat Grok normaliza metadatos de historial antes de invocar el proveedor.

### Seguimiento de la revisión 2026-09-14

- El CTA de voz del chat fullscreen (`/ai` y `/chat`) ahora utiliza el mismo `VoiceCommandHub` que el panel autenticado: el shell monta un puente headless que escucha `toggle-gemini-live`, inicia/detiene `MediaRecorder`, transcribe y ejecuta el comando con el contexto cognitivo disponible. Se eliminó la dependencia práctica del listener huérfano de `GeminiLiveOrb`; el bridge no añade otro control visual.
- El store de reproducción verifica que `BroadcastChannel` exista antes de crearlo, evitando fallos de importación en navegadores embebidos y entornos de test.
- Las capturas de producto bajo el pliegue del landing dejaron de usar `priority`/preload: se cargan de forma diferida al llegar a la sección, evitando una descarga inútil en móvil y el warning de preload no utilizado.
- Se retiraron `google-auth-library` y `jose` como dependencias directas sin imports en el código; Google APIs, MCP y OIDC siguen resolviendo sus versiones transitivas y `npm audit --omit=dev` permanece en cero vulnerabilidades.
- Nuevo deployment READY: `dpl_EDYgMzWtCSoJ3xM5WJDrx18J6XM5` (`https://novo-desktop-m829m18gz.vercel.app`), aliasado explícitamente a `https://productivitynovo.vercel.app`. Canary desktop/mobile y auth sin overflow horizontal ni errores de consola bloqueantes; `/app` sin sesión sigue redirigiendo a login.

- Las tarjetas primarias ahora aplican explícitamente el contrato Focus (`background`, `backdrop-filter`, `-webkit-backdrop-filter`, borde y sombra), evitando que utilidades de fondo transparentes oculten el blur configurado en Chromium/WebKit. El cambio conserva las variantes secondary/tertiary y queda cubierto por `app/globals.test.ts`.
- El endpoint `POST /api/cognitive/loop/plan` rechaza JSON truncado y cuerpos de más de 32 KB antes de ejecutar el planner; la frontera tiene regresiones específicas.
- Producción validada después del deploy: landing desktop/mobile y login cargan sin errores de consola; `/app` sin sesión redirige al login.
- El deploy anterior `dpl_CbSM5oLXZ1SdNCBLgJvFqJWxQj4x` quedó sustituido por `dpl_EDYgMzWtCSoJ3xM5WJDrx18J6XM5`, que conserva el canary visual y deja el alias de producción en `https://productivitynovo.vercel.app`. El landing se verificó en 1280×720 y 390×844; auth se verificó en desktop sin overflow ni errores de consola.
- Peak Focus ya no se queda en una recomendación vacía cuando no hay tareas de alta prioridad: solicita un plan diario calibrado y lo publica en la cola del foco, con fallback informativo si el proveedor no está disponible.
- Novo Loop comparte un `runId` por intención entre actividad, check-in y planner. El planner reusa la ActionPlan registrada en una repetición completada, evitando duplicados aunque el navegador reintente la solicitud.
- La reconciliación de Google Calendar protege la ventana de find/update-or-create con un lock por usuario; la creación directa hacia Google usa un id determinista cuando hay `Idempotency-Key`, evitando duplicados en reintentos offline.
- El loop `requestAnimationFrame` del parallax del landing se detiene fuera del viewport y sólo vuelve a programarse al entrar en escena, reduciendo trabajo constante sin cambiar el movimiento visible.

### Seguimiento más reciente · 2026-09-14

- La pantalla `/auth/signin` ya no monta `ClientLayoutRouter`/`CognitiveProvider` ni widgets globales. Antes de la corrección, una visita anónima disparaba dos búsquedas de YouTube y mostraba 401 en consola; producción ahora carga la superficie de acceso sin esos requests, sin errores de consola y sin overflow.
- El aislamiento se aplica tanto en el layout servidor como durante navegación cliente para `/auth/*`, con regresión en `app/__tests__/client-layout-router.test.tsx`.
- Deployment anterior: `dpl_8gGEFeswUdndFjxGxR4b3TDQPiGS` (`https://novo-desktop-gdfmciy2n.vercel.app`), sustituido por el deployment READY más reciente documentado abajo.
- Onboarding/welcome anónimo conserva una entrada clara al login, pero ya no inicia búsquedas de YouTube ni autoplay cognitivo mientras se resuelve la sesión; canary limpio sin errores de consola.
- `POST /api/cognitive/insight` ahora acepta `Idempotency-Key`, registra la intención en `MutationRequest` y actualiza el snapshot cognitivo en la misma transacción; los reintentos devuelven el insight original y no generan filas duplicadas.
- Nuevo deployment READY: `dpl_DSJXNkvmxiUz5MMu7emhohRkDHQB` (`https://novo-desktop-plyg538z2.vercel.app`), aliasado explícitamente a `https://productivitynovo.vercel.app`. Build remoto 134/134, suite completa 187/641/2 y canary limpio en landing desktop/mobile, login, guard de `/app` y API de insights sin sesión.
- El loader del landing mantiene las 16 escenas GSAP deterministas y ahora carga todas las imágenes de la secuencia de forma eager; el set optimizado pesa ~0,82 MB y evita franjas negras si una escena lazy llega tarde.
- Nuevo deployment READY: `dpl_Fyv4yVv4XYjGR8UTxofED5F6jkaG` (`https://novo-desktop-oxpogfhpk.vercel.app`), aliasado explícitamente a `https://productivitynovo.vercel.app`. Build remoto 134/134; canary visual del landing en desktop/móvil sin errores de consola.
- Verificación posterior: `npm run build:cap` completó el build server-backed y TypeScript/static generation (`134/134`); `npx cap doctor` reporta Android healthy y mantiene sólo el gate esperado de iOS/Xcode en Windows. El deployment vigente es `dpl_AdhmJ8bWDtvxNe5SdcpEDz86ySkd` (`https://novo-desktop-mwb6258bi.vercel.app`), aliasado a producción; build remoto y smoke público completados.
- La consulta de contexto de Gmail quedó alineada entre el stream principal, `/api/ai/generate` y el runner interno: sólo se activa para preguntas explícitas de correo y conserva la reducción de datos a asunto/remitente.
- Drive ahora selecciona la cuenta incremental que realmente tiene `drive.file`; los respaldos enviados desde la UI llevan una clave de idempotencia y los reintentos actualizan el mismo archivo determinista en vez de crear copias.
- El mapa 3D ya no redimensiona el canvas en cada frame en pantallas Retina: compara las dimensiones físicas del backing buffer con el `devicePixelRatio`, reduciendo reallocaciones GPU y parpadeos durante resize/scroll.
- La persistencia ambiental del Twin usa un upsert atómico por usuario y una transacción de huella; dos señales concurrentes idénticas convergen en una sola observación y un solo evento de evolución.

## Riesgos y pendientes bloqueantes

1. **Pagos Live (bloqueo confirmado):** la comprobación de solo lectura contra la API de Lemon Squeezy encontró que las dos variantes configuradas en Vercel pertenecen al store `432339`, están publicadas pero en `test_mode=true` (productos `1228618` y `1228626`), y no existe un webhook con la URL exacta `https://productivitynovo.vercel.app/api/webhooks/lemonsqueezy`. Los cuatro IDs compartidos anteriormente (`1921229`, `1228834`, `1921230`, `1228835`) responden 404 con la credencial actualmente configurada. El checkout falla cerrado con 503 hasta que se proporcionen IDs de variantes/productos Live accesibles por esa cuenta y se cree el webhook firmado; después aún hay que ejecutar una compra controlada y probar activación, renovación, cancelación y recuperación.
2. **Deploy:** Vercel Production está READY en `dpl_Eh7SGZ1DSrDqnVJP8jBw2tdgyVFb` (preview `novo-desktop-2rui0jyi5.vercel.app`) y el smoke público de `/landing` responde correctamente. Las 35 migraciones de la base Neon configurada están aplicadas; antes de cambiar de entorno hay que repetir `prisma migrate deploy` contra la base definitiva.
3. **E2E autenticado:** hace falta un entorno aislado con credenciales de prueba para recorrer login, onboarding, conexión de proveedores, creación, edición, completar y rollback.
4. **Port móvil/desktop:** Capacitor abre únicamente `https://productivitynovo.vercel.app/app` (configurable con `CAPACITOR_SERVER_URL`) y no monta el landing. `/app` resuelve sesión y estado de onboarding: sin sesión envía al login web, un usuario nuevo continúa a onboarding y un Twin ya configurado entra al shell autenticado `/` (dashboard completo). La app usa el backend web y la redirección web para autenticación global. Ya existen los scaffolds `android/` e `ios/` sincronizados con el bundle de fallback app-only; aún faltan build en Android SDK/macOS, matriz de permisos/refresh offline y pruebas OAuth en dispositivo para certificar.
5. **Idempotencia global:** libros, tareas, proyectos, rutinas, goals, notas, trackers, entradas de trackers, templates, calendario, focus, completions, mensajes, quick notes, workout, activity history, checklist, gratitudes, pasos, clientes, subjects, negocio, cursos/calificaciones, playlists/historial, runs de actividad, `timeblocks/create` y respaldos de Drive están cubiertos en sus flujos principales. Los bloques de tiempo reservan el recurso local antes del proveedor y reintentan el mismo evento de Google mediante un ID determinista cuando llega un replay; Drive actualiza el archivo determinista asociado a la clave de intención. Los endpoints de analytics/eventos append-only y la emisión de tokens secretos requieren políticas específicas, no una respuesta replay genérica.
6. **Errores API heredados:** las rutas principales revisadas ya no devuelven diagnósticos crudos. Conviene mantener un test de higiene para cualquier endpoint nuevo y revisar los flujos de acciones externas antes de habilitarlos en producción.
7. **Dependencias de desarrollo:** `npm audit` completo aún reporta avisos transitorios en `tar`, `js-yaml` y `@babel/core`; no entran en el bundle/runtime de Vercel, pero deben resolverse al actualizar la cadena de tooling.
8. **Integraciones:** una conexión “activa” no equivale a lectura disponible. Cada proveedor debe mostrar último sync, permisos concedidos, frescura, error accionable y opción de volver a sincronizar sin duplicar entidades.

## Criterio de salida recomendado

Marcar la versión como lista sólo después de: (a) Preview desplegada con build terminado, (b) compra/webhook Live verificados, (c) E2E autenticado aislado verde, (d) smoke de cada integración conectada, (e) prueba de reintento en foco/completion y acciones externas, y (f) revisión responsive de las cinco anchuras móviles y desktop.
