# OpenJarvis en Novo

El primer flujo integrado es la **continuación de un proyecto desde el chat de Companion**. El Companion ejecuta y verifica la apertura de Windows con sus permisos habituales. La API de Novo autentica al dispositivo, recupera la evidencia autorizada por cuenta y proyecto, y delega la respuesta de lectura al agente de OpenJarvis. Su cliente MCP consulta una única instantánea privada del turno. El agente recibe identidades, tareas confirmadas y fuentes que fallaron. Novo conserva los permisos, la memoria, la interfaz, el historial y la reproducción.

## Arranque local

Clona OpenJarvis fuera de Novo y fija el commit `484de900c7238442d4e049e185de6af679519192`. El servicio comprueba el commit y que el árbol de código upstream esté limpio. El código upstream está bajo [Apache 2.0](https://github.com/open-jarvis/OpenJarvis/blob/484de900c7238442d4e049e185de6af679519192/LICENSE). Los motores y pesos opcionales conservan sus propias licencias. El [manifiesto upstream](https://github.com/open-jarvis/OpenJarvis/blob/484de900c7238442d4e049e185de6af679519192/pyproject.toml) admite Python 3.11 a 3.13. Para este servicio se verificó Python 3.12 con las dependencias de `requirements.txt` en un entorno aparte. La app de escritorio, los modelos y el servidor general de OpenJarvis no se requieren.

1. Crea un entorno virtual Python separado e instala `services/openjarvis/requirements.txt` en él.
2. En el entorno del servicio, configura `NOVO_OPENJARVIS_CHECKOUT` con el directorio upstream. Configura `NOVO_OPENJARVIS_MODEL` y `NOVO_OPENJARVIS_ENGINE`. Con `groq` proporciona únicamente `GROQ_API_KEY` para el servicio. Con `ollama` se usa el servidor compatible local de `127.0.0.1:11434` y un modelo ya instalado. El proceso no aprovisiona ni arranca modelos.
3. Genera una credencial aleatoria y configura `NOVO_OPENJARVIS_TOKEN` con el mismo valor en el servicio y el servidor Novo. Arranca el proceso con `python -I -B services/openjarvis/runtime.py`. Escucha en `127.0.0.1:8764` de forma predeterminada.
4. En el servidor Novo del mismo host, configura `NOVO_OPENJARVIS_URL=http://127.0.0.1:8764` y los mismos valores de `NOVO_OPENJARVIS_MODEL` y `NOVO_OPENJARVIS_ENGINE`. Las continuaciones de proyecto con modelo automático o el modelo configurado usan OpenJarvis como primera opción. Eliminar `NOVO_OPENJARVIS_URL` y reiniciar el servidor revierte al proveedor existente.
5. Para repetir el ensayo real con datos ficticios, configura `NOVO_OPENJARVIS_PYTHON` con el ejecutable del entorno aislado y ejecuta `node services/openjarvis/smoke.mjs` con los valores del paso 2. El ensayo crea su propia credencial y detiene su proceso al salir.

El puente exige una credencial de servicio, usa una dirección fija local y limita tamaño, modelo y tiempo. El servicio exige que el motor de cada petición coincida con su configuración. Un error en modo Ollama se devuelve al chat sin reenviar el proyecto a la nube. MCP reside dentro del proceso y sólo expone la instantánea. El registro conserva métricas de tiempo, memoria del proceso y tokens reportados por el proveedor. El servidor separa este proceso de la configuración que contiene credenciales del Twin y de sus conectores. La cancelación del chat descarta la respuesta y cancela la conexión a Novo. Una llamada de inferencia ya aceptada puede acabar dentro de su plazo aunque el cliente se haya desconectado.

## Alcance de la prueba

El endpoint autenticado existente del Companion es compatible con el cliente 0.2.17. Esta prueba usa un host compartido con Novo y el motor de texto. El proceso de voz requiere sus extras específicos y su propia validación de hardware. El lector de Windows y el dictado manual siguen en uso. Los agentes con cambios externos, herramientas de navegador, la superficie web, la escucha permanente y una topología remota autenticada requieren integración y pruebas adicionales.

El SDK general combina configuración, descubrimiento de motores, herramientas y memoria. Se seleccionaron directamente `SimpleAgent`, el motor compatible con chat de OpenAI y el cliente/servidor MCP para que Novo conserve esos controles. El servidor general de OpenJarvis incluye además canales, conectores, persistencia y rutas de agentes. Su despliegue daría acceso a funciones que este flujo no necesita. La traza se limita a las métricas de Novo porque el colector general puede incluir mensajes y resultados de herramientas.

Para evaluar voz de forma local, instala el extra diagnóstico `faster-whisper==1.2.1` y `av<19` en el entorno aislado. Con un modelo CTranslate2 previamente descargado, ejecuta `python -B services/openjarvis/speech_check.py <archivo.wav> --language es --model-dir <modelo>`. El comando acepta un WAV existente, usa CPU e INT8 y muestra la transcripción y el consumo locales. Usa el mismo archivo con `companion/windows/scripts/voice-calibration.py` para comparar con el motor actual. La prueba de voz no requiere micrófono ni servicio conectado.

## Resultados del 23 de noviembre de 2026

La prueba real de inferencia pasó dos casos sintéticos con Groq y `openai/gpt-oss-20b`. Con una tarea registrada, la respuesta citó Novo y ofreció retomarla. Sin una tarea confirmada, pidió aclaración. Ambos casos mencionaron la indisponibilidad de Vercel. El primer ensayo con MCP había omitido citar Novo. Tras ajustar el mensaje, el ensayo invoca el mismo mensaje que la app.

| Caso | Tiempo | CPU del proceso local | RAM residente | Tokens de entrada / salida reportados |
| --- | ---: | ---: | ---: | ---: |
| Tarea confirmada | 798–1 347 ms | 125–406 ms | 47,8–49,6 MiB | 269 / 197–234 |
| Tarea no confirmada | 601–876 ms | 47–94 ms | 48,5–50,3 MiB | 251 / 247–259 |

La sonda de Windows observó una ventana de Codex y obtuvo `focused`. La consulta de la carpeta seleccionada de ClickHome obtuvo una identidad exacta, un identificador Vercel y 12 archivos con fragmentos, sin imprimirlos. Una lectura por propietario no encontró un proyecto con ese título exacto ni memoria activa coincidente. La evidencia disponible no confirma una tarea concreta de ClickHome. El circuito conjunto con la cuenta real del Companion sigue pendiente. Las [pruebas completas del servidor](https://github.com/jeremyencarnacion2000-stack/Novo/actions/runs/45281116551) pasaron en `77a879e` con 331 suites, 1 370 pruebas, TypeScript, lint y OAuth. En local pasaron 32 pruebas dirigidas de chat/permisos y 13 del recorrido de escritorio.

Se ejecutaron dos comparaciones en Windows con archivos idénticos para ambos motores. Se usó Tiny Q5_1 y Silero para whisper.cpp. En OpenJarvis se usó Faster-Whisper Tiny INT8 con idioma fijado y la revisión `d90ca5fe260221311c53c58e660288d3deb8d356` del [modelo MIT de Systran](https://huggingface.co/Systran/faster-whisper-tiny/tree/d90ca5fe260221311c53c58e660288d3deb8d356). El SHA-256 de `model.bin` fue `dcb76c6586fc06cbdac6dd21f14cfd129cc4cdd9dce19bf4ffa62e59cbe6e6d1`.

| WAV | Motor | Tiempo | CPU | Pico de RAM | Errores / palabras de referencia |
| --- | --- | ---: | ---: | ---: | ---: |
| «Abre Codex», sintético ES | whisper.cpp | 14,11 s | 8,94 s | 153 MiB | 3/2 |
| «Abre Codex», sintético ES | OpenJarvis | 12,54 s | 6,58 s | 217 MiB | 3/2 |
| JFK, humano público EN | whisper.cpp | 5,08 s | 9,95 s | 156 MiB | 0/22 |
| JFK, humano público EN | OpenJarvis | 4,28 s | 4,44 s | 223 MiB | 0/22 |

Una ejecución por motor y WAV. Son procesos nuevos y la caché del sistema y su carga no se controlaron. Se incluyen inserciones y sustituciones en los errores. El ejemplo humano fue [el WAV de JFK del repositorio de whisper.cpp](https://github.com/ggml-org/whisper.cpp/blob/d1be6fde11ac6e0407606b4e42fe72d34add8037/samples/jfk.wav), SHA-256 `59dfb9a4acb36fe2a2affc14bacbee2920ff435cb13cc314a08c13f66ba7860e`. La primera ejecución inglesa se detuvo por RAM disponible inferior al mínimo y se repitió sólo el WAV humano cuando recuperó margen. No se capturó audio del usuario. El mayor uso de RAM y el empate de errores no justifican cambiar el STT instalado. Aún faltan voz humana ES dominicana, TTS de OpenJarvis, corte audible y aceptación conjunta.
