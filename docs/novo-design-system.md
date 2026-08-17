# Novo design system — cleanup baseline

## Principios

- Crema, carbón y verde profundo; el acento indica acción o estado real.
- Una acción dominante por sección.
- Secciones abiertas para copy y contexto; cards solo para objetos/acciones independientes.
- Blur, glow y movimiento solo cuando expresan actividad, foco o transición.
- El contenido factual siempre supera a la decoración.

## Tokens existentes a respetar

La fuente de verdad actual está en `app/globals.css`, `lib/design-tokens.ts` y los componentes `GlassSurface`, `Card`, `Dialog` y `Sheet`. No se crea una segunda paleta durante esta fase.

## Jerarquía tipográfica

Display/page title → section title → object title → body → supporting → metadata. Labels de navegación deben ser comprensibles y traducibles.

## Motion

Hover 100–160 ms; selección 160–220 ms; panel 220–300 ms; focus 280–420 ms; completion 240–360 ms. `prefers-reduced-motion` elimina movimiento continuo y conserva cambios de estado.

## Card policy

No anidar cards para agrupar copy. Recomendaciones, acciones, errores y objetos independientes pueden usar card; headers, evidencia y timelines deben respirar como secciones.
