# Historial de chat: recuperación bajo demanda

## Cambio y alcance

El proveedor web se monta en toda la aplicación. Antes solicitaba hasta 200 conversaciones con su JSON de mensajes completo. Ahora pide `GET /api/ai-conversations?view=summary` y reutiliza el GET de detalle para la conversación seleccionada. Se conservan el límite de 200, el orden, los filtros de propietario y el contrato completo por defecto para clientes anteriores.

La primera conversación aún requiere una lectura de detalle y un recorrido adicional de red después del listado. Los historiales abiertos se conservan en memoria durante la sesión; no hay expulsión de borradores ni virtualización nueva. La mejora reduce transferencia inicial, no garantiza una cifra de FPS ni menor latencia en toda conexión.

## Medida reproducible con datos sintéticos

Fixture: 200 conversaciones, 20 mensajes por conversación y un adjunto de 8192 bytes por conversación. Mismos datos y serialización JSON antes/después; después se cuenta tanto el listado como el primer detalle.

| Transferencia inicial | Bytes |
| --- | ---: |
| Listado completo anterior | 4,500,381 |
| Listado de metadatos | 33,381 |
| Un historial completo seleccionado | 22,469 |
| Total nuevo | 55,850 |

Reducción en este fixture: **98.76%**. No representa consumo facturado de Neon, compresión HTTP, una cuenta real ni ahorro medido de inferencia. Cargar mensajes no añade llamadas a modelos.

## Protección de datos y recuperación

- Los metadatos se marcan `messagesLoaded: false` en el cliente. Su array vacío no se considera un historial vacío confirmado y nunca participa en autosave.
- La marca vive en el objeto capturado: un timeout antiguo tampoco puede guardar su placeholder cuando otro objeto ya terminó de cargar.
- La hidratación registra la revisión y el snapshot sin suprimir cambios pendientes en otras conversaciones.
- Cambiar de cuenta/selección, iniciar un chat o borrar el seleccionado invalida respuestas anteriores. Seleccionar de nuevo el mismo ID conserva la lectura pendiente y su estado de error.
- Envío, edición, retry y acciones comparten la condición de disponibilidad de cuenta/historial. Una preferencia de cuenta todavía pendiente no puede dejar una edición truncada sin envío.
- Un borrado confirmado espera al guardado ya iniciado; evita que un POST tardío vuelva a crear la conversación.
- Los IDs de mensajes antiguos son estables. Se conservan adjuntos, tarjetas, fuentes, feedback y fechas válidas de cada mensaje.
- La carga y el reintento tienen feedback accesible y localizado. El compositor permanece montado y conserva el borrador.

## Evidencia y límites

Suite inicial completa antes de los ajustes de revisión: 328 suites, 1330 pruebas y dos snapshots aprobados. La revisión independiente encontró dos casos importantes y uno de compatibilidad; se reprodujeron antes de corregirlos. Tras el ajuste: 46 pruebas dirigidas de API, proveedor, UI, normalización y turnos Companion aprobadas; lint de los archivos modificados aprobado. Incluyen volver a la misma cuenta mientras termina un guardado anterior: esa respuesta no puede quitar el seguimiento de un guardado nuevo ni adelantar su borrado. La verificación remota mantiene activas las puertas de tipos, pruebas y build.

La aceptación en producción consiste en observar únicamente metadatos más el detalle seleccionado, cambiar de conversación, conservar fuentes/adjuntos y comprobar ausencia de escrituras por mera lectura. No requiere enviar mensajes ni modificar historiales reales. La medición de fluidez física y la convergencia de los dos orquestadores siguen siendo trabajos distintos.

Publicación verificada: PR #31, merge `b882c82`, Vercel `novo-desktop-59ujysgcw.vercel.app` READY con alias `productivitynovo.vercel.app`. CI `41397618757`: tipos, lint, 328 suites / 1336 pruebas / dos snapshots aprobados. En la sesión autorizada de Chrome se observaron 75 resúmenes sin `messages` (13,840 bytes) más un detalle de cuatro mensajes (2,864 bytes), con fuentes Gmail conservadas. Cambiar a otro chat generó sólo un GET de detalle. No hubo POST/PUT/DELETE de historiales durante la lectura y el cambio. Son tamaños JSON de esa sesión, no una comparación facturada antes/después.
