# Auditoría de animaciones Novo

Planes generados a partir de la auditoría de movimiento del commit `cea6656`.

| Plan | Severidad | Estado | Alcance |
| --- | --- | --- | --- |
| 001 | HIGH | TODO | Eliminar `transition: all` y transiciones de layout en superficies frecuentes |
| 002 | HIGH | TODO | Corregir escalas/layout animado del flujo Hoy |
| 003 | MEDIUM | TODO | Hacer el Hub dinámico respetuoso de reduced-motion y más eficiente |

## Orden recomendado

1. Ejecutar 001 para reducir trabajo de paint/composición en cards, shell y botones.
2. Ejecutar 002 para estabilizar checklist, progreso y secciones expandibles.
3. Ejecutar 003 para el Hub, donde existen loops infinitos visibles durante toda la sesión.

La auditoría es de solo lectura; estos planes no modifican código por sí mismos.
