// Derives a node/edge graph from the user's existing CognitiveTwinRecord +
// BehavioralSignal history. This is a VIEW over data that already exists —
// deliberately not a new storage model. Deterministic mapping, not an LLM
// extraction step: cheap, instant, and never produces a hallucinated edge.

export interface GraphNode {
  id: string;
  label: string;
  detail: string;
  kind: 'root' | 'identity' | 'energy' | 'bottleneck' | 'signal' | 'metric';
  weight: number; // 1-10, drives node radius
  isNew?: boolean; // twin inferred something new about this dimension recently — the "learning" signal
}

export interface GraphEdge {
  source: string;
  target: string;
  /** 'structure' = hierarchy (root→category); 'insight' = a derived correlation worth highlighting */
  kind: 'structure' | 'insight';
}

export interface CognitiveGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface TwinRecordLike {
  identity: unknown;
  energyCurve: unknown;
  metrics: unknown;
  bottlenecks: unknown;
}

interface SignalCount {
  signal: string;
  count: number;
}

const SIGNAL_LABEL: Record<string, string> = {
  task_created: 'Crea tareas',
  task_completed: 'Completa tareas',
  task_deferred: 'Pospone tareas',
  focus_started: 'Inicia foco',
  focus_finished: 'Termina foco',
  routine_completed: 'Cumple rutinas',
  routine_skipped: 'Salta rutinas',
};

// Which bottleneck correlates with which behavioral signal — the one real
// "insight" cross-link per bottleneck, instead of a flat hierarchy.
const BOTTLENECK_SIGNAL: Record<string, string> = {
  procrastination: 'task_deferred',
  context_switching: 'focus_started',
  overcommitment: 'task_created',
  lack_of_structure: 'routine_skipped',
};

// TwinEvolutionLog.changeType → the graph node that inference just touched.
// Lets recent, real inference events (already written by
// lib/inngest/functions/process-twin-signal.ts for every real user) surface
// as a visible "the twin just learned something" pulse — no new tracking.
const CHANGE_TYPE_NODE: Record<string, string> = {
  chronotype_updated: 'chronotype',
  peak_window_detected: 'peak-window',
  friction_detected: 'bottleneck',
  trust_level_up: 'root',
};

// Same changeTypes, but for the decision feed (components/cognitive/decision-feed.tsx):
// a human-readable Spanish headline and which graph `kind` colour to borrow,
// so a log entry and the node it pulsed read as the same event.
export const CHANGE_TYPE_LABEL: Record<string, string> = {
  chronotype_updated: 'Cronotipo detectado',
  peak_window_detected: 'Ventana pico detectada',
  friction_detected: 'Bloqueo detectado',
  decision_fatigue_raised: 'Señal histórica no utilizada',
  burnout_risk_raised: 'Señal histórica no utilizada',
  trust_level_up: 'Confianza del twin subió',
};

export const CHANGE_TYPE_KIND: Record<string, GraphNode['kind']> = {
  chronotype_updated: 'energy',
  peak_window_detected: 'energy',
  friction_detected: 'bottleneck',
  decision_fatigue_raised: 'metric',
  burnout_risk_raised: 'metric',
  trust_level_up: 'root',
  ai_action: 'signal',
};

// AiActionLog.actionType (AIActionType from lib/ai/actions.ts) → Spanish label
// for the decision feed. Executor actions the AI actually ran, not just
// inferred — the "the AI did this" half of the audit trail.
export const ACTION_TYPE_LABEL: Record<string, string> = {
  CREATE_TASK: 'Creó una tarea',
  CREATE_TASKS: 'Creó varias tareas',
  UPDATE_TASK: 'Actualizó una tarea',
  DELETE_TASK: 'Eliminó una tarea',
  CREATE_PROJECT: 'Creó un proyecto',
  UPDATE_PROJECT: 'Actualizó un proyecto',
  DELETE_PROJECT: 'Eliminó un proyecto',
  CREATE_ROUTINE: 'Creó una rutina',
  UPDATE_ROUTINE: 'Actualizó una rutina',
  DELETE_ROUTINE: 'Eliminó una rutina',
  CREATE_NOTE: 'Creó una nota',
  UPDATE_NOTE: 'Actualizó una nota',
  CREATE_EVENT: 'Creó un evento',
  CREATE_TRACKER: 'Creó un tracker',
  CREATE_COURSE: 'Creó un curso',
  UPDATE_COURSE: 'Actualizó un curso',
  DELETE_COURSE: 'Eliminó un curso',
  ADD_GRADE: 'Agregó una calificación',
  UPDATE_GRADE: 'Actualizó una calificación',
  DELETE_GRADE: 'Eliminó una calificación',
  START_WORKOUT: 'Inició un entrenamiento',
  FINISH_WORKOUT: 'Terminó un entrenamiento',
  GENERATE_FILE: 'Generó un archivo',
  GENERATE_DAILY_INSIGHT: 'Generó tu resumen diario',
  REENGAGEMENT_EMAIL: 'Envió un email de re-enganche',
};

export function buildCognitiveGraph(
  twin: TwinRecordLike | null,
  signalCounts: SignalCount[],
  recentChangeTypes: string[] = [],
): CognitiveGraph {
  const nodes: GraphNode[] = [{ id: 'root', label: 'Tu Gemelo', detail: 'Cognitive Twin', kind: 'root', weight: 10 }];
  const edges: GraphEdge[] = [];

  const identity = (twin?.identity as any) || {};
  const energyCurve = (twin?.energyCurve as any) || {};
  const metrics = (twin?.metrics as any) || {};
  const bottlenecks = (twin?.bottlenecks as any) || {};

  if (identity.role) {
    nodes.push({ id: 'identity', label: identity.role, detail: identity.industry || 'Identidad', kind: 'identity', weight: 7 });
    edges.push({ source: 'root', target: 'identity', kind: 'structure' });

    if (identity.focusStyle) {
      nodes.push({ id: 'focus-style', label: identity.focusStyle.replace(/_/g, ' '), detail: 'Estilo de foco', kind: 'identity', weight: 5 });
      edges.push({ source: 'identity', target: 'focus-style', kind: 'structure' });
    }
  }

  if (energyCurve.chronotype) {
    nodes.push({ id: 'chronotype', label: energyCurve.chronotype.replace(/_/g, ' '), detail: 'Cronotipo', kind: 'energy', weight: 7 });
    edges.push({ source: 'root', target: 'chronotype', kind: 'structure' });

    if (energyCurve.peakFocusStart) {
      nodes.push({
        id: 'peak-window',
        label: `${energyCurve.peakFocusStart}-${energyCurve.peakFocusEnd || ''}`,
        detail: 'Pico de energía',
        kind: 'energy',
        weight: 5,
      });
      edges.push({ source: 'chronotype', target: 'peak-window', kind: 'structure' });
    }
  }

  const mainFriction: string | undefined = bottlenecks.mainFrictionPoint;
  if (mainFriction && mainFriction !== 'not_detected') {
    nodes.push({ id: 'bottleneck', label: mainFriction.replace(/_/g, ' '), detail: 'Bloqueo principal', kind: 'bottleneck', weight: 8 });
    edges.push({ source: 'root', target: 'bottleneck', kind: 'structure' });
  }

  if (typeof metrics.currentCognitiveLoad === 'number') {
    nodes.push({ id: 'load', label: `${Math.round(metrics.currentCognitiveLoad)}%`, detail: 'Carga operativa estimada (no biométrica)', kind: 'metric', weight: 4 + metrics.currentCognitiveLoad / 20 });
    edges.push({ source: 'root', target: 'load', kind: 'structure' });
  }

  // Top behavioral signals by frequency (last 30 days) — real, observed behavior.
  const topSignals = [...signalCounts].sort((a, b) => b.count - a.count).slice(0, 4);
  for (const s of topSignals) {
    const id = `signal:${s.signal}`;
    nodes.push({
      id,
      label: SIGNAL_LABEL[s.signal] || s.signal,
      detail: `${s.count} veces (30d)`,
      kind: 'signal',
      weight: Math.min(9, 3 + Math.log2(s.count + 1)),
    });
    edges.push({ source: 'root', target: id, kind: 'structure' });
  }

  // The one deliberate cross-link: connect the bottleneck to the behavioral
  // signal that actually explains it, if that signal made the top list.
  if (mainFriction) {
    const correlatedSignal = BOTTLENECK_SIGNAL[mainFriction];
    const signalNodeId = `signal:${correlatedSignal}`;
    if (correlatedSignal && nodes.some(n => n.id === signalNodeId)) {
      edges.push({ source: 'bottleneck', target: signalNodeId, kind: 'insight' });
    }
  }

  const newNodeIds = new Set(recentChangeTypes.map(t => CHANGE_TYPE_NODE[t]).filter(Boolean));
  for (const n of nodes) {
    if (newNodeIds.has(n.id)) n.isNew = true;
  }

  return { nodes, edges };
}
