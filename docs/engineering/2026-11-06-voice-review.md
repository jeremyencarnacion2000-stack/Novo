# Continuación de voz y revisión de candidata — 6 de noviembre de 2026

PR #41, fuente de corrección `3ad0d0999f364802e730d2c1c8bc29249de90701`. La instalación permanece en 0.2.17 `c64098a`. **Sin merge, release, producción ni escucha permanente.** Se continúa sólo con pruebas automáticas; no hay nueva aceptación de micrófono/altavoces.

## Corrección encontrada en la revisión final

La revisión independiente de la rama encontró un fallo reproducible: después de abrir Codex, si la consulta para continuar ClickHome fallaba, Novo podía leer una respuesta anterior como si correspondiera a la petición nueva. El controlador conserva el historial en caso de error y el lector seleccionaba su última respuesta.

El camino existente ahora conserva los identificadores de las respuestas previas y sólo lee una respuesta nueva después de una continuación sin error. Si falla o el historial guardado no aporta respuesta nueva, informa de la apertura confirmada y de que no pudo continuar la consulta. Se mantienen las comprobaciones de cuenta/conversación/cancelación y el envío manual; no se repite la apertura ni se inventa contexto.

Tres regresiones fallaron antes de corregir: error con lectura automática, error después de dictado con lectura automática apagada, e historial sin respuesta nueva. Pasan después, junto con una continuación dictada correcta que sí lee el resultado actual. **8/8 pruebas dirigidas, 438/438 frontend y TypeScript/Vite aprobados localmente.** Las seis pruebas Python y el self-check también pasan; se añadieron al workflow Windows existente. No se ejecutó una segunda revisión ni se añadieron agentes implementadores.

## Small: comparación que antes estaba bloqueada por almacenamiento

C: volvió a disponer de 17,6 GiB. Se descargó Small Q5_1 sólo como diagnóstico y se verificó SHA-256 `ae85e4a935d7a567bd102fe55afc16bb595bdb618e11b2fc7591bc08120411bb`. El primer intento no arrancó: 277,96 MiB libres frente al mínimo de 912. Se reinició únicamente el kernel JavaScript de diagnóstico del agente, recuperando unos 1 064 MiB disponibles; no se cerraron aplicaciones del usuario ni se activó el micrófono.

Cuatro procesos posteriores terminaron correctamente sobre los mismos WAV sintetizados de [la matriz anterior](2026-11-05-voice-optimization.md), sin vocabulario añadido, dos hilos, beam 5 e idioma fijo. [Datos de cada ejecución](2026-11-06-voice-review-metrics.json). Son dos señales repetidas, no muestras humanas nuevas.

| Referencia / configuración | Proceso | CPU hijo | Pico working set | Resultado y filtro |
| --- | ---: | ---: | ---: | --- |
| «Abre Codex», contexto actual | 24 465 ms | 44 531 ms | 486,42 MiB | Texto exacto, confianza 0,424; rechazado |
| Mismo PCM, contexto 128 que cubre la señal completa | 9 735 ms | 17 859 ms | 431,44 MiB | Texto exacto, confianza 0,354; rechazado |
| «Open Codex», contexto actual | 26 321 ms | 47 922 ms | 486,12 MiB | `Open codecs`, confianza 0,531; texto incorrecto aceptado por filtro |
| Mismo PCM, contexto 128 | 2 923 ms | 5 156 ms | 432,00 MiB | `Open Codex.`, confianza 0,596; exacto y aceptado |

El encoder ES baja de 22 747,76 a 1 796,39 ms, pero en la ejecución acotada el decode tarda 5 580,37 ms. Carga: 220,74/334,39 ms. En EN el encoder baja de 24 904,96 a 1 730,52 ms; carga 269,49/318,09 ms. Por tanto no basta con mantener el modelo cargado ni con acortar su contexto. El mínimo libre fue 530,37 MiB, cerca del suelo de 512 que se conservó. No se midió la memoria de todo el circuito, potencia ni p95.

**No se adopta Small ni se relajan filtros.** Una orden inglesa sintética queda por debajo de tres segundos; la española aún no combina precisión aceptada y latencia. Tampoco se concluye que toda configuración/hardware local sea incapaz. Hay 144 procesos válidos registrados entre ambos días, pero siguen faltando el corpus dominicano/inglés humano y el recorrido físico completo. La alternativa híbrida con consentimiento separado continúa documentada, sin implementar ni transmitir audio.

## Candidata y aceptación

La candidata anterior `2b91b0d` fue cotejada y descargada, pero no instalada. El nuevo [workflow Windows 42164771978](https://github.com/jeremyencarnacion2000-stack/Novo/actions/runs/42164771978), fuente `3ad0d09`, terminó **correctamente**: 438 frontend, 281 app nativa, 30 hooks, 21 harness y seis pruebas Python, más self-check y build. Las seis sondas físicas nativas siguen ignoradas explícitamente.

Se descargó el artefacto `13478253994`, ZIP de 142 873 048 bytes, y se cotejó su digest oficial SHA-256 `1731198cad82abe0b8b5a4c8721beb68f18ba458d0182bee91f596503463fd15`. Se conservó sólo el NSIS versionado de 33 189 841 bytes, SHA-256 `bf361fe522939f68bd99675a44a3b00efdf006fc280857248dc21ab4e766b51f`, en `companion/windows/.tmp/candidates/0.2.17-3ad0d09/`. El MSI cotejado, sin guardar, tiene SHA-256 `3aaa5e68e0fa1505c873621f1931dd314ebd85cbd251d718579efa7346d534e6`.

La firma Authenticode devuelve `NotSigned`. Se extrajo sin ejecutar el payload `novo-companion.exe`: versión 0.2.17, 7 436 288 bytes, SHA-256 `44285c92106e22bd3a61189124f2923e2d1f6fd06d53f8091592eb7df0be7295`. Se guardó una copia local de las preferencias antes de instalar: local/es, nube y lectura automática apagadas. El instalador **no se ha ejecutado**; se solicitó autorización para esta candidata concreta.

Se cotejaron de nuevo el ejecutable instalado `c64098a`, sus 16 recursos de voz, los dos instaladores correspondientes, los 21 archivos de respaldo 0.2.16 y su NSIS original. Esa comprobación acredita integridad, no una reversión ejecutada. No se modifica la instalación sin autorización para la candidata concreta.

Pendientes: instalación autorizada, nueva voz humana ES/EN, borrador→Enviar→Codex real→contexto Twin real→respuesta audible, interrupción física y fluidez durante síntesis. La lectura audible y apertura por texto confirmadas anteriormente siguen siendo pruebas separadas. La revisión no certifica esas tareas por sustitución.

## Decisiones de ejecución y revisión

- Suite nativa completa/empaquetado por CI tras fallar los builds locales por disco: conserva la verificación completa y reserva recursos del PC; cuesta minutos de CI y exige revisar su resultado remoto.
- Precisión humana, circuito físico y cancelación audible: permanecen pendientes porque el usuario pidió pruebas automáticas; el riesgo es que la voz real siga fallando.
- Instalación y reversión ejecutada: se verifican hashes y respaldos y se espera autorización específica; la app instalada aún no recibe las correcciones y la reversión no se certifica como ejecutada.
- Disco realmente frío, energía, aceleración GPU y p95 poblacional: quedan sin medir, sin añadir un backend pesado sólo para completar una tabla; rendimiento fuera de estas condiciones sigue desconocido.

La revisión encontró un único hallazgo importante, corregido con pruebas roja/verde y suite completa. Ningún hallazgo crítico ni menor aplazado. La aceptación física permanece abierta.
