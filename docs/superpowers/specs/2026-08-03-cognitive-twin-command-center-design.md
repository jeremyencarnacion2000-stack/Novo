# Cognitive Twin Command Center design

## Product outcome

When a user opens `/cognitive`, they should understand the next important move before seeing secondary metrics. The page must communicate one recommendation, why it exists, what evidence supports it, what Novo can do with permission, and what the system learned from prior outcomes.

## First viewport

1. Compact top bar: current lens, sync timestamp, sources/privacy access and command/search.
2. Cognitive Brief: recommendation title, blocker/change, primary action, secondary modify action and “Why this?”.
3. Twin Presence: small non-permanent activity indicator tied to real activity phases.
4. Evidence strip: a few factual signals with source and reliability, not scores without provenance.

Metrics, deep analytics and provider names move below the first decision or into secondary lenses.

## Graph model

One server-generated snapshot contains typed nodes, typed relationships and evidence references. Lenses are projections over that same snapshot:

- `now`: current objective, blocker, deadline, action and relevant dependencies.
- `goals`: objectives, projects, commitments, actions and outcomes.
- `patterns`: corroborated patterns, strategies and outcomes.
- `memory`: episodic, semantic and procedural memory summaries.
- `sources`: integrations, source permissions, exclusions and corrections.

The initial snapshot is limited to 35 nodes desktop and 15 mobile. Selecting a node changes the focus context and opens the inspector rather than showing every label at once.

## Inspector

The inspector shows node label/type/status/relevance, connections, evidence source/timestamp/reliability, history, related recommendation and allowed actions. It separates observed facts from inferred relationships. Corrections and exclusions call the existing signal ledger API. On mobile the inspector is a draggable bottom sheet; Escape closes it.

## Adaptive behavior

The recommendation comes from persisted `ActionPlan`/`RecommendedAction` data and the deterministic policy. Outcomes update strategy summaries only after repeated evidence. Rejected or intrusive intervention patterns are down-ranked or suppressed. User-declared priorities remain authoritative unless stronger direct evidence is shown and the user can correct the inference.

## Motion and visual direction

Retain Novo’s cream/deep-neutral/green language. Use restrained radial light and a small grain texture; no default AI violet, crypto dashboard neon or medical biometrics. Motion is limited to selection, focus, inspector entry, confirmation and real activity. Use transform/opacity, stable containers, and reduced-motion fallbacks.

## Accessibility

The graph is not the only representation. A list/tree view exposes every visible relationship in text. Lens controls use `aria-pressed`; selected nodes use `aria-current`; inspector is labelled and focus-managed; phase changes use polite announcements without token-by-token speech. Reduced motion removes pulsing, camera movement and edge motion.

## Explicit non-goals

- No new cognitive database schema in the first slice.
- No raw chain-of-thought.
- No fake fatigue or biometric scores.
- No LLM request per render.
- No full Sigma migration before the contract and SVG slice are proven.
