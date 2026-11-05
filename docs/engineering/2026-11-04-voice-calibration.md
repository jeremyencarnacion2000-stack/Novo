# Calibración física de voz local — 4–5 de noviembre de 2026

Base: PR #41, `d981ad6`. Correcciones de captura: `c64098a`. **La aceptación de voz todavía no pasa.** No hay escucha permanente, merge ni despliegue en producción. Los [resultados medidos](2026-11-04-voice-calibration-metrics.json) distinguen muestras humanas, reproducciones del mismo audio y síntesis de referencia.

## Equipo, captura y referencia humana

- Windows expone un único dispositivo WaveIn activo: micrófono Realtek. La consulta del controlador acepta PCM firmado de 16 bits, mono, 16 kHz. Eso es el formato entregado a Whisper; no certifica la frecuencia nativa del ADC.
- Se capturaron tres muestras habladas con la sonda: orden española, orden inglesa y frase cotidiana española. La cuarta captura inglesa queda excluida de precisión: el usuario confirmó que no habló porque estaba distraído. Después se conservó temporalmente una cuarta muestra hablada desde el botón instalado: «abre Codex», con español fijo. Las reproducciones de estos mismos audios no aumentan el número de muestras independientes.
- Para separar el endpoint de captura del motor se usaron ventanas fijas de 12 s, sin corte temprano por nivel de sonido, y señal hablada antes de arrancar WaveIn. El usuario escuchó la reproducción de la primera muestra española y confirmó que estaba completa y a velocidad normal. Este instrumento diagnóstico no sustituye el circuito de la aplicación instalada.
- Primera muestra española: 11 998 ms de PCM, RMS global −30,18 dBFS, pico 14 991/32 768 y cero muestras saturadas. El RMS incluye pausas; no se presenta como SNR ni como medida calibrada del micrófono.
- El usuario aclaró después que su voz reproducida se oía baja, aunque completa y normal en velocidad. Core Audio reporta el micrófono al 100 %, +6 dB y sin mute en los tres roles. No se modificó el nivel global. Una copia de la misma señal amplificada +5,38 dB, sin clipping, subió a −24,80 dBFS pero siguió dando órdenes incorrectas y el mismo recorte de Silero. La amplificación por sí sola no resuelve el fallo y no se incorporó a producción.
- Había inicialmente unos 220 MiB libres. Se detuvieron las pruebas de Whisper hasta que el usuario cerró aplicaciones; después se recuperó margen por encima del mínimo de 912 MiB. Cada ejecución diagnóstica conserva el suelo de 512 MiB libres y límite de 60 s.

## Comparación sobre los mismos audios

Motor distribuido: whisper.cpp b5454, `d1be6fde11ac6e0407606b4e42fe72d34add8037`, Tiny multilingüe Q5_1 y Silero 6.2.0. Los recursos se cotejaron con el lock por tamaño/SHA-256. Se compararon auto/es/en, VAD activado o desactivado, beam 5/1, dos/cuatro hilos y un vocabulario diagnóstico limitado a «Novo, Codex, ClickHome».

| Audio/configuración | Inferencia | Pico working set | Resultado |
| --- | ---: | ---: | --- |
| Orden ES, Tiny actual auto + VAD | 4 223 ms | 152,3 MiB | Detectó inglés; confianza 0,304; rechazada |
| Misma orden ES, Tiny con español fijo + VAD | 3 036 ms | 152,1 MiB | Idioma correcto, orden incorrecta; confianza 0,188; rechazada |
| Misma orden ES, Tiny sin VAD | 3 642 ms | 146,1 MiB | 6 errores / 7 palabras de referencia; rechazada |
| Frase cotidiana ES, Tiny actual | 4 070 ms | 154,2 MiB | 4 errores / 14 palabras, incluido `9` frente a `nueve`; confianza 0,492; rechazada |
| Orden EN, Tiny actual | 3 854 ms | 152,0 MiB | 8 errores / 7 palabras, incluidas inserciones; rechazada |
| Misma orden EN, Base + vocabulario + VAD con padding 150 ms | 7 380 ms | 222,1 MiB | Coincidencia completa en esta única muestra; confianza 0,704 |
| Misma orden EN, Base + vocabulario, beam 1/cuatro hilos | 7 290 ms | 166,8 MiB | Coincidencia completa en esta única muestra; confianza 0,754 |
| Misma orden EN, contexto reducido a 512 | 2 584 ms | 153,6 MiB | Confunde `open Codex` con `OpenCorded`; no es una orden correcta |
| Orden ES corta capturada por la candidata, Tiny español + VAD | 4 987 ms | 150,2 MiB | «Abrecó de éste.»; confianza 0,242; rechazada |
| Mismo audio corto, Small español + VAD | 27 963 ms | 429,3 MiB | «Abre codex» correcto, pero confianza 0,182; rechazada |
| Mismo audio corto, Small contexto 512 + vocabulario/padding | 12 370 ms | 337,3 MiB | «Abre Codex.» correcto, confianza 0,565; no alcanza latencia |

Los tiempos incluyen inicio del proceso y carga del modelo; excluyen la captura y el envío. El pico de working set se muestrea cada 25 ms. No son latencia del circuito completo, memoria total del sistema, precisión poblacional ni p95. El WER normaliza mayúsculas, puntuación y acentos, pero no equivalencias entre cifras y números escritos; las inserciones pueden producir WER superior al 100 %.

La carga de modelo tarda aproximadamente 0,1–0,6 s en los ensayos con desglose. La codificación del audio domina el tiempo: aproximadamente 4,9–8 s en Base y 26 s en Small con contexto completo. La exploración inicial de contexto reducido en inglés no garantizaba cubrir los 12 s de entrada; sus resultados son exploratorios y no se trasladaron a la aplicación. El instrumento actual sólo permite contextos que cubran todo el PCM (20 ms por unidad). El primer ensayo Small/contexto sobre 2,3 s no arrancó por falta de memoria: 845,9 MiB frente al mínimo de 912 MiB. Al recuperar memoria se repitió: contexto 512, cuatro hilos/beam 1, vocabulario y padding reconocieron la orden a 12 370 ms, con 337,3 MiB y un mínimo libre de 545,2 MiB. El siguiente perfil no arrancó al quedar 874,7 MiB libres. Son mediciones de la misma muestra, sin acción ejecutada ni mejora instalada; no constituyen aceptación de latencia o precisión general.

En la primera muestra española, Silero situó el primer segmento en 1,95 s; con padding de 150 ms comenzó en 1,83 s. Esto demuestra recorte del principio de la señal, pero falta alineación humana por palabra para atribuir qué fonemas excluyó. Silero carga correctamente su versión 6.2.0; no apareció un error de compatibilidad del modelo.

**No se adoptaron los ajustes de vocabulario ni Base por defecto.** Tiny llegó a devolver una lista de nombres con confianza alta sin reconocer la orden. Base recupera los nombres en inglés, pero conserva errores de verbo en español y mayor latencia. La confianza y una transcripción correcta son métricas distintas. Los umbrales de producción no se relajaron y no se ejecutó una acción desde estas grabaciones diagnósticas.

Base Q5_1 se descargó sólo al directorio diagnóstico: 59 707 625 bytes, SHA-256 `422f1ae452ade6f30a004d7e5c6a43195e4433bc370bf23fac9cc591f01a8898`, [revisión oficial fijada](https://huggingface.co/ggerganov/whisper.cpp/blob/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-base-q5_1.bin). No forma parte del instalador.

Small Q5_1 también se evaluó sólo fuera de la instalación: 190 085 487 bytes, SHA-256 `ae85e4a935d7a567bd102fe55afc16bb595bdb618e11b2fc7591bc08120411bb`, [misma revisión oficial](https://huggingface.co/ggerganov/whisper.cpp/blob/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-small-q5_1.bin). Recuperó una frase corta sin sugerirla en el prompt, pero con baja confianza; con vocabulario/contexto pasó confianza en esa misma muestra pero no latencia. No se cambió el modelo instalado ni se redujeron umbrales.

## TTS y altavoces reales

La enumeración SAPI utilizada por Companion devuelve Helena Desktop (es-ES), David Desktop y Zira Desktop (en-US). No aparecen es-DO ni es-MX. La enumeración amplia de Windows/.NET también muestra Laura y Pablo (es-ES), pero esos tokens no están disponibles en el backend SAPI actual; no se copiaron claves del registro para forzarlos.

Se reprodujeron por SAPI dos frases completas, primero Helena en español y después David en inglés. Las llamadas síncronas duraron 6 995 y 6 371 ms respectivamente: son duración de reproducción, no latencia de inicio. **El usuario confirmó que ambas se oyeron completas y claras.** Después confirmó también la lectura desde el botón del chat instalado, rectificando su aviso inicial de que no sonaba. La confirmación no constituye una evaluación MOS ni una comparación de acentos. La interrupción desde ese botón y su latencia no quedaron confirmadas.

Se revisaron dos alternativas sin instalarlas: [Kokoro, 82 millones de parámetros y pesos Apache](https://huggingface.co/hexgrad/Kokoro-82M), y [Piper, motor neural local GPL-3.0](https://github.com/OHF-Voice/piper1-gpl). No se midieron su memoria, calidad ni es-DO en este PC. Dado que la reproducción de Windows fue clara y el bloqueo principal está en STT, añadir otro runtime/modelo TTS no aporta evidencia para esta candidata.

## Correcciones y regresiones

1. Se reprodujo de forma determinista el orden erróneo de tres buffers cuando una consulta atrasada encuentra simultáneamente el buffer antiguo 2 y los nuevos 0/1. La prueba falló devolviendo 0 donde correspondía 2; el cursor FIFO pasa después. Es un defecto real del código anterior, pero no se afirma que explique por sí solo los fallos históricos: la sonda física ya mantenía el orden correcto y Tiny seguía fallando.
2. El evento nativo «listening» se emite después de `waveInStart`. La interfaz distingue «Preparando el micrófono» de «Escuchando». Antes anunciaba escucha desde la solicitud inicial, incluso mientras Windows abría el dispositivo.
3. Configuración ofrece Auto/Español/English para dictado local, con validación nativa del enum, compatibilidad de preferencias antiguas y restauración visual si guardar falla. Cambiar ajustes cancela captura en curso. Nube sigue requiriendo consentimiento independiente.
4. Se conserva borrador → Enviar. No se inicia ninguna acción al transcribir. Se conserva cancelación y lector local por solicitud de voz.

Regresiones: 432 pruebas de frontend, 279 nativas y seis sondas manuales excluidas. Los casos de orden de buffers, preparación y persistencia de idioma se observaron fallar antes de corregirlos; 20 pruebas dirigidas pasan. TypeScript/Vite y el formato de los dos archivos de captura pasan. La limpieza oficial `cargo clean --profile dev --package novo-companion` recuperó 9,8 GiB de artefactos de desarrollo; no tocó instalación ni datos.

Durante la investigación del lector se reprodujo otro defecto: guardar ajustes ajenos a la voz detenía la reproducción manual cuando la lectura automática ya estaba apagada. Se corrige en `2d85284`, componente compartido por Novo/Codex: detener al cambiar voz o al desactivar explícitamente la lectura automática. Prueba roja/verde, 14 pruebas dirigidas y suite completa **433/433**; TypeScript/Vite vuelve a pasar. Este cambio posterior **todavía no está en el instalador `c64098a`**, y no se atribuye como causa demostrada del aviso inicial del usuario.

## Reversión, candidata y aceptación pendiente

Los 21 archivos del respaldo 0.2.16 coinciden con su manifiesto y el ejecutable respaldado coincide con el instalado. Además se recuperaron los instaladores originales del workflow CI `41781602456`, sin ejecutar:

- EXE SHA-256: `690C3641F92E5FD1E9D63521F6672A0643A2D800B66B7A4A48234DAC1E9BC2EB`.
- MSI SHA-256: `6DB5AA8E0EC686A55939E0DA03AD9FA89E57ABF7D1AFE578C21C871BAAF952E9`.

El usuario autorizó expresamente compilar e instalar la candidata local **0.2.17**, fuente `c64098a482e17f38a08593c647194fc52df7b724`. La compilación release terminó en 10 min 46 s y produjo NSIS/MSI. La instalación devolvió 0 y el ejecutable instalado indica 0.2.17. Las preferencias conservaron su hash exactamente antes de volver a lanzar la app. Sus 16 recursos de voz coinciden con el lock. El ejecutable coincide con el build salvo los tres bytes de la marca de empaquetado Tauri `UNK` → `NSS`.

- NSIS 33 201 713 bytes, SHA-256 `A3979F5244A94CAD70DD434314B6657E495C6CAEA4C538D21EDB2D970E8CB958`.
- MSI 38 461 440 bytes, SHA-256 `A931325C49064DEB52B025F0A6DA156A94E7ED4DA7B04A48CEA03B0D3BB58A8B`.
- Ejecutable instalado SHA-256 `A3B4CBEE3D09D3E96CCB5A276BE38A3B60DF101B8893EA0AC438E7A42E8D8DAC`.
- Los instaladores no tienen firma digital y siguen sólo en `.tmp/candidates/0.2.17-c64098a/`, junto con el manifiesto. Se conserva también la candidata anterior; no se reemplazó ni publicó un release.

Dos intentos desde el botón instalado terminaron con aviso de reconocimiento incierto. El primero, sin referencia fijada, midió 13 191 ms y 151,3 MiB de pico; el segundo midió 7 173 ms y 151,0 MiB. Se verificó que el ajuste aún era Auto, por lo que no se presentan como aceptación de español fijo. Después se cerró la app y se cambió únicamente `voiceInputLanguage` a `es`, con copia local previa y comparación semántica del resto de las preferencias. Se reinició y se verificó `local/es`, nube desactivada, antes del siguiente ensayo.

Ese ensayo con español fijo también falló. El proceso instalado tardó 7 904,7 ms y alcanzó 150,9 MiB. Su PCM duró 2,3 s, con RMS −39,96 dBFS, pico 2 412 y cero clipping; Silero conservó un segmento 0,13–1,60 s. La transcripción incierta no produjo acción ni envío. Las comparaciones offline del mismo PCM se muestran arriba.

Como control independiente, el usuario escribió «abre Codex» y pulsó Enviar. Confirmó la acción; la accesibilidad de la instalación mostró «Listo, puse Codex al frente». El usuario confirmó después que el lector del chat funciona. Esto acredita texto → intención → resultado local y lectura manual, **no** hablar → borrador correcto → Enviar → acción → respuesta audible en un solo recorrido. No se afirmó recuperación de ClickHome a partir de esta orden corta.

La captura de ventana mediante Windows.Graphics.Capture todavía hace timeout; se obtuvo lectura de accesibilidad, pero no se da por aprobada la revisión visual. Los clics por índice tampoco resolvían el selector; por eso se documenta el cambio puntual de preferencias en vez de atribuirlo falsamente a un clic de UI.

Pendiente: corpus consentido de al menos 40 muestras ES/EN, reconocimiento fiable desde el botón instalado, cancelación física y su latencia, recorrido unido con Twin, revisión visual y recuperación tras reinicio. La candidata sí se reinició para verificar el idioma; eso no certifica recuperación de operaciones pendientes. La muestra inglesa sin habla no se incluye como fallo de reconocimiento hablado. No hay escucha permanente habilitada y no se puede declarar listo el asistente por una única coincidencia inglesa.

## Repetir el diagnóstico

Con Python en el entorno de desarrollo y recursos del lock preparados (no es una dependencia del Companion):

```powershell
python scripts/voice-calibration.py --self-test
python scripts/voice-calibration.py --capture --seconds 12 --language es --expected 'Novo, abre Codex y continuemos con ClickHome' --report .tmp/voice-calibration/physical-es.json
python scripts/voice-calibration.py --audio <wav-temporal-16k-mono-PCM16> --language en --expected 'Novo, open Codex and continue with ClickHome' --report .tmp/voice-calibration/replay-en.json
pwsh -NoProfile -File scripts/read-microphone-level.ps1
pwsh -NoProfile -File scripts/observe-voice-worker.ps1 -NovoProcessId <pid-real-del-Companion> -Report .tmp/voice-calibration/installed.json
```

El instrumento no envía a la nube ni controla apps. El audio se elimina por defecto al terminar; `--keep-audio` sólo conserva temporalmente una muestra para comparar perfiles sobre el mismo PCM. Tras las comparaciones se eliminaron explícitamente los ocho WAV de prueba y los dos modelos diagnósticos (240,5 MiB); se conservaron informes sanitizados, instaladores y reversión. Ningún WAV humano se incorpora a GitHub. Para repetir se necesita una nueva captura consentida y, si se elige Base/Small, descargar la revisión oficial y verificar el hash indicado. `--model tiny|base|small` y `--profile baseline|tune|context` seleccionan experimentos del instrumento, no opciones de producción. El self-check valida WER, métricas PCM y rechazo de audio mayor de 20 s.
