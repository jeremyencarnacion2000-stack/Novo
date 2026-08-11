import { getTwinInferenceStage, twinInferenceSubagents } from '../twin-inference-stages'

describe('Twin inference stage orchestration', () => {
  it('keeps the observable reasoning order explicit', () => {
    expect(twinInferenceSubagents.map((stage) => stage.id)).toEqual([
      'observe', 'understand', 'propose', 'verify', 'learn', 'adapt',
    ])
  })

  it('maps every worker to a real Activity Protocol phase', () => {
    expect(getTwinInferenceStage('learn')).toMatchObject({ phase: 'learning' })
    expect(getTwinInferenceStage('adapt')).toMatchObject({ phase: 'adapting' })
  })
})
