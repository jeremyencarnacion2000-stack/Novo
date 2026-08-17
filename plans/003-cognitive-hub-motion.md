# 003 — Hacer el Hub respetuoso de reduced-motion

- **Status**: TODO
- **Commit**: cea6656
- **Severity**: MEDIUM
- **Category**: Accessibility / Interruptibility
- **Estimated scope**: 1–2 files, 20–40 líneas

## Problem

El Hub mantiene loops infinitos en una superficie siempre visible y no consulta reduced-motion:

```tsx
/* components/ContextHub.tsx:618-622 */
animate={{ scale: [1, 1.08, 1], opacity: [0.85, 1, 0.85] }}
transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
```

```tsx
/* components/ContextHub.tsx:633-639 */
animate={{ height: ['5px', `${10 + bar * 3}px`, '5px'] }}
transition={{ duration: 0.55 + bar * 0.12, repeat: Infinity, ease: 'easeInOut' }}
```

El anillo de alerta también repite cuatro cambios de opacidad (`components/ContextHub.tsx:648-653`). Aunque sirve como señal, puede ser distractor y no respeta `prefers-reduced-motion`.

## Target

Importar `useReducedMotion` de Framer Motion en `components/ContextHub.tsx`. Cuando sea true:

- El pulso del Gemelo queda estático (`animate={{ opacity: 1, scale: 1 }}`).
- El ecualizador muestra barras estáticas de 5–8 px sin loop.
- El anillo conserva un estado fijo de opacidad/contraste en lugar del repeat.

Cuando sea false, mantener los loops existentes pero pausar el ecualizador y el pulso cuando el Hub no esté visible o la pestaña no esté activa, si ya existe una señal de visibilidad en el componente.

## Repo conventions to follow

`components/cognitive/twin-command-center.tsx:79-107` ya usa `useReducedMotion` y ramifica el objeto `animate`, y `app/globals.css:1883-1895` conserva feedback de color sin movimiento para reduced-motion.

## Steps

1. Añadir `const reduceMotion = useReducedMotion()` al componente que contiene `CapsuleContent`.
2. Cambiar los tres `animate`/`transition` para ramificar entre estado estático y loop actual.
3. Añadir tests de render si existe suite del Hub; comprobar que no se crean timers o repeticiones en reduced-motion.
4. Mantener aria-labels y colores semánticos.

## Boundaries

- No cambiar estados del Hub, prioridad de indicadores ni lógica cognitiva.
- No sustituir el feedback por un loader genérico.

## Verification

- **Mechanical**: lint, typecheck y tests del Hub.
- **Feel check**: abrir `MINI_PILL` con audio, foco y alerta; comprobar que cada estado se distingue sin movimiento excesivo. Activar reduced-motion en DevTools: no debe haber pulso, barras animadas ni parpadeo, pero el texto/ícono permanece visible.
- **Done when**: todos los loops del Hub tienen una rama estática accesible y no hay warnings de hydration.
