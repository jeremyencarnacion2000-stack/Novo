# Diagnóstico de voz y continuidad de ClickHome

13 de noviembre de 2026. PR #41. La instalación sigue en 0.2.17, fuente `3ad0d09`. Se conservan Whisper, idioma local español, envío manual y escucha permanente apagada.

## Realtek → Whisper → borrador

| Etapa | Evidencia |
| --- | --- |
| Captura | WaveIn usa el dispositivo predeterminado y solicita PCM16 mono a 16 kHz, con tres bloques de 100 ms en FIFO. DirectShow enumeró el Realtek y abrió PCM16 a 44,1 kHz estéreo. Son formatos que entregan las APIs, no una lectura de la frecuencia física del ADC. |
| WAV de Novo | 92 800 muestras y 5,8 s, RMS −39,64 dBFS, pico 3 952, cero muestras recortadas. Captura de pared 5,891 s. Conversión a WAV por copia little-endian de muestras, sin ganancia ni remuestreo en Novo. No se observó inversión del orden, clipping ni un vacío significativo en la duración. Esto no excluye defectos más cortos o de la ruta de Windows. |
| Fin de habla | 1,2 s de silencio según el umbral energético. El código exige 0,3 s acumulados sobre el umbral. Un Detener manual sale antes de drenar el bloque en curso. Windows devuelve el bloque parcial al parar el dispositivo, pero la limpieza no lo adjunta. Esta pérdida potencial afecta el final manual y no explica este intento, que cerró por silencio. [Contrato de WaveIn](https://learn.microsoft.com/en-us/windows/win32/api/mmeapi/nf-mmeapi-waveinstop). |
| Whisper y Silero | El intento instalado tardó 15,46 s hasta el error: 2,610 s de comprobación de recursos, 1,096 s de preparación, 5,891 s de captura y 5,830 s de Whisper. En el mismo WAV, español fijo con Silero produjo un segmento, 7 errores de 9 palabras y confianza geométrica 0,219. Sin Silero: un segmento, los mismos 7 errores y confianza 0,257. Los dos resultados fallan la validación. |
| Validación y borrador | La validación exige idioma soportado, texto, tokens válidos, mínimo 0,1 por token léxico y media geométrica ≥0,5. El fallo se reproduce antes de emitir `finished`. Las pruebas del frontend confirman que un resultado final válido llega al borrador, conserva el texto previo y requiere Enviar. El registro de la instalación no tiene un evento de borrador para ese intento. |

El usuario autorizó la prueba y confirmó que dijo «Abre Codex y revisa las tareas pendientes de ClickHome» en Novo. La segunda toma abrió el mismo Realtek con FFmpeg DirectShow, con RMS −41,66/−41,90 dBFS y sin clipping. El usuario no pudo confirmar que dijera la frase tras los tonos. Se excluye de precisión y no permite comparar fidelidad de captura entre APIs. No hubo una nueva frase humana inglesa confirmada en esta sesión. Las tomas anteriores ya se habían eliminado, por lo que sus métricas siguen como evidencia histórica independiente.

## Alternativa local

Vosk 0.3.45 para Windows x64 y los modelos Apache 2.0 `vosk-model-small-es-0.42` (39 MB publicados) y `vosk-model-small-en-us-0.15` (40 MB publicados) se probaron sólo en un directorio temporal. PyPI ofrece esa rueda Windows y la última release estable upstream consultada es v0.3.50 de abril de 2024. El repositorio sigue recibiendo cambios, pero el paquete probado tiene una cadencia de releases baja. [Modelos y licencias](https://alphacephei.com/vosk/models) · [Paquete Windows](https://pypi.org/project/vosk/0.3.45/) · [Release](https://github.com/alphacep/vosk-api/releases/tag/v0.3.50).

| Métrica | Whisper Tiny + Silero | Vosk Small |
| --- | ---: | ---: |
| Frase humana española, errores / palabras | 7/9 | 6/9 |
| Frase humana española, pared / pico RAM | 2,785 s / 154,24 MiB | 3,368 s / 166,32 MiB |
| Controles sintéticos de habla, exactitud | 3/6 | 5/6 |
| Controles sintéticos de habla, errores / palabras | 7/60 | 1/60 |
| Controles sintéticos de habla, mediana de pared | 4,569 s | 2,868 s |
| Controles sintéticos de habla, mediana de CPU | 8,367 s | 2,852 s |
| Controles sintéticos de habla, mayor pico RAM | 154,40 MiB | 177,53 MiB |
| Ruido y silencio sintéticos, resultados no vacíos | 0/2 | 0/2 |

Se compararon los mismos WAV PCM16 mono a 16 kHz, en procesos nuevos y con caché del SO sin controlar. Hay **una** muestra humana independiente, seis casos sintéticos de habla con dos versiones ruidosas derivadas de otras frases, y dos controles sin habla. Los 19 procesos no son 19 locuciones independientes. Memoria y CPU se refieren al proceso de reconocimiento. Se borraron el WAV humano y el intento de DirectShow. Se comprobó que no quedaron WAV de la solicitud. USD 0 en proveedores. [Resultados numéricos](2026-11-13-stt-comparison.json).

Para reproducir la comparación, fijar idioma por toma y usar el perfil `baseline` de `companion/windows/scripts/voice-calibration.py`. Comparar `fixed-language` y `without-vad`. En Vosk, cargar un modelo por idioma, crear `KaldiRecognizer(model, 16000)`, alimentar los mismos PCM con `AcceptWaveform` en bloques de 1 600 muestras y concatenar únicamente `Result()` y `FinalResult()`. Medir el proceso completo, incluido arranque y carga del modelo. Calcular WER con `word_errors` del mismo script y publicar sólo agregados. Los hashes de archivos Vosk están en el JSON. Guardar WAV únicamente durante la comparación autorizada.

Conservar Whisper. Vosk es una alternativa experimental para el corpus humano, pero los seis errores de nueve palabras en la frase objetivo impiden adoptarlo. Sherpa-ONNX tiene releases de runtime más recientes y publica modelos multilingües con español. Queda pendiente escoger y medir un artefacto compacto con licencia de pesos comprobada. [Releases](https://github.com/k2-fsa/sherpa-onnx/releases/tag/v2.0.1) · [Modelos ASR](https://github.com/k2-fsa/sherpa-onnx/releases/tag/asr-models).

## Prueba por texto y lector

El primer intento con «Abre Codex y dime qué tarea pendiente de ClickHome puedes confirmar y de qué fuente viene» fue al chat general. La respuesta visible mencionó las fuentes conectadas y la carpeta de ClickHome, dijo que no tenía una tarea confirmada y declaró que no podía abrir Codex. Esto evidencia la respuesta visible, sin certificar que Twin se habilitara o que todas las fuentes se consultaran en vivo. Se reprodujo el fallo del parser y se añadió la intención de consulta de tareas tras una apertura explícita. Pasa por el catálogo, permisos, recibo Windows y búsqueda de contexto existentes. Las expresiones compuestas fuera de las gramáticas probadas siguen sin ejecutar acciones parciales.

El segundo intento, «Abre Codex y continuemos con ClickHome», llegó al flujo local. La interfaz mostró que no pudo confirmar Windows. El error genérico no permite distinguir catálogo, autorización, ventana o fallo en la consulta posterior. El código nativo exige una ventana observable, y si ya encuentra una única ventana intenta enfocarla con los permisos vigentes. No hay prueba de cuál fue la causa concreta en ese intento. Windows registró dos acuses SAPI de inicio, 766 y 12 ms. El usuario indicó que el altavoz no sonó. Una instancia nueva de SAPI tenía volumen 100 y seleccionó `Speakers (FxSound Audio Enhancer)`. Windows también enumeró una salida Realtek. La sonda identifica la salida predeterminada y no prueba la mezcla efectiva del proceso de Novo ni confirma que FxSound cause el silencio. **Circuito Windows → Twin → respuesta audible pendiente.**

## Cambios verificados y siguiente medición

- PR #41 registra ahora código de error, amplitud PCM, clipping y conteo de segmentos Silero sin guardar audio, transcripción ni salida cruda del motor. La candidata instalada todavía no incluye esa instrumentación. El algoritmo, el umbral y el modelo siguen iguales.
- El parser distingue la consulta de tareas de una apertura sola o una continuación genérica y pide evidencia de la fuente. Si la búsqueda de contexto falla después de una apertura confirmada, conserva el recibo y muestra el fallo de contexto por separado. Ambas regresiones se reprodujeron antes de corregirlas. Pasaron 440 pruebas frontend, compilación TypeScript/Vite, 23 pruebas del harness Rust y 6 pruebas Python. No se instaló otro binario.
- Para la siguiente comparación física, el operador de cada toma controla el comienzo, con un aviso visible persistente y confirmación antes de avanzar. Registrar el formato nativo, convertir una copia con `ffmpeg -i input.wav -ac 1 -ar 16000 -c:a pcm_s16le output.wav` y reutilizar el mismo PCM en cada motor. Alternar orden de grabación y probar inicio y final completos, estéreo por canal, y pérdidas tras Detener. La toma independiente de hoy no se usa como línea base del micrófono.
- Corpus a grabar con consentimiento: dos locutores por idioma y diez frases por locutor, más silencio/ambiente por separado. Mantener al menos un locutor dominicano en el conjunto español. Guardar referencia, idioma declarado, modalidad, ruido, distancia, y dispositivo por separado. Hacer varias ejecuciones frías y calientes por WAV. Reportar WER, acierto de intención/entidades, falsos textos, p50/p95 de proceso y borrador, RAM/CPU y número de muestras únicas. Ninguna toma ruidosa derivada aumenta ese número.

| Caso | Español dominicano | Inglés |
| --- | --- | --- |
| Apertura | Abre Codex. | Open Codex. |
| Nombre propio | Abre Codex y revisa las tareas pendientes de ClickHome. | Open Codex and check the pending tasks for ClickHome. |
| Breve y coloquial | Dame un chin de contexto sobre lo que dejé a medias. | Give me a quick recap of what I left unfinished. |
| Agenda | ¿A qué hora es la reunión de mañana? | What time is tomorrow's meeting? |
| Fecha relativa | Recuérdame revisar eso el viernes por la tarde. | Remind me to review that on Friday afternoon. |
| Corrección | Abre el proyecto, perdón, primero dime qué sigue. | Open the project, sorry, first tell me what's next. |
| Nombres mixtos | Revisa ClickHome, GitHub y el despliegue de Vercel. | Check ClickHome, GitHub, and the Vercel deployment. |
| Habla baja | Dime por dónde seguimos con el proyecto. | Tell me where we should pick up on the project. |
| Pausa natural | Busca las tareas pendientes… y dime cuál vence primero. | Find the pending tasks… and tell me which one is due first. |
| Larga | Revisa el proyecto que abrimos ayer, busca lo pendiente y menciona la fuente de cada tarea antes de recomendar el próximo paso. | Review the project we opened yesterday, find the pending work, and cite the source of each task before suggesting the next step. |

## Diseño de respaldo conectado

Mantener local como opción inicial. Ante un fallo de reconocimiento o RAM, ofrecer un botón explícito «Transcribir con un servicio conectado» sólo cuando exista una toma utilizable y el usuario elija el destino conociendo datos y retención. Si no existe audio, ofrecer una nueva toma iniciada por el usuario. Descartar el audio retenido al cancelar, cambiar de cuenta/conversación, bloquear o vencer el plazo. En el backend, reutilizar el adaptador de STT web con autenticación de dispositivo, scope específico, idioma elegido, MIME/duración/tamaño acotados, rate limit y timeout. La ruta web actual usa sesión de navegador y español fijo, por lo que no se conecta directamente desde Companion. No guardar audio ni texto en logs. Cada petición tiene ID, cancelación y vigencia. El resultado final vuelve al borrador actual y espera Enviar. Una revocación cancela el trabajo y descarta resultados tardíos. El respaldo queda diseñado y apagado.
