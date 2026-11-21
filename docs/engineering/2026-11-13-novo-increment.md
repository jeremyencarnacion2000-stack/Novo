# Novo Companion y contexto de proyectos

Mediciones del 13 de noviembre de 2026; revisión y regresiones adicionales del 21 de noviembre. PR #41, código de las correcciones `2ff0acd`. La instalación continúa en 0.2.17 `3ad0d09`.

## Escritorio y ClickHome

La candidata instalada aborta la enumeración de AppsFolder a los 8 s. Tres ejecuciones independientes del mismo script encontraron Codex a 13 331, 11 109 y 10 106 ms. Al imponer 8 s, la operación agotó el plazo. Con carga concurrente, otra ejecución también lo agotó a 20 s. El intento previo de la interfaz agrupó los errores y no permite atribuirle retrospectivamente una causa exacta.

Para una orden que nombra Codex, el PR consulta directamente su registro de aplicación empaquetada. La consulta devolvió el identificador exacto en tres ejecuciones de 6 364, 7 296 y 5 688 ms. El catálogo general conserva el límite de 20 s para las demás apps. Una sonda Rust que ejecutó el código nativo de enumeración y apertura encontró una ventana de Codex, no leyó su título y obtuvo el recibo `focused`. La sonda aisló la capa Windows y no pasó por la autorización de cuenta ni por la interfaz instalada. La negativa de enfoque con ventana aún visible se reprodujo en la regresión y conserva un recibo `already_open` con enfoque sin confirmar. Catálogo, permisos, inicio, ventana no observada y consulta posterior quedan diferenciados.

La inspección de ajustes encontró una carpeta existente llamada ClickHome entre las tres seleccionadas. Una sonda que ejecutó el buscador Rust sobre esa carpeta recuperó una identidad exacta, un identificador de Vercel y 12 archivos con fragmentos. No imprimió ni envió fragmentos. Una lectura de la base configurada, acotada al propietario, no encontró un proyecto Novo con el título exacto ni memoria activa con ese nombre o repositorio terminado en ClickHome. El plan de la cuenta admite Twin, sin comprobar en este turno el alcance del dispositivo. La carpeta aporta contexto y no acredita una tarea confirmada. Los cambios consultan tareas asociadas a un proyecto Novo inequívoco y autorizado, aplican las exclusiones antes de consultar, preservan la procedencia y marcan el límite de resultados. La prueba previa del lector de 0.2.17 se conserva. La apertura, la recuperación Twin y el audio todavía no se han observado juntos en un turno de la candidata instalada.

## Presupuesto contextual en sombra

`NOVO_PROJECT_CONTEXT_SHADOW=1` compara secciones ya recuperadas en consultas de tareas de un proyecto identificado en Companion, sin adjuntos, búsqueda web ni Twin activo. Conserva sin recortar la evidencia de proyecto y carpetas, la procedencia y los estados de recuperación. Si la alternativa supera 12 000 bytes UTF-8 o no reduce la entrada, conserva el contexto original para el cálculo. El proveedor, la respuesta, el prompt enviado y las fuentes visibles siguen el camino habitual. El experimento no hace consultas adicionales en el flujo de chat y sólo registra tamaños, tiempo, conteos y nombres fijos de secciones. La bandera está apagada.

Se usó la misma función fuera de la aplicación para dos variantes de cuatro casos inventados con `openai/gpt-oss-20b` en el servicio configurado, temperatura 0, razonamiento `low` y máximo de 550 tokens de salida. El proveedor devolvió los tokens reales. Dos solicitudes iniciales dieron 429 y se repitió ese par después. El tiempo es de solicitud completa, incluye red y una primera ejecución de 3,8 s, y no sirve para atribuir una mejora causal. No se midió la factura ni se realizó una comparación con datos privados de ClickHome o con el prompt completo del chat.

| Métrica | Completo | Presupuesto |
| --- | ---: | ---: |
| Tokens de entrada acumulados | 8 784 | 1 128 |
| Tokens de salida acumulados | 323 | 269 |
| Mediana por solicitud | 539,5 ms | 455,5 ms |
| Tarea confirmada y su fuente conservadas | 2/2 | 2/2 |
| Respuestas que nombraron Vercel como no disponible | 1/4 | 0/4 |
| Respuestas en inglés a solicitudes en inglés | 0/2 | 0/2 |

La reducción de entrada fue 87,2% en esta muestra. La variante acotada perdió una mención explícita a Vercel pese a conservar el dato de origen en el prompt. Las dos variantes respondieron en español a los casos ingleses; el contexto común conservaba `preferences.language: es`, lo que limita esa comparación de idioma. Mantener apagado el selector. El próximo ensayo debería puntuar idioma, tarea, fuente y distinción entre «sin tareas» y «fuente no consultable» antes de elegir qué contexto enviar. [Configuración, entradas y resultados por caso](2026-11-13-novo-increment-metrics.json). El límite de 12 000 bytes protege la comparación; no es un límite estricto de tokens del prompt completo.

## Voz

Detener manualmente ahora llama a `waveInStop` y drena en orden los bloques completos y el último parcial, sin reencolarlos y sin superar el límite de PCM. La revisión del 21 de noviembre detectó que los encabezados detenidos conservan la marca DONE: recorrer el anillo sin un límite de bloques podía copiar la misma cola repetidamente hasta completar los 20 segundos permitidos. La regresión reprodujo 320 000 muestras en lugar de 1 604; se limita el drenado a una sola vuelta. La prueba también conserva el último bloque parcial y respeta el máximo de muestras. Cancelar sigue descartando el audio.

Se mantuvo Whisper, el borrador con Enviar, el respaldo conectado desactivado y la escucha permanente apagada. El usuario eligió seguir sin grabaciones nuevas. Los WAV del ensayo anterior ya se habían borrado. Por tanto, sigue pendiente medir el cambio con voz humana y repetir Whisper/Vosk sobre tomas idénticas. La regresión de buffers no acredita una mejora de precisión ni explica por sí sola los rechazos de una toma finalizada por silencio. [Comparación humana previa](2026-11-13-voice-diagnostics.md).

## Verificación del 21 de noviembre

Una consulta con permiso de proyectos pero sin permiso de tareas podía registrar una observación vacía y sustituir tareas previamente conocidas por la memoria. Se reprodujo la escritura con una regresión y se evita guardar esa observación incompleta. No se cambian los permisos de lectura ni se borran datos existentes. Las 51 pruebas dirigidas de chat, contexto, permisos y memoria pasan.

La [revisión de servidor de `dab3d44`](https://github.com/jeremyencarnacion2000-stack/Novo/actions/runs/44949668646) pasó TypeScript, lint, 331 suites / 1 368 pruebas y los casos de sesión OAuth entre bundles compilados. Los casos verifican sesión válida, ausente, caducada, otro propietario y otro permiso.

El empaquetado de Windows falló antes de los tests: `Expand-Archive` devolvía una carpeta vacía y, al hacer terminantes sus errores, informó una sobrecarga de `ExtractToDirectory` de tres argumentos no disponible en ese proceso. Se reprodujo localmente la carga de un módulo Archive incompatible desde `PSModulePath`. `dab3d44` carga el módulo del host Windows PowerShell invocado y conserva errores terminantes, hashes y versiones. La regresión falló antes y pasó después con un ZIP mínimo fijado; una preparación local vacía comprobó también los 16 recursos reales.

La [compilación Windows de `dab3d44`](https://github.com/jeremyencarnacion2000-stack/Novo/actions/runs/44949663671) terminó aprobada: 444 pruebas de interfaz, seis Python y self-checks, 284 de la app, 30 de hooks y 23 del harness. Las seis sondas físicas ignoradas no se cuentan como aprobadas. Se generaron NSIS y MSI sin instalar. El [artefacto de CI](https://github.com/jeremyencarnacion2000-stack/Novo/actions/runs/44949663671/artifacts/14725895221) identifica el código completo y vence el 24 de noviembre; su ZIP tiene SHA-256 `db63148190d2f759e30d2f34f69a3ae2b2c85692dfb361e60a1bcbd3a4535d6c`. Este digest corresponde al contenedor de artefactos, no al ejecutable instalado ni al NSIS individual.

Se cotejaron de nuevo el SHA-256 del ejecutable instalado, los 21 archivos del manifiesto de reversión y el instalador de respaldo: coinciden. La restauración no se ejecutó. La prueba integrada de interfaz, permisos de la cuenta, Twin y salida audible no se certifica con las sondas de capa ni con pruebas automatizadas.

## Siguiente incremento

Verificar el nuevo recorrido con una candidata autorizada: orden escrita → recibo Windows → evidencia ClickHome → respuesta audible. Usar primero una consulta de proyecto sin tarea confirmada y una con registro de tarea atribuible. Mantener el presupuesto en sombra hasta que esa comparación preserve fuentes faltantes e idioma. Instalar una candidata requiere autorización separada. El ejecutable 0.2.17 instalado conservó el SHA esperado y la instantánea de reversión de 21 archivos permanece disponible. PR #41 en borrador.
