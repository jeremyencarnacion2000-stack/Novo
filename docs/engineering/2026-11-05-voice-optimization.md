# Voz local: rendimiento medido y candidata pendiente — 5 de noviembre de 2026

PR #41, base `5a98630`. **No se supera todavía la aceptación de voz.** El usuario pidió avanzar sólo con pruebas automáticas: no hubo nuevas grabaciones humanas, reproducción en altavoces ni acciones de Windows desde audio en esta sesión. La instalación sigue en 0.2.17 `c64098a`; la candidata `2b91b0d` está preparada, sin instalar. No hubo merge, release ni despliegue en producción.

## Qué cambió

Se instrumentó el camino existente, sin crear otro asistente ni alterar intenciones, Twin, permisos o envío manual. El registro local guarda identificador de solicitud, estado y duraciones numéricas: comprobación de recursos, preparación del micrófono, captura, limpieza, duración PCM, silencio estimado al finalizar, proceso Whisper, VAD, carga, mel/encode/decode, validación y entrega al borrador. `null` significa no medido. El runner normal sigue descartando stderr; únicamente voz solicita diagnóstico acotado, reducido en memoria a duraciones conocidas. No se registra audio, transcripción, rutas ni stderr del motor en estas métricas de aplicación.

El tiempo de silencio proviene del detector energético de captura: no es una alineación humana del fin de habla ni Silero en streaming. La entrega nativa→interfaz usa relojes de pared y es aproximada; solicitud→borrador usa reloj monotónico. Las métricas SAPI `start_ack`/`stop_ack` miden respuesta de la API, **no comienzo audible ni desaparición física del sonido**. Esta instrumentación aún necesita ejecutarse desde la nueva candidata instalada para medir captura/interfaz reales.

La candidata incluye además `2d85284`: guardar ajustes ajenos a la voz no interrumpe la lectura manual cuando la lectura automática ya estaba apagada. No se cambió voz de Windows, modelo, umbral, hilos ni configuración de reconocimiento predeterminados. Una hipótesis parcial nunca se entrega al ejecutor; la transcripción final sigue en borrador hasta pulsar Enviar.

## Equipo y método

Intel Core m3-8100Y, 2 núcleos/4 procesadores lógicos, 3,39 GiB visibles; Intel UHD Graphics 615, controlador 31.0.101.2141. El paquete CPU actual usa AVX2/FMA; OpenVINO figura desactivado. Windows tiene un cargador Vulkan, pero el paquete fijado no contiene backend Vulkan. No se probó aceleración GPU ni se concluye que sea imposible en este hardware.

Motor whisper.cpp b5454 (`d1be6fde11ac6e0407606b4e42fe72d34add8037`) y Silero 6.2.0. Recursos comprobados por tamaño/SHA-256. Tiny Q8_0 diagnóstico: SHA-256 `c2085835d3f50733e2ff6e4b41ae8a2b8d8110461e18821b09a15c40c42d1cca`; no forma parte del instalador. Los hashes de Tiny Q5_1/Silero permanecen en `companion/windows/voice-resources.lock.json`.

Se ejecutaron **140 procesos válidos**, incluidos 96 de la matriz, 20 de parámetros, 2 de reutilización residente, 6 de prefijos PCM reales, 14 con BLAS y 2 de comprobación final de integridad. Cada proceso terminó con código 0; eso no significa que reconociera correctamente. Los [datos sanitizados](2026-11-05-voice-optimization-metrics.json) contienen resultados individuales, parámetros, hashes de informes y corpus, CPU y RAM. No incluyen grabaciones privadas.

El corpus tiene 12 controles distintos: ocho frases sintetizadas con Helena es-ES/David en-US, dos versiones con ruido blanco a SNR objetivo 10 dB y dos negativos (3 s de silencio/ruido). Son diez señales con habla y dos sin habla; las repeticiones no son muestras independientes. **No representan español dominicano, ruido doméstico real ni cuarenta participantes/muestras humanas.** Las voces de Windows sólo escribieron WAV; no reprodujeron audio durante estas pruebas.

Cada variante de la matriz se repitió dos veces sobre el mismo PCM, con idioma fijo, dos hilos y beam 5. Se mide proceso→resultado, excluyendo captura, endpoint, entrega, modelo de conversación y acción Windows. Working set se muestrea cada 25 ms; CPU del hijo se obtiene de Windows; porcentaje = tiempo CPU / pared / 4. Los ensayos son secuenciales, sin aleatorización ni control térmico/carga. El hash previo calienta la caché de archivos: **no se afirma una medición con disco frío**. Se mantiene mínimo de inicio 912 MiB y suelo de ejecución 512 MiB libres; no se bajaron los guardas para forzar resultados.

## Comparación sobre el mismo corpus sintético

Cada fila resume 20 ejecuciones con habla y cuatro negativas. Mediana estadística de pared; pico máximo de working set del hijo. WER literal normaliza mayúsculas, puntuación y acentos, pero conserva diferencias como `9`/`nine`. Coincidencia+filtro exige texto exacto y confianza aceptada; no es precisión de intenciones ni de acciones.

| Configuración experimental | Mediana proceso | Mediana CPU | CPU media, mediana de runs | Pico RAM | WER literal | Coincidencia + filtro |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Tiny Q5_1, contexto actual | 3 938 ms | 7 523 ms | 48,07 % | 155,87 MiB | 28/210 (13,33 %) | 10/20 |
| Mismo Tiny, contexto acotado al PCM completo | 1 501 ms | 2 781 ms | 45,27 % | 136,16 MiB | 30/210 (14,29 %) | 8/20 |
| Tiny Q8_0, contexto actual | 3 140,5 ms | 5 906 ms | 45,79 % | 166,93 MiB | 28/210 (13,33 %) | 8/20 |
| Mismo Q8_0, contexto acotado | 1 286 ms | 2 281 ms | 43,51 % | 146,59 MiB | 22/210 (10,48 %) | 10/20 |

Los cuatro grupos rechazaron sus cuatro negativos. Son dos señales repetidas; **no acreditan tasa de falsas activaciones por hora**. Tampoco hay medición fiable de p95 poblacional, batería, temperatura o vatios. El menor mínimo de memoria libre de la matriz fue 803,73 MiB durante una ejecución, por encima del suelo de seguridad.

Desglose mediano del mismo corpus (cada etapa por separado; sus medianas no suman necesariamente la mediana total):

| Etapa | Q5_1 actual | Q5_1 acotado | Q8_0 actual | Q8_0 acotado |
| --- | ---: | ---: | ---: | ---: |
| Carga del modelo | 123,75 ms | 118,90 ms | 138,24 ms | 147,28 ms |
| Silero VAD | 56,66 ms | 40,11 ms | 43,69 ms | 48,30 ms |
| Encoder | 2 683,54 ms | 350,75 ms | 2 027,76 ms | 238,98 ms |
| Batch decode | 644,35 ms | 462,58 ms | 483,56 ms | 297,22 ms |

**Se conserva la configuración de producción.** El contexto corto reduce coste del encoder, pero no preserva fiabilidad. `Abre Codex` sigue fallando en español; Q8 acotado devuelve `abreco dex.` y se rechaza. En la frase española larga, pasa de rechazar texto erróneo a aceptar `clicon` en lugar de ClickHome. Con ruido español acepta `realizar mi tarea` en vez de `revisar mis tareas`, que antes rechazaba. El promedio de WER no justifica aceptar estas regresiones. No se relajó el filtro ni se usó vocabulario para fabricar nombres.

En algunas órdenes breves sintetizadas sí se logra menos de tres segundos. Esto es un resultado experimental de inferencia, **no cumplimiento del recorrido físico ni mejora instalada**. Los 12 370 ms anteriores eran Small sobre una grabación humana distinta; no se compara esa cifra con Tiny sintético como si fuera un antes/después emparejado. En aquel ensayo unos 10 347 ms correspondían al encoder y 610 ms a carga. La nueva matriz confirma que cargar el modelo no es el principal cuello de botella.

## Otras optimizaciones evaluadas

- **Hilos/beam, misma orden ES sintetizada:** dos hilos/beam 5 tardan 3 128/3 743 ms; un hilo 6 122/6 341 ms; cuatro hilos 3 089/3 131 ms pero usan ~9,3 s de CPU frente a ~5,5–7,0 s. Beam 1/cuatro hilos 3 272/3 262 ms. Contexto acotado 856/905 ms; versión beam 1/cuatro hilos 760/794 ms. Todas esas variantes confunden Codex y se rechazan: ninguna se adopta por ser rápida.
- **Silero:** padding 150 ms y silencio 300 ms producen `Abre Codeks.` en 4 151/3 611 ms, todavía rechazado. Sin VAD: 3 559/3 425 ms e incorrecto. No se ha medido el endpoint con voz nueva del usuario, y no se confunde VAD offline con escucha incremental.
- **Flash attention:** apagarlo da 4 567/5 089 ms y ~222 MiB frente a ~153 MiB; no aporta mejora. Seleccionar GPU sin un backend instalado sigue usando CPU; no es una prueba de aceleración.
- **Reutilización real del modelo:** un proceso, tres archivos iguales, `--max-context 0`. ES: resultados listos en intervalos 2 948/3 199/3 259 ms; EN: 5 519/4 819/5 891 ms. Carga única 86,54/204,97 ms, pico ~156 MiB. Resolución de lectura de resultados 25 ms. No aparece ganancia consistente; no se añade un trabajador residente a la app sólo para ahorrar esa carga. No se midió su consumo en reposo.
- **Incremental:** prefijos que contienen realmente sólo el primer segundo y dos segundos de PCM, seguidos del audio completo. En ES: 611/804/1 130 ms; EN: 626/1 373/1 777 ms. El prefijo español de 2 s acepta una frase parcial errónea. Sumados, los tres procesos gastan ~2,09×/1,95× la CPU del resultado final solo. Son reproducciones offline, sin solapamiento con captura ni integración en interfaz. No se entregan hipótesis parciales. Se excluyen seis ensayos previos basados en `--duration` sobre WAV completo porque VAD podía observar audio futuro.
- **BLAS:** se verificó el ZIP oficial b5454 y se probaron sólo sus dos DLL adicionales en un directorio temporal: ~51 MB sin comprimir. Un ensayo confirma backends CPU+BLAS cargados, 2 146 ms actual / 803 ms acotado, pero cargar el plugin no demuestra qué operaciones lo usaron. Las series de dos repeticiones y `OPENBLAS_NUM_THREADS=1` no aíslan una mejora consistente de hardware/carga. No se añaden DLL ni dependencia al producto; los archivos temporales fueron retirados.
- **Small:** la nueva comparación no llegó a arrancar. Las descargas fijadas fallaron escribiendo en C: y en la unidad V:. No se presenta el intento como medición ni se concluye que este hardware sea incapaz de alcanzar el objetivo con otro modelo.

No se instaló otro runtime TTS: Helena/David ya fueron escuchados y confirmados por el usuario en la sesión anterior. Eso no sustituye medir interrupción física en la nueva candidata.

## Reproducir y comprobar

Desde `companion/windows`, Python estándar de Windows (sin dependencias nuevas):

```powershell
python -m unittest discover -s tests -p voice_calibration_test.py
python scripts/voice-calibration.py --self-test
powershell -NoProfile -File scripts/voice-corpus.ps1
python scripts/voice-calibration.py --audio .tmp/voice-calibration/optimization-corpus/es-short.wav --language es --expected 'Abre la calculadora.' --profile screen --repeats 2 --report .tmp/voice-calibration/repeat.json
```

El generador produce las ocho referencias de voz; los cuatro controles de ruido/silencio de esta medición fueron generados por un script temporal con `random.Random(41)`, PCM16/16 kHz, ruido gaussiano σ=600 para el negativo, y señal/ruido normalizados a 10 dB para las versiones con habla (señal limitada a pico 18 000, sin clipping). La receta no se incluyó como comando de producto. Los WAV/manifest originales siguen en el directorio temporal para repetir **exactamente** esos controles; verificar sus hashes contra el JSON antes de comparar. La síntesis de Windows puede variar entre versiones de voz. Ni regenerar una frase ni repetir el mismo archivo amplía el corpus humano.

Los perfiles `performance`, `resident` e `incremental` comparan las variantes descritas; `--model tiny-q8` requiere el modelo diagnóstico con hash fijado, y `--models-dir` permite ubicar modelos diagnósticos en otro disco sin cambiar la app. El runner rechaza recursos alterados y DLL desconocidas; sus excepciones BLAS son dos hashes exactos. No descarga modelos ni envía audio a red. El smoke final volvió a verificar los recursos canónicos y ejecutó Tiny real: 2 079/574 ms, texto correcto en ambas configuraciones, sin acción Windows.

## Candidata, reversión y comprobaciones

[CI Windows 41989046596](https://github.com/jeremyencarnacion2000-stack/Novo/actions/runs/41989046596), fuente `2b91b0d098a7de9262fb8aaa608bde6b7349b038`: **434 frontend, 281 app nativa, 30 hooks, 21 harness**, seis sondas físicas ignoradas explícitamente. TypeScript/Vite pasa. Localmente pasan frontend 434, harness 21 y seis pruebas Python; los tres intentos de suite nativa completa local fallaron por almacenamiento (LNK1180/os 112), no por un diagnóstico de compilación de fuente. Por eso la verificación nativa completa y el empaquetado se hicieron en el workflow existente.

El artefacto CI `13398475843` se descargó y verificó en memoria, sin guardar el ZIP de 143 093 146 bytes: SHA-256 `7408a0ac3243084fba116e25c103cbd3c467a46f186fb929781c5ad4b75b65c5`. Se conservó sólo el NSIS versionado de 33 299 600 bytes: SHA-256 `1d67991f1193aad79460080dd587061372b721f2af9632adb93298384d4f1fa1`, en `.tmp/candidates/0.2.17-2b91b0d/`, junto al manifiesto. El MSI remoto cotejado tiene SHA-256 `16dc6fcaa76c573ff152bc13bbdf93d3f8abd56f9501819c4a2a55e943c78f26`; no se guardó localmente. Los instaladores siguen sin firma digital.

Se mantienen los dos instaladores de la versión instalada `c64098a`, sus hashes del [informe anterior](2026-11-04-voice-calibration.md), el respaldo de 21 archivos de 0.2.16 y su NSIS original. Para recuperar espacio se retiraron compilaciones regenerables, duplicados comprobados, la candidata inicial obsoleta y el MSI redundante 0.2.16; no se borró el NSIS ni el respaldo de reversión. Los párrafos históricos que decían conservar todos los formatos ya no describen el almacenamiento actual.

C: llegó repetidamente a cero bytes libres. Se pidió liberar al menos 1 GB o una ubicación local autorizada. **No se modifica la instalación con este margen; tampoco se asume autorización para la nueva candidata a partir del permiso previo de `c64098a`.** Después de disponer de espacio y autorización, hay que comprobar hash instalado/preferencias, probar el lector y su interrupción y medir el recorrido completo.

## Aceptación que falta y alternativa opcional

Quedan pendientes: nuevo corpus humano ES dominicano/EN con referencia confirmada; captura y cortes VAD; micrófono→borrador→Enviar→Codex observado→contexto real Twin→voz audible en una sola interacción; cancelación física ≤250 ms; interfaz durante síntesis; métricas frías/calientes bajo carga controlada y p95 suficiente. La apertura por texto y la voz audible que el usuario confirmó antes son evidencia separada, no este circuito completo. Escucha permanente sigue apagada.

Si otro modelo local no preserva precisión dentro del presupuesto, la alternativa es mantener captura/VAD locales y el mismo borrador, enviando sólo el audio de una solicitud a un transcriptor en otro PC propio de la red o proveedor elegido. Requiere consentimiento **separado por servicio**, indicador visible, cancelación, límites/retención explícitos y retorno local claro si falla. No se reutiliza un consentimiento web como aprobación de otro proveedor; ningún servicio de pago fue invocado ni se transmitió audio en estas pruebas. Esta arquitectura está documentada, no implementada ni habilitada.
