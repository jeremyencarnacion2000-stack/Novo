import {
  LiquidGlassBudget,
  type RefractivePriority,
} from '@/lib/liquid-glass/liquid-glass-budget'

describe('LiquidGlassBudget', () => {
  it('never grants more than five simultaneous SVG lenses', () => {
    const budget = new LiquidGlassBudget(5)
    for (let index = 0; index < 8; index += 1) {
      budget.request(`ambient-${index}`, 'ambient')
    }

    expect(budget.grantedIds()).toHaveLength(5)
  })

  it('lets a critical lens displace an ambient fallback without a sixth lease', () => {
    const budget = new LiquidGlassBudget(5)
    const priorities: RefractivePriority[] = Array(5).fill('ambient')
    priorities.forEach((priority, index) => budget.request(`ambient-${index}`, priority))

    budget.request('thinking-pill', 'critical')

    expect(budget.isGranted('thinking-pill')).toBe(true)
    expect(budget.grantedIds()).toHaveLength(5)
    expect(budget.isGranted('ambient-4')).toBe(false)
  })

  it('returns a released slot to the next waiting surface', () => {
    const budget = new LiquidGlassBudget(1)
    budget.request('navigation', 'interactive')
    budget.request('panel', 'ambient')

    budget.release('navigation')

    expect(budget.isGranted('panel')).toBe(true)
  })
})
