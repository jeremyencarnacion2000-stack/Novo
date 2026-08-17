# Política adaptativa del Cognitive Twin

## Versión

`cognitive-policy-v2`

La política es determinista primero. La IA puede resumir, normalizar o descomponer, pero no puede saltarse ownership, exclusiones, permisos, idempotencia ni la decisión de reglas.

## Scoring interno

```ts
type RecommendationScoreInput = {
  goalAlignment: number
  urgency: number
  expectedImpact: number
  feasibility: number
  contextFit: number
  learnedSuccess: number
  dependencyReadiness: number
  interruptionPenalty: number
  rejectionPenalty: number
  intrusivenessPenalty: number
  uncertaintyPenalty: number
}
```

Los factores positivos pesan alineación del objetivo, urgencia, impacto, viabilidad, ajuste al contexto, éxito aprendido y dependencias. Las penalizaciones se aplican después. El resultado queda limitado a 0–1 y no se muestra como porcentaje preciso; la UI traduce a alta/media/baja con explicación.

## Reglas mínimas

- Deadline próximo eleva urgencia.
- Objetivo sin actividad eleva oportunidad, no bloquea automáticamente.
- Dependencia abierta eleva el bloqueo de la acción dependiente.
- Conflicto de horario reduce viabilidad.
- Repetición de postponement reduce el tamaño recomendado y eleva la necesidad de revisión.
- Dismissed/unhelpful reduce ranking de esa clase de intervención.
- Intrusive o proactive desactivado impide intervención proactiva.
- Fuente excluida queda fuera del siguiente snapshot.
- Confianza baja no dispara intervención automática.

## Memoria

Los outcomes actualizan tasas de completion/helpful/intrusive por `strategyKey`. Un solo outcome solo produce una observación. El patrón es emergente desde tres muestras y confirmado desde ocho. La estrategia aprendida modifica formato, tamaño, duración y horario recomendado, nunca la prioridad declarada por el usuario sin evidencia superior.

## Gate de intervención

```ts
shouldIntervene({
  score,
  confidence,
  userAllowsProactive,
  isCooldownActive,
  wasPreviouslyIntrusive,
  requiresConfirmation,
})
```

Debe devolver `false` si el usuario no permite proactive, hay cooldown, la intervención fue intrusiva o la confianza es baja. Las acciones externas requieren confirmación explícita y una clave idempotente.

## Explicabilidad

Cada recomendación expone cuatro capas:

1. Facts: señales observadas y su fuente.
2. Interpretation: inferencia resumida de Novo.
3. Recommendation: acción concreta y editable.
4. Confidence: alta/media/baja y limitación conocida.

Corrección y exclusión generan eventos de ledger y deben cambiar el siguiente snapshot.
