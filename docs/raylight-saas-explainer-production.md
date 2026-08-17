# Paquete de producción — vídeo SaaS explainer de Novo

Estado: listo para importar en Raylight; render final pendiente porque no hay una integración/CLI de Raylight disponible en este entorno.

## Objetivo comercial de hoy

- Meta: generar al menos USD 100 en ventas, sin prometer un resultado garantizado.
- Oferta a mostrar: Novo Pro mensual y anual, con checkout alojado por Lemon Squeezy.
- CTA único: **Prueba Novo Pro** → `/auth/signup` → paywall → checkout Lemon Squeezy.
- Evidencia de confianza: pago seguro con Lemon Squeezy, cancelación desde la cuenta y resultado verificable del ciclo de trabajo.

## Guion de 75 segundos (16:9, 1440×900)

| Tiempo | Captura | Voz / subtítulo | Tratamiento Raylight |
|---|---|---|---|
| 0–6 s | Landing de Novo | “Tu día no necesita más ruido. Necesita una siguiente acción clara.” | Entrada suave, zoom 102%, sin partículas.
| 6–16 s | Objetivo + check-in | “Novo parte de tu objetivo, tu tiempo disponible y el contexto que tú indicas.” | Resaltar sólo los campos activos; cursor visible.
| 16–28 s | Actividad del Novo Loop | “Recupera contexto, revisa señales y separa hechos de estimaciones.” | Mostrar orb compacto en `retrieving_context` y `interpreting_signals`.
| 28–39 s | “¿Por qué esta?” | “Puedes inspeccionar qué hechos respaldan la recomendación antes de actuar.” | Expandir panel; animar Facts → Interpretación → Recomendación.
| 39–51 s | Aceptar → iniciar → completar | “Acepta, modifica o pospone. El resultado queda registrado.” | Transición compartida GSAP; no mostrar loaders ficticios.
| 51–62 s | Feedback útil/no útil | “Lo que te funciona cambia la siguiente acción.” | Orb `shaping` sólo durante el evento real de adaptación.
| 62–69 s | Calendar + confirmación | “Las acciones externas esperan tu confirmación. Nada se crea por sorpresa.” | Orb `listening`; mostrar tarjeta de confirmación.
| 69–75 s | Checklist + paywall | “Menos listas infinitas. Más progreso verificable. Prueba Novo hoy.” | CTA Lemon Squeezy y cierre con URL `productivitynovo.vercel.app`.

## Reglas de captura

1. Usar sólo datos sintéticos: objetivo “Preparar lanzamiento”, tarea “Validar checkout”, check-in de 45 minutos.
2. No capturar nombres, correos, notas privadas, tokens, calendarios personales ni URLs con secretos.
3. Grabar la actividad únicamente cuando exista un evento real del backend; no simular fases con temporizadores.
4. Exportar maestro H.264 1080p/30 fps con subtítulos SRT y recorte 9:16 de 45–60 s.
5. Mantener contraste en tema oscuro y claro; respetar reduced motion en tomas de accesibilidad.

## Copy del CTA y descripción

**Título:** Tu siguiente acción, con evidencia.

**Descripción:** Novo convierte objetivos, tiempo disponible y resultados anteriores en una acción concreta que puedes revisar, ejecutar y adaptar.

**CTA:** Prueba Novo Pro.

**Nota de pago:** Pago seguro con Lemon Squeezy · Cancela cuando quieras.

## Checklist comercial

- [x] Variables de Lemon Squeezy presentes en `.env.local` (valores no documentados).
- [x] Checkout mensual/anual y atribución `paywall_source` implementados.
- [x] Webhook con firma HMAC y actualización de suscripción.
- [x] Test de checkout pasando.
- [ ] Render final en Raylight.
- [ ] Publicar vídeo y medir visitas → paywall → checkout iniciado → compra.
