# Skills para producir animaciones top

Estas skills están instaladas en el entorno de Codex. Úsalas en este orden según la fase. No es necesario aplicarlas todas a cada cambio.

## 1. Dirección y concepto

### `design-consultation`

Úsala cuando todavía no está claro qué debe comunicar el landing. Entregable: promesa, audiencia, capítulos y jerarquía visual.

### `taste-skill:high-end-visual-design`

Úsala para elevar composición, ritmo, tipografía, contraste, materialidad y evitar una estética genérica de IA.

### `taste-skill:design-taste-frontend`

Úsala durante la primera implementación visual. Entregable: reglas concretas de layout, espaciado, color y componentes.

### `apple-design`

Úsala como revisión de producto: claridad, jerarquía, feedback, accesibilidad, gestos y estados vacíos. Mantén la identidad propia del proyecto.

## 2. Motion y prototipado

### `motion-design`

Úsala para definir vocabulario de movimiento, timing, curvas, entrada/salida y consistencia entre escenas.

### `improve-animations`

Úsala cuando ya existe una animación pero se siente plana, cortada, lenta o sin intención. Entregable: diagnóstico y ajustes medibles.

### `review-animations`

Úsala como revisión independiente antes de dar la animación por terminada. Revisa continuidad, interrupciones, performance y reduced motion.

### `watch:watch`

Úsala para analizar un vídeo de referencia. Documenta exactamente qué hace el vídeo: trigger, trayectoria, timing, easing, capas y estado final. No copies sin adaptar al producto.

## 3. Implementación y control

### `impeccable:impeccable`

Úsala para pulido de UI: alineación, contraste, responsive, estados hover/focus, modales y detalles que hacen que el resultado parezca acabado.

### `ponytail:ponytail`

Úsala para revisar deuda visual y técnica antes de acumular parches. Entregable: lista priorizada de mejoras, no un rediseño infinito.

### `superpowers:systematic-debugging`

Úsala si una animación funciona en móvil pero no en desktop, si el scroll se bloquea o si hay una diferencia entre preview y producción.

### `superpowers:verification-before-completion`

Úsala antes de afirmar que una secuencia está lista. Exige pruebas reales en los breakpoints y estados que importan.

## 4. Imágenes y arte

### `imagegen`

Úsala para crear fondos editoriales, recortes o texturas originales. Separa después los planos con criterio visual; no generes una imagen genérica y la llames parallax.

### `taste-skill:imagegen-frontend-web`

Úsala para preparar imágenes pensadas para composición web, crop responsive y lectura detrás de texto.

## Flujo corto recomendado

```text
design-consultation
→ high-end-visual-design
→ motion-design
→ implementación aislada
→ impeccable
→ review-animations
→ verification-before-completion
```

## Reglas de uso

- Una skill decide o revisa una cosa concreta; no mezcles cinco diagnósticos en una sola pasada.
- La skill puede proponer; la decisión final la toma el objetivo del producto.
- Documenta cualquier cambio de timing, asset o estructura en `HANDOFF-CHECKLIST.md`.
- Si una skill recomienda un efecto que empeora legibilidad o rendimiento, se descarta.
