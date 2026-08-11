import { inferTwinAdaptationProposals, parsePersistedTwinAdaptationProposals } from '../twin-adaptation'

describe('Twin adaptation proposals', () => {
  it('keeps confirmation boundaries while the Twin is learning', () => {
    const proposals = inferTwinAdaptationProposals({ confidenceScore: 40, trustLevel: 'learning', energyCurve: {}, bottlenecks: {} })
    expect(proposals.map((proposal) => proposal.id)).toContain('keep_confirmation_boundary')
    expect(proposals.map((proposal) => proposal.id)).not.toContain('use_validated_pattern')
  })

  it('turns observed friction and energy into bounded behavior proposals', () => {
    const proposals = inferTwinAdaptationProposals({ confidenceScore: 82, trustLevel: 'adapted', energyCurve: { chronotype: 'morning_lark' }, bottlenecks: { mainFrictionPoint: 'context_switching' } })
    expect(proposals.map((proposal) => proposal.id)).toEqual(expect.arrayContaining(['respect_peak_window', 'reduce_context_switching', 'use_validated_pattern']))
  })

  it('rejects malformed or unknown persisted proposals at the capability boundary', () => {
    const proposals = parsePersistedTwinAdaptationProposals({
      adaptationPolicy: {
        proposals: [
          { id: 'run_provider_write', reason: 'unknown', behavior: 'execute' },
          { id: 'reduce_context_switching', reason: 'observed', behavior: 'one next step' },
          { id: 'keep_confirmation_boundary', reason: 42, behavior: 'invalid' },
          'not-an-object',
        ],
      },
    })
    expect(proposals).toEqual([{ id: 'reduce_context_switching', reason: 'observed', behavior: 'one next step' }])
    expect(parsePersistedTwinAdaptationProposals({ adaptationPolicy: { proposals: [{ id: 'reduce_context_switching' }] } })).toEqual([])
  })
})
