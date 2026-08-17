# 002 — Estabilizar las animaciones de Hoy

- **Status**: TODO
- **Commit**: cea6656
- **Severity**: HIGH
- **Category**: Physicality / Performance
- **Estimated scope**: 1 file, 20–50 líneas

## Problem

El flujo Hoy combina un `scale(0)` frecuente, animación de `height: auto` y una barra cuyo progreso cambia por `width`, todos en una pantalla de uso diario:

```tsx
/* app/today/page.tsx:140-145 */
<motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
```

```tsx
/* app/today/page.tsx:234-239 */
<motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: 'easeInOut' }}>
```

```tsx
/* app/today/page.tsx:403-407 */
<motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.6, ease: 'easeOut' }} />
```

El `scale(0)` viola la continuidad espacial y el ancho/alto fuerzan layout y paint. La sección se puede abrir y cerrar repetidamente, así que el coste se acumula.

## Target

- Checkbox: `initial={{ opacity: 0, scale: 0.88 }}`, `animate={{ opacity: 1, scale: 1 }}`, `exit={{ opacity: 0, scale: 0.88 }}`, spring con `duration: 0.2, bounce: 0.15`.
- Sección: conservar el cambio de altura solo si Framer necesita medir `auto`, pero envolver el contenido en un contenedor con `overflow: clip`; usar `opacity` + `transform: translateY(-4px)` como feedback y no animar propiedades ajenas.
- Barra: sustituir `width` por un transform directo: `style={{ transformOrigin: 'left center' }}` y `animate={{ transform: \\`scaleX(${progress / 100})\\` }}`.
- Sustituir `easeInOut` de entrada/salida por `cubic-bezier(0.23, 1, 0.32, 1)` para entrada y una salida `cubic-bezier(0.4, 0, 1, 1)`.

## Repo conventions to follow

`hooks/use-drag-to-dismiss.ts:202-206` ya usa `power3.out` y duración máxima 280 ms para una salida física. El estado del checkbox debe seguir el mismo principio: rápido, reversible y sin `scale(0)`.

## Steps

1. Editar el bloque del checkbox en `app/today/page.tsx` para eliminar `scale: 0` y usar escala inicial 0.88 + opacity.
2. Editar la expansión de `SectionCard` para conservar `overflow-hidden`, añadir desplazamiento/opacity y limitar la transición a ≤250 ms.
3. Editar la barra de progreso para animar `transform: scaleX()` en lugar de `width`.
4. Verificar que completar/descompletar y abrir/cerrar una sección no reinicien animaciones de elementos vecinos.

## Boundaries

- No cambiar la agrupación de tareas, datos ni textos.
- No eliminar `layout` de la tarjeta externa si se mantiene estable en pruebas; solo evitar que el nodo con blur sea el nodo layout-animado.

## Verification

- **Mechanical**: `rg -n "scale: 0|width:.*progress|height: 'auto'" app/today/page.tsx` debe quedar sin el checkbox `scale:0` ni la barra basada en width; ejecutar tests de Hoy y typecheck.
- **Feel check**: activar 10 tareas, abrir/cerrar la sección diez veces y completar una tarea rápidamente; no debe haber salto, rebote grande ni blur que se recalcule por frame.
- Con reduced motion, conservar el cambio de estado del checkbox mediante opacity/color y eliminar movimiento.
- **Done when**: ninguna interacción diaria usa `scale(0)` y el progreso se compone con transform.
