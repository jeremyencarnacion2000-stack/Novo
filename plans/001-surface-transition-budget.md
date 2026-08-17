# 001 — Reducir el presupuesto de transición de superficies

- **Status**: TODO
- **Commit**: cea6656
- **Severity**: HIGH
- **Category**: Performance / Easing & duration
- **Estimated scope**: 2 files, 20–40 líneas

## Problem

Las superficies de alta frecuencia usan `transition: all`, por lo que cualquier cambio incidental de sombra, fondo, borde, layout o blur puede entrar en la misma animación y provocar trabajo de paint innecesario:

```css
/* app/globals.css:746-763 */
.glass-card {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

/* app/globals.css:770-784 */
.glass-card-list {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

/* app/globals.css:787-805 */
.glass-button {
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
```

El shell principal también anima todo su contenido durante 1000 ms:

```tsx
/* components/dashboard-shell.tsx:85-87 */
<main className="flex-1 relative flex flex-col min-h-0 overflow-hidden transition-all duration-1000">
```

## Target

En `app/globals.css`, reemplazar cada `transition: all` por propiedades explícitas:

```css
transition: background-color 180ms ease, border-color 180ms ease, box-shadow 220ms var(--ease-out), transform 220ms var(--ease-out);
```

Para `.glass-button` mantener `transform`/color/fondo, sin animar padding, blur ni dimensiones:

```css
transition: background-color 160ms ease, color 160ms ease, transform 160ms var(--ease-out), box-shadow 180ms var(--ease-out);
```

En `components/dashboard-shell.tsx`, sustituir `transition-all duration-1000` por una transición únicamente de `background-color, opacity` de máximo 300 ms, o eliminarla si no existe un cambio de estado visual asociado.

## Repo conventions to follow

El repositorio ya usa `--novo-spring` y `cubic-bezier(0.23, 1, 0.32, 1)` en entradas de submenús (`app/globals.css:238`). Añadir un token `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)` junto a los tokens de `:root` solo si no existe otro equivalente.

## Steps

1. Editar `app/globals.css` y reemplazar las tres transiciones `all` de `.glass-card`, `.glass-card-list` y `.glass-button` por listas explícitas.
2. Editar `components/dashboard-shell.tsx` y eliminar la transición de 1000 ms sobre el `<main>` o limitarla a propiedades compositables y ≤300 ms.
3. Mantener intacta la lógica de blur y el hover; no cambiar colores ni markup.

## Boundaries

- No cambiar la API de cards ni eliminar `backdrop-filter`.
- No añadir dependencias.
- No animar `width`, `height`, `padding`, `margin`, `top` o `left`.

## Verification

- **Mechanical**: `rg -n "transition:\s*all|transition-all duration-1000" app/globals.css components/dashboard-shell.tsx` no debe devolver estos casos; ejecutar Jest global y lint de ambos archivos.
- **Feel check**: abrir Ajustes, Hoy y una lista con muchas cards; en DevTools poner Animations a 10% y confirmar que hover solo cambia fondo/borde/sombra/transform, sin relayout.
- Activar `prefers-reduced-motion`; el contenido debe conservar feedback de color/opacidad sin desplazamientos.
- **Done when**: no queda `transition: all` en estas primitivas y no hay cambio perceptible de fluidez al pasar sobre 20+ cards.
