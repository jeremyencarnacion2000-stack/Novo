export type CognitiveLens = 'now' | 'goals' | 'patterns' | 'memory' | 'sources'
export type EvidenceClassification = 'user_reported' | 'observed' | 'deterministic_estimate' | 'model_inference' | 'uncalibrated'
export type EvidenceReliability = 'high' | 'medium' | 'low'
export type CognitiveNodeKind = 'twin' | 'objective' | 'project' | 'commitment' | 'action' | 'routine' | 'constraint' | 'blocker' | 'signal' | 'memory' | 'pattern' | 'strategy' | 'intervention' | 'outcome' | 'source' | 'integration'
export type CognitiveEdgeKind = 'supports' | 'blocks' | 'depends_on' | 'conflicts_with' | 'derived_from' | 'belongs_to' | 'caused_by' | 'learned_from' | 'recommended_for' | 'executed_as' | 'corrected_by' | 'excluded_from'
export type CognitiveNodeCluster = 'core' | 'context' | 'intent' | 'evidence' | 'learning' | 'adaptation' | 'outcome'

export interface CognitiveEvidence {
  id: string
  sourceId: string
  sourceType: string
  classification: EvidenceClassification
  observedAt: string
  reliability: EvidenceReliability
  correctedAt?: string
  excludedAt?: string
  userConfirmed: boolean
  label: string
}

export interface CognitiveGraphNode {
  id: string
  kind: CognitiveNodeKind
  label: string
  summary?: string
  status?: string
  relevance: number
  urgency?: number
  confidence: EvidenceReliability
  evidenceIds: string[]
  actionIds: string[]
  createdAt: string
  updatedAt: string
  lastActivityAt?: string
  isInferred: boolean
  isCorrectable: boolean
  isExcluded: boolean
  isStale: boolean
  cluster?: CognitiveNodeCluster
  isNew?: boolean
  position?: { x: number; y: number; z?: number }
}

export interface CognitiveGraphEdge {
  id: string
  source: string
  target: string
  kind: CognitiveEdgeKind
  weight: number
  confidence: EvidenceReliability
  evidenceIds: string[]
  isInferred: boolean
  isActive: boolean
}

export interface CognitiveGraphSnapshot {
  id: string
  generatedAt: string
  policyVersion: string
  lens: CognitiveLens
  focusNodeId?: string
  nodes: CognitiveGraphNode[]
  edges: CognitiveGraphEdge[]
  evidence: CognitiveEvidence[]
  changes: { addedNodeIds: string[]; changedNodeIds: string[]; removedNodeIds: string[] }
  recommendation?: {
    id: string
    title: string
    nextStep: string
    rationale: string
    actionLabel: string
    confidence: EvidenceReliability
    facts: string[]
    inferences: string[]
    evidenceIds: string[]
    actionId?: string
  }
}

export interface BuildGraphOptions {
  userId: string
  lens: CognitiveLens
  focusNodeId?: string
  depth?: number
  limit?: number
  since?: Date
}
