# Twin Brain Graph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every verified Twin learning visible as an evidence-backed graph node and present the Cognitive Twin as an explorable, useful brain-shaped graph.

**Architecture:** The existing graph projection remains the only graph source. It will project evolution events and persisted adaptation proposals into atomic nodes with deterministic semantic clusters. The Cognitive Center will add a progressive 3D-like brain map built with the installed Three.js runtime only when capability is present, while its semantic learning feed and SVG fallback remain the accessible default path.

**Tech Stack:** Next.js App Router, React, TypeScript, Prisma, existing event stream, Three.js, Jest.

## Global Constraints

- Preserve the existing graph API and owner-scoped Prisma reads.
- Do not create a second memory, activity, agent, or graph store.
- Each learning node must expose evidence, confidence, lifecycle, timestamp, and impact.
- WebGL is progressive enhancement; keyboard, screen reader, reduced motion, and non-WebGL paths retain equivalent learning controls.
- Do not add a dependency when installed `three` is sufficient; cap visible graph nodes at 35.

---

### Task 1: Project atomic learning and adaptation nodes

**Files:**
- Modify: `lib/cognitive-graph/types.ts`
- Modify: `lib/cognitive-graph/projection.ts`
- Test: `lib/cognitive-graph/__tests__/projection-adaptation.test.ts`

**Interfaces:**
- Produces `CognitiveGraphNode.cluster?: 'core' | 'context' | 'intent' | 'evidence' | 'learning' | 'adaptation' | 'outcome'` and `isNew?: boolean`.
- Produces `strategy` nodes named `adaptation:<proposal.id>` linked from Twin with `learned_from` and to relevant recommendations with `recommended_for`.

- [ ] **Step 1: Write failing projection tests**

```ts
expect(snapshot.nodes).toEqual(expect.arrayContaining([
  expect.objectContaining({ id: 'memory:evolution-1', kind: 'memory', cluster: 'learning' }),
  expect.objectContaining({ id: 'adaptation:reduce_context_switching', kind: 'strategy', cluster: 'adaptation' }),
]))
expect(snapshot.edges).toEqual(expect.arrayContaining([
  expect.objectContaining({ source: twinId, target: 'adaptation:reduce_context_switching', kind: 'learned_from' }),
]))
```

- [ ] **Step 2: Run the focused test and confirm the missing node failure**

Run: `npm test -- --runInBand lib/cognitive-graph/__tests__/projection-adaptation.test.ts`

- [ ] **Step 3: Implement bounded proposal projection**

```ts
for (const proposal of parsePersistedTwinAdaptationProposals(twin?.identity)) {
  addNode({ id: `adaptation:${proposal.id}`, kind: 'strategy', cluster: 'adaptation', ... })
  addEdge(twinId, `adaptation:${proposal.id}`, 'learned_from', true)
}
```

- [ ] **Step 4: Run the focused test and confirm it passes**

Run: `npm test -- --runInBand lib/cognitive-graph/__tests__/projection-adaptation.test.ts`

### Task 2: Create deterministic brain clusters and layout

**Files:**
- Modify: `lib/cognitive-graph/layout.ts`
- Test: `lib/cognitive-graph/__tests__/layout.test.ts`

**Interfaces:**
- Produces `assignBrainPositions(nodes)` with deterministic `position: { x, y, z }` keyed by node id and semantic cluster.

- [ ] **Step 1: Write failing layout tests**

```ts
expect(assignBrainPositions([{ id: 'twin:1', cluster: 'core' }])[0].position).toMatchObject({ x: 0.5, y: 0.5, z: 0 })
expect(assignBrainPositions([{ id: 'pattern:1', cluster: 'learning' }])[0].position?.x).not.toBe(0.5)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand lib/cognitive-graph/__tests__/layout.test.ts`

- [ ] **Step 3: Implement stable hemisphere grouping without simulation**

```ts
const hemisphere = node.cluster === 'learning' || node.cluster === 'adaptation' ? 0.66 : 0.34
return { x: hemisphere + (seed.x - 0.5) * 0.22, y: 0.18 + seed.y * 0.64, z: (seed.y - 0.5) * 0.28 }
```

- [ ] **Step 4: Run layout and projection tests**

Run: `npm test -- --runInBand lib/cognitive-graph/__tests__/layout.test.ts lib/cognitive-graph/__tests__/projection-adaptation.test.ts`

### Task 3: Surface a reactive learning feed

**Files:**
- Modify: `components/cognitive/cognitive-command-surface.tsx`
- Test: `components/cognitive/__tests__/cognitive-command-surface.test.tsx`

**Interfaces:**
- Consumes `snapshot.changes` and atomic learning/strategy nodes.
- Produces an `aria-live="polite"` learning feed with inspect controls and no fake timers.

- [ ] **Step 1: Write a failing component test**

```tsx
expect(screen.getByText('Nuevo aprendizaje del Twin')).toBeInTheDocument()
expect(screen.getByRole('button', { name: /reducir cambios de contexto/i })).toBeInTheDocument()
```

- [ ] **Step 2: Run the component test and confirm failure**

Run: `npm test -- --runInBand components/cognitive/__tests__/cognitive-command-surface.test.tsx`

- [ ] **Step 3: Add concise learning feed and event-highlight state**

```tsx
const learningNodes = snapshot.nodes.filter((node) => node.cluster === 'learning' || node.cluster === 'adaptation')
```

- [ ] **Step 4: Run the component test and confirm pass**

Run: `npm test -- --runInBand components/cognitive/__tests__/cognitive-command-surface.test.tsx`

### Task 4: Add progressive brain map with accessible fallback

**Files:**
- Create: `components/cognitive/twin-brain-map.tsx`
- Modify: `components/cognitive/cognitive-command-surface.tsx`
- Test: `components/cognitive/__tests__/twin-brain-map.test.tsx`

**Interfaces:**
- Consumes `nodes`, `edges`, `selectedId`, and `onSelectNode`.
- Produces a WebGL canvas when available and the existing SVG/list interaction otherwise.

- [ ] **Step 1: Write failing fallback and selection tests**

```tsx
render(<TwinBrainMap nodes={nodes} edges={edges} selectedId={null} onSelectNode={onSelectNode} />)
expect(screen.getByRole('img', { name: /mapa cerebral/i })).toBeInTheDocument()
fireEvent.click(screen.getByRole('button', { name: /patrón/i }))
expect(onSelectNode).toHaveBeenCalledWith('pattern:1')
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- --runInBand components/cognitive/__tests__/twin-brain-map.test.tsx`

- [ ] **Step 3: Implement capability-gated map**

```tsx
const canRenderWebGl = typeof window !== 'undefined' && !!window.WebGLRenderingContext && !reducedMotion
return canRenderWebGl ? <BrainCanvas ... /> : <AccessibleBrainMap ... />
```

- [ ] **Step 4: Run the focused map and command-surface tests**

Run: `npm test -- --runInBand components/cognitive/__tests__/twin-brain-map.test.tsx components/cognitive/__tests__/cognitive-command-surface.test.tsx`

### Task 5: Quality and product verification

**Files:**
- Modify: `docs/novo-launch-readiness.md`

- [ ] **Step 1: Run targeted cognitive tests**

Run: `npm test -- --runInBand lib/cognitive-graph/__tests__ components/cognitive/__tests__`

- [ ] **Step 2: Run static checks**

Run: `npm run lint && node --max-old-space-size=4096 ./node_modules/typescript/bin/tsc --noEmit --pretty false --incremental`

- [ ] **Step 3: Build and inspect production behavior**

Run: `npm run build`

- [ ] **Step 4: Run Impeccable detector on changed UI**

Run: `node C:\\Users\\Angel\\.codex\\plugins\\cache\\impeccable\\impeccable\\4.0.4\\skills\\impeccable\\scripts\\detect.mjs --json components/cognitive/cognitive-command-surface.tsx components/cognitive/twin-brain-map.tsx`

- [ ] **Step 5: Record results in launch readiness**

Document the production URL, validation commands, and any external test-environment limitation without exposing secrets.
