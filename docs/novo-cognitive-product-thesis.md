# Novo Cognitive Product Thesis

**Status:** product decision filter  
**Date:** 2026-08-15  
**Category:** Cognitive Adaptive Application

## The thesis

> The next interface for AI is not a better chat box. It is shared context.

People should not have to restate their intent, circumstances, preferences,
previous attempts, and changing priorities every time they need help. Novo
reduces that distance by maintaining a persistent, inspectable and correctable
working model of the person's context.

Novo is neither a task manager, dashboard, generic assistant, nor a wrapper
around a model. It is a **Cognitive Adaptive Application**: a continuous
human--Twin relationship that turns observed context into understandable,
permissioned and verifiable help.

## The product promise: shared understanding

The outcome is not more AI output. It is **shared understanding**: Novo can
show what it currently understands, why it thinks that, what remains uncertain,
and how the user can correct it. The system adapts to the person; the person
does not rebuild the situation in every prompt.

Every surface is a view of the same Cognitive Twin:

- **Today** makes the current situation and next useful step actionable.
- **Cognitive** makes the Twin's model, evidence, relationships and learning
  inspectable.
- **Chat** is a conversational entry point to that same model, never a parallel
  memory or recommendation system.
- **Activity** makes actions, outcomes, verification and adaptation legible.
- **Actions and integrations** perform permissioned work and return evidence to
  the same model.

## Four pillars

1. **Understanding** -- build an evidence-backed representation of current
   context, behavior, work and constraints.
2. **Adaptation** -- change recommendations or behavior only when evidence or a
   user correction warrants it.
3. **Agency** -- take real actions only with the correct permission boundary;
   keep the action and result visible.
4. **Continuity** -- preserve relevant understanding across sessions, tools,
   devices, agents and surfaces.

## The real cognitive loop

The product must represent a working protocol, not a decorative loading state:

1. **Observe** a relevant signal, event or explicitly provided context.
2. **Understand** the current context, keeping observations distinct from
   inferences.
3. **Propose** one explainable next action with evidence, impact, time cost and
   qualitative confidence.
4. **Act** only after the required user confirmation.
5. **Verify** the result or failure.
6. **Learn** from the outcome without overstating certainty.
7. **Adapt** the next recommendation when the evidence supports it.

An external system can report a new fact before planning is available. Novo
must retain that fact durably, make a replan recoverable, and never pretend the
world did not change because an AI call is temporarily unavailable.

## How the Twin earns trust

The Cognitive Twin communicates: *"This is how I currently understand how you
operate."* That statement is useful only when it is inspectable.

- Facts, inferences, evidence, patterns and outcomes have visibly distinct
  roles.
- A pattern shows its lifecycle, evidence/sample count, last update, impact and
  qualitative confidence.
- Each inference has a path back to evidence or a clear uncertainty state.
- Users can correct, exclude or pause learning. A correction is not complete
  until it is durable and can change a later recommendation or behavior.
- Novo does not make clinical, psychological or biometric claims.

## Architecture boundary

The existing cognitive services are the authority for this experience:

- `lib/cognitive-memory.ts`
- `app/api/cognitive/patterns`
- `lib/cognitive-graph/projection.ts`
- `components/cognitive/cognitive-command-surface.tsx`
- `app/api/cognitive/loop/plan`
- `lib/ai/activity`

New UI or interaction work must reuse these contracts. It must not introduce a
second memory store, graph, activity protocol, recommendation engine or agent
runtime. Chat, graph, activity and action surfaces may present different parts
of the model, but they must never disagree about the model's identity.

## Product decision filter

Before adding a screen, effect, metric, integration or capability, answer:

1. Does it improve shared context, understanding, adaptation, agency or
   continuity?
2. Does it make the loop more real, explainable or correctable?
3. Does it reuse the existing cognitive model and ownership boundaries?
4. Does it preserve a clear user permission and verification boundary?

If the answer is no, it is not part of Novo's core product direction.
