import { prisma } from '@/lib/prisma'
import { applyGraphLens } from './lenses'
import { assignStablePositions } from './layout'
import type { BuildGraphOptions, CognitiveEvidence, CognitiveGraphEdge, CognitiveGraphNode, CognitiveGraphSnapshot, EvidenceReliability } from './types'
import { parsePersistedTwinAdaptationProposals } from '@/lib/cognitive/twin-adaptation'

export const COGNITIVE_POLICY_VERSION = 'cognitive-policy-v2'

function iso(value: Date | null | undefined) { return (value || new Date(0)).toISOString() }
function text(value: unknown, fallback: string) { return typeof value === 'string' && value.trim() ? value.trim().slice(0, 240) : fallback }
function confidence(value: number | null | undefined): EvidenceReliability { if (typeof value !== 'number') return 'low'; if (value >= 0.75) return 'high'; if (value >= 0.45) return 'medium'; return 'low' }
function list(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').slice(0, 8) : [] }
function record(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {} }
function cluster(kind: CognitiveGraphNode['kind']): CognitiveGraphNode['cluster'] {
  if (kind === 'twin') return 'core'
  if (kind === 'memory' || kind === 'pattern') return 'learning'
  if (kind === 'strategy') return 'adaptation'
  if (kind === 'outcome') return 'outcome'
  if (kind === 'signal' || kind === 'source') return 'evidence'
  if (kind === 'objective' || kind === 'project' || kind === 'action' || kind === 'intervention') return 'intent'
  return 'context'
}

function evidence(signal: { id: string; source: string; sourceRef: string | null; label: string; reliability: string; observedAt: Date; correctedAt: Date | null; correction: string | null; excludedAt: Date | null }): CognitiveEvidence {
  const reliability = signal.reliability === 'user_reported' || signal.reliability === 'direct' ? 'high' : signal.reliability === 'deterministic' ? 'medium' : 'low'
  const classification = signal.reliability === 'user_reported' ? 'user_reported' : signal.reliability === 'direct' ? 'observed' : signal.reliability === 'deterministic' ? 'deterministic_estimate' : signal.reliability === 'inference' ? 'model_inference' : 'uncalibrated'
  return { id: `evidence:${signal.id}`, sourceId: signal.sourceRef || signal.id, sourceType: signal.source, classification, observedAt: signal.observedAt.toISOString(), reliability, correctedAt: signal.correctedAt?.toISOString(), excludedAt: signal.excludedAt?.toISOString(), userConfirmed: signal.reliability === 'user_reported', label: signal.correction || signal.label }
}

function evolutionEvidence(change: { id: string; description: string; createdAt: Date }): CognitiveEvidence {
  return { id: `evidence:twin-evolution:${change.id}`, sourceId: change.id, sourceType: 'twin_evolution', classification: 'model_inference', observedAt: change.createdAt.toISOString(), reliability: 'medium', userConfirmed: false, label: change.description }
}

export async function buildCognitiveGraphSnapshot(options: BuildGraphOptions): Promise<CognitiveGraphSnapshot> {
  const since = options.since || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const [twin, goals, projects, tasks, ledger, preferences, actions, outcomes, evolution] = await Promise.all([
    prisma.cognitiveTwinRecord.findUnique({ where: { userId: options.userId }, select: { id: true, confidenceScore: true, trustLevel: true, identity: true, bottlenecks: true, updatedAt: true } }),
    prisma.goal.findMany({ where: { userId: options.userId, status: { not: 'completed' } }, orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }], take: 12, select: { id: true, title: true, status: true, priority: true, deadline: true, updatedAt: true } }),
    prisma.project.findMany({ where: { userId: options.userId, status: { not: 'completed' } }, orderBy: { updatedAt: 'desc' }, take: 12, select: { id: true, title: true, status: true, priority: true, dueDate: true, updatedAt: true } }),
    prisma.task.findMany({ where: { userId: options.userId, status: { not: 'done' } }, orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }], take: 20, select: { id: true, title: true, status: true, priority: true, dueDate: true, projectId: true, updatedAt: true } }),
    prisma.novoSignalLedger.findMany({ where: { userId: options.userId, observedAt: { gte: since } }, orderBy: { observedAt: 'desc' }, take: 80, select: { id: true, source: true, sourceRef: true, signalType: true, label: true, reliability: true, observedAt: true, correctedAt: true, correction: true, excludedAt: true } }),
    prisma.novoSignalSourcePreference.findMany({ where: { userId: options.userId }, select: { source: true, excludedAt: true } }),
    prisma.recommendedAction.findMany({ where: { userId: options.userId }, orderBy: [{ statusAt: 'desc' }, { createdAt: 'desc' }], take: 12, select: { id: true, title: true, nextStep: true, priority: true, confidence: true, explanation: true, facts: true, inferences: true, status: true, createdAt: true, updatedAt: true } }),
    prisma.outcomeEvent.findMany({ where: { userId: options.userId, createdAt: { gte: since } }, orderBy: { createdAt: 'desc' }, take: 40, select: { id: true, type: true, recommendedActionId: true, createdAt: true } }),
    prisma.twinEvolutionLog.findMany({ where: { userId: options.userId, OR: [{ createdAt: { gte: since } }, { changeType: 'adaptation_policy_updated' }] }, orderBy: { createdAt: 'desc' }, take: 30, select: { id: true, changeType: true, description: true, createdAt: true } }),
  ])

  const excluded = new Set(preferences.filter((item) => item.excludedAt).map((item) => item.source))
  const signals = ledger.filter((item) => !item.excludedAt && !excluded.has(item.source))
  const evidenceItems = [...signals.map(evidence), ...evolution.map(evolutionEvidence)]
  const nodes: CognitiveGraphNode[] = []
  const edges: CognitiveGraphEdge[] = []
  const addNode = (node: CognitiveGraphNode) => nodes.push({ ...node, cluster: node.cluster || cluster(node.kind) })
  const addEdge = (source: string, target: string, kind: CognitiveGraphEdge['kind'], inferred = false) => edges.push({ id: `${source}->${target}:${kind}`, source, target, kind, weight: inferred ? 0.45 : 0.7, confidence: inferred ? 'low' : 'high', evidenceIds: [], isInferred: inferred, isActive: true })
  const twinId = `twin:${twin?.id || options.userId}`
  addNode({ id: twinId, kind: 'twin', label: 'Tu Gemelo', summary: 'Centro operativo del contexto actual', status: twin?.trustLevel || 'initial', relevance: 1, confidence: confidence(typeof twin?.confidenceScore === 'number' ? twin.confidenceScore / 100 : undefined), evidenceIds: [], actionIds: actions.slice(0, 2).map((item) => item.id), createdAt: iso(twin?.updatedAt), updatedAt: iso(twin?.updatedAt), isInferred: false, isCorrectable: false, isExcluded: false, isStale: false })
  const mainFriction = text(record(twin?.bottlenecks).mainFrictionPoint, '')
  if (mainFriction && mainFriction !== 'not_detected') {
    const id = `blocker:${mainFriction}`
    addNode({ id, kind: 'blocker', label: mainFriction.replace(/_/g, ' '), summary: 'Fricción operativa registrada por el Twin', status: 'active', relevance: 0.86, confidence: 'medium', evidenceIds: [], actionIds: [], createdAt: iso(twin?.updatedAt), updatedAt: iso(twin?.updatedAt), isInferred: true, isCorrectable: true, isExcluded: false, isStale: false })
    addEdge(twinId, id, 'blocks', true)
  }

  for (const goal of goals) { const id = `goal:${goal.id}`; addNode({ id, kind: 'objective', label: text(goal.title, 'Objetivo sin título'), summary: goal.deadline ? `Vence ${goal.deadline}` : 'Objetivo activo', status: goal.status, relevance: goal.priority === 'high' ? 0.92 : 0.58, confidence: 'high', evidenceIds: [], actionIds: [], createdAt: iso(goal.updatedAt), updatedAt: iso(goal.updatedAt), isInferred: false, isCorrectable: true, isExcluded: false, isStale: false }); addEdge(twinId, id, 'supports') }
  for (const project of projects) { const id = `project:${project.id}`; addNode({ id, kind: 'project', label: text(project.title, 'Proyecto sin título'), summary: project.dueDate ? `Vence ${project.dueDate}` : project.status, status: project.status, relevance: project.priority === 'high' ? 0.84 : 0.58, confidence: 'high', evidenceIds: [], actionIds: [], createdAt: iso(project.updatedAt), updatedAt: iso(project.updatedAt), isInferred: false, isCorrectable: true, isExcluded: false, isStale: false }); addEdge(twinId, id, 'supports') }
  for (const task of tasks) { const id = `task:${task.id}`; addNode({ id, kind: 'action', label: text(task.title, 'Acción sin título'), summary: task.dueDate ? `Vence ${task.dueDate}` : task.status, status: task.status, relevance: task.priority === 'high' ? 0.9 : 0.55, confidence: 'high', evidenceIds: [], actionIds: [], createdAt: iso(task.updatedAt), updatedAt: iso(task.updatedAt), isInferred: false, isCorrectable: true, isExcluded: false, isStale: false }); addEdge(task.projectId ? `project:${task.projectId}` : twinId, id, 'belongs_to') }
  for (const signal of signals.slice(0, 20)) { const item = evidenceItems.find((entry) => entry.id === `evidence:${signal.id}`); const id = `signal:${signal.id}`; addNode({ id, kind: 'signal', label: text(signal.correction || signal.label, signal.signalType), summary: signal.source, status: signal.reliability, relevance: 0.5, confidence: item?.reliability || 'low', evidenceIds: item ? [item.id] : [], actionIds: [], createdAt: iso(signal.observedAt), updatedAt: iso(signal.observedAt), isInferred: signal.reliability === 'inference', isCorrectable: true, isExcluded: false, isStale: false }); addEdge(twinId, id, 'derived_from', signal.reliability === 'inference') }
  for (const preference of preferences) { const id = `source:${preference.source}`; addNode({ id, kind: 'source', label: preference.source, summary: preference.excludedAt ? 'Fuente excluida por ti' : 'Fuente activa', status: preference.excludedAt ? 'excluded' : 'active', relevance: 0.45, confidence: 'high', evidenceIds: [], actionIds: [], createdAt: iso(preference.excludedAt), updatedAt: iso(preference.excludedAt), isInferred: false, isCorrectable: true, isExcluded: Boolean(preference.excludedAt), isStale: false }); addEdge(twinId, id, 'supports') }
  for (const action of actions.slice(0, 8)) { const id = `recommendation:${action.id}`; addNode({ id, kind: 'intervention', label: text(action.title, 'Siguiente acción'), summary: action.status, status: action.status, relevance: Math.min(1, action.priority / 10), confidence: confidence(action.confidence), evidenceIds: [], actionIds: [action.id], createdAt: iso(action.createdAt), updatedAt: iso(action.updatedAt), isInferred: true, isCorrectable: true, isExcluded: action.status === 'dismissed', isStale: action.status === 'dismissed' }); addEdge(twinId, id, 'recommended_for', true) }
  for (const outcome of outcomes.slice(0, 12)) { const id = `outcome:${outcome.id}`; addNode({ id, kind: 'outcome', label: outcome.type, summary: 'Resultado registrado', status: outcome.type, relevance: 0.38, confidence: 'high', evidenceIds: [], actionIds: outcome.recommendedActionId ? [outcome.recommendedActionId] : [], createdAt: iso(outcome.createdAt), updatedAt: iso(outcome.createdAt), isInferred: false, isCorrectable: false, isExcluded: false, isStale: false }); if (outcome.recommendedActionId) addEdge(`recommendation:${outcome.recommendedActionId}`, id, 'executed_as') }
  for (const change of evolution.slice(0, 10)) { const id = `memory:${change.id}`; addNode({ id, kind: 'memory', label: text(change.description, 'Novo aprendió algo'), summary: change.changeType, status: 'learned', relevance: 0.5, confidence: 'medium', evidenceIds: [`evidence:twin-evolution:${change.id}`], actionIds: [], createdAt: iso(change.createdAt), updatedAt: iso(change.createdAt), isInferred: true, isCorrectable: false, isExcluded: false, isStale: false }); addEdge(twinId, id, 'learned_from', true) }

  const adaptationChange = evolution.find((change) => change.changeType === 'adaptation_policy_updated')
  const adaptationProposals = parsePersistedTwinAdaptationProposals(twin?.identity)
  if (adaptationChange) for (const proposal of adaptationProposals) {
    const id = `adaptation:${proposal.id}`
    addNode({ id, kind: 'strategy', label: proposal.behavior, summary: proposal.reason, status: 'prepared', relevance: 0.72, confidence: 'medium', evidenceIds: [`evidence:twin-evolution:${adaptationChange.id}`], actionIds: [], createdAt: iso(adaptationChange.createdAt), updatedAt: iso(adaptationChange.createdAt), isInferred: true, isCorrectable: false, isExcluded: false, isStale: false, isNew: true })
    addEdge(twinId, id, 'learned_from', true)
  }

  const changeCounts = new Map<string, number>()
  for (const change of evolution) changeCounts.set(change.changeType, (changeCounts.get(change.changeType) || 0) + 1)
  for (const [changeType, count] of changeCounts) {
    const latest = evolution.find((change) => change.changeType === changeType)
    if (!latest) continue
    const id = `pattern:${changeType}`
    const changeTokens = changeType.split('_').filter((token) => token.length > 2)
    const matchingSignals = signals.filter((signal) => changeTokens.some((token) => signal.signalType.includes(token) || signal.label.toLowerCase().includes(token)))
    const patternEvidenceIds = [...matchingSignals.map((signal) => `evidence:${signal.id}`), ...evolution.filter((item) => item.changeType === changeType).map((item) => `evidence:twin-evolution:${item.id}`)]
    if (!patternEvidenceIds.length) continue
    addNode({ id, kind: 'pattern', label: changeType.replace(/_/g, ' '), summary: `${count} señales de aprendizaje registradas`, status: count >= 3 ? 'emerging' : 'observed', relevance: Math.min(0.8, 0.42 + count * 0.08), confidence: count >= 3 ? 'medium' : 'low', evidenceIds: patternEvidenceIds, actionIds: [], createdAt: iso(latest.createdAt), updatedAt: iso(latest.createdAt), isInferred: true, isCorrectable: matchingSignals.length > 0, isExcluded: false, isStale: false })
    addEdge(twinId, id, 'learned_from', true)
  }
  const filtered = applyGraphLens({ nodes, edges, lens: options.lens, focusNodeId: options.focusNodeId, depth: Math.max(1, Math.min(options.depth || 2, 3)) })
  const ranked = filtered.nodes.sort((a, b) => b.relevance - a.relevance || a.id.localeCompare(b.id)).slice(0, Math.max(8, Math.min(options.limit || 35, 35)))
  const ids = new Set(ranked.map((node) => node.id))
  const latest = actions.find((action) => ['proposed', 'accepted', 'modified', 'started'].includes(action.status))
  const recommendation = latest ? { id: latest.id, title: text(latest.title, 'Siguiente acción'), nextStep: text(latest.nextStep, 'Define el primer paso concreto'), rationale: text(latest.explanation, 'Esta acción conecta con señales disponibles.'), actionLabel: latest.status === 'accepted' ? 'Continuar acción' : 'Comenzar', confidence: confidence(latest.confidence), facts: list(latest.facts), inferences: list(latest.inferences), evidenceIds: ranked.flatMap((node) => node.evidenceIds).slice(0, 8), actionId: latest.id } : undefined
  const learningChanges = [...evolution.map((item) => `memory:${item.id}`), ...adaptationProposals.map((proposal) => `adaptation:${proposal.id}`)].filter((id) => ids.has(id))
  return { id: `snapshot:${options.userId}:${options.lens}:${options.focusNodeId || 'root'}`, generatedAt: new Date().toISOString(), policyVersion: COGNITIVE_POLICY_VERSION, lens: options.lens, focusNodeId: options.focusNodeId, nodes: assignStablePositions(ranked), edges: filtered.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)), evidence: evidenceItems, changes: { addedNodeIds: learningChanges, changedNodeIds: learningChanges, removedNodeIds: [] }, recommendation }
}
