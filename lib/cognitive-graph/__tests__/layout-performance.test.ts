import { assignStablePositions } from '../layout'

describe('cognitive graph layout performance', () => {
  it.each([30, 100, 500, 2000])('positions %i nodes deterministically within bounded space', (count) => {
    const nodes = Array.from({ length: count }, (_, index) => ({ id: `node:${index}` }))
    const started = Date.now()
    const first = assignStablePositions(nodes)
    const elapsed = Date.now() - started

    expect(first).toHaveLength(count)
    expect(first.every((node) => node.position && node.position.x >= 0.18 && node.position.x <= 0.82 && node.position.y >= 0.16 && node.position.y <= 0.84)).toBe(true)
    expect(assignStablePositions(nodes)).toEqual(first)
    expect(elapsed).toBeLessThan(1000)
  })
})
