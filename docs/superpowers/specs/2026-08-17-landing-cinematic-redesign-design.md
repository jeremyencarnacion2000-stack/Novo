# Landing cinematográfico — Design Spec

**Fecha:** 2026-08-17
**Archivo objetivo:** `app/landing/page.tsx` (y componentes que ya vive en el mismo archivo: `LandingTwinField`, `CognitiveSequence`, `ContextMask`, `ProductWindow`)

## Problema

El landing actual (dark green/carbón, tipografía grande, diagrama de nodos en el hero) está bien ejecutado pero se lee genérico: sigue el molde visual de cualquier landing de "AI startup" reciente (hero oscuro + headline + node-graph decorativo). No transmite que Novo es un producto real y funcionando.

## Dirección aprobada

Cinematográfico / producto-como-héroe (estilo Apple): el producto real (capturas de `docs/release/evidence/`) protagoniza la narrativa en vez de ilustraciones abstractas, con transiciones de scroll dramáticas en los dos momentos que más importan.

## Estado actual del código (para no reinventar nada)

`app/landing/page.tsx` ya implementa scroll-linked motion con **Framer Motion puro** (`useScroll` + `useTransform` + `useSpring`), sin GSAP, en cuatro puntos:

1. **Hero** (líneas 305-309, 334, 345): `useScroll({ container: scrollRef })` mapea los primeros 16% de scroll a un parallax sutil (la copy sube 34px, el grafo baja 28px y escala a 0.975). No hay pin.
2. **`ContextMask`** (líneas 258-281): la captura real (`currentProductCapture`, la rica con 4 nodos) se usa como textura de fondo del headline gigante "CONTEXTO" vía `backgroundBlendMode: multiply`, con `backgroundPositionX` atado al scroll del propio bloque (`useScroll({ target: maskRef, container, offset: ['start end','end start'] })`).
3. **`CognitiveSequence`** (líneas 211-256, `id="sistema"`): columna izquierda `lg:sticky lg:top-28` (pin real, ya existe) con una línea vertical que se dibuja (`scaleY` atado a `useScroll` con `offset: ['start 78%','end 35%']`); la columna derecha usa `whileInView` con `clipPath: inset(0 0 12% 0) → inset(0 0 0% 0)` por tarjeta.
4. **`ProductWindow`** (líneas 283-300): ya es un mockup de ventana (dots arriba, imagen, `figcaption`) mostrando `currentProductCapture` con un solo `whileInView` reveal — sin scroll-scrub, sin segunda imagen.

Solo se usa **una** de las dos capturas existentes (`current-cognitive-product-desktop.png`, la rica). `final-cognitive-preview-desktop.png` (la dispersa) no se usa en ningún lado hoy.

`useReducedMotion()` de Framer Motion ya se chequea en cada componente animado y colapsa a estados estáticos — ese patrón se mantiene y se extiende, no se reemplaza.

**Conclusión técnica:** el pin real (Opción C) se construye extendiendo el mismo patrón `sticky` + `useScroll`/`useTransform` que ya existe en `CognitiveSequence`, envolviendo hero y `producto` en un contenedor más alto (ej. `200dvh`) con un panel interno `sticky top-0 h-dvh`. **No se introduce GSAP ScrollTrigger ni se sincroniza con Lenis** — cero dependencias nuevas, cero riesgo de desincronización.

## Diseño por sección

### Hero (pin nuevo)
El wrapper de la sección hero pasa de altura normal a un contenedor alto (~`200dvh`) con un panel `sticky top-0 h-dvh` adentro. `useScroll` mapea ese rango a:
- El headline ("La próxima interfaz para la IA no es otro chat." / "Es contexto compartido.") revela palabra por palabra (opacity+blur por `span`, ya hay precedente de reveal por bloque en `landing-enter*`).
- `LandingTwinField` (el grafo SVG) dibuja sus líneas y nodos en sincronía con el mismo progreso de scroll, reusando las mismas `motion.path`/`motion.line`/`motion.g` que ya existen — solo cambia qué controla su `pathLength`/`opacity` (de un `initial→animate` de montaje a un `useTransform` atado al scroll del wrapper).
- Al llegar a progreso 1, el panel se "suelta" y el scroll continúa normalmente a la siguiente sección.

### Contexto (`ContextMask`) y Sistema (`CognitiveSequence`)
Sin pin nuevo. Se mantiene tal cual — ya tienen mask-reveal (`clipPath`) y el shift de textura por scroll. Ajuste menor: alinear timing/easing con el nuevo ritmo del hero para que la transición entre secciones se sienta continua.

### Producto (pin nuevo + segunda imagen)
`ProductWindow` se extiende: mismo wrapper alto + `sticky` que el hero. Dentro, dos `Image` (la dispersa `final-cognitive-preview-desktop.png` y la rica `current-cognitive-product-desktop.png`) apiladas en el mismo marco de ventana, cross-fadeadas por `useTransform` del progreso de scroll (opacity 1→0 en la dispersa, 0→1 en la rica). El copy lateral ("Puedes ver qué sabe. Y por qué lo sabe.") permanece como está.

### Precios y Cierre
Sin cambios estructurales. Mantener el `whileInView` actual; solo pulir si el nuevo ritmo de las secciones anteriores lo pide (ajuste de `delay`/`duration`, no de estructura).

## Copy

Se mantiene el mensaje actual. Se permite recortar o reordenar frases dentro de un bloque si la nueva coreografía de reveal lo pide (ej. dividir el headline del hero en unidades más cortas para el reveal palabra-por-palabra), pero no se redacta mensaje nuevo ni se agregan secciones.

## Accesibilidad

`useReducedMotion()` ya gatea cada bloque animado hoy — se extiende el mismo criterio a las secciones pineadas: con reduced motion activo, el wrapper alto (`200dvh`) colapsa a altura normal (sin scroll extra vacío) y el contenido se muestra directamente en su estado final, sin scrub. Ningún nuevo pin debe alargar el documento cuando reduced motion está activo.

## Mobile

El pin de hero y producto se limita a `lg:` (≥1024px), igual que la columna sticky que ya existe en `CognitiveSequence` (`lg:sticky`). Por debajo de ese breakpoint, ambas secciones caen a scroll normal con el `whileInView` reveal que ya usan las demás secciones — mismo patrón que el resto de la página, no un caso especial nuevo.

## Fuera de alcance

- Reescritura de copy/mensaje.
- Cambios a la estructura o precios de la sección `#precios`.
- Nuevas secciones.
- Captura de nuevo contenido (video o screenshots frescos) — se usan únicamente las dos imágenes ya existentes en `docs/release/evidence/`.
- Cambios a otras páginas o al `PageTransitionProvider`/overlay de transición entre rutas (debe seguir funcionando sin conflicto).

## Testing

- `app/landing/__tests__/landing-identity-motion.test.ts` debe seguir pasando sin modificación de expectativas salvo que el reveal cambie un valor que el test asertaba explícitamente.
- Verificación visual con `/browse` en desktop (1440px) y mobile (390px), en cada sección, antes y después.
- Verificación con `prefers-reduced-motion: reduce` forzado (via `emulateMedia` o CSS override): confirmar que no aparece scroll vacío extra y que el contenido se ve completo sin animación.
- Confirmar que el overlay de transición entre rutas (CTAs `/auth/signup`, `/auth/signin`) sigue disparando correctamente desde las nuevas secciones pineadas.
