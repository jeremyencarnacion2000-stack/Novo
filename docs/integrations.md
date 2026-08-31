# Novo: integraciones y contexto de dispositivos

Esta guía explica qué puede aprender Novo hoy, cómo conectar cada fuente y cómo
el Twin convierte observaciones recientes en recomendaciones. El sistema sigue el
principio de **mínimo privilegio**: cada conexión es opcional, queda ligada a la
cuenta que la autorizó y se representa como una señal agregada, no como una copia
de contenido privado.

## Fuentes disponibles hoy

| Fuente | Contexto en segundo plano | Qué conserva el Twin | Cómo conectar |
| --- | --- | --- | --- |
| Google / Gmail | contador de no leídos; encabezados solo cuando preguntas por correo | presión de bandeja y una lista de encabezados limitada a esa petición | Ajustes → Conectores → Google → Gmail |
| Google Calendar | eventos de hoy y densidad de agenda | bloques de tiempo, densidad y patrones horarios | Ajustes → Conectores → Google → Calendar |
| Todoist | proyectos seleccionados, tareas activas y completadas recientes | presión de tareas, vencimientos y ventanas de finalización | Ajustes → Conectores → Todoist |
| Notion | bases y páginas seleccionadas | totales de tareas pendientes/vencidas y ventanas de edición | Ajustes → Conectores → Notion |
| Slack | actividad propia en canales seleccionados | volumen, actividad fuera de horario e indicadores de carga | Ajustes → Conectores → Slack |
| GitHub | hasta cinco repositorios autorizados con actividad reciente | horario de commits y carga sostenida; nunca código fuente | Ajustes → Conectores → GitHub |
| Novo | sesiones enfocadas y visibles dentro de la app | duración de presencia y sesiones largas | automático mientras usas Novo |

Spotify, Apple Music y Drive siguen siendo integraciones útiles para medios y
archivos. Una cuenta conectada por sí sola no se trata como evidencia cognitiva:
solo entra al planificador cuando produce una señal de fuente explícita.

## El ciclo de aprendizaje activo

1. Conecta el proveedor desde su página OAuth oficial. Novo guarda la identidad de
   la cuenta y un token protegido; el navegador nunca envía ese token al modelo.
2. Una sincronización acotada lee únicamente el alcance autorizado. Cada proveedor
   emite una observación estable y reemplazable en el Signal Ledger de Novo.
3. Las observaciones de menos de 24 horas se marcan como **frescas**. El
   planificador puede usarlas como evidencia; las obsoletas o excluidas no generan
   una recomendación nueva.
4. El runtime cognitivo combina esa evidencia con objetivos, tareas, estado y
   resultados previos. Persiste la recomendación y sus hechos para que el camino de
   «por qué» sea inspeccionable en Cognitive y Chat.
5. La siguiente sincronización observa qué cambió. Las correcciones y resultados
   aceptados alimentan el plan siguiente; el Twin no sobreescribe una corrección
   del usuario en silencio.

El botón **Sincronizar todo** ejecuta este mismo camino server-side de inmediato.
El worker ambiental puede refrescar fuentes autorizadas periódicamente cuando la
función está habilitada. Si un proveedor requiere volver a autorizarse, Novo falla
de forma segura y conserva el último estado conocido, sin inventar completados ni
recomendaciones.

## Conectar la computadora o un dispositivo

### Disponible hoy: presencia de Novo

No hace falta instalar nada para la primera señal de dispositivo. Mientras estás
autenticado y la pestaña de Novo está visible y enfocada, se registra una sesión de
presencia. Una gracia de dos minutos evita fragmentarla al cambiar rápidamente de
pestaña y las sesiones de menos de 30 segundos se descartan.

Solo se guardan las marcas de inicio y fin. Novo **no** captura pantalla, teclas,
micrófono, archivos, aplicaciones instaladas, ubicación ni otras pestañas. Al
terminar la sesión, el navegador envía un evento autenticado y ligado al propietario
a `/api/device/presence`; el Cognitive Engine puede derivar una señal de sesión
larga. El aprendizaje se puede pausar desde Ajustes.

### Puente nativo de escritorio (ruta preparada, no activada por defecto)

Para conocer contexto del sistema operativo (aplicación activa, archivos locales o
notificaciones) hace falta un companion instalado por separado. El conector debe ser
local-first y explícito:

1. Instala el companion de Novo firmado para tu sistema operativo.
2. En Novo abre Ajustes → Conectores → **Tu computadora** y pulsa **Añadir dispositivo**.
3. Escanea el código de emparejamiento de un solo uso o pégalo en el companion. Es
   de corta duración y no puede autorizar otra cuenta.
4. Selecciona capacidades individuales, por ejemplo «nombres de aplicaciones
   activas» o una carpeta de proyecto. Todo lo demás queda desactivado.
5. Confirma la vista previa de tipos de datos, retención y frecuencia de sync. El
   Twin recibe eventos agregados; los archivos y el audio permanecen locales salvo
   que un futuro conector solicite un elemento concreto.
6. Revoca el dispositivo desde el mismo panel. La revocación invalida su clave,
   detiene la ingesta y permite eliminar eventos en cola.

Este puente nativo no se habilita silenciosamente desde la web. El repositorio ya
expone la primitiva segura de presencia y el pipeline de señales compartido para
que un companion de escritorio/móvil pueda usar las mismas reglas de ownership,
frescura y corrección cuando se publique.

## Configuración del despliegue (administradores)

GitHub requiere una OAuth App en GitHub Developer Settings y estas variables en el
entorno de Vercel (sin compartir sus valores en el cliente):

```text
GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET
GITHUB_REDIRECT_URI=https://tu-dominio.example/api/integration/github/callback
```

La URL de callback debe coincidir exactamente con la registrada en GitHub. Tras
actualizar variables, crea un nuevo deployment y prueba conectar/desconectar desde
una cuenta de QA. Gmail, Calendar, Todoist, Notion y Slack siguen sus propios
clientes OAuth y scopes documentados en sus consolas.

## Primer setup recomendado

1. Conecta Calendar y Todoist (o Notion) para compromisos y trabajo en curso.
2. Añade Gmail con solo lectura si la presión de bandeja afecta tus decisiones.
3. Conecta GitHub y conserva únicamente los repositorios que representan tu
   trabajo actual.
4. Conecta Slack cuando la actividad fuera de horario sea una señal útil de carga.
5. Pulsa **Sincronizar todo** y abre Cognitive → Fuentes para confirmar la frescura.
6. Pide a Novo el siguiente paso. La respuesta debe citar las fuentes que realmente
   aportaron contexto; una conexión sin señal no se presenta como evidencia.

## Privacidad y controles

- OAuth ocurre en la página oficial del proveedor; Novo nunca pide tu contraseña.
- El servidor verifica ownership en cada cuenta, señal y evento de dispositivo.
- Las observaciones de fondo son agregadas y acotadas. No se guardan cuerpos de
  correo, mensajes de commit ni código fuente como evidencia cognitiva.
- Puedes excluir una fuente, pausar el aprendizaje, desconectarla o revocar un
  cliente MCP desde Ajustes.
- Si una fuente está obsoleta, revocada o no disponible, el planificador muestra la
  brecha y continúa con contexto propio de Novo en vez de adivinar.

## Referencias y decisiones de diseño

La dirección del puente sigue patrones de productos agent-native como
[Happycapy Connectors](https://www.producthunt.com/p/happycapy/introducing-happycapy-connectors-your-ai-finally-has-a-place-to-work),
que separan los permisos de app, correo y computadora. El modelo de captura
multidispositivo también toma como referencia el flujo de escritorio y wearable de
[Limitless](https://help.limitless.ai/en/articles/10546658-interacting-with-the-pendant-search-ask-ai-summaries),
donde la información se sincroniza con una cuenta del usuario antes de estar
disponible en otros dispositivos. Novo comienza deliberadamente con señales de
presencia de menor riesgo y exige un puente nativo con permisos por capacidad para
el contexto más profundo del sistema operativo.
