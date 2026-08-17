# Novo Visual Direction v2

**Status:** art-direction research and product direction. No implementation is
authorized by this document.  
**Date:** 2026-08-15  
**Product thesis:** The next interface for AI is not a better chat box. It is
shared context.

## The decision

Novo must stop borrowing the visual language of a generic AI landing page or a
graph demo. Its external experience and its Cognitive Twin have different jobs:

- The **landing** creates a memorable, editorial argument for shared context.
- The **product** makes shared context legible, useful and correctable.

The landing may use controlled scale, rhythm and a few consequential
transitions. The Twin must stay calm and information-first. It is not a 3D
universe, an animated decoration or an Obsidian-style node cloud.

The direction is **quiet intelligence, not liquid spectacle**.

## Research method and evidence

The following sources were reviewed as product and visual references. They are
not templates to copy.

### Directly reviewed

| Reference | What was observed | What Novo may learn | What Novo must not copy |
| --- | --- | --- | --- |
| [Refero](https://refero.design/) | A library organized around real web/iOS screens, flows, UI elements and tasks, rather than invented "premium" concepts. | Use real product flows as the standard for navigation, inspectors, dialogs and responsive behavior. | Treat a reference gallery as a design system or copy a visual skin. |
| [Mobbin](https://mobbin.com/) | A real-product library organized by screens, elements and complete flows. | Audit the product through concrete states: navigation, sheets, Chat, correction and return flow. | Use landing motion as a substitute for interaction clarity. |
| [Linear](https://linear.app/) | An extremely restrained dark page: large empty intervals, one statement at a time and product evidence that carries the narrative. | Landing sections need one job each; product screenshots should prove a claim, not decorate it. | Linear's black-on-black visual identity or its developer-product posture. |
| [Raycast](https://www.raycast.com/) | A single focused promise, generous negative space and product moments revealed as a sequence. | The first Novo viewport needs one clear visual anchor and one action. | A long feature catalogue or a keyboard-utility aesthetic inside the Twin. |
| [Granola](https://www.granola.ai/) | An editorial landing that repeatedly shows a real, evolving note/brief/action context before, during and after a meeting. | Context becomes believable when the same underlying artifact changes across the narrative. This is the strongest direct reference for Novo's continuity story. | Its note-taking brand, lime palette or meeting-specific copy. |
| [Capacities](https://capacities.io/) | Object relationships are shown in service of an active object; the relationship map is supporting evidence, not the entire product. | Start from a meaningful object/context and reveal connected evidence on demand. | A generic "second brain" claim or freeform knowledge graph as Novo's primary value. |

### Reference queue before implementation

These are specific pages/products to capture and annotate during the next art
direction session. They are not yet implementation instructions.

#### Landing composition and motion

1. [Apple Vision Pro](https://www.apple.com/apple-vision-pro/) — scroll-scale
   and staged visual reveal.
2. [Rive](https://rive.app/) — interaction-led motion that explains a system.
3. [Mercury](https://mercury.com/) — editorial product windows and restraint.
4. [Vercel](https://vercel.com/) — disciplined black space and technical proof.
5. [Cursor](https://cursor.com/) — clear AI-product positioning without an
   overloaded first screen.
6. [Figma](https://www.figma.com/) — product proof as narrative rather than a
   screenshot wall.
7. [Framer](https://www.framer.com/) — kinetic section transitions and pacing.
8. [Runway](https://runwayml.com/) — cinematic pacing, only as a reference for
   sequence and scale.

#### Product, context and inspection

1. [Heptabase](https://heptabase.com/) — spatial sensemaking and focus.
2. [Tana](https://tana.inc/) — structured context and progressive disclosure.
3. [Notion](https://www.notion.com/product) — hierarchy around a primary object.
4. [Figma](https://www.figma.com/) — inspector patterns and primary-canvas
   relationships.
5. [Reflect](https://reflect.app/) — personal knowledge without graph-first UI.
6. [Readwise Reader](https://readwise.io/read) — source provenance and evidence.
7. [Apple Health](https://www.apple.com/ios/health/) — trend presentation with
   a human-readable interpretation.
8. [Linear](https://linear.app/) — detail panels that preserve the surrounding
   working context.

## Synthesized direction

### What is table stakes

- Clear navigation, stable controls, readable surfaces and one obvious current
  action.
- A focused object can reveal detail without losing the user's location.
- Evidence, source and uncertainty are visible when an AI makes a claim.
- Motion has one job: orient, reveal a relationship or confirm a state change.

### The opportunity specific to Novo

Most AI products make the model's output visible. Most knowledge products make
the user's information visible. Novo should make the **relationship between
observed reality, the Twin's interpretation and the next decision** visible.

> **Eureka:** graph products assume that more visible connections create more
> understanding. Novo's user needs the opposite: a small, current model first,
> then an evidence path only when they ask why.

## Twin interaction direction

### 1. Resting state: the current cognitive field

The default state answers one question in two seconds: *what is occupying
Novo's attention now?*

- One central Twin / current-context node.
- Four to six dominant contexts, selected by relevance and recency.
- One compact label per visible context; no simultaneous paragraphs on the
  canvas.
- Quiet causal threads, only where they improve recognition.
- Facts, inferences, patterns, evidence and outcomes use role and language,
  not a rainbow of unrelated colors.
- The full graph remains discoverable through a deliberate secondary control;
  it is never the default visual burden.

This is a **focus-context layout**, not an orbital 3D model. A slight sense of
depth is acceptable only if it strengthens grouping; navigation and selection
cannot depend on rotating a sphere field.

### 2. Selection: reorganize around a question

Selecting a context must cause a physical, deterministic re-layout rather than
only changing opacity. The selected concept becomes the center of a causal
explanation:

```text
supporting observations / outcomes
              ↓
      selected understanding
              ↓
   affected context / next action
```

The user should recognize the direction of reasoning without reading a legend.
The existing evidence, relation and recommendation data remains authoritative;
this is a presentation contract, not a second graph model.

### 3. Why: an evidence dossier, not another graph mode

`Why` should replace the canvas with an investigation-like surface:

1. Novo's current belief in one plain sentence.
2. Supporting observations, explicitly marked as facts or inferences.
3. Recent outcomes or changes that matter.
4. The concrete effect on the current recommendation.
5. Controls to correct or exclude the input.

The relationship graph may appear as a small supporting trace, but `Why` must
be readable as a causal dossier on its own. It is the trust surface, not an
alternate visualization setting.

### 4. Inspector: preserve place, expose detail

The inspector is the third layer, after current context and causal explanation.

- Desktop: a contained side inspector that keeps the cognitive field visible.
- Mobile: a gesture-safe sheet with a clear close/return state.
- Content order: meaning, confidence/lifecycle, evidence, relationships,
  effect, then correction/exclusion.
- Correction needs a deliberate inline or sheet editor tied to the cited
  evidence. It should never feel like a browser prompt detached from the
  belief being changed.

### 5. Learning is a state transition

A new learning does not arrive as another floating node. It appears as a small
meaningful change:

```text
observed outcome → emerging understanding → confirmed pattern → adapted next action
```

The user must be able to inspect why it advanced, how much evidence it has and
what behavior changed. This gives growth a purpose beyond node count.

## Current implementation: precise gaps

This is a diagnosis, not a request to change code yet.

| Current behavior | Directional problem | Future recovery target |
| --- | --- | --- |
| `TwinBrainMap` renders all supplied nodes as a rotatable Three.js scene. | The resting state reads as a visualization before it reads as Novo's current understanding. | Derive a bounded dominant-context view for the resting state. |
| `explore`, `focus` and `why` share one canvas; mode changes mainly spotlight/opacity. | Selecting a context does not visibly reorganize the causal story, and Why remains a graph setting. | Define three distinct presentation states: field, causal focus and evidence dossier. |
| The SVG fallback and WebGL canvas use different render paths. | Their handoff can create the two-version flash reported in production. | One stable initial structure, followed by a compatible enhanced state only if it preserves the same layout. |
| A perpetual low-amplitude scene rotation runs when reduced motion is off. | Ambient movement makes the Twin feel ornamental instead of inspectable. | Reserve motion for selection, re-layout and data/state change. |
| The current inspector does show confidence, evidence, relations and correction. | Its information is valuable, but the correction entry uses a detached browser prompt and Why is not its own narrative. | Keep the provenance contract; change only the interaction sequence after the visual direction is approved. |

Relevant current components and services to preserve:

- `components/cognitive/twin-brain-map.tsx`
- `components/cognitive/cognitive-command-surface.tsx`
- `lib/cognitive-graph/projection.ts`
- `app/api/cognitive/graph`
- `app/api/cognitive/patterns`
- `lib/cognitive-memory.ts`

## Landing direction: five acts, not a feature catalogue

### Act I — Shared context

One oversized thesis, one live Twin artifact and one action. The first viewport
should feel closer to an editorial cover than a SaaS dashboard.

**Headline:** “The next interface for AI isn't a better chat box. It's shared
context.”

The visual should contain a small field that responds to attention, not floating
feature cards. It proves that Novo has a model of context before the visitor
reads a feature list.

### Act II — Context drift

As the visitor scrolls, fragments of intention, work, evidence and outcomes
lose their relationship. This is a single state transition, not background
particles. The point is felt before it is explained: fragmented tools force
people to reconstruct context.

### Act III — Shared context restored

The same fragments resolve into one coherent operating model. The motion is
geometric and causal: elements that had drifted reconnect because Novo has
understood their relationship.

### Act IV — Real product, one narrative

Show Today, Cognitive and Activity as consecutive evidence of the same loop:

```text
reality changed → Novo understood it → one next action changed → outcome remains visible
```

Never stack unrelated screenshots. Each product frame needs a caption that
advances the same story.

### Act V — The closing line

A typographic/cinematic end state can use a masked product image or video only
when it lands the thesis: **SHARED CONTEXT** or **STAY IN CONTEXT**. It must not
introduce a new visual language in the final screen.

## Material, typography and motion guardrails

- The product remains typographically functional and compact. The landing may
  use one editorial display moment, but it must not make the app feel like a
  magazine.
- Warm neutral light surfaces and neutral graphite dark surfaces support the
  Twin better than blue-black fills. Green is an evidence/live-state signal,
  not a universal decorative wash.
- Cards earn their existence through grouping or action. They are not the page
  layout.
- Remove decorative glass, ambient drift and parallax where they do not convey
  state, hierarchy or a relationship.
- Every motion has a reduced-motion equivalent and must leave the information
  legible in a still frame.
- Do not reuse motion intended for landing theater in the authenticated
  Cognitive product.

## Required approval gate before implementation

1. Capture and annotate the remaining references in the queue.
2. Approve this direction or revise its specific decisions.
3. Write an implementation brief with exact states for Resting, Focus, Why,
   Inspector, loading, empty and error.
4. Design one controlled comparison of the landing's five acts.
5. Only then change the Twin or landing code.

Until these gates pass: no new graph effect, no new landing animation, no
visual rewrite and no second cognitive model.
