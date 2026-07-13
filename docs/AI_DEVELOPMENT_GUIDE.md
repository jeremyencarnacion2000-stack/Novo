# Guía de Desarrollo con IA — Novo

> Documento de referencia: cómo trabaja el colaborador de IA (Claude Code) en este
> proyecto — herramientas que usa, reglas que el usuario ha impuesto, y la
> filosofía de código que debe seguir. Vive junto a `NOVO_DESIGN_LANGUAGE.md`
> como la segunda mitad del contrato: uno define *cómo se ve* Novo, este define
> *cómo se construye*.

---

## 1. Filosofía de código — Ponytail

Referencia: [github.com/DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail)

Ponytail es un conjunto de reglas para agentes de IA que fuerza generación de
código mínima y eficiente — la mentalidad de un desarrollador senior que
escribe solo lo necesario, no lo que "podría ser útil después". Antes de
escribir código nuevo, pasa por una escalera de decisión:

1. **¿Este código necesita existir de verdad?** — ¿el problema ya está resuelto
   en otro lugar del código, o puede resolverse sin escribir nada nuevo?
2. **¿Puede reutilizarse algo existente?** — antes de crear un componente,
   hook o endpoint nuevo, buscar si ya hay uno equivalente.
3. **¿Una solución nativa/estándar es suficiente?** — no reinventar lo que el
   framework, el navegador o la librería ya resuelven.

Esto coincide directamente con las instrucciones base de este entorno: sin
abstracciones prematuras, sin manejo de errores para casos que no pueden
pasar, sin comentarios que expliquen QUÉ hace el código (los nombres ya lo
dicen) — solo POR QUÉ, cuando no es obvio.

**Cómo se aplicó en esta sesión (ejemplos reales):**
- Al construir `CREATE_EVENT`/`CREATE_TRACKER`, se reutilizó el patrón exacto
  de los handlers existentes en `lib/ai/executor.ts` en vez de crear un
  sistema paralelo.
- Al detectar 4 componentes muertos (`mini-chatbot.tsx`, `chatbot.tsx`,
  `TaskItem.tsx`, `TaskPanel.tsx`, `artifact-panel.tsx`) sin ningún import en
  toda la app, se eliminaron en vez de "arreglarlos" — no tenía sentido pulir
  código que nadie ejecuta.
- Al migrar de Blendy a GSAP Flip, se mantuvo la misma convención de atributos
  (`data-flip-from`/`data-flip-to`) para no tocar 15 archivos consumidores más
  de lo estrictamente necesario.

---

## 2. Reglas de desarrollo impuestas por el usuario

Estas son correcciones y confirmaciones reales dadas durante el desarrollo —
no invenciones, son lo que efectivamente se pidió o se corrigió.

### Proceso de trabajo
- **"los bug y luego lo demas"** — cuando hay bugs puntuales verificados Y una
  feature grande pendiente, arreglar primero lo pequeño y confirmado, luego
  construir lo grande.
- **Verificar antes de aplicar hallazgos de auditoría.** Los subagentes de
  auditoría se equivocan — en esta sesión se detectaron falsos positivos
  reales (`/api/tasks` marcado como "no existe" cuando sí existía;
  `TodaySkeleton` marcado como "sin usar" cuando sí se usaba). Regla: cada
  hallazgo se verifica contra el código real con `grep`/`Read` antes de
  tocar algo.
- **Probar en caja blanca, no solo compilar.** Ante un bug de animación que
  "no se veía como el video", verificar con `tsc` no fue suficiente — hubo
  que levantar el dev server, autenticar con Playwright, e inspeccionar
  `element.style.transform` frame por frame para encontrar la causa real
  (faltaba un `data-flip-id` compartido que GSAP necesita para correlacionar
  el estado capturado con el elemento destino).
- **No repetir errores de sesiones anteriores sin verificar que siguen
  vigentes.** La memoria persistente es un snapshot, no estado en vivo —
  antes de actuar sobre ella se relee el código actual.

### Estándares de código
- Sin hardcodear API keys nunca, ni como fallback "por si acaso" — deben
  venir de variables de entorno y fallar explícitamente si faltan.
- Paralelizar siempre que las operaciones sean independientes
  (`Promise.all` en vez de `await` secuencial) — se corrigieron múltiples
  casos reales: `IntegrationEngine.getTodayTasks` (5 queries), el endpoint
  de aplicar horario (hasta 8 escrituras), y la carga del dashboard.
- Los timers/intervals deben limpiarse y pausarse cuando la pestaña no está
  visible (Page Visibility API) — no seguir sondeando el backend en segundo
  plano sin razón.
- `Date.setHours()` muta el objeto original — siempre clonar (`new Date(d)`)
  antes de mutar si el original se necesita después.
- Migraciones de Prisma: cuando el diff automático mezcla el cambio deseado
  con drift preexistente no relacionado, extraer manualmente solo el SQL del
  cambio actual en vez de aplicar todo el diff.

### UX / Diseño
- Seguir estrictamente `NOVO_DESIGN_LANGUAGE.md`: radios {20px cards, 28px
  paneles, 34px diálogos, 999px pills}, blur del sistema de vidrio {18-28px},
  colores solo semánticos (nunca decorativos).
- Las animaciones deben significar algo (transición de estado real) — nunca
  decorativas. Ver [[novo-product-philosophy]] más abajo.
- Los modales que "aparecen de la nada" rompen la continuidad espacial — deben
  crecer físicamente desde el elemento que los originó (ver sección GSAP Flip).
- El chromatic aberration del efecto de vidrio debe escalar con el tamaño del
  componente — 6 para pills de 40px, hasta 15 para paneles de 600px+. Un valor
  uniforme se ve exagerado en elementos chicos e invisible en grandes.
- Cuando la IA le pide algo al usuario, preferir un mini-formulario
  estructurado sobre una pregunta en texto plano — pero **solo cuando la
  petición es genuinamente ambigua**, nunca por pereza de usar un valor por
  defecto razonable.

### Autonomía y confirmación
- Nunca hacer `git push`, `--force`, o acciones destructivas sin pedir
  confirmación explícita primero.
- Desplegar a producción (`vercel --prod`) sí está autorizado de forma
  recurrente en este proyecto — pero siempre después de que `tsc --noEmit`
  pase limpio, nunca a ciegas.
- Rotar/generar secretos (API keys, `EVENTS_WEBHOOK_SECRET`) es responsabilidad
  del usuario en las consolas externas — la IA no tiene acceso a esos paneles.

---

## 3. Herramientas y habilidades usadas

| Herramienta | Uso en este proyecto |
|---|---|
| `Bash` / `PowerShell` | Compilación, git, despliegues, migraciones de Prisma, gestión de procesos |
| `Read` / `Edit` / `Write` | Lectura y edición quirúrgica de archivos — `Edit` para cambios puntuales, `Write` solo para archivos nuevos o reescrituras completas |
| `Glob` / `Grep` | Búsqueda de patrones y referencias cruzadas antes de eliminar o renombrar código |
| `Agent` (subagente `Explore`) | Auditorías grandes en paralelo (UX página por página, capacidades de acción de IA) — con verificación manual posterior de cada hallazgo |
| `AskUserQuestion` | Decisiones de producto que no pueden inferirse del código (ej. alcance de la migración de Blendy a GSAP) |
| `WebFetch` | Consultar documentación externa y repos de referencia (ej. este mismo repo de ponytail, el código fuente de `pretty-modal`) |
| `Playwright` (instalado ad-hoc) | Pruebas de caja blanca en el navegador quando el typecheck no basta — autenticación real, inspección de estilos computados en vivo |
| `TodoWrite` | Seguimiento de tareas multi-paso dentro de una sesión |
| Prisma CLI | `migrate diff` para generar SQL quirúrgico, `migrate deploy` para aplicar, `generate` para el cliente |
| Vercel CLI (`npx vercel --prod --yes`) | Despliegue a producción — se prefiere sobre el MCP de Vercel porque el MCP delega al CLI de todos modos |

---

## 4. MCPs disponibles en el entorno

Conectados pero **no usados activamente en el desarrollo de Novo** hasta ahora
(disponibles para tareas específicas si se necesitan):

- **Vercel** — deploy vía CLI en la práctica, no vía MCP directo
- **Google Calendar / Gmail / Drive** — relevante si se conecta el ecosistema
  Google real más allá del OAuth ya integrado en la app
- **Spotify** — la app ya tiene su propia integración de música vía YouTube;
  este MCP es para gestión de la cuenta de Spotify del usuario, no del código
- **Figma** — útil si se necesita traer un diseño externo al código, o llevar
  una página de Novo a Figma
- **Notion** — la app ya sincroniza checklist items con Notion vía
  `integration_accounts`; este MCP sería para gestión directa del workspace
- **Supabase, Netlify, Atlassian, Canva, Crypto.com, Otter.ai** — sin uso
  identificado en este proyecto (Novo usa Neon/Postgres + Vercel, no Supabase
  ni Netlify)

**Requieren autorización manual del usuario** (OAuth no completado en este
entorno): CoinDesk, Interactive Brokers, Microsoft 365.

---

## 5. Contexto de producto (memoria persistente del proyecto)

Estas son decisiones ya tomadas que informan cualquier trabajo futuro —
extraídas de la memoria persistente entre sesiones:

### Novo no es una app de productividad
Es un **Sistema Operativo Cognitivo**. El Gemelo Cognitivo (Cognitive Twin) es
el centro: un modelo continuo de atención, energía, momentum, hábitos, carga
de trabajo, foco, recuperación y patrones de comportamiento. Pipeline de 5
etapas: Observar → Interpretar → Predecir → Guiar → Aprender.

Ley de diseño: **toda animación debe representar un estado, transición,
predicción, adaptación o aprendizaje real — la animación decorativa está
prohibida.**

### Contexto del hackathon (XPRIZE)
Novo compite en **"Build with Gemini XPRIZE"**, Categoría 1 — *Education &
Human Potential*. Fecha límite: 17 de agosto de 2026. Pool de premios: $2M.

Criterios de evaluación:
1. **Viabilidad de negocio** — adquisición de usuarios e ingresos reales en
   una ventana de 90 días. No es una demo, es un negocio real.
2. **Operaciones nativas de IA** — si la IA (Gemini específicamente) ejecuta
   decisiones de negocio reales en producción, no solo funciones de chat.
3. **Impacto de categoría** — avance real dentro de Education & Human
   Potential.

**Prioridad actual confirmada por el usuario**: Operaciones nativas de IA
primero. La orquesta de modelos (Groq primario, Gemini para razonamiento
profundo/Live, OpenRouter como respaldo) se mantiene como está
arquitectónicamente — Gemini se enfatiza en la narrativa del pitch, no se
reestructura el código para que sea el único modelo. Monetización está
planeada pero no construida — no es el foco actual.

### Sistema de vidrio líquido
El chromatic aberration debe escalar con el tamaño del componente (ver tabla
en la sección 2). Border-radius estricto: 20px tarjetas, 28px paneles, 34px
diálogos, 999px pills — sin valores arbitrarios (`rounded-2xl`, `rounded-3xl`
genéricos están prohibidos salvo que coincidan exactamente con esta escala).

---

## 6. Decisiones técnicas clave (para no repetir la investigación)

- **Orquesta de modelos es intencional**: Groq (inferencia rápida primaria) →
  Gemini (razonamiento profundo, function calling, Live) → OpenRouter
  (respaldo). No colapsar a un solo proveedor.
- **Tiempo real es SSE, no socket.io** — Next.js serverless no soporta
  conexiones WebSocket persistentes. `lib/socket-context.tsx` usa
  `EventSource` nativo del navegador contra `/api/events`.
- **GSAP Flip requiere `data-flip-id` compartido** entre el elemento origen y
  el destino para que el motor correlacione el estado capturado con el
  elemento a animar — sin esto, el tween se completa instantáneamente sin
  transformación visible. Ver `lib/modal-flip.ts`.
- **El calendario tiene dos capas**: `CalendarAggregator` (lectura unificada
  de google/checklist/proyectos/escuela/rutinas/hábitos/negocio/eventos
  nativos) y `CalendarEvent` (escritura nativa, incluyendo eventos creados
  por la IA vía `CREATE_EVENT`). Son complementarias, no redundantes.
- **Las tareas creadas por la IA usan el modelo `Task`**, no `ChecklistItem`
  — son sistemas paralelos que `/today` debe leer ambos para no perder
  tareas creadas por el asistente.
- **El motor cognitivo no persiste su recomendación por defecto** — el
  `reorganizedDay` que calcula debe aplicarse explícitamente (endpoint
  `/api/ai/cognitive-engine/apply-schedule`) para que sobreviva más allá de
  la página `/cognitive`.
