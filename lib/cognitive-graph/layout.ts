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

export function assignStablePositions<T extends { id: string; cluster?: string }>(items: T[]) {
  return items.map((item, index) => {
    if (index === 0 || item.cluster === 'core') return { ...item, position: { x: 0.5, y: 0.5, z: 0 } }
    const seed = hashToUnitPair(item.id)
    const rightHemisphere = item.cluster === 'learning' || item.cluster === 'adaptation' || item.cluster === 'outcome'
    const center = rightHemisphere ? 0.66 : 0.34
    return { ...item, position: { x: center + (seed.x - 0.5) * 0.28, y: 0.16 + seed.y * 0.68, z: (seed.y - 0.5) * 0.32 } }
  })
}
