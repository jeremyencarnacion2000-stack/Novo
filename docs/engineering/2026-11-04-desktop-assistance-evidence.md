# Asistencia de escritorio: evidencia de aceptación

Fecha: 2026-11-04. PR #41 sigue en borrador. Rama `codex/companion-desktop-flow`, código base instalado 0.2.16. El ejecutable instalado sigue en 0.2.16; no se instaló el candidato ni se publicó o fusionó nada.

## Estado del candidato

- `npm run tauri build` generó EXE NSIS y MSI de 0.2.17. Versiones internas del ejecutable: 0.2.17. Ambos instaladores son **NotSigned**.
- Paquetes y SHA-256 en `companion/windows/.tmp/candidates/0.2.17/manifest.json`. El candidato sigue local y sin instalar.
- La copia de reversión en `rollback-0.2.16/` conserva binarios y 16 recursos de voz verificados (52.75 MB). Excluye configuración, tokens, bandeja de entrada, proyectos, actividad y registros. Los ajustes actuales permanecen en `%APPDATA%` y no se copiaron.
- Se compararon tamaño y SHA-256 de los 16 recursos de voz de la rama con la instalación 0.2.16: coincidieron todos.

## Flujo de escritorio implementado

La misma entrada Enviar usada por texto y dictado manual reconoce «Novo, abre Visual Studio Code y continuemos con ClickHome». Resuelve una app registrada por nombre o alias exacto, verifica cuenta y permisos locales, ejecuta la apertura y espera una ventana observable. Después consulta una vez el contexto autorizado del proyecto. Sin evidencia o con raíces ambiguas, pide información. Con evidencia, reutiliza el `NovoChatController`, conversación, modelo y permisos existentes. No hay un segundo orquestador ni una llamada al modelo para abrir/controlar apps.

En este PC no está instalado VS Code. El usuario indicó que usa Codex por falta de espacio. No se instaló VS Code. La prueba nativa encontró Codex ya abierto y devolvió `already_open` sin enfocarlo ni cambiar el chat. Bloc de notas se usó para comprobar cambios de ventana reales.

## Catálogo y permisos

- AppsFolder de Windows se consulta mediante un ejecutable fijo, oculto y limitado a 8 s, 1 MiB y 1024 entradas. Caché de 60 s y actualización manual en configuración.
- Acepta ejecutables canónicos registrados y apps empaquetadas con identidad válida. Documentos, scripts y accesos cuyo ejecutable desapareció se excluyen; no descubre ejecutables portátiles no registrados.
- Rutas, argumentos, identidad de lanzamiento y HWND permanecen en Rust. La interfaz recibe IDs opacos, nombres y permisos. Accesos equivalentes al mismo ejecutable comparten la política más restrictiva.
- Apertura y control locales comienzan habilitados con exclusiones editables; leer títulos comienza apagado y no da acceso al contenido de las aplicaciones.
- Sólo configuración puede cambiar la política. El comando legado aplica las mismas comprobaciones. Configuración corrupta o vacía bloquea permisos; cada acción revalida cuenta y exclusiones. Los HWND caducan en 30 s y se comprueba de nuevo la identidad del proceso.
- Apertura, control y lectura local están separados. El servidor aún agrupa abrir/controlar en `device:desktop:control`; un permiso remoto de sólo apertura requiere otro protocolo.

## Pruebas de Windows y cuenta

| Comprobación | Resultado observado |
| --- | --- |
| Cuenta | Verificación real con permiso remoto de control concedido |
| Catálogo | 73 apps utilizables; Antigravity rechazado porque su ejecutable registrado ya no existe |
| Codex | App identificada, `already_open`; no se enfocó ni se manipuló el chat |
| Bloc de notas | Minimizar, maximizar y restaurar observados por Windows; ningún proceso se cerró |
| Lectura y exclusión | Títulos ocultos sin permiso; Codex bloqueado por exclusión temporal; HWND de Bloc de notas rechazado como destino de otra app |
| ClickHome | 1 identidad de proyecto autorizada y 12 archivos con fragmentos relacionados |
| Chat real | `/api/companion/chat` completó una respuesta de 12 856 caracteres e incluyó una pregunta; no se evaluó semánticamente ni se guardó su contenido |
| Twin | El modelo actual de la cuenta no permite `twinMode`; el chat respetó `allowsTwinMode:false` |

Las pruebas de texto inyectado confirman que dictar sólo prepara el borrador y que Enviar usa el mismo ejecutor; no se abre una app antes de Enviar. La consulta de contexto, la acción Windows y el chat real se probaron en sondas distintas, no como un único recorrido visual de principio a fin.

## Micrófono real, Whisper y Silero

El usuario confirmó que pronunció ambas frases completas. El micrófono de Windows se abrió y cerró; el audio y los archivos JSON temporales se eliminaron. No se imprimió ni conservó la transcripción.

| Muestra | Resultado observado |
| --- | --- |
| Español: «Novo, abre Codex y continuemos con ClickHome» | 4.8 s capturados; el resultado no tuvo segmentos léxicos y la validación dio `no_speech`. No aprobada. |
| Inglés: «Novo, open Codex and continue with ClickHome» | Idioma detectado `en`, 8 tokens léxicos, confianza geométrica 0.218 (<0.5); validación `speech_uncertain`. Inferencia 12 367 ms para 1.9 s de audio. No aprobada. |
| Memoria | Pico de working set muestreado: 150.9 MiB, sondeo cada 25 ms. No es el máximo de memoria comprometida del sistema. |
| Cancelación | Seis repeticiones posteriores: 19, 23, 32, 36, 36 y 44 ms; todas bajo 250 ms. Una ejecución previa tardó 10 518 ms y falló el límite; el outlier no se oculta y p95 no se declara aprobado. |

En una comparación posterior, cada nueva captura se procesó con el modo actual (`auto`, 2 hilos, beam 5) y con `es/en` fijado (4 hilos, beam 1). Ambas configuraciones dieron cero segmentos para las muestras españolas e inglesas. Al no existir transcripción evaluable, las latencias de 383–536 ms de esa comparación no certifican reconocimiento ni rendimiento con habla; la única muestra inglesa con tokens sigue siendo la de baja confianza descrita arriba.

El equipo reporta 4 procesadores lógicos y 3.39 GiB de RAM visible. Una primera ejecución sin frase se excluyó porque el usuario confirmó que aún no había hablado. La prueba con ambas frases no cumplió idioma/confianza ni latencia: el factor de tiempo real observado en inglés fue ~6.5. No se ejecutó ninguna acción desde voz. No se puede afirmar precisión ES/EN, latencia objetivo ≤3 s ni p95 de cancelación con estas muestras.

## Verificación automatizada y límites

- Frontend: 426 pruebas aprobadas; TypeScript/Vite compila.
- Suite nativa tras los cambios: 278 aprobadas, 0 fallidas y 6 ignoradas, incluidas dos sondas físicas. El formato Rust del archivo cambiado pasa; `cargo fmt --all -- --check` falla por diferencias de formato preexistentes en otros archivos del workspace, que no se reformatearon.
- Regresiones cubren exclusiones, nombres ambiguos, cancelación previa a apertura, contexto ausente/reutilizado, configuración corrupta, identificadores persistentes y cambios rápidos de permisos. Cuatro hallazgos de revisión se reprodujeron y corrigieron.
- Las llamadas reales de ClickHome y chat se ejecutaron en la cuenta autorizada. Sin una prueba de voz aceptada, no se certifica dictado→borrador→Enviar→intención→acción→resultado→Twin en una sola interacción.
- La captura visual de la ventana de Companion falló dos veces por timeout de Windows. La aceptación visual/responsive/accesible no se completó.
- No se reinició la aplicación para comprobar recuperación integral. Los recibos durables de acciones tras reinicio siguen pendientes; las pruebas automatizadas no sustituyen un reinicio real.
- Abrir Codex no equivale a ejecutar una tarea dentro de Codex. No hay herramientas locales habilitadas en el adaptador Codex.
- Activación por palabra «Novo», conversación manos libres, otras apps empaquetadas, lectura de contenido de apps y UI Automation no están aceptadas ni implementadas.

Pruebas manuales nativas realizadas:

```powershell
cargo test --lib -p novo-companion real_windows_editor_and_notepad --locked -j1 -- --ignored --nocapture
cargo test --lib -p novo-companion real_clickhome_authorized_context --locked -j1 -- --ignored --nocapture
cargo test --lib -p novo-companion real_clickhome_continuation --locked -j1 -- --ignored --nocapture
cargo test --lib -p novo-companion physical_microphone_whisper_silero_es_en --locked -j1 -- --ignored --nocapture
cargo test --lib -p novo-companion physical_microphone_cancel_stops_capture --locked -j1 -- --ignored --nocapture
```

**Decisión:** conservar 0.2.17 como paquete local de diagnóstico; no instalarlo ni marcarlo listo. Resolver el rechazo y la latencia de voz, repetir calibración física, completar el recorrido unido y la revisión visual/reinicio antes de cambiar el estado del PR. No publicar ni fusionar sin autorización.

## Respuesta hablada tras dictado — cambio incremental sin aceptación física

El Companion marca sólo las transcripciones reconocidas como peticiones de voz; cancelar o restaurar un borrador no activa el modo de respuesta hablada. Tras enviar una petición dictada por el flujo normal, el lector local lee la respuesta final incluso con «leer respuestas en voz alta» desactivado. La apertura confirmada se expresa como «Listo, abrí [app]». El texto escrito sigue respetando la preferencia global.

Comprobación automatizada tras el cambio: 15/15 pruebas dirigidas y 430/430 en la suite completa; TypeScript/Vite compila. Las pruebas simulan el evento de transcripción y verifican llamadas al lector; no prueban audio audible ni micrófono real. La palabra de activación «Novo» y la escucha permanente continúan sin implementar ni habilitar. No se regeneró el instalador candidato 0.2.17, no se instaló y no se publicó.
