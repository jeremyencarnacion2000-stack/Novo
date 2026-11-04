# Asistencia de escritorio: evidencia de desarrollo

Fecha: 2026-11-04. Base: Companion 0.2.16, commit `ea7b2d6`. Rama: `codex/companion-desktop-flow`. El ejecutable instalado continúa en 0.2.16; estos cambios de desarrollo no se han instalado ni publicado en producción.

## Flujo implementado

La misma entrada Enviar usada por texto y dictado manual reconoce «Novo, abre Visual Studio Code y continuemos con ClickHome». Resuelve una app registrada por nombre o alias exacto, verifica la cuenta y los permisos locales, ejecuta la apertura y espera una ventana observable. Después consulta el contexto autorizado del proyecto una vez. Si falta evidencia o hay dos proyectos locales con el mismo nombre, pide información. Con evidencia, entrega la continuación y el contexto preparado al `NovoChatController` existente; respeta modelo, conversación, Twin y permisos disponibles. No hay otro orquestador ni llamada al modelo para abrir/controlar apps.

Windows no tiene VS Code disponible en este PC. El usuario eligió usar lo existente y confirmó que sólo usa Codex por espacio. La orden de VS Code devuelve app ausente; no sustituye silenciosamente su destino. La prueba de apertura se realizó con Codex y la de cambios de ventana con Bloc de notas.

## Catálogo y permisos

- AppsFolder de Windows se consulta mediante un único programa fijo, sin perfil, oculto y acotado a 8 s/1 MiB/1024 entradas. Reutiliza el ejecutor protegido existente. Caché de 60 s y actualización manual en configuración.
- Acepta ejecutables canónicos registrados y apps empaquetadas con identidad válida; documentos, scripts y accesos cuyos ejecutables desaparecieron quedan fuera. No descubre ejecutables portables sin registro.
- Rutas, argumentos, identidad de lanzamiento y HWND permanecen en Rust. La interfaz recibe IDs opacos, nombres y permisos. Los IDs de apps registradas siguen su registro Windows, no el directorio de versión del ejecutable. Los accesos equivalentes al mismo ejecutable se agrupan y comparten la comprobación más restrictiva de sus permisos.
- Apertura y control local están habilitados por defecto, con exclusiones editables por app. Leer títulos de ventanas comienza apagado. Esto no concede lectura del contenido de las aplicaciones.
- Los cambios de política sólo se aceptan desde la ventana de configuración. Guardar preferencias generales no puede reemplazar la política. El comando legado comparte la misma comprobación. Un archivo existente ilegible, truncado o vacío bloquea los permisos de escritorio; una instalación sin archivo usa los valores iniciales generales.
- Se verifica la cuenta real antes de actuar y la política se comprueba al ejecutar. Se reutilizan las identidades/cancelación de solicitudes de cuenta. Los identificadores de ventana vencen a los 30 s y se vuelve a comprobar la identidad del proceso antes del cambio.
- El servidor compatible conserva el scope remoto `device:desktop:control` para abrir/controlar. Los permisos locales de apertura, control y lectura son independientes; un scope remoto exclusivo de apertura requerirá otra versión de protocolo.

## Pruebas reales en este Windows

| Comprobación | Resultado observado |
| --- | --- |
| Cuenta | Verificación real con permiso de control de escritorio concedido |
| Catálogo | 73 aplicaciones utilizables; Antigravity rechazado porque su ejecutable registrado ya no existe |
| Codex | Identidad empaquetada observada; apertura devuelve `already_open` sin enfocar ni cambiar el chat del usuario |
| Bloc de notas | Ventana observada; minimizar, maximizar y restaurar verificados por Windows; sin cerrar procesos |
| Lectura | Títulos ocultos cuando la lectura no está autorizada; no se registraron títulos ni contenido |
| Identidad y exclusión | Un HWND de Bloc de notas rechazado como destino de otra app; apertura de Codex bloqueada tras excluirla en la política temporal de la prueba |
| ClickHome | Una identidad de proyecto autorizada y 12 archivos con fragmentos relacionados |
| Orquestación real | Una continuación real completada por `/api/companion/chat`: 226 caracteres y pregunta de aclaración presente; sin registrar el contenido privado |
| Twin | El catálogo real del modelo no permite `twinMode` en la cuenta actual; la continuación respeta ese límite |

La primera comprobación de ClickHome falló: una carpeta anterior agotaba el presupuesto global. La regresión con una carpeta ajena grande falló antes de corregirlo; ahora se prioriza la raíz elegida cuyo nombre aparece en la consulta y sus archivos antes de recorrer subdirectorios. La primera sonda de chat forzaba Twin y recibió 403; se corrigió la sonda para usar las capacidades reales del modelo, sin cambiar planes ni permisos.

## Verificación automatizada

- Frontend completo: 426 pruebas aprobadas. TypeScript/Vite: compilación aprobada. Suite nativa: 278 aprobadas y 4 sondas manuales excluidas del recorrido habitual. Las tres sondas de escritorio/contexto/chat se ejecutaron aparte; la de voz Microsoft no se repitió.
- Se comprobó con una transcripción inyectada en el receptor real del compositor que no se abre ninguna app antes de Enviar; después usa el mismo ejecutor. Esta prueba no certifica micrófono ni reconocimiento físico.
- Pruebas de exclusiones, nombres ambiguos, cancelación antes de apertura, respuesta nativa válida, contexto ausente, reutilización de contexto sin otra búsqueda, configuración corrupta, persistencia de identidad tras actualizar el ejecutable y guardados rápidos de permisos.
- Revisión independiente: cuatro hallazgos importantes reproducidos con pruebas antes del arreglo y corregidos. La verificación no se presenta como un benchmark de todas las apps.

Comandos nativos reales (manuales, excluidos de CI habitual):

```powershell
cargo test --lib -p novo-companion real_windows_editor_and_notepad --locked -j1 -- --ignored --nocapture
cargo test --lib -p novo-companion real_clickhome_authorized_context --locked -j1 -- --ignored --nocapture
cargo test --lib -p novo-companion real_clickhome_continuation --locked -j1 -- --ignored --nocapture
```

## Pendiente y decisiones de alcance

- Dictado físico ES/EN, ruido, latencia, consumo y cancelación medidos con micrófono. No se activó el micrófono en estas pruebas.
- Activación «Novo» y conversación manos libres. El prefijo escrito/dictado no instala un detector de palabra de activación.
- Verificación visual, responsive y accesibilidad de la nueva lista en la ventana nativa, y ensayo completo por el usuario tras empaquetar/instalar una candidata.
- Apps empaquetadas distintas de Codex y restricciones de foco de Windows pueden requerir más compatibilidad; no se anuncia éxito si Windows no confirma la ventana.
- Lectura de títulos sin permiso de control todavía no tiene un recorrido independiente en `desktop_app_windows`; la operación actual se usa para elegir destinos de control y oculta títulos sin permiso de lectura. Leer contenidos y UI Automation general no están implementados.
- El chat con plan Codex conserva su aislamiento y no recibe herramientas locales. Abrir la app Codex es una operación de escritorio distinta de ejecutar trabajo dentro de ella.
- No se hizo una evaluación semántica independiente de la respuesta del modelo; sí se observaron finalización y pregunta de aclaración. No se certifica que el Twin conozca la próxima tarea de ClickHome.
- No se publicó ni mezcló a producción. Los recibos durables de escritorio tras reinicio siguen pendientes; la apertura evita repetir una app con ventana ya observable, sin afirmar recuperación completa.
