import { parseCognitiveGraphQuery } from '../request'

describe('cognitive graph request bounds', () => {
  const now = new Date('2026-09-11T12:00:00.000Z')

  it('clamps depth, limit, focus and history at the request boundary', () => {
    const params = new URLSearchParams({
      lens: 'patterns',
      depth: '99',
      limit: '999',
      focus: '  node:memory:one  ',
      since: '2020-01-01T00:00:00.000Z',
    })

    const result = parseCognitiveGraphQuery(params, now)

    expect(result).toMatchObject({ lens: 'patterns', depth: 3, limit: 35, focusNodeId: 'node:memory:one' })
    expect(result.since?.toISOString()).toBe('2026-03-15T12:00:00.000Z')
  })

  it('uses safe defaults for malformed controls and does not trust invalid dates', () => {
    const result = parseCognitiveGraphQuery(new URLSearchParams({ lens: 'not-a-lens', depth: 'wat', limit: '-1', since: 'not-a-date' }), now)

    expect(result).toEqual({ lens: 'now', depth: 2, limit: 8, since: undefined, focusNodeId: undefined })
  })
})
