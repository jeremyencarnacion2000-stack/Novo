# Novo: seguimiento activo, ejecución y memoria continua

Estado: diseño aprobado por el usuario; implementación pendiente.
Fecha: 12 de octubre de 2026.

## Intención del usuario

Novo debe seguir de cerca los proyectos y tareas importantes, automatizar y
realizar trabajo clave, actualizar el Twin y conservar contexto actualizado para
evitar que el usuario tenga que repetir información. La misma experiencia debe
funcionar en la web, el compañero y otros dispositivos, con la identidad de Novo.
Las integraciones de servicios y agentes de Coucou son una base aprovechable.

El resultado esperado es una tarea resuelta con evidencia, estado actualizado y
memoria disponible en la siguiente conversación, incluso desde otra superficie.

## Qué existe y qué falta

Esta revisión describe el código; no demuestra que todas las conexiones estén
activadas en la cuenta del usuario.

- Companion 0.2.7 ya observa sesiones de agentes y consulta carpetas elegidas,
  GitHub y Vercel. Sus integraciones locales también consultan Stripe, n8n,
  Resend, Notion y Cal.com cuando están configuradas.
- `project-links.ts` relaciona fuentes por repositorio o identificador de Vercel;
  las coincidencias de nombre son probables. El contexto de consultas no persiste
  esas relaciones como una memoria estable de proyecto.
- Existe una cuenta compartida, registro/revocación de dispositivos Windows y
  sincronización de actividad. El contexto de trabajo sincronizado es una nota
  breve del usuario con caducidad de cuatro horas, no una memoria completa.
- El refresco ambiental ya combina fuentes autorizadas y actualiza observaciones
  del Twin. Debe ampliarse y comprobarse para cubrir el trabajo local y los
  resultados de ejecuciones; no se parte de un Twin sin ningún refresco.
  La configuración de Vercel programa ese refresco una vez al día; los 15 minutos
  actuales corresponden al refresco interactivo. No cumple aún el seguimiento
  periódico propuesto con la web cerrada.
- Los hooks de agentes aportan observación y algunas respuestas a permisos. No
  constituyen por sí solos un mecanismo general para delegar y seguir trabajos.
- Hay ejecutores de acciones de Novo y un camino confirmado para Calendar.
  `runTwinAgent` mantiene desactivadas las capacidades antiguas, y la superficie
  de agent-actions está en modo de propuestas.
- `AiActivityRun` sirve al seguimiento de chat, pero sus registros actuales
  caducan a los 30 minutos. No debe emplearse sin cambios como cola duradera.
- Coucou Windows/Linux 0.4.0 incorpora enlace Android por red local. Su enlace
  iPhone depende de Mac/iCloud. No se debe presentar esa disponibilidad como una
  función ya integrada en Novo.

Referencias: `lib/ai/project-query-context.ts`, `lib/ai/project-links.ts`,
`lib/ai/activity.ts`, `lib/cognitive/ambient-context-refresh.ts`,
`lib/cognitive/ambient-twin-runtime.ts`, `lib/cognitive/twin-agent.ts`,
`lib/companion/devices.ts`, `lib/companion/work-context.ts`,
`companion/windows/src-tauri/src/{agents,integrations,query_context}.rs` y
[Coucou oficial](https://github.com/Louis-CFM/coucou).

## Diseño propuesto

### 1. Una memoria de proyecto compartida

Cada proyecto de Novo conserva sus vínculos con repositorios, despliegues,
carpetas autorizadas y sesiones de agentes. Varias carpetas/worktrees o ramas
pueden pertenecer al mismo proyecto; se conserva la identidad de cada workspace.
Las rutas completas y credenciales permanecen en el dispositivo.

Novo guarda hechos con fuente, fecha, versión y estado de verificación: trabajo
pendiente, bloqueos, próxima acción, última ejecución y resultado. Una coincidencia
de identificadores puede vincular fuentes; nombres parecidos generan una propuesta
de vinculación. Una corrección del usuario prevalece sobre inferencias posteriores.

El contexto necesario se recupera antes de responder. Una conversación nueva no
reinicia esa memoria. Información vieja sigue disponible como historial, pero no
se afirma como estado actual. Si falta una fuente, Novo indica qué pudo comprobar.

### 2. Seguimiento continuo de lo importante

Decisión propuesta: empezar por proyectos/tareas activos de prioridad alta y por
los que el usuario añada explícitamente al seguimiento. Mostrar esta selección y
permitir cambiarla en Configuración. Los vencimientos ordenan la atención dentro
de ese conjunto; no convierten toda la cuenta en tareas de ejecución automática.

Los cambios de tareas, sesiones de agentes, commits, PR y despliegues actualizan
el estado y los bloqueos. Usar eventos cuando exista transporte fiable y un
refresco periódico para reconciliar eventos perdidos.

Decisión propuesta: refresco remoto cada 15 minutos, respetando límites del
proveedor; cambios locales con agrupación de eventos y reconciliación al
reconectar. Al preguntar por un estado operativo, refrescar la evidencia que lo
sustenta si es antigua. La lectura sigue los permisos existentes de cada fuente.
El plan debe comprobar primero que el worker/scheduler existente puede sostener
esta cadencia en segundo plano, incluidos sus límites y autenticación. Reutilizar
Inngest si su despliegue lo permite; no introducir una compra ni depender de una
pestaña abierta para cumplir el seguimiento remoto. Una limitación de despliegue
se presenta como bloqueo de activación, no como seguimiento ya operativo.

Avisar cuando aparece un bloqueo relevante, se acerca un vencimiento, se termina
una tarea o hace falta una decisión. No repetir el mismo aviso sin un cambio.
Pausar seguimiento, excluir fuentes y revocar permisos desde la configuración única.

### 3. Trabajo delegado con un resultado verificable

Cada capacidad declara qué puede consultar o modificar, sus permisos, qué
dispositivo/proveedor la ejecuta y cómo se verifica el resultado. El planificador
elige entre capacidades registradas; texto de documentos, servicios o modelos
no se convierte en comandos sin validación del servidor y del ejecutor local.

La unidad de trabajo persiste objetivo, proyecto, autorización, pasos, ejecutor,
estado, resultado y evidencia. Estados mínimos: pendiente, en curso, esperando
confirmación, esperando dispositivo, completada, fallida, cancelada e incierta.
Cada intento tiene una identidad estable para impedir duplicados y seguirlo desde
varias pantallas. Una operación incierta se reconcilia antes de volver a enviarse.

Decisión propuesta para concretar la automatización solicitada: la delegación
puede ser persistente, por ejemplo «mantén este proyecto al día». Al activarla, el
usuario elige proyecto, capacidades y resultado permitido. Los cambios nuevos
que cumplan esa regla pueden iniciar trabajo sin una petición nueva. Seguir un
proyecto o conectar una fuente por sí solos no activan esta delegación.

La regla permanece vigente hasta pausarla o revocarla. Guardar su versión con
cada trabajo y volver a comprobarla antes de cada paso. Disparadores iniciales:
un fallo nuevo de CI/despliegue, un bloqueo detectado de una tarea seguida o una
petición explícita. Solo disparan capacidades incluidas en la regla; una propuesta
inferida no amplía su alcance. Agrupar el mismo problema por proyecto, fuente y
versión de evidencia. Decisión propuesta: una ejecución activa por proyecto y
hasta tres ejecuciones automáticas al día; límites configurables, con pausa y
explicación al alcanzarlos. Un fallo idéntico sin evidencia nueva no genera un
bucle de trabajos. Las confirmaciones externas descritas abajo siguen aplicando.

Decisión propuesta para la primera entrega:

- Lecturas autorizadas, seguimiento y actualización de memoria factual: automáticos.
- Crear/actualizar el resumen de seguimiento, bloqueos y próximas acciones de Novo:
  automático; se distinguen de cambios manuales del usuario.
- Modificar prioridades, fechas, estados o contenidos de tareas del usuario:
  requiere delegación explícita que delimite el proyecto y la operación.
- Una petición explícita puede autorizar una ejecución concreta. Las acciones
  externas conservan la confirmación explícita, registro e idempotencia exigidos
  por el repositorio; una preferencia de aprendizaje no concede ese permiso.
- Crear borradores y preparar cambios entra en una delegación acotada. Enviar,
  publicar, fusionar, desplegar, borrar o efectuar pagos usa una decisión explícita
  sobre el resultado concreto. No repetir una aprobación que sigue siendo válida
  para los mismos argumentos y alcance.

El resumen final muestra qué se hizo, dónde está el resultado y qué se comprobó.
"Completada" exige la comprobación correspondiente; un agente que dice haber
terminado no basta para marcar el objetivo resuelto.

### 4. Agentes y servicios que colaboran con Novo

Decisión propuesta: integrar primero el control de trabajo de Codex y después
Claude Code, conservando la observación de los demás agentes. Verificar durante
el plan los transportes oficialmente soportados de iniciar/continuar/cancelar,
sus versiones y el acceso disponible en el PC. Una capacidad sin transporte
soportado se muestra como no disponible, no se simula.

Novo entrega objetivo, proyecto/workspace y contexto seleccionado a una sesión
identificada; recibe pasos, preguntas, cambios y resultado. Las sesiones creadas
por Novo son propias de la delegación. Reutilizar una sesión del usuario exige
que este seleccione esa sesión y autorice su continuidad.

Las suscripciones se representan con el agente/cuenta realmente conectado y sus
límites disponibles. Cada capacidad distingue autenticación de sesión, API o
modelo local. Una medición de cuota no demuestra permiso para ejecutar, y no se
promete que una suscripción cubra llamadas de API. No introducir nuevas claves,
proveedores de pago ni compras sin una necesidad concreta y autorización.

La primera capacidad de ejecución debe cerrar un ciclo real: diagnóstico de un
proyecto, preparación de una corrección en un workspace aislado, comprobaciones y
presentación del cambio. La publicación es un paso separado y confirmado. Los
servicios existentes se incorporan progresivamente cuando aporten una acción útil
al seguimiento, con sus contratos y comprobaciones de resultado.

### 5. Continuidad entre dispositivos

Decisión propuesta: usar la cuenta de Novo y su web móvil como primera superficie
remota, junto al Companion Windows actual. El usuario ve las mismas tareas,
resultados, confirmaciones y memoria desde cualquier sesión autorizada.

Las acciones locales se asignan al PC que dispone del workspace y la capacidad.
Si está apagado o desconectado, quedan esperando dispositivo. Al volver, el PC
verifica vigencia y autorización y reclama un trabajo de forma exclusiva antes
de ejecutarlo. Revocación o cancelación impide empezar nuevos pasos. Una acción
externa ya enviada se reconcilia: cancelar la interfaz no equivale a deshacerla.

La extensión posterior a aplicaciones nativas de teléfono puede aprovechar el
enlace de Coucou. No crear en esta primera entrega un segundo sistema de cuentas,
emparejamiento o configuración paralelo al de Novo.

### 6. El Twin se actualiza como parte del ciclo

Observación nueva → estado reconciliado del proyecto → trabajo o propuesta →
resultado verificado → memoria y Twin actualizados → siguiente respuesta.

Separar hechos observados, inferencias y preferencias del usuario. Guardar los
resultados esenciales y las decisiones mientras el proyecto exista; no hacerlos
depender de la caducidad del chat o de una nota de cuatro horas. Permitir corregir
y borrar memoria. Decisión propuesta: registros operativos detallados durante 30
días; estados esenciales y memoria de proyecto hasta su archivo o eliminación,
sin impedir los controles de borrado del usuario.

No inferir condiciones de salud ni introducir nuevas capturas de pantalla,
teclas, audio, correo o archivos sin el permiso correspondiente. El aprendizaje
usa evidencia autorizada y los resultados del trabajo delegado.

## Experiencia y orden de entrega

Usar Configuración para fuentes, dispositivos, autonomía y seguimiento. Chat,
Hub y compañero muestran una tarjeta breve por trabajo: estado, próximo paso,
resultado o decisión requerida. Los detalles y el historial quedan a un clic.
Conservar los adjuntos y la conversación actual, y la identidad visual de Novo.

1. Memoria persistente de proyectos y seguimiento reconciliado; integrar contexto
   local con el refresco ambiental existente y actualizar el Twin.
2. Trabajo duradero, permisos y un ciclo de ejecución Codex comprobado; después,
   adaptar Claude Code y acciones útiles de servicios.
3. Continuidad y decisiones desde la web móvil con el mismo trabajo en el PC.
   Las aplicaciones móviles nativas y más proveedores quedan para ampliaciones.

Estas son partes del proyecto propuesto; la primera entrega de memoria no basta
para afirmar que la ejecución y la continuidad remota están terminadas.

## Comprobaciones de aceptación

- Un proyecto local, GitHub y Vercel conserva su identidad al cambiar de chat o
  dispositivo; coincidencias ambiguas no fusionan proyectos.
- Un cambio relevante entra en el seguimiento y el Twin sin que el usuario lo
  tenga que volver a explicar. Una corrección manual se mantiene.
- "Qué falta" responde con trabajo pendiente, bloqueos, fuentes y frescura; no
  exige información ya disponible ni presenta datos obsoletos como recientes.
- Un trabajo delegado produce un cambio revisable y comprobado, conserva su
  resultado y evita ejecutarse dos veces tras perder la conexión.
- Una delegación persistente inicia un trabajo permitido ante un bloqueo nuevo,
  respeta sus límites y deja de iniciar pasos al pausarla o revocarla.
- La publicación espera su confirmación concreta; las lecturas y la memoria
  autorizadas continúan sin confirmaciones repetidas.
- El móvil ve el estado real del PC y puede responder a una decisión de ese
  trabajo. Un PC desconectado no produce falsos resultados completados.
- Una revocación, fallo de proveedor o falta de permisos detiene la capacidad
  afectada y conserva una explicación breve y recuperable.
- La memoria importante sobrevive más de 30 minutos/cuatro horas, sigue limitada
  al propietario y se puede corregir/eliminar.

## Decisiones que quedan al constructor

Reutilizar los modelos de señales, proyectos, ejecuciones externas y actividad
cuando sus contratos lo permitan. Elegir en el plan las extensiones mínimas de
cola duradera, vínculos de proyecto y memoria; los cambios Prisma serán aditivos.
No rehabilitar las capacidades antiguas del Twin en bloque. No prometer API,
permisos o funciones móviles que todavía no estén implementados y comprobados.
Verificar el scheduler desplegado, compatibilidad de agentes, controles de cuotas,
límites de consulta y reconciliación antes de activar un seguimiento real.
