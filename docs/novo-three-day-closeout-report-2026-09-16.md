# Novo — reporte de cierre de tres días

**Corte:** 17 de septiembre de 2026
**Última actualización:** 17 de septiembre de 2026
**Alcance:** producto autenticado (app web/PWA, shell de PC/móvil, backend, conectores, Twin y efectos). El landing queda fuera de este reporte.

## Objetivo

Convertir Novo en un producto utilizable y confiable para personas no técnicas:
que el Twin pueda adquirir contexto de forma continua, que las integraciones sean
una fuente activa de señales, que las creaciones sean idempotentes, y que la app
se sienta fluida, clara y estable en escritorio y móvil.

## Trabajo realizado

### Funcionalidad y datos

- Se revisaron las rutas autenticadas y sus filtros de propiedad por usuario.
- Se añadieron límites de entrada con Zod y respuestas de error estables en los
  flujos de tareas, libros, notas, rutinas, checklist, música, escuela,
  calendario, negocios, social y Twin.
- Las creaciones sensibles conservan una clave de intención y convergen en el
  mismo recurso cuando se repite una petición por doble clic, timeout o pérdida
  de respuesta. Esto cubre libros, tareas, checklist, notas, rutinas, proyectos,
  playlists, historial musical, cursos, calificaciones, eventos y acciones del
  Novo Loop.
- La biblioteca usa identidad por proveedor/ISBN/título-autor y un lock corto
  de PostgreSQL; agregar un libro dos veces ya no genera copias paralelas.
- Las espejos de tareas y checklist se reconcilian bajo lock, incluyendo replay,
  cambios de estado, fecha y salida de “hoy”.
- Se corrigieron reintentos de amistad: el mismo sentido responde como replay,
  el sentido inverso sigue siendo una acción distinta y una auto-invitación se
  rechaza antes de tocar la base de datos.
- El Twin carga un perfil actual ligero en los refresh frecuentes; la evolución
  histórica permanece en sus rutas analíticas y no se arrastra en cada lectura.
- El heartbeat ambiental, la reconciliación de proveedores y las señales del
  dispositivo quedaron ligados a la cuenta y pausados cuando la pestaña está
  oculta.
- Focus asigna una nueva clave de intención en cada inicio de sesión (incluidos
  los ciclos automáticos), evitando que una sesión detenida haga fallar la
  siguiente como si fuera un replay conflictivo. Los perfiles nuevos bloquean
  dobles pulsaciones, recortan el nombre y normalizan duraciones inválidas.
- Las notificaciones y el sonido de Focus son capacidades opcionales: si el
  navegador bloquea permisos o autoplay, el ciclo y su persistencia continúan
  sin excepciones ni errores visibles.
- Las notificaciones del navegador también quedan protegidas frente a permisos
  revocados, constructores bloqueados y fallos del service worker; un recordatorio
  que no pueda mostrarse nunca interrumpe la sesión ni deja un error de consola.

### Integraciones y contexto del Twin

- Se revisaron Gmail, Google Calendar/Drive, Slack, Notion, Todoist y GitHub,
  junto con el orquestador de plugins y sus callbacks OAuth.
- Los callbacks y sincronizaciones validan estado, usuario y capacidad concreta;
  una identidad de Google no se presenta falsamente como acceso a Gmail, Drive
  y Calendar a la vez.
- Los tokens OAuth de acceso y refresco ya no se incluyen en la sesión que llega
  al navegador. Gmail, Calendar, Drive, biometría y YouTube resuelven el grant
  propiedad del usuario en el servidor, con scopes concretos y sin exponer
  credenciales bearer al cliente.
- Las lecturas de proveedor tienen timeout, locks de sincronización y fallbacks
  seguros. El Twin recibe señales normalizadas en vez de datos privados crudos
  en logs o respuestas.
- El motor cognitivo reutiliza la lectura de Calendar dentro de cada refresh
  para no consultar dos veces al proveedor, reduciendo latencia y presión de
  rate limit mientras conserva la persistencia de señales de umbral.
- Se retiraron los endpoints móviles antiguos que emitían JWT de 30 días sin que
  el resto de la API los reconociera. El camino soportado es la sesión web
  global mediante navegador del sistema.

### UX, efectos y rendimiento

- Se eliminó la doble transición de rutas que hacía que la app se reacomodara al
  terminar una navegación.
- Dialogs y sheets mantienen posición estable durante FLIP/Framer Motion; los
  paneles laterales tienen su propio scroll y overscroll para que los formularios
  largos no oculten sus acciones en móvil.
- Lenis, el mapa cognitivo, el Context Hub, el orb de voz, el reproductor y los
  pollers paran RAF/timers al ocultar la pestaña y limpian listeners al desmontar.
- La promoción GPU y `will-change` se reservan para estados animados; la app no
  mantiene todas las cards y superficies en capas compositoras permanentes.
- El widget musical cancela el reward timer, y los controles de like/follow ahora
  serializan un cambio por pista/artista, deshabilitan el control mientras está
  pendiente y hacen rollback si falla la persistencia.
- La preferencia de animaciones de la app controla CSS, Framer Motion y smooth
  scroll de forma coherente; el material liquid glass respeta los valores de
  configuración en vez de imponer un blur global.
- Se corrigió el último borde de esa preferencia: el efecto que publica las
  variables visuales también reacciona a `showAnimations`, por lo que apagar o
  encender animaciones se refleja inmediatamente en CSS, Lenis y Framer Motion.
- Los toggles de visibilidad de contraseña de login y registro tienen ahora
  nombre accesible, estado pulsado y tooltip, sin alterar el flujo visual.
- El onboarding ahora cancela sus reveals, transiciones y peticiones de análisis/
  plan al desmontarse; los taps rápidos no avanzan dos pasos ni generan dos veces
  el plan inicial.
- Se retiró una acción interna de IA que simulaba crear notas con un ID aleatorio
  sin persistirlas; el único camino de creación queda en `/api/notes`, con sesión
  e idempotencia.
- Se eliminó del checklist la tarea sintética `Review [curso]`, que siempre
  volvía a aparecer porque no tenía una persistencia real; los elementos
  académicos ahora provienen de asignaciones/calificaciones reales.
- Se saneó la telemetría de desarrollo y los fallbacks de IA: prompts,
  documentos, cuerpos de error y eventos privados ya no se escriben en logs;
  la cola offline tampoco persiste cabeceras de autorización, cookies o API keys.
- Los fallos del refresco ambiental, la reconciliación de Todoist y las llamadas
  de modelos quedan reducidos a códigos operativos estables; los mensajes crudos
  de proveedor no se devuelven al cliente ni se guardan en registros durables.
- Las lecturas de Google (contactos/libros) y todo el feed de YouTube Music exigen
  una identidad de sesión completa antes de ejecutar proveedores o devolver datos.
- El webhook de Google Calendar dejó de escribir títulos, identificadores de
  eventos o cuentas en logs y sus borrados/upserts verifican siempre el
  propietario antes de tocar un bloque local.
- Las acciones de IA para iniciar/finalizar entrenamientos y añadir
  calificaciones ahora son idempotentes: un reintento reproduce el registro
  propio en lugar de crear otra sesión, ejercicios hijos o calificación.
- Se completó el flujo de recuperación de contraseña: solicitud anti-enumeración
  con rate limit, token de un solo uso almacenado como hash, expiración de una
  hora, invalidación de sesiones al cambiar la contraseña y estados claros en la
  pantalla de recuperación. “Change Password” en ajustes ahora abre el mismo
  flujo en vez de ser una acción visual sin destino; el consumo del token es
  atómico para que un replay concurrente termine como enlace inválido, no como
  error 500.
- La transición de recomendaciones del Novo Loop se serializa con un lock por
  recomendación: dos aceptaciones concurrentes convergen en una sola tarea y
  las repetidas devuelven conflicto seguro, con regresión automatizada.
- Del video de referencia se aplicaron jerarquía, contraste independiente del
  fondo, espaciado consistente, iconografía coherente y acciones persistentes
  dentro de contenido desplazable.

### Limpieza y ports

- Se eliminaron artefactos legacy sin consumidores (motor de autoplay aislado,
  hook Pomodoro y CSS de Focus antiguo) y estados/timers sin salida visible.
- La shell Capacitor abre directamente `/app`, no empaqueta el landing y usa el
  backend/sesión globales de Novo. Android e iOS tienen proyectos sincronizados;
  PWA y navegador de escritorio comparten el mismo resolver, onboarding y API.
- Se dejó documentada la arquitectura requerida para OAuth del sistema, App
  Links/Universal Links, offline queue, permisos y pruebas reales de dispositivos.
- El plan de inicio ahora conserva una huella estable por posición de tarea:
  si el proveedor reformula una tarea durante un reintento, se reproduce el
  registro original en lugar de crear otro o devolver un conflicto falso.
- El importador de rutinas rechaza payloads mayores de 40.000 caracteres antes
  de enviarlos a un proveedor, evitando consumo de memoria y latencia sin límite.
- Se retiró `hooks/use-player-persistence.ts`, un hook vacío sin consumidores ni
  efecto observable, para evitar mantener una API interna muerta.
- Se saneó el logging de las rutas de música (historial, favoritos y playlists):
  los errores del proveedor o de persistencia ya no se imprimen completos.
- Las sesiones de analítica ahora reciben una intención estable del cliente:
  un doble montaje/reintento de React Strict Mode reproduce la misma
  `UserSession`, rechaza una clave perteneciente a otra cuenta y registra el
  replay sin crear filas duplicadas.
- Las ventanas de historial de analítica normalizan también el action JSON
  `getAnalyticsData`, evitando fechas inválidas o escaneos mayores al límite
  aunque el valor llegue fuera de la ruta GET.
- La ruta de analítica ya no registra excepciones crudas de insights, streaks,
  Inngest o persistencia; conserva mensajes operativos seguros y una regresión
  dedicada de higiene de logs.
- Esa misma frontera se extendió a las rutas CRUD de libros, tareas, proyectos,
  objetivos, rutinas, notas, checklist, trackers, materias, gratitudes y
  clientes, evitando que errores de Prisma o de proveedores terminen en logs
  con datos privados.
- En el cierre se aplicó la misma protección a actividad, negocios, escuela,
  plantillas, mensajes, fitness, estadísticas, artefactos, música, MCP y
  borrado de datos; la regresión de higiene cubre estas rutas para bloquear
  futuros logs de excepciones completas.
- El POST de Google Calendar exige ahora `session.user.id` antes de ejecutar
  cualquier escritura del proveedor y sus fallos quedan reducidos a códigos
  operativos seguros.
- Los modales contextuales se ajustan al viewport visual y el ancho/alto
  máximo real del panel; ya no dependen de offsets fijos que podían dejar
  contenido fuera de pantalla.
- Las lecturas de Calendar y Contacts acotan los tamaños de página antes de
  llegar a Google, y las búsquedas/recomendaciones de YouTube/YouTube
  Music/Books normalizan límites, espacios y longitud de consulta para evitar
  respuestas inestables o cargas innecesarias.
- El historial de completions de rutinas limita la ventana a un año y verifica
  que el `routineId` consultado pertenezca al usuario autenticado antes de leer
  datos.
- Se añadió y aplicó en producción una migración aditiva con índices compuestos
  para historial de rutinas/completions, días y ejercicios, entrenamientos,
  tareas legacy y entradas de trackers. Las consultas frecuentes por propietario,
  fecha y orden ya no dependen de un escaneo completo de esas tablas.
- El calendario rechaza fechas inválidas, rangos invertidos o ventanas de más de
  un año antes de consultar fuentes; también normaliza filtros duplicados y
  evita guardar títulos vacíos o descripciones desproporcionadas.
- El panel de estado cognitivo cancela solicitudes al desmontarse, ignora
  respuestas antiguas y muestra un reintento claro cuando la sesión o el
  proveedor no están disponibles, sin métricas `undefined` ni errores crudos.
- Los boundaries de error de la app ya no imprimen ni muestran mensajes
  internos de excepciones; ofrecen una recuperación estable y conservan solo
  una señal operativa mínima para diagnóstico seguro.
- La capa legacy de acciones internas de IA quedó cerrada contra filtraciones:
  los fallos de ejecución y procesadores devuelven códigos estables
  (`INTERNAL_ACTION_FAILED`/`PROCESSOR_NOT_FOUND`) en vez de mensajes de
  implementación, y la única ruta activa de categorización mantiene su
  fallback seguro por palabras clave.
- Se incorporó una microinteracción inspirada en Animate UI como opt-in en el
  botón compartido ([patrón Ripple Button de Animate UI](https://animate-ui.com/docs/components/buttons/ripple)):
  ripple localizado al punto de toque, limitado a tres ondas,
  acelerado por GPU y desactivado cuando el sistema pide reducir movimiento.
  Solo se usa en acciones de alta intención (crear/guardar/capturar), evitando
  ruido en navegación y controles frecuentes.

## Evidencia de verificación

- `npm test -- --runInBand`: **217 suites, 735 tests, 2 snapshots**, todo aprobado
  también después del último blindaje de acciones/procesadores internos de IA;
  las regresiones añadidas al cierre se revalidaron además con 9 pruebas de
  higiene enfocadas.
- `npm run lint`: 0 errores; solo permanecen dos advertencias preexistentes de
  fuentes de Next.
- `npm audit --omit=dev --audit-level=high`: 0 vulnerabilidades en el grafo que
  llega a producción; el audit completo conserva tres avisos transitorios de
  tooling de desarrollo y build, documentados para una actualización separada.
- TypeScript `--noEmit`: aprobado.
- Regresión final de higiene de logs: **9/9 pruebas** aprobadas después de
  blindar la capa interna de acciones de IA.
- `npm run build`: aprobado; 133 rutas generadas.
- Build remoto de Vercel: aprobado con las 133 rutas.
- `npx prisma migrate status`: las 36 migraciones están aplicadas, incluida
  `20260917150000_add_activity_query_indexes` en la base de producción.
- `npm run build:cap`: aprobado con las 133 rutas; la PWA y el shell nativo
  apuntan directamente a `/app` y nunca empaquetan el landing. `npx cap doctor`
  confirma Android saludable; iOS queda pendiente de Xcode/macOS, no por un
  fallo del código de la app.
- Canary productivo: `/app` devuelve el login con callback preservado, sin errores
  de consola en escritorio y viewport móvil de 390×844; endpoints protegidos sin
  sesión responden `401` sin filtrar datos. El alias productivo apunta al build
  `dpl_F9zVtLVwP4cf9XYaqYGXMg1gcb7K`.
- La pantalla pública `/auth/reset-password` carga sin errores de consola y ofrece
  tanto la solicitud anti-enumeración como el formulario de nueva contraseña.
- Prueba enfocada de música: 4/4 endpoints; prueba social: 3/3 casos de
  replay/rechazo; overlays: 13/13.
- Medición app-only y límites de rendimiento: [`app-performance-audit-2026-09-17.md`](app-performance-audit-2026-09-17.md).

## Producción

- Alias: [productivitynovo.vercel.app/app](https://productivitynovo.vercel.app/app)
- Deployment actual: `dpl_FiCHpY2D1HVQkFMt7QfK4sPtDW6V`
- Preview: `https://novo-desktop-a85mnwo7b.vercel.app`

## Lo que todavía requiere una prueba externa

Esto no es un fallo silencioso del código, sino una puerta de release que necesita
cuentas o dispositivos reales:

1. E2E autenticado de `/app`, `/chat`, edición de tareas/checklist y cada callback
   de conector con las cuentas reales del usuario.
2. Lemon Squeezy Live: checkout, webhook firmado, variantes y propagación del plan.
3. Android/iOS físicos o simuladores: OAuth del navegador del sistema, deep links,
   offline/resume, micrófono, safe areas y revocación de sesión.
4. Frescura, scopes y rate limits de Google, Slack, Todoist, Notion y GitHub bajo
   datos reales.

## Conclusión

La app queda en un estado de código y despliegue listo para el siguiente gate de
uso real: las rutas críticas, reintentos, sincronización del Twin, efectos y
rendimiento tienen regresiones automatizadas y el alias productivo apunta al
último build. No se declara certificación total de conectores o ports nativos
hasta ejecutar esas cuatro pruebas externas.

## Seguimiento — 18 Sep 2026

- Se retiraron los logs por solicitud de OpenRouter y por selección de música;
  no aportaban diagnóstico accionable y podían dejar metadatos de uso en los
  logs de producción.
- Lint y TypeScript permanecen limpios después de esta limpieza.
- El nuevo deployment terminó en estado `READY` y el alias fue reasignado después
  de la espera de build: `dpl_F9zVtLVwP4cf9XYaqYGXMg1gcb7K`.
- Canary final: `/app` redirige a `/auth/signin?callbackUrl=%2Fapp` sin errores de
  consola; medición de escritorio: TTFB 53 ms, DOM ready 6.9 s, carga total 7.3 s.
- El deployment posterior que añade el fallback de coordenadas del ripple
  (`dpl_FiCHpY2D1HVQkFMt7QfK4sPtDW6V`) terminó en estado `READY` y fue promovido
  al alias público.
- Canary final: `/app` redirige a `/auth/signin?callbackUrl=%2Fapp` sin errores de
  consola; medición de escritorio: TTFB 63 ms, DOM ready 4.0 s, carga total 4.2 s.
