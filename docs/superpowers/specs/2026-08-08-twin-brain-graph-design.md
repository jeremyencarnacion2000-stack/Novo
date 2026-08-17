# Twin brain graph and visible learning

## Job and outcome

The Cognitive Center must make a user feel that Novo is learning from their
real work, not merely displaying a static graph. Success means that after a
verified outcome or correction, the user can see a named learning, its evidence,
its confidence and lifecycle, and the future behavior it changes.

## Chosen direction

Use a progressive brain-shaped 3D graph as the spatial exploration layer and
retain a semantic 2D/list experience as the primary explanation and fallback.
The brain is not a generic force-directed cloud: nodes cluster by cognitive
role (context, objectives, active actions, observed evidence, learned patterns,
adaptations, and outcomes), with stable locations and a visible "new learning"
transition. Selecting any node opens the existing evidence inspector.

## Learning contract

1. Every persisted Twin evolution entry projects into an individual memory or
   learning node, never only an aggregate policy node.
2. Persisted adaptation proposals project into individual adaptation nodes,
   each linked to its policy evidence and the recommendation(s) it affects.
3. Patterns grow from repeated evidence and display lifecycle, evidence count,
   qualitative confidence, latest update, and effect.
4. Graph changes are emitted through the existing Twin update event. The UI
   refreshes once, announces the new learning, and highlights it without fake
   timers.
5. The learning feed is visible above the graph and offers an inspect action;
   the graph is discovery, not the only way to understand Novo.

## Experience and layout

- On desktop, the 3D brain is an exploration canvas with restrained orbit,
  click/keyboard selection, focus mode, and a reset view.
- On narrow/low-capability/reduced-motion contexts, render the existing SVG map
  plus the exact same learning feed and inspector.
- Use stable grouping and bounded data (maximum 35 visible nodes). Only animate
  transforms/opacity. Do not add a new graph runtime, memory store, or agent
  protocol.
- Surface four states: no learning yet, learning in progress, new learning,
  and a recoverable graph load/capability failure.

## Architecture

- Extend `buildCognitiveGraphSnapshot` with explicit `learning` and
  `adaptation` nodes and evidence/action edges.
- Extend graph types with optional cluster and novelty metadata; preserve the
  existing API contract for current consumers.
- Add a small brain-layout projection built from the existing stable layout,
  with deterministic left/right hemispheric coordinates by node role.
- Make the Cognitive Command Surface consume the existing `novo:twin-updated`
  event and snapshot change set to show a concise learning timeline.
- Add an optional Three.js/R3F renderer only if already installed. Otherwise,
  use the existing SVG renderer and CSS depth treatment; no dependency is added
  solely for a decorative effect.

## Boundaries

- No clinical, psychological, or biometric claims.
- No autonomous external action or hidden learning.
- No unbounded simulation, graph polling loop, duplicate state, or fake
  activity.
- No regression to the desktop navigation or the dashboard-first user flow.

## Verification

- Unit tests for one evolution log and one adaptation proposal producing unique
  nodes and correct edges.
- Component tests for visible learning state, evidence inspector, and fallback.
- Typecheck, lint, relevant Jest suites, production build, and a desktop/mobile
  visual pass.
