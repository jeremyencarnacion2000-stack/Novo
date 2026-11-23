# OpenJarvis en Novo

El primer flujo integrado es la **continuación de un proyecto desde el chat de Companion**. El Companion ejecuta y verifica la apertura de Windows con sus permisos habituales. La API de Novo autentica al dispositivo, recupera la evidencia autorizada por cuenta y proyecto, y delega la respuesta de lectura al agente de OpenJarvis. Su cliente MCP consulta una única instantánea privada del turno. El agente recibe identidades, tareas confirmadas y fuentes que fallaron. Novo conserva los permisos, la memoria, la interfaz, el historial y la reproducción.

## Arranque local

Clona OpenJarvis fuera de Novo y fija el commit `484de900c7238442d4e049e185de6af679519192`. El servicio comprueba el commit y que el árbol de código upstream esté limpio. El código upstream está bajo [Apache 2.0](https://github.com/open-jarvis/OpenJarvis/blob/484de900c7238442d4e049e185de6af679519192/LICENSE). Los motores y pesos opcionales conservan sus propias licencias. El [manifiesto upstream](https://github.com/open-jarvis/OpenJarvis/blob/484de900c7238442d4e049e185de6af679519192/pyproject.toml) admite Python 3.11 a 3.13. Para este servicio se verificó Python 3.12 con las dependencias de `requirements.txt` en un entorno aparte. La app de escritorio, los modelos y el servidor general de OpenJarvis no se requieren.

1. Crea un entorno virtual Python separado e instala `services/openjarvis/requirements.txt` en él.
2. En el entorno del servicio, configura `NOVO_OPENJARVIS_CHECKOUT` con el directorio upstream. Configura `NOVO_OPENJARVIS_MODEL` y `NOVO_OPENJARVIS_ENGINE`. Con `groq` proporciona únicamente `GROQ_API_KEY` para el servicio. Con `ollama` se usa el servidor compatible local de `127.0.0.1:11434` y un modelo ya instalado. El proceso no aprovisiona ni arranca modelos.
3. Genera una credencial aleatoria y configura `NOVO_OPENJARVIS_TOKEN` con el mismo valor en el servicio y el servidor Novo. Arranca el proceso con `python -I -B services/openjarvis/runtime.py`. Escucha en `127.0.0.1:8764` de forma predeterminada.
4. En el servidor Novo del mismo host, configura `NOVO_OPENJARVIS_URL=http://127.0.0.1:8764` y el mismo `NOVO_OPENJARVIS_MODEL`. Las continuaciones de proyecto con modelo automático o el modelo configurado usan OpenJarvis como primera opción. Eliminar `NOVO_OPENJARVIS_URL` y reiniciar el servidor revierte al proveedor existente.
5. Para repetir el ensayo real con datos ficticios, configura `NOVO_OPENJARVIS_PYTHON` con el ejecutable del entorno aislado y ejecuta `node services/openjarvis/smoke.mjs` con los valores del paso 2. El ensayo crea su propia credencial y detiene su proceso al salir.

El puente exige una credencial de servicio, usa una dirección fija local y limita tamaño, modelo y tiempo. MCP reside dentro del proceso y sólo expone la instantánea. El registro conserva métricas de tiempo, memoria del proceso y tokens reportados por el proveedor. El servidor separa este proceso de la configuración que contiene credenciales del Twin y de sus conectores. La cancelación del chat descarta la respuesta y cancela la conexión a Novo. Una llamada de inferencia ya aceptada puede acabar dentro de su plazo aunque el cliente se haya desconectado.

## Alcance de la prueba

El endpoint autenticado existente del Companion es compatible con el cliente 0.2.17. Esta prueba usa un host compartido con Novo y el motor de texto. El proceso de voz requiere sus extras específicos y su propia validación de hardware. El lector de Windows y el dictado manual siguen en uso. Los agentes con cambios externos, herramientas de navegador, la superficie web, la escucha permanente y una topología remota autenticada requieren integración y pruebas adicionales.
