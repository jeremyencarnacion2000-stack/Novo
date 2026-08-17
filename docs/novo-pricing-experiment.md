# Novo — Pricing experiment

## Hipótesis

Founder Pro debe cobrar por continuidad y ejecución humano-agente, no por “inteligencia” abstracta ni por cantidad de módulos.

## Oferta inicial

Free/trial para demostrar un Loop; un único Founder Pro. No añadir tiers hasta que exista evidencia de disposición a pagar.

## Instrumentación

Registrar pricing viewed, checkout opened, checkout completed, subscription activated, payment failed y cancelled sin PII innecesaria. `lib/lemonsqueezy.ts` y `app/api/webhooks/lemonsqueezy/route.ts` implementan checkout y lifecycle; falta validar configuración Live/Test Mode con eventos reales.

## Experimento

Comparar dos mensajes de valor en cohortes separadas, manteniendo precio y producto constantes. Criterios: checkout iniciado, activación, acción verificada por usuario pagado, reembolso/cancelación y coste por acción. No realizar compra con la tarjeta del propietario ni declarar conversión sin webhook real.
