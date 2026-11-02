# Fluidez de interacción — 2026-11-01

La aceptación incluye escribir, leer, desplazar, abrir/cerrar y cambiar de panel dentro de una página. Reducir el tiempo de navegación por sí solo no satisface la solicitud.

## Entorno y método

- Windows del usuario: ~3.4 GiB de RAM física. Chrome instalado, extensión de Codex y sesión autenticada existente, autorizada por el usuario. Viewport de escritorio 1366 × 551; prueba responsive 375 × 812, restaurado al terminar.
- Producción al comenzar las mediciones: `https://productivitynovo.vercel.app/`, antes de desplegar estos cambios. No confundir esa base con el worktree `cd0af5f` modificado. PR #29 publicó las correcciones después; ver la actualización al final.
- Observación temporal por CDP: intervalos de `requestAnimationFrame`, `PerformanceObserver` para tareas largas y eventos de interacción. Se desconectan los observadores y se retiran estilos de diagnóstico al terminar. No se guardan contenidos de chats/correos, credenciales ni preferencias de cuenta.
- Las ventanas de aislamiento de filtros duran 1600 ms. La comparación cambia sólo CSS temporal de los campos de color de Ahora, con el mismo documento, sesión y equipo. No ejecutamos compiladores durante estas mediciones.
- Son diagnósticos locales bajo presión de memoria, no una medición de INP de campo, FPS garantizados o un benchmark de todas las páginas. Las muestras cortas y la propia instrumentación limitan la precisión.

## Producción autenticada: interacción dentro de las páginas

| Escenario observado | Mediana de intervalo entre frames | p95 | Evidencia / límite |
| --- | ---: | ---: | --- |
| Dashboard en reposo, muestra inicial | 159.4 ms | 185.6 ms | Sin tareas largas JS en esa ventana; el coste no era sólo JavaScript |
| Abrir/cerrar notificaciones | 230.8 ms | 537.9 ms | Interacciones observadas de hasta 1200 ms y tarea larga de 729 ms; incluye primer montaje |
| Hoy: escribir, limpiar campo y desplazar | 80.4 ms | 171.1 ms | Eventos de teclado observados de 176–512 ms; texto de prueba retirado, sin generar plan |
| Chat: escribir, limpiar y leer mensajes anteriores | 16.7 ms | 30.3 ms | Ninguna tarea larga; no se envía mensaje ni se consume respuesta del modelo |
| Centro cognitivo: seleccionar Memoria | 16.0 ms | 29.2 ms | Click observado de 168 ms; sólo la UI accesible de esta cuenta, sin mapa Pro |
| Menú móvil: abrir/cerrar | 63.2 ms | 128.3 ms | Click de apertura observado de 584 ms, tarea larga de 326 ms; emulación de viewport, no teléfono físico |

La cifra de evento incluye la presentación de la respuesta visual; no es sólo el tiempo del manejador. Esta sesión muestra que las superficies tienen costes distintos. El centro cognitivo carga con navegación; su mapa avanzado muestra la restricción del plan. No se intentó eludirla ni se certificó ese mapa.

## Aislamiento del dashboard conservando glass

La inspección encontró tres campos animados de Ahora con `blur(38px) saturate(155%)`, de aproximadamente 1160–1320 px de lado en este viewport. También hay wallpaper desenfocado y tarjetas con backdrop. Pausar sólo las órbitas dejó la mediana en ~141 ms; no resolvió el cuello de botella. Quitar todos los filtros temporalmente llevó otra muestra a ~16 ms, pero se descartó como solución porque eliminaría el material pedido.

Se probó sustituir únicamente los fondos sólidos desenfocados de Ahora por degradados radiales de borde suave, conservando órbitas, geometría, paleta del estado, grano, contraste y glass de navegación/tarjetas:

| Repetición alternada | CSS anterior: mediana | Degradados suaves: mediana | Anterior p95 | Suave p95 |
| --- | ---: | ---: | ---: | ---: |
| 1 | 142.4 ms | 46.8 ms | 282.1 ms | 78.8 ms |
| 2 | 125.3 ms | 46.6 ms | 142.3 ms | 110.0 ms |
| 3 | 94.7 ms | 45.4 ms | 106.9 ms | 48.6 ms |

No alcanza todavía el presupuesto de 16.7 ms en este equipo. Sí justifica el cambio mínimo en `app/globals.css`. Promover el wallpaper a una nueva capa o redimensionar los campos no dio una mejora consistente y no se incorporó.

La revisión encontró además dos `Card` externos envolviendo secciones que ya renderizan su propio `Card`. Se eliminaron esos dos envoltorios del dashboard de escritorio. Cada sección conserva su propio material y sus controles; evita dos planos glass y padding duplicados. La prueba usa QuickActions y RecentActivity reales: detecta cuatro tarjetas antes y dos después, sin anidamiento. No se atribuye una cifra de FPS a esta eliminación.

## Gesto móvil: antes/después controlado

Fixture Chromium 375 × 812 con React, GSAP y el hook real `useDragToDismiss`, mismas dependencias antes/después. Ráfaga de 51 `pointermove`, cinco repeticiones por versión. Captura de puntero simulada para permitir eventos sintéticos; no equivale a una prueba física táctil.

| Coste de la ráfaga | Antes | Después |
| --- | ---: | ---: |
| Lecturas de geometría | 52 | 2 |
| Mutaciones de estilo observadas | 107 | 7 |
| Mediana de despacho | 10.1 ms | 1.0 ms |

Tiempos individuales antes: 14.7, 8.4, 8.7, 10.3, 10.1 ms. Después: 1.5, 1.1, 1.0, 1.0, 0.9 ms. Mide el procesamiento de la ráfaga, no todo el morph ni la pintura del material.

El hook conserva el muestreo de velocidad por evento, presenta como máximo una vez por frame, entrega la última posición al cierre y cancela el frame al desmontar. `pointercancel` restaura el panel; no debe ejecutar un cierre. Cuatro pruebas cubren estos contratos, además de las de presencia del modal.

## Chat y trabajo invisible

- Markdown terminado se memoriza por contenido, manteniendo acciones y reacciones fuera de esa caché. Las pruebas confirman que reaccionar actualiza el botón sin volver a analizar el texto y editar contenido sí lo analiza.
- El streaming sigue el final sólo mientras el lector está allí. Leer arriba conserva la posición; un mensaje nuevo del usuario vuelve a seguir la conversación. No reinicia smooth-scroll por cada fragmento ni por una reacción. Se respeta movimiento reducido.
- Hub difiere su panel expandido hasta el primer uso y luego lo conserva para proteger borradores; Pomodoro mantiene su geometría, pero monta contenido sólo abierto o durante el morph. En el mismo fixture JSDOM: 127 → 34 elementos en reposo. No extrapolar a DOM/FPS de la aplicación completa.

## Aceptación que falta tras publicar

| Superficie | Revisión necesaria |
| --- | --- |
| Dashboard / Hoy | Comparar scroll y escritura con estos cambios compilados; revisar el coste restante de wallpaper, noise y backdrop, conservando contraste y material |
| Chat | Respuesta real en streaming, adjuntos en conversación activa y lectura de historia larga; proteger revisiones antes de migrar a carga de mensajes bajo demanda |
| Modales / menú móvil | Apertura inicial y repetida, reversión, arrastre, cancelación del SO, foco y teclado; medir en Android/iOS físicos |
| Centro cognitivo | Todas las lentes autorizadas, carga/error/vacío, navegación rápida entre rutas; investigar cualquier retroceso de ruta antes de atribuirlo a una carrera |
| Accesibilidad | Texto grande, contraste, transparencia reducida y preferencia de movimiento en dispositivos reales |

Objetivo: intervalos cercanos al refresco del dispositivo, sin tareas largas atribuibles al gesto, escritura sin perder caracteres y lectura sin saltos forzados. Mantener una tabla por interacción; no declarar la aplicación fluida a partir del tiempo de carga.

## Actualización tras publicación — 2026-11-02

PR #29 está en producción. La inspección DOM confirma campos de color sin blur y sin Cards redundantes anidadas. El chat recibe una respuesta Gmail real y la recupera al abrir otra pestaña. No se sustituyen con ello las mediciones de interacción de la tabla anterior.

La nueva sonda gráfica sólo entregó dos intervalos durante una ventana de 1.8 s; la captura nativa de Windows también falla. La muestra es insuficiente y no comparable con el ensayo controlado anterior. Se descarta como benchmark, sin atribuirla a una regresión de Novo ni certificar FPS. No quedan observadores o estilos temporales instalados en la página.
