# Skill routing

Estas son las skills que el autor debe activar desde Codex/Claude Code cuando trabaje en la web. La carpeta documenta el orden y el objetivo; las instrucciones completas viven en la instalación local del agente y no deben copiarse dentro del proyecto para evitar duplicarlas o quedar desactualizadas.

## Núcleo recomendado

| Skill | Momento | Resultado esperado |
| --- | --- | --- |
| `design-consultation` | antes de diseñar | intención, audiencia y capítulos |
| `taste-skill:high-end-visual-design` | dirección de arte | composición y materialidad premium |
| `motion-design` | storyboard | vocabulario de movimiento y timing |
| `improve-animations` | primera pasada | corrección de ritmo y continuidad |
| `impeccable:impeccable` | pulido | UI, estados, responsive y detalle |
| `review-animations` | revisión | fallos de movimiento y rendimiento |
| `apple-design` | QA de producto | claridad, accesibilidad y comportamiento |
| `superpowers:verification-before-completion` | cierre | evidencia reproducible |

## Skills opcionales

- `watch:watch` — descomponer vídeos de referencia en triggers, capas y curvas.
- `imagegen` — crear arte original y fondos con intención editorial.
- `taste-skill:imagegen-frontend-web` — preparar imágenes para crop y composición web.
- `ponytail:ponytail` — revisar deuda visual antes de seguir acumulando parches.
- `superpowers:systematic-debugging` — investigar fallos entre desktop, móvil y producción.

## Prompt de arranque

```text
Activa design-consultation, taste-skill:high-end-visual-design y motion-design.
Analiza esta web y define una narrativa de scroll con capítulos, capas, paths,
timings y fallback reduced-motion. No implementes todavía; entrega primero el
storyboard y los riesgos de rendimiento.
```

## Prompt de revisión

```text
Activa impeccable, review-animations, apple-design y
superpowers:verification-before-completion. Revisa el landing en desktop y móvil,
comprueba que cada animación comunica una intención, que no hay scroll hijacking,
que el fallback estático funciona y devuelve hallazgos priorizados con evidencia.
```
