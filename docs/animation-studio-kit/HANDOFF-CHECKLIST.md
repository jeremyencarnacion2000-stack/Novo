# Checklist de entrega

## Narrativa

- [ ] La secuencia comunica una transformación de Novo, no solo un efecto.
- [ ] Cada tarjeta tiene un anclaje semántico y un origen visual.
- [ ] El camino termina en una acción clara.
- [ ] El último frame funciona como captura estática.

## Técnica

- [ ] Se reutiliza el `progress` del landing.
- [ ] El componente nuevo está aislado en `components/landing/`.
- [ ] No hay un segundo smooth-scroll global.
- [ ] No hay listeners de scroll que compitan con el controlador existente.
- [ ] Se limpian timelines, observers y listeners al desmontar.
- [ ] No se animan dimensiones o layout en cada frame.

## Responsive

- [ ] Desktop 1440×900.
- [ ] Desktop 1280×800.
- [ ] Tablet 1024×768.
- [ ] Móvil 390×844.
- [ ] Móvil 430×932.
- [ ] No hay clipping del cerebro, hojas, texto ni CTA.
- [ ] El scroll sigue siendo continuo y no se bloquea al cambiar de capítulo.

## Accesibilidad y rendimiento

- [ ] `prefers-reduced-motion` conserva una composición equivalente.
- [ ] El texto y los botones siguen siendo accesibles por teclado.
- [ ] Las capas decorativas tienen `aria-hidden`.
- [ ] Imágenes optimizadas y sin duplicar assets pesados.
- [ ] Performance revisada en una máquina media.

## Evidencia

- [ ] Captura desktop antes/después.
- [ ] Captura móvil antes/después.
- [ ] Vídeo corto del recorrido completo.
- [ ] Nota con archivos modificados y por qué.
