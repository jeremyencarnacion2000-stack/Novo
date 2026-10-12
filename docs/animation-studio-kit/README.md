# Animation Studio Kit

Kit general de handoff para diseñar y construir un landing premium con animaciones de alto nivel. Está pensado para que otra persona pueda entrar al proyecto, entender la intención y producir escenas sin improvisar efectos aislados.

No depende de Novo ni de un framework concreto. Las recetas usan React porque es el entorno más común, pero los principios funcionan igual con Vue, Svelte o una web vanilla.

## Contenido

- `MOTION-DIRECTION.md` — cómo convertir una idea de producto en una historia visual.
- `IMPLEMENTATION-GUIDE.md` — arquitectura de escenas, scroll, GSAP, Framer Motion y parallax.
- `SKILLS.md` — skills recomendadas, orden de uso y entregables que debe producir cada una.
- `animation-contract.json` — contrato editable de capas, capítulos, ritmo y fallback.
- `HANDOFF-CHECKLIST.md` — control de calidad antes de entregar.
- `examples/` — recetas pequeñas, no componentes de producción listos para copiar sin adaptar.
- `references/` — lugar para guardar capturas, vídeos y referencias del proyecto hermano.

## Flujo recomendado

1. Define la promesa del producto en una frase.
2. Divide la página en capítulos y asigna a cada capítulo una transformación visual.
3. Diseña el storyboard antes de abrir GSAP.
4. Crea componentes de escena independientes.
5. Implementa primero el estado estático, después el movimiento.
6. Prueba desktop, móvil, teclado, touch y `prefers-reduced-motion`.
7. Mide rendimiento y captura evidencia.

## Principio de calidad

Una animación premium no es la que tiene más movimiento. Es la que hace que el visitante entienda algo antes de que termine de leerlo.
