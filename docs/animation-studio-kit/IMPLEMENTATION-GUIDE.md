# Guía técnica de implementación

## Arquitectura recomendada

Organiza el landing por escenas:

```text
landing/
  page.tsx
  scenes/
    hero-scene.tsx
    proof-scene.tsx
    transition-scene.tsx
    cta-scene.tsx
  motion/
    scroll-progress.ts
    motion-tokens.ts
    media.ts
```

Cada escena recibe estado y progreso; no debe leer ni mutar el DOM de otra escena.

## Un progreso compartido

Usa un único valor `0 → 1` para una escena y deriva las transformaciones:

```tsx
const y = useTransform(progress, [0, 1], [0, -180])
const opacity = useTransform(progress, [0, 0.12, 0.9, 1], [0, 1, 1, 0.84])

<motion.div
  className="absolute inset-0 will-change-transform"
  style={reduceMotion ? undefined : { y, opacity }}
>
  {children}
</motion.div>
```

No instales varios smooth-scroll ni varios listeners globales. Si ya existe un controlador, todas las escenas deben consumirlo.

## GSAP: cuándo y cómo

Usa GSAP para timelines locales, entradas de modales, secuencias con orden preciso o una interacción puntual. Usa el sistema reactivo del framework para el scroll continuo.

```ts
const ctx = gsap.context(() => {
  const timeline = gsap.timeline({ paused: true })
  timeline.fromTo(panel,
    { autoAlpha: 0, y: 18, scale: 0.97 },
    { autoAlpha: 1, y: 0, scale: 1, duration: 0.55, ease: 'power3.out' },
  )
}, root)

return () => ctx.revert()
```

Si se usa `ScrollTrigger`, crea el trigger dentro del mismo `context` y destrúyelo al desmontar. Nunca dejes timelines globales huérfanos.

## Caminos y conexiones

Para dibujar una línea editorial, anima `pathLength`:

```tsx
const pathLength = useTransform(progress, [0.18, 0.48], [0, 1])

<motion.path
  d="M 120 180 C 260 90, 360 260, 520 150"
  fill="none"
  stroke="currentColor"
  strokeWidth="1.5"
  strokeDasharray="5 8"
  vectorEffect="non-scaling-stroke"
  style={reduceMotion ? { pathLength: 1 } : { pathLength }}
/>
```

La curva debe explicar una relación. Si no existe una relación, usa una textura o elimina la línea.

## Responsive y touch

- Desktop: más aire lateral y mayor separación de planos.
- Móvil: composición central, menor desplazamiento horizontal y textos siempre visibles.
- No desactives la animación solo por ser desktop o móvil; responde a `prefers-reduced-motion`.
- No hagas que un gesto de scroll quede capturado por un canvas o un elemento decorativo.
- Prueba 1440×900, 1280×800, 1024×768, 390×844 y 430×932.

## Rendimiento

- Anima `transform` y `opacity`.
- Usa `will-change` solo durante una interacción real.
- No animes `width`, `height`, `top`, `left` o layout continuamente.
- No animes `backdrop-filter`; reserva los filtros para entradas cortas.
- Comprime imágenes y precarga solo el primer plano visible.
- Verifica CPU, memoria y frames en una máquina media antes de añadir otra capa.

## Accesibilidad

- Todo contenido esencial debe existir sin movimiento.
- Las capas decorativas llevan `aria-hidden="true"`.
- Respeta `prefers-reduced-motion` con una composición estable equivalente.
- No uses el color o el movimiento como única señal de estado.
- Mantén foco visible y orden de teclado durante las transiciones.
