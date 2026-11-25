# Aceptación física de voz — candidata 0.2.17 `3ad0d09`

Prueba física del 6 de noviembre de 2026 y cierre de verificaciones autónomas del 12 de noviembre. PR #41. **La aceptación de dictado no pasa.** La candidata se instaló con autorización y se probó con micrófono real; ninguna de las dos frases controladas llegó al borrador. No se activó escucha permanente, cambió el reconocimiento seleccionado, fusionó el PR ni publicó en producción. [Métricas sanitizadas](2026-11-06-physical-voice-acceptance-metrics.json).

## Instalación y reversión

El usuario autorizó expresamente instalar esta candidata y confirmó estar junto al PC para hablar/escuchar. El NSIS cotejado con CI terminó con código 0. El ejecutable instalado coincide **exactamente** con el payload extraído: versión 0.2.17, SHA-256 `44285c92106e22bd3a61189124f2923e2d1f6fd06d53f8091592eb7df0be7295`, fuente `3ad0d0999f364802e730d2c1c8bc29249de90701`.

Se volvieron a comprobar los 16 recursos de voz fijados. Las preferencias conservaron su hash antes del primer lanzamiento; después se comprobó que los cuatro ajustes de voz seguían iguales: **local, español, nube apagada, lectura automática apagada**. La configuración Twin y las conexiones locales siguen activadas. No se normalizó ni amplificó la señal de la app.

Antes de instalar se copió y cotejó una nueva instantánea de 21 archivos de la instalación `c64098a`, además de las preferencias y el NSIS anterior. Está en `companion/windows/.tmp/candidates/0.2.17-3ad0d09/rollback-c64098a/`, con manifiesto SHA-256 e instrucciones; el instalador anterior permanece en `0.2.17-c64098a/`, SHA-256 `a3979f5244a94cad70dd434314b6657e495c6caea4c538d21edb2d970e8cb958`. Esto verifica integridad y una vía concreta de reversión; **no se ejecutó una desinstalación/restauración real**. Los instaladores siguen sin firma digital.

## Captura real y resultado de la app

Windows enumera un único WaveIn: micrófono Realtek. La app captura PCM16, mono, 16 kHz. Se observaron seis solicitudes nativas rechazadas; sólo dos tienen frase hablada completa confirmada por el usuario. Las otras cuatro no se incluyen en precisión con referencia. Se copió temporalmente el WAV desde la solicitud privada mediante el observador existente, sin abrir otro micrófono.

1. Español: «Novo, abre Codex y continuemos con ClickHome». El usuario confirmó haber dicho la frase completa y después escuchó su reproducción **completa, a velocidad normal y baja**. No se entregó borrador ni se envió la orden.
2. Inglés: «Novo, open Codex and continue with ClickHome». El usuario confirmó frase completa y aviso de error. Se conservó español en la app, como se había acordado; este intento **no certifica un reconocedor de inglés seleccionado**. Su WAV se reutilizó con inglés forzado sólo en diagnóstico. La reproducción de este segundo WAV no está confirmada por el usuario.

| Medición del intento instalado | Español controlado | Inglés controlado, app en español |
| --- | ---: | ---: |
| Duración PCM | 5 800 ms | 9 000 ms |
| RMS global / pico | −40,38 dBFS / 2 185 | −31,93 dBFS / 9 229 |
| Clipping | 0 | 0 |
| Validar recursos | 1 286 ms | 635 ms |
| Preparar micrófono | 96 ms | 52 ms |
| Captura / limpieza | 5 932 / 17 ms | 9 021 / 27 ms |
| Silencio de endpoint estimado | 1 200 ms | 1 200 ms |
| Proceso Whisper, registro nativo | 4 339 ms | 11 464 ms |
| Carga del modelo | 133,24 ms | 129,99 ms |
| Silero VAD | 52,63 ms | 142,87 ms |
| Encoder | 2 875,32 ms | 3 598,42 ms |
| Batch decode / sampling | 795,85 / 218,94 ms | 5 880,47 / 1 501,38 ms |
| Solicitud nativa hasta error terminal | 11 707 ms | 21 236 ms |
| Pico working set del hijo | 154,84 MiB | 157,36 MiB |
| CPU del hijo, última muestra | ≥8 109 ms | ≥20 266 ms |
| CPU media equivalente del equipo, cuatro hilos | ≥47,0 % | ≥44,3 % |

CPU es un límite inferior desde la última muestra cada 25 ms, dividido por la vida observada del proceso y cuatro procesadores lógicos. Working set es el pico del hijo; **no mide la memoria incremental de toda la app/captura ni consumo eléctrico**. Las etapas tienen fronteras distintas y no se suman a partir de medianas.

Precisión de entrega con referencia confirmada: **0/2 borradores aceptados**. El filtro no expone una transcripción nativa rechazada, por lo que no se presenta WER nativo como si hubiera texto entregado. El WER de los replays está separado en los datos.

En las seis solicitudes fallidas, tiempo hasta error: **p50 12 140,5 ms; p95 descriptivo 20 044 ms**, con interpolación lineal. Cuatro referencias habladas no están confirmadas. Son tiempos de fallo con N pequeño; **p50/p95 de transcripción correcta quedan sin medir**. No constituyen el corpus ni p95 de aceptación. La primera solicitud no llegó a lanzar Whisper; su causa concreta no quedó en el registro numérico. Otra no produjo trabajo del encoder tras VAD. No se atribuyen todos los errores a precisión del modelo.

## Comparaciones del mismo audio real

Se completaron 29 procesos Whisper de replay sobre estas mismas dos señales y una copia amplificada. Son **dos muestras humanas independientes**, no 29. Hubo además intentos bloqueados, un timeout y una interrupción por memoria: se conservan como tales, excluidos de precisión/latencia de resultado completo. La carga, caché de disco, temperatura y otras aplicaciones no estuvieron controladas; no se certifican mejoras causales ni disco frío.

- Tiny sobre el español original: Auto llegó a detectar italiano. Español forzado y quitar VAD siguieron devolviendo texto incorrecto y de baja confianza. Eliminar Silero por sí solo no resolvió esta muestra.
- La copia española amplificada +21,02 dB preservó 92 800 muestras y quedó limitada a pico 24 575, sin clipping. Tiny continuó rechazando todas las variantes. La señal baja es un hallazgo real, pero **amplificar no bastó para recuperar el contenido**. No se cambió volumen de Windows ni la señal de producción.
- Tiny Q8_0 con español forzado: 2 086 ms actual / 1 274 ms con contexto acotado que cubre todo el PCM; ambos textos incorrectos, 8 errores por 7 palabras, rechazados. Mejorar el tiempo no justifica adoptar el ajuste.
- Hilos/beam sobre el español original, Tiny: dos hilos/beam 5, 5 298 ms; un hilo, 5 486 ms; cuatro hilos, 4 020 ms; cuatro hilos/beam 1, 3 527 ms. Contexto acotado y cuatro hilos/beam 1: 1 363 ms. Ninguna variante fue correcta ni pasó el filtro. Padding Silero 150 ms/silencio 300 ms y quitar VAD tampoco recuperaron la frase. Apagar flash fue más lento; GPU-auto siguió cargando CPU, sin probar aceleración real.
- Tiny sobre inglés: Auto y en forzado identificaron inglés pero devolvieron la misma frase incorrecta, confianza ~0,179; proceso 7 209/3 779 ms. Sin VAD y greedy también fallaron. El idioma incorrecto de la app explica parte del trabajo de decodificación del intento inglés, pero inglés forzado **no recuperó la frase**.
- Small Q5_1 sobre español original: Auto agotó 60 s; no tiene resultado válido. Español forzado/VAD terminó a 43 997 ms con texto incorrecto (8 errores/7 palabras, confianza 0,241); sin VAD se detuvo por memoria. No se considera completada esa comparación sin VAD.
- Small sobre inglés con idioma en: 32 256 ms actual / 9 450 ms acotado; ambas variantes tuvieron 6 errores/7 palabras y fueron rechazadas. Small sobre español amplificado: 28 981 / 7 975 ms, también incorrecto y rechazado. La gran ventaja inglesa del ensayo **sintético** anterior no se reproduce como reconocimiento fiable en estas muestras humanas. No se puede atribuir la diferencia exclusivamente al idioma con N=1 por idioma, duraciones y niveles diferentes.
- Un ensayo exploratorio Small con nombres proporcionados por la prueba (`Novo, Codex, ClickHome`), padding/contexto y cuatro hilos/beam 1 devolvió 4 errores/7 palabras a 9 657 ms, confianza 0,422; rechazado. La pista conoce los nombres esperados y no es una validación ciega. La variante inglesa no arrancó por falta del margen diagnóstico. No se habilitaron pistas ni modelo nuevos en la app.

También se probó la alternativa **ya instalada** de reconocimiento Windows en-US, sólo desde el WAV inglés: 4 841 ms incluyendo arranque de PowerShell, 1 281 ms dentro de la prueba, 148,72 MiB de pico, 7 errores/7 palabras y confianza 0,147. No abrió el micrófono ni ejecutó acciones. No aporta precisión suficiente. Windows sólo expone un reconocedor en-US; Helena es-ES es una voz de salida. No se instaló un paquete de reconocimiento español, otro runtime ni un modelo pesado por defecto.

## Recursos, errores y recuperación

La RAM disponible varió desde ~71 MiB hasta ~1,8 GiB. El usuario cerró las aplicaciones que pudo. Se mantuvieron el mínimo de inicio de la app de 912 MiB y el suelo de ejecución de 512 MiB. Los replays Small se programaron con margen adicional; los guardas/timeout detuvieron ensayos y no se rellenaron sus métricas como si fueran resultados válidos. C: mantiene margen de almacenamiento; el bloqueo intermitente aquí es RAM, no una nueva instalación incompleta.

Después de errores pudieron iniciarse nuevas capturas con nuevas identidades de solicitud. Esto acredita recuperación de intentos, no una tarea completada. Los rechazos no ejecutaron órdenes desde el audio. La cancelación manual física, su latencia y un resultado tardío tras cancelar siguen pendientes.

## Circuito de escritorio y lector

Computer Use pudo leer controles, pero los dos intentos refrescados de pulsar la ventana fallaron por cambios de bounds y geometría no disponible. Se dejó el micrófono y Enviar bajo control del usuario. No se reemplazó la prueba por llamadas directas al ejecutor.

El usuario escribió «abre Codex y continuemos con ClickHome», pulsó Enviar y confirmó que Codex abrió. Indicó que Novo pidió contexto o mostró un error. No hay respuesta exacta ni evidencia de recuperación del proyecto por el Twin. La apertura por texto queda confirmada por observación del usuario. Una sonda anterior recuperó una identidad autorizada y 12 archivos relacionados. En esa prueba, el modelo de la cuenta devolvió `allowsTwinMode:false`. No se extrapola ese resultado al turno actual. [Sondas anteriores](2026-11-04-desktop-assistance-evidence.md).

En el seguimiento del 12 de noviembre se repitió la suite de Companion y pasaron **438/438 pruebas**. Cubren envío manual del borrador, exclusiones, continuación con contexto de prueba, cancelación, recuperación y descarte de resultados de otro turno. La enumeración de ventanas agotó el tiempo de espera en tres intentos, incluido uno tras reiniciar el controlador. No se volvió a abrir el micrófono ni se obtuvo un nuevo turno en la app instalada.

La prueba local del motor SAPI usó la misma combinación de síntesis asíncrona, purga y texto plano del lector, con salida PCM en memoria. Generó 193 742 bytes con Microsoft Helena (es-ES) en 149,35 ms y 200 604 bytes con Microsoft David (en-US) en 141,29 ms. Una síntesis larga estaba activa al ordenar la purga y SAPI confirmó que terminó en 2,39 ms desde esa orden. Estos tiempos corresponden al motor de Windows con salida en memoria. La prueba no pasó por el botón del Companion ni por los altavoces. Sigue pendiente comprobar el corte audible, la latencia física de cancelación del dictado y el resultado real tras un cambio de turno.

El usuario confirmó que oyó completa la muestra española de micrófono reproducida en el PC. Las tres copias WAV temporales del diagnóstico se eliminaron. Se verificó que el directorio de solicitudes de voz de Novo no contiene archivos WAV.

## Veredicto

**La candidata queda instalada y la aceptación física queda abierta.** Codex abrió por texto y los intentos de voz se recuperaron después del error. Ambos dictados controlados fueron rechazados antes de Enviar. El flujo integrado sigue bloqueado en la transcripción. Quedan sin verificar la recuperación real de ClickHome por el Twin, la lectura audible del turno actual, el corte y la cancelación física, y p50/p95 de transcripciones correctas con un corpus suficiente.

Las variantes probadas no recuperaron precisión en las muestras humanas. Se conservaron el reconocimiento actual, el borrador con envío manual y la escucha permanente desactivada. El PR permanece en borrador.
