# Novo Companion para Windows

Versión preparada: **0.2.14**.

[Descargar el instalador](https://github.com/jeremyencarnacion2000-stack/Novo/releases/download/companion-v0.2.14/Novo-Companion-Windows-0.2.14-setup.exe) · [Alternativa MSI](https://github.com/jeremyencarnacion2000-stack/Novo/releases/download/companion-v0.2.14/Novo-Companion-Windows-0.2.14.msi)

## Novedades de 0.2.14

- Consulta tus tareas y el estado disponible del Twin desde el chat. Crear una tarea prepara una propuesta: sólo se guarda después de aprobarla visualmente en el Companion.
- Controla las apps elegidas en Configuración → Asistente: abrir, enfocar, minimizar, maximizar y restaurar. Vuelve a conectar la cuenta para autorizar los nuevos permisos; las rutas y títulos de ventanas permanecen en el PC.
- Lee y detén respuestas de Novo y Codex con voces Microsoft de Windows. La lectura automática se activa de forma opcional en Asistente → Voz y privacidad; abrir el historial permanece en silencio.
- La selección automática busca una voz local española. Si falta, instala una desde Configuración de Windows → Hora e idioma → Voz, o elige otra voz disponible. El instalador no incluye ni distribuye paquetes de voz de Microsoft.
- Cambiar cuenta o conversación, iniciar dictado, salir del chat o bloquear Windows detiene la lectura. Las confirmaciones de escritura continúan siendo visuales.
- El dictado sigue siendo manual y revisable, con permiso independiente para el servicio que procesa audio. Activación «Novo» y reconocimiento local Whisper/Silero siguen pendientes de implementación y medición física.

## Novedades de 0.2.13

- Permite elegir Cuenta Novo o ChatGPT / Codex como fuente de respuesta en la configuración del chat activo.
- Codex usa la sesión local del plan ChatGPT, con historial temporal separado y cancelación al cambiar de fuente. Requiere un Codex CLI compatible y una sesión válida; no transfiere automáticamente el historial ni los archivos de la cuenta Novo.
- Comprueba el tipo de cuenta mediante el protocolo de Codex y conserva el aislamiento del proceso y los límites de respuesta.
- Corrige el formato de los permisos que rechazaba Codex CLI. El chat del plan responde sin cargar instrucciones de proyectos ni habilitar herramientas locales; no requiere lectura general del disco. Las acciones del Twin siguen en Cuenta Novo y el trabajo de código conserva sus comprobaciones de aislamiento.
- Aísla los procesos de Codex de las herramientas, conexiones y secretos del proceso que los abre, conservando el login local protegido.
- Incluye las correcciones de protocolo verificadas en Windows y mantiene los hooks, preferencias, carpetas autorizadas y cuenta existentes.

## Novedades de 0.2.10

- Unifica la cuenta, el asistente, las conexiones, las carpetas autorizadas y la actividad delegada bajo la identidad de Novo.
- Comparte el mismo estado de seguimiento entre el Companion, el chat y la actividad web. Los trabajos distinguen seguimiento de permiso de ejecución, muestran los resultados y requieren aprobación para guardar cambios internos.
- Presenta los archivos y comprobaciones de una propuesta con su referencia local. El parche permanece en el PC autorizado y los archivos originales no se modifican.
- Añade dictado de voz de activación manual al chat abierto del Companion: revisas el texto antes de enviarlo y no se crea una conversación nueva.
- Sincroniza con el Twin solo un resumen breve y depurado de la tarea y el resultado de Codex; no envía historial completo, rutas, código ni salidas de herramientas.

## Conectar

Abre el compañero y entra en Configuración → Cuenta. Conecta tu cuenta de Novo mediante el navegador o un token con acceso al compañero y al chat. Los tokens antiguos necesitan reautorizar los permisos nuevos para consultar proyectos.

La configuración única reúne Cuenta y privacidad, Asistente, Conexiones y Escritorio. Las carpetas se eligen en Asistente; las consultas leen solo las fuentes autorizadas. Los proyectos locales, GitHub y Vercel se relacionan por identificadores verificables; el nombre por sí solo es una coincidencia probable. La captura de actividad es opcional.

## Desarrollo

Requisitos: Node.js, Rust, herramientas de compilación de Windows y WebView2. Ejecuta desde esta carpeta:

```powershell
npm ci
npm run build
npm test
npm run pack
```

Los instaladores se generan en `release/`. No se guardan en Git: se publican como archivos de GitHub Releases. Credenciales, preferencias, carpetas personales y archivos compilados quedan fuera del repositorio.

## Estado de las comprobaciones

El seguimiento actualiza Twin y el contexto del proyecto desde fuentes autorizadas y resultados verificados. No lee el historial completo de Codex. La actualización en segundo plano requiere configurar el secreto `NOVO_PROJECT_REFRESH_SECRET` en GitHub Actions para que el flujo llame al endpoint protegido de Vercel.

Para compartir contexto de Codex, confía sus hooks desde Codex con `/hooks` y empieza una sesión nueva. El Companion conserva solo el nombre breve del proyecto y el resumen depurado de la tarea/resultado; la lectura completa del historial sigue pendiente.

## Licencias

Derivado de [Coucou](https://github.com/Louis-CFM/coucou), revisión `a7bd575e90253673e7e08370a78f1261eb53ac2f`, bajo licencia MIT. Se conserva el nombre del relé `coucou-hook.exe` por compatibilidad. Consulta `THIRD-PARTY-LICENSE.txt` para los avisos completos y la licencia de Manrope.
