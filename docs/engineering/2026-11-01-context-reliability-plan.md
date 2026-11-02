# Contexto útil ante fallos parciales

Spec: documento maestro del usuario, secciones 2, 8, 9, 14–16; [roadmap](../roadmap/NOVO_EVOLUTION.md), etapa 1. Se reutiliza `buildUserContext`, compartido por los consumidores existentes. No se añade otro orquestador ni una dependencia.

## Task 1: lecturas independientes con resultados parciales

- Antes de modificar, leer builder, sus consumidores, pruebas y contratos de Gmail/atribución.
- Reproducir: caída de calendario o Twin descarta tareas, proyectos y otras fuentes sanas. Un error de contador aparece como cero tareas. Error de preferencias debe detener lecturas sensibles.
- Probar primero: conservar contexto sano ante caída de fuente; marcar campos no disponibles; no exponer diagnóstico privado; no inventar necesidad de reautorizar Gmail; fallar cerrado si no se pueden consultar exclusiones.
- Corregir en el builder compartido. Estado de recuperación explícito y contadores desconocidos como `null`; un resultado vacío confirmado sigue siendo vacío/cero.
- Verificar con tests del builder, Gmail, chat-service, streams y scopes del Companion.

## Task 2: reducir contexto innecesario sin cambiar datos

- Revisar campos y límites de las consultas actuales antes de limitar el contexto enviado.
- Mantener los identificadores y datos necesarios para las acciones existentes. Pruebas con datos representativos y límites; medir bytes del prompt.
- Ninguna migración, escritura de datos, caché global entre usuarios o inferencia adicional.

## Task 3: verificación y registro

- Ejecutar las comprobaciones adecuadas y registrar fallos previos por separado.
- Revisar aislamiento, permisos, fallback y compatibilidad de consumidores.
- Actualizar matriz de capacidades y registro de implementación. No presentar pruebas unitarias como certificación de proveedores reales.

## Ledger

Base: worktree existente aislado en `cd0af5f`, con cambios previos de Companion/accesibilidad/fluidez preservados.

Pre-flight: Task 1 produce el estado explícito de recuperación; Task 2 debe conservarlo y no confundir límites de contexto con ausencia de datos. Los consumidores usan `summary` para IA y `sources` para atribución; no hay consumidor aritmético directo de los contadores del builder.

Ruling: continuar en el worktree existente y registrar aquí avances con herramientas nativas PowerShell — evita crear otro checkout o perder cambios ya validados. El directorio principal no se modifica.

Task 1: implementada. Se reprodujeron seis fallos de recuperación y se corrigieron sin alterar ownership/scopes. Cada lectura conserva su frontera; los errores de exclusiones siguen deteniendo todas las lecturas sensibles. Los contadores desconocidos y agenda no recuperada usan null. No se envían diagnósticos privados a logs/prompts.

Task 2: implementada. Rutinas: 10 recientes × 7 días × 12 ejercicios, con campos explícitos y límites declarados en contextWindow; los contadores consultan el total. La ejecución START_WORKOUT conserva su lectura completa por ID y propietario. Fixture sintético de la misma información: JSON compacto 154231 bytes frente a 307674 con indentación; no son tokens ni medidas de producción. No se añadieron modelos, cachés globales, servicios ni dependencias.

Ruling: el límite es del contexto preventivo, no de los datos almacenados — evita copiar rutinas completas sin límite en cada turno. Los textos de descripción/notas y otras fuentes aún requieren recuperación por intención; no se afirma un presupuesto global de tokens.

Revisión fresca: tres P2 aceptados y reproducidos con pruebas antes de corregir. Google Calendar ahora informa su fallo sin descartar eventos nativos; mailbox.status=unavailable también marca recuperación parcial; el scroll distingue el movimiento ascendente del lector de frames intermedios de un seguimiento suave descendente.

Ruling / Task 4: al contrastar consumidores se encontró que la ruta web omitía pregunta/historial del lector Gmail. Se corrige el cableado dentro de la ruta existente, en lugar de migrar de golpe su orquestación/SSE — conserva adjuntos, confirmaciones y contrato de transporte. Se añade la frase de seguimiento «¿Hay algo del MESCyT?» y su búsqueda de respaldo sin palabras vacías. Pruebas rojas observadas y luego verdes.

Task 3: suite completa final pasa: 326 suites, 1309 pruebas, dos snapshots. ESLint de archivos modificados y diff --check pasan. La primera ejecución fallaba sólo por assets Capacitor ausentes; se regeneraron mediante cap copy android/ios, sin SDK, instalación de apps ni cambio de preferencias. Una comprobación TypeScript acotada superó 1 GB de heap; no se declara aprobada. La compilación web queda como verificación pendiente, no se omite su puerta de tipos.

Ruling: las instrucciones anteriores del usuario autorizan publicar en GitHub y desplegar en Vercel. Se conserva el checkout principal, se publica una rama revisable y se verifica la compilación remota antes de actualizar producción. No se solicita otra elección de integración ya autorizada.
