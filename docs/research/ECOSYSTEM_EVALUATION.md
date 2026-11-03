# Evaluación de ecosistema

Investigación del 2026-11-01, actualizada el 2026-11-02 con `/browse`: metadatos públicos oficiales de GitHub (`/repos/{owner}/{repo}`) de los quince repositorios indicados, README de los motores de voz y lectura actual de Leon/Pipecat. Las fechas son `pushed_at` (UTC), no una garantía de release, soporte o seguridad. Las decisiones siguientes son una evaluación para Novo, no una certificación del software. No se instaló ninguno de estos motores ni se ejecutaron scripts de terceros.

## Selección inicial

| Proyecto / fuente primaria | Estado consultado; licencia del repo | Encaje y coste de integración | Decisión para Novo |
| --- | --- | --- | --- |
| [Open Interpreter](https://github.com/openinterpreter/openinterpreter) | El enlace indicado redirige a `openinterpreter/openinterpreter`; Rust, activo, push 2026-11-01; Apache-2.0 | Su identidad actual difiere de descripciones históricas; otro runtime de agente duplicaría permisos/procesos existentes | Estudiar; no integrar a ciegas el paquete histórico |
| [Microsoft UFO](https://github.com/microsoft/UFO) | Python, activo, 2026-10-30; MIT | Referencia de automatización Windows; añadir proceso Python/modelos antes de validar workflows aumentaría memoria y mantenimiento | Estudiar adaptadores estructurados; no integrar framework completo |
| [Leon](https://github.com/leon-ai/leon) | TypeScript, activo, 2026-11-02; MIT | Su README actual separa controlled skills/actions/tools de ejecución agentic y contexto/memoria | Adaptar esa separación en el dictado del chat; no incorporar otro asistente |
| [Home Assistant](https://github.com/home-assistant/core) | Python, activo, 2026-11-02; Apache-2.0 | Dominio de dispositivos; no resuelve por sí solo continuidad del trabajo de Novo | Adaptador opcional futuro mediante API, sólo si hay dispositivos autorizados |
| [Pipecat](https://github.com/pipecat-ai/pipecat) | Python, activo, 2026-11-02; BSD-2-Clause | Pipeline realtime multimodal; nuevo servicio/transporte frente a los existentes | Adaptar separación captura/transcripción/ejecución; streaming/VAD quedan pendientes de medición |
| [Playwright](https://github.com/microsoft/playwright) | TypeScript, activo, 2026-11-02; Apache-2.0 | Ya figura como dependencia de desarrollo; requiere navegador, no implica permiso para operar sesión del usuario | Reutilizar para validación; automatización de producto necesitaría permisos propios |
| [Mem0](https://github.com/mem0ai/mem0) | Python, activo, 2026-10-30; Apache-2.0 | Novo ya tiene señales y memoria con procedencia/revisiones; sumar otra persistencia añade coste y conflictos | Estudiar recuperación/deduplicación; rechazar dependencia en esta fase |
| [Ollama](https://github.com/ollama/ollama) | Go, activo, 2026-11-02; MIT | El Companion ya habla su protocolo; RAM/GPU y licencia dependen del modelo | Reutilizar adaptador existente, instalación/modelos optativos |
| [Semantic Kernel](https://github.com/microsoft/semantic-kernel) | C#, activo, 2026-11-02; MIT | Otro framework sobre planner/executor existentes | Estudiar patrones; rechazar incorporación ahora |
| [whisper.cpp](https://github.com/ggml-org/whisper.cpp) | C++, activo, 2026-10-30; MIT | CPU/quantización y Windows documentados; sidecar nativo encaja mejor que un servidor general | Candidato a prototipo STT local optativo |
| [faster-whisper](https://github.com/SYSTRAN/faster-whisper) | Python, activo, 2026-11-02; MIT | CTranslate2 y runtime Python; GPU añade requisitos CUDA/cuDNN | Comparar en estación adecuada; evitar empaquetar para todos |
| [Piper original](https://github.com/rhasspy/piper) | Archivado; último push 2025-08-26; MIT | README declara traslado a [OHF-Voice/piper1-gpl](https://github.com/OHF-Voice/piper1-gpl); no trasladar la licencia MIT del repo antiguo al sucesor | Rechazar integración del repo archivado; evaluar sucesor y voces por separado |
| [OpenWakeWord](https://github.com/dscripka/openWakeWord) | No archivado; último push 2025-12-30; Apache-2.0 | README: Windows usa ONNX; modelos incluidos sólo en inglés; revisar licencia de cada peso/dataset | Estudiar; no habilitar escucha continua ni prometer wake word español |
| [Silero VAD](https://github.com/snakers4/silero-vad) | Python, activo, 2026-10-22; MIT | VAD de audio; ONNX permite separar inferencia de Python, con I/O propio | Candidato pequeño para detección de voz, tras benchmark |
| [Kokoro](https://github.com/hexgrad/kokoro) | No archivado; último push 2025-08-06; Apache-2.0 | README enlaza modelo de 82M y ejemplos ES/EN; empaquetado, voces, fonetización y calidad requieren revisión | Prototipo TTS optativo; no sustituir síntesis existente aún |

La licencia indicada corresponde al repositorio consultado. Antes de distribuir binarios, modelos, voces o datasets hay que verificar sus archivos/licencias concretos y las dependencias transitivas. Un repositorio no archivado puede estar poco mantenido.

## Utilidad adaptada: voz dentro de la conversación

El [README actual de Leon](https://github.com/leon-ai/leon#readme) documenta modos controlados, acciones y herramientas; el [de Pipecat](https://github.com/pipecat-ai/pipecat#readme) separa servicios de voz, transporte y procesamiento. La adaptación para Novo es propia: reutilizar `VoiceCommandHub` y el compositor persistente, sin copiar código ni instalar ambos frameworks.

En `/chat` y `/ai`, el micrófono entrega texto al borrador de la conversación actual. Conserva texto y adjuntos existentes; requiere pulsar Enviar para entrar en el mismo flujo de contexto, herramientas y confirmaciones que un mensaje escrito. Cambio de cuenta/selección o cierre cancela la captura/transcripción pendiente. No se ejecutan comandos aislados ni se crea una tarea sólo por dictar una frase. El clasificador del panel independiente también deja de convertir conversación genérica en tareas.

Esto implementa una entrada de voz revisable; no implementa Pipecat, VAD, síntesis, wake word, STT offline ni un protocolo nuevo. El panel independiente conserva sus comandos explícitos y todavía requiere converger con el chat; no se certifica aquí su catálogo completo. La transcripción sigue usando el servicio existente y requiere red/configuración del servidor. Las pruebas de captura usan audio/transcripción simulados; la calidad física ES/EN queda pendiente.

Actualización Companion 2026-11-03: los comandos exactos de ventana usan un parser local y APIs nativas, no automatización visual general. El dictado del Companion queda apagado hasta que el usuario permite expresamente el servicio de voz en configuración; el motor del WebView puede procesar audio fuera del dispositivo. No se añade ningún modelo ni dependencia. Wake word, whisper.cpp/Silero y TTS continúan siendo candidatos y sólo se deben integrar tras medir licencias, paquetes, ruido, RAM/CPU y cancelación en Windows real.

Entrega: [PR #32](https://github.com/jeremyencarnacion2000-stack/Novo/pull/32), merge `80bcc3a`, producción READY con alias canónico comprobado. CI `41456515869`: tipos/lint y 1349 pruebas aprobadas; cuatro suites dirigidas / 21 pruebas y revisión independiente aprobadas. En Chrome autorizado, una transcripción simulada apareció en el borrador con Enviar habilitado y descripción accesible; se observaron cero solicitudes al asistente, executor, tareas o historiales. El borrador de prueba se limpió. No se activó el micrófono ni se envió texto real para probarlo. Cancelar invalida respuestas tardías y detiene captura; una petición de transcripción ya enviada puede terminar en el servidor.

## Comparación de voz aplicable al equipo

| Alternativa | Latencia / calidad | CPU, GPU y memoria | Offline e integración |
| --- | --- | --- | --- |
| Dictado browser existente | Depende del proveedor y red; no medido en este equipo | Sin nuevo motor empaquetado; CPU/red dependen del navegador | No garantizar offline. Mantener detección de soporte, permiso y envío manual |
| whisper.cpp multilingüe | Calidad y velocidad dependen de tamaño/quantización; comparar ES/EN | CPU posible; GPU opcional. README estima ~273 MB para tiny, ~388 MB para base y ~852 MB para small | Offline con pesos locales; requiere capturar/reconvertir audio y gestionar proceso/streaming |
| faster-whisper | Benchmarks del autor dependen de hardware/configuración, no prueban ventaja en este PC | CPU int8 o GPU; Python/CTranslate2 y, en GPU, CUDA/cuDNN añaden carga | Offline con modelo descargado; proceso separado, cancelación y empaquetado Windows |
| Silero VAD | Detecta segmentos, no transcribe ni razona; ajustar falsos cortes con muestras reales | Ruta ONNX a medir; no asumir que instalar PyTorch completo sea necesario | Offline; conectar frames, umbral, silencio y cancelación al pipeline existente |
| Piper | Síntesis local; voz/calidad dependen del modelo | Medir motor sucesor/voces antes de presupuestar | Repo original archivado; revisión legal/técnica del sucesor pendiente |
| Kokoro | Calidad ES/EN y tiempo al primer audio pendientes de prueba | 82M parámetros según README; tamaño de pesos no equivale a RAM total | Pesos locales y fonetización; streaming por segmentos y cancelación por integrar |
| OpenWakeWord | Precisión depende de ruido, hablante y umbral; modelos oficiales indicados en inglés | Escucha continua añade coste permanente; presupuesto no medido | Offline; exige consentimiento explícito y evaluación de modelos antes de habilitar |
| Pipecat | Orquesta servicios; por sí mismo no determina calidad ni latencia | Proceso Python y motores/transporte elegidos | Evaluar únicamente si simplifica de forma medible el pipeline |

Las cifras de whisper.cpp proceden de su [tabla de memoria](https://github.com/ggml-org/whisper.cpp#memory-usage), no de una prueba local. El equipo de esta sesión informa unos 3.4 GiB de RAM total y poca RAM disponible durante la instalación: no conviene cargar otro modelo automáticamente. El [benchmark de faster-whisper](https://github.com/SYSTRAN/faster-whisper#benchmark) usa hardware distinto; no se presenta como comparación directa aquí.

## Siguiente experimento, sin framework adicional

Reutilizar el dictado manual y el executor autorizado. Capturar un corpus pequeño consentido ES/EN (silencio, ruido, interrupciones); comparar browser contra un único modelo multilingüe pequeño de whisper.cpp. Medir arranque, tiempo al primer texto/audio, p50/p95, RAM, CPU, errores de transcripción, falsos cortes y cancelación. Sólo después elegir VAD/TTS. Guardar métricas sin audio o texto privado por defecto. La adaptación por hardware requiere esas medidas; no se declara implementada por esta investigación.

## Continuación — voz local y selección de repositorios

La síntesis del Companion usa las voces Microsoft instaladas mediante SAPI y la dependencia Windows existente. No se distribuyen voces, pesos ni otro runtime. En este PC se instaló `Language.TextToSpeech~~~es-ES~0.0.1.0` mediante Windows, sin reinicio; Helena apareció en el catálogo y sintetizó 188.686 bytes de una frase fija en memoria, sin salida por altavoces. Esto prueba disponibilidad del motor, no calidad audible ni latencia de cancelación.

La navegación /browse falló con `ERR_CERT_DATE_INVALID`; se conservó la validación TLS y se contrastaron después las fuentes públicas mediante la API de repositorios de GitHub. Los hallazgos nuevos y las referencias figuran al final de este documento. A partir de las fuentes ya documentadas: whisper.cpp con Silero sigue siendo la siguiente integración de STT local; debe fijar binario, licencia y hashes antes de distribuirlo. OpenWakeWord exige un modelo de «Novo» y licencia de pesos adecuada. Leon y Pipecat aportan separación de entrada, diálogo y acción; se adapta su patrón con el catálogo existente. UFO orienta observación/verificación de Windows; el control permanece limitado a las apps permitidas. Kokoro se comparará contra Helena sólo si mejora calidad dentro del presupuesto de memoria. No se instalaron esos frameworks ni sus modelos.

Se adaptó la separación de reproducción/cancelación: el audio no puede autorizar acciones, ejecutar SSML ni cargar audio desde rutas/URLs; las respuestas se entregan a Windows como texto literal.

## Fuentes públicas contrastadas con la API de GitHub

La API oficial de GitHub funcionó mediante `gh api` después del fallo de /browse. Se leyeron los README y metadatos públicos; no se ejecutó código de los repositorios.

| Fuente | Hallazgo verificado | Aplicación en Novo |
| --- | --- | --- |
| [whisper.cpp v1.9.5](https://github.com/ggml-org/whisper.cpp/releases/tag/v1.9.5) | Commit `d1be6fde11ac6e0407606b4e42fe72d34add8037`; esa release no adjunta binarios. [b5454](https://github.com/ggml-org/whisper.cpp/releases/tag/b5454) publica `whisper-bin-x64.zip` (8.928.640 bytes), digest declarado `sha256:6ba69e3482d7826214f90a6a9c84ca07782aec1e1d0c6a7c30c994fd5d816ccb` | Base de STT local. Elegir fuente estable fijada o binario concreto; falta descargar/verificar localmente antes de integrarlo |
| [whisper.cpp VAD](https://github.com/ggml-org/whisper.cpp#voice-activity-detection-vad) | El README documenta `--vad`, modelo adicional y Silero `v6.2.0`, con descarga Windows | Reutilizar el VAD del mismo trabajador; modelo y hash se fijan por separado del ejecutable |
| [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) | Código Apache-2.0; Rust, Windows, ASR streaming/offline, keyword spotting y Silero VAD documentados | Candidato de comparación si Whisper excede presupuesto. No se confirmó un modelo de keyword spotting en español ni se instaló el runtime |
| [OpenWakeWord](https://github.com/dscripka/openWakeWord#license) | Código Apache-2.0; los modelos incluidos usan CC BY-NC-SA 4.0 y el README declara soporte inglés | No incluir esos pesos en Novo comercial; «Novo» necesita un modelo adecuado y derechos de distribución verificables |
| [Decibri](https://github.com/decibri/decibri) | La referencia antigua redirige a `decibri/decibri.cpp`, cuyo README deriva a la reescritura Rust. El repo actual declara Apache-2.0, captura/reproducción multiplataforma y VAD opcional; explica límites de telemetría ONNX en Windows | Evaluar captura y buffering sin copiar la edición Node antigua; no activar ONNX/VAD por defecto ni añadirlo sin medir huella y revisar esas condiciones |
| [Pipecat](https://github.com/pipecat-ai/pipecat) | Python, pipelines componibles, transportes y procesamiento de audio documentados | Mantener en Novo las separaciones de captura, respuesta y acción; no añadir un proceso Python para la salida de voz |
| [Kokoro](https://github.com/hexgrad/kokoro) | README: modelo de 82M, idioma español `e` y pesos Apache; fonetización/paquete propios | Comparar calidad/latencia contra Helena antes de considerar sustitución; sin instalación en esta revisión |

Los digests de GitHub anteriores son metadatos del proveedor, no hashes comprobados sobre un archivo descargado. Esta revisión añade candidatos y decisiones concretas; el único cambio instalado fuera del worktree fue el componente oficial de voz española de Windows.
