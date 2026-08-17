# Novo — Activation funnel

## Definición

Usuario activado = objetivo creado + contexto mínimo + recomendación recibida + acción aceptada o modificada + acción iniciada o completada.

La métrica principal es el número semanal de acciones prioritarias verificadas.

## Eventos canónicos

`onboarding_started`, `objective_created`, `context_added`, `first_plan_generated`, `first_recommendation_viewed`, `first_recommendation_accepted`, `first_action_started`, `first_action_completed`, `recommendation_modified`, `outcome_recorded`, `plan_adapted`, `mcp_execution_completed`, `checkout_viewed`, `checkout_opened`, `checkout_completed`, `subscription_activated`, `payment_failed`, `subscription_cancelled`.

## Estado actual

`lib/cognitive/events.ts` ya persiste eventos sanitizados del Loop, outcomes, actividad AI y MCP. La taxonomía de primera activación y pagos aún no está garantizada en cada punto de UI; por eso no se presenta un porcentaje de activación.

## Instrumentación mínima pendiente

Mapear cada evento canónico a un único emisor server-side o una acción validada; guardar `userId`, timestamp, surface, run/goal/action IDs y versión, nunca textos privados ni prompts. Las consultas deben calcular cohortes por primera ocurrencia y tiempos entre eventos.

## Embudo

Landing → signup → onboarding started → objective/context → first plan → recommendation viewed → accept/modify → start → complete → helpful → adapted next plan → paid pilot.

No contar login, dashboard abierto, mensaje enviado o integración conectada sin resultado como activación.
