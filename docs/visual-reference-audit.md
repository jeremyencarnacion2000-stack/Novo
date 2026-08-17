# Auditoría visual de referencia — sb Money / Novo

Fecha: 2026-08-03

## Hallazgos observables

- **Composición:** el contenido se organiza en una superficie principal amplia, con rail lateral estrecho y controles secundarios en cápsulas. El foco visual queda en un único bloque hero; no hay varias tarjetas compitiendo por atención.
- **Color:** la base es un verde casi negro. El color se concentra en un gradiente radial esmeralda/teal que nace cerca del centro y cae a negro hacia los bordes. Las acciones primarias usan verde luminoso; los metadatos permanecen gris verdoso.
- **Noise:** la textura es dither/grain fino, uniforme y de baja opacidad. No funciona como una imagen decorativa separada: se mezcla con el gradiente y sigue siendo visible en las zonas oscuras.
- **Profundidad:** los paneles usan bordes de 1px, radios grandes, sombra amplia y muy poco contraste entre superficie y fondo. La jerarquía proviene principalmente del espacio, escala tipográfica y luminancia.
- **Animación:** el gradiente cambia lentamente, sin loaders giratorios ni rebotes. Las transiciones de panel/dropdown son cortas, con entrada desde el origen espacial del control y escala casi imperceptible.
- **Gestos:** en móvil el panel se comporta como bottom sheet: se puede arrastrar desde el contenido, tiene handle visible, resistencia al arrastre y cierre por umbral. Los dropdowns se anclan al control y no cambian el layout de la página.
- **Tipografía:** títulos grandes y compactos, labels pequeños en mayúsculas con tracking amplio, y valores con mucho peso visual. El texto secundario nunca compite con el número o acción principal.

## Mapeo aplicado en Novo

- `app/globals.css`: campo ambiental del viewport, noise compartido, `novo-premium-field`, deriva de 18s y fallback de movimiento reducido.
- `app/globals.css`: superficies `liquid-glass` con noise de baja opacidad y premium glass en verde profundo (`rgba(7, 18, 12, ...)`) para retirar el matiz púrpura heredado.
- `components/settings/settings-control-center.tsx`: rail lateral en escritorio y cápsula horizontal en móvil.
- `components/dashboard/now-hero.tsx`: hero único con gradiente animado, tarea/checklist real y copy de estado honesto.
- `components/notification-center.tsx`: control fijado más cerca del borde derecho (`right-2` móvil, `sm:right-6`).

## Guardrails de fluidez

- Sólo se animan `transform`, `opacity` y filtros en capas aisladas.
- La deriva ambiental se pausa con `prefers-reduced-motion`.
- El noise no captura pointer events ni altera el layout.
- Integraciones externas conservan sus colores semánticos; la neutralización se limita a primitives compartidos.

## Evidencia de navegación

La URL `https://stepbro.site/apps/money/#/home/dashboard` fue inspeccionada con la skill `/browse`. El hash de la demo pública redirige al shell inicial cuando no hay una sesión de demo; las propiedades visuales de las pantallas autenticadas se tomaron de las capturas proporcionadas por el usuario y se contrastaron con el DOM accesible del shell público.

## Auditoría de CSS y movimiento de la referencia

La inspección de `frontend.css?v=38` confirma un sistema deliberado de profundidad:

- El fondo usa `.background .noise` con textura raster de alta frecuencia y blobs animados (`blob-move-1` y `blob-move-2`) para desplazar gradientes lentamente.
- Las superficies translucidas reservan `backdrop-filter: blur(8px)` para barras y controles; una mezcla `variant-glass` mantiene el detalle del fondo.
- Las cards parten de una superficie suave (`surface-container-low`) y entran con `opacity + translateY(8px) + scale(.985)`, evitando blur permanente por tarjeta.
- La navegación usa transiciones cortas y curvas tipo spring (`cubic-bezier(0.38, 0.49, 0, 1.5)`); los cambios de icono duran 125 ms.
- Los estados de carga usan blur temporal (16–32 px) y lo eliminan al terminar; el contenido estable no permanece borroso.
- La barra inferior móvil usa `backdrop-filter: blur(8px)` y el botón activo expande su ancho con una transición suave.

Implicación para Novo: el problema observado no era falta de efectos, sino cards casi transparentes sobre el wallpaper y una variable de blur no aplicada de forma consistente. La corrección centraliza el blur en `--card-blur-px`, añade el prefijo WebKit y da a Ajustes un scrim estable para conservar el fondo sin competir con el contenido.
## Corrección aplicada y evidencia

- `app/globals.css`: `.glass-card` ahora usa `--card-blur-px` con fallback seguro, `-webkit-backdrop-filter` e `isolation: isolate`; su textura queda detrás del contenido sin apagarlo.
- `app/globals.css`: `.settings-page-shell` agrega una capa de legibilidad suave y dependiente del tema, manteniendo visible el wallpaper.
- `app/globals.test.ts`: se añadió una aserción para evitar regresiones del blur compartido.
- Verificación: `npx jest app/globals.test.ts components/dashboard/__tests__/now-hero.test.tsx --runInBand` → 12 tests aprobados.
- Producción: deployment `https://novo-desktop-66grju9l4.vercel.app` quedó Ready y el alias `https://productivitynovo.vercel.app` apunta a esa versión. `GET /landing` respondió HTTP 200.
## Segunda fase: motion y Cognitiva

- Se ejecutaron los planes `plans/001`, `plans/002` y `plans/003`: no quedan `transition: all` en las primitivas objetivo, el checkbox de Hoy ya no usa `scale(0)`, el progreso usa `scaleX`, y los loops del Hub tienen una rama estática para reduced-motion.
- `components.json` conserva el registro `@bklit` solicitado. El registro remoto contiene un árbol amplio de módulos; para no bloquear webpack se dejó un adaptador ligero en `components/charts/line-chart.tsx` sobre Recharts, con la misma composición visual: dos series, grid discontinuo, tooltip oscuro, reveal de 700 ms y paleta esmeralda/ámbar.
- `components/cognitive/cognitive-metrics-strip.tsx` ahora muestra una tendencia histórica real cuando existen al menos dos puntos persistidos; si no hay datos, mantiene el estado honesto de “construyendo historial”.
- `app/cognitive/page.tsx` y `app/globals.css` incorporan el campo verde/teal, noise tenue y una superficie cognitiva profunda inspirada en la referencia.
- Verificación remota: Vercel compiló correctamente (`✓ Compiled successfully in 59s`, TypeScript, 127 páginas estáticas y funciones) y publicó `https://novo-desktop-crsrz8rfx.vercel.app`; el alias `https://productivitynovo.vercel.app` apunta a esa versión. `GET /landing` respondió HTTP 200.
