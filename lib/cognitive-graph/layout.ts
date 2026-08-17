export function hashToUnitPair(id: string): { x: number; y: number } {
  let hashA = 2166136261
  let hashB = 16777619
  for (let index = 0; index < id.length; index += 1) {
    const code = id.charCodeAt(index)
    hashA = Math.imul(hashA ^ code, 16777619)
    hashB = Math.imul(hashB ^ (code + index), 2246822519)
  }
  return { x: ((hashA >>> 0) % 10000) / 10000, y: ((hashB >>> 0) % 10000) / 10000 }
}

type LayoutAnchor = {
  x: number
  y: number
  z: number
  angle: number
  radius: number
  spread: number
  yScale: number
  depth: number
}

const CLUSTER_ANCHORS: Record<string, LayoutAnchor> = {
  core: { x: 0.5, y: 0.5, z: 0, angle: 0, radius: 0.02, spread: 0.08, yScale: 0.7, depth: 0.05 },
  context: { x: 0.28, y: 0.35, z: -0.08, angle: -0.55, radius: 0.13, spread: 0.16, yScale: 0.72, depth: 0.18 },
  intent: { x: 0.28, y: 0.63, z: -0.02, angle: 2.35, radius: 0.14, spread: 0.17, yScale: 0.72, depth: 0.16 },
  evidence: { x: 0.23, y: 0.79, z: -0.1, angle: 1.2, radius: 0.11, spread: 0.16, yScale: 0.74, depth: 0.14 },
  learning: { x: 0.72, y: 0.34, z: 0.08, angle: -2.5, radius: 0.13, spread: 0.17, yScale: 0.7, depth: 0.2 },
  adaptation: { x: 0.75, y: 0.53, z: 0.12, angle: 0.1, radius: 0.13, spread: 0.17, yScale: 0.7, depth: 0.2 },
  outcome: { x: 0.72, y: 0.76, z: 0.04, angle: 0.95, radius: 0.11, spread: 0.15, yScale: 0.7, depth: 0.12 },
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function inferCluster(item: { kind?: string; cluster?: string }) {
  if (item.cluster) return item.cluster
  if (item.kind === 'twin') return 'core'
  if (item.kind === 'memory' || item.kind === 'pattern') return 'learning'
  if (item.kind === 'strategy') return 'adaptation'
  if (item.kind === 'outcome') return 'outcome'
  return 'context'
}

function anchorFor(item: { kind?: string; cluster?: string }, index: number, count: number): LayoutAnchor {
  const cluster = inferCluster(item)
  const fallback = CLUSTER_ANCHORS[cluster] || CLUSTER_ANCHORS.context
  if (cluster === 'core' || index === 0 || count === 1) return fallback
  const seed = hashToUnitPair(`${cluster}:${index}`)
  return {
    ...fallback,
    angle: fallback.angle + (seed.x - 0.5) * 0.85,
    radius: fallback.radius + (seed.y - 0.5) * 0.07 + Math.min(index, 4) * 0.014,
    spread: fallback.spread + (seed.x - 0.5) * 0.04,
    z: fallback.z + (seed.y - 0.5) * fallback.depth,
  }
}

export function assignStablePositions<T extends { id: string; cluster?: string; kind?: string }>(items: T[]) {
  const buckets = new Map<string, T[]>()
  for (const item of items) {
    const cluster = inferCluster(item)
    const bucket = buckets.get(cluster) || []
    bucket.push(item)
    buckets.set(cluster, bucket)
  }

  const orderedClusters = ['core', 'context', 'intent', 'evidence', 'learning', 'adaptation', 'outcome']
  const positioned = new Map<string, { x: number; y: number; z?: number }>()

  for (const cluster of orderedClusters) {
    const bucket = buckets.get(cluster)
    if (!bucket?.length) continue
    bucket.forEach((item, index) => {
      if (cluster === 'core') {
        const anchor = CLUSTER_ANCHORS.core
        positioned.set(item.id, { x: anchor.x, y: anchor.y, z: anchor.z })
        return
      }
      const seed = hashToUnitPair(`${item.id}:${index}`)
      const anchor = anchorFor(item, index, bucket.length)
      const radius = anchor.radius + seed.y * 0.08
      const angle = anchor.angle + (seed.x - 0.5) * anchor.spread
      const hemisphere = anchor.x >= 0.5 ? 1 : -1
      // Keep every semantic cluster inside the readable canvas safe area.
      // This matters on narrow mobile canvases where edge nodes otherwise
      // clip against the rounded frame and become impossible to select.
      const x = clamp(anchor.x + hemisphere * Math.abs(Math.cos(angle)) * radius, 0.18, 0.82)
      const y = clamp(anchor.y + Math.sin(angle) * radius * anchor.yScale, 0.16, 0.84)
      const z = anchor.z + (seed.y - 0.5) * anchor.depth
      positioned.set(item.id, { x, y, z })
    })
  }

  const fallbackItems = items.filter((item) => !positioned.has(item.id))
  fallbackItems.forEach((item, index) => {
    const seed = hashToUnitPair(`${item.id}:${index}`)
    const centerCluster = inferCluster(item)
    const anchor = CLUSTER_ANCHORS[centerCluster] || CLUSTER_ANCHORS.context
    positioned.set(item.id, {
      x: clamp(anchor.x + (seed.x - 0.5) * 0.12, 0.18, 0.82),
      y: clamp(anchor.y + (seed.y - 0.5) * 0.12, 0.16, 0.84),
      z: anchor.z + (seed.y - 0.5) * 0.04,
    })
  })

  return items.map((item) => ({ ...item, position: positioned.get(item.id) || { x: 0.5, y: 0.5, z: 0 } }))
}
