import { runTodoistAmbientSync } from '../todoist-ambient-runner'
jest.mock('@/lib/cognitive/complete-durable-task', () => ({ completeDurableTask: jest.fn().mockResolvedValue({ replanPending: true }) }))

describe('Todoist ambient server-side fallback', () => {
  it('verifies completion, calls generic bridge, then advances cursor', async () => {
    const calls: string[] = []
    const ports: any = {
      loadConnection: async () => ({ id: 'c', userId: 'u', provider: 'todoist', providerAccountId: 'acct', accessToken: 'token', status: 'active' }),
      claimRun: async () => ({ acquired: true, claimId: 'claim' }),
      getCursor: async () => null,
      discoverCandidates: async () => ({ ids: ['x'], nextCursor: 'next' }),
      mappings: async () => [{ externalId: 'x', taskId: 'task-a', baselineHash: 'h', baselineState: 'ACTIVE' }],
      verifyTask: async () => ({ state: 'COMPLETED_VERIFIED', revision: 'r1' }),
      observeTransition: async () => ({ duplicate: false }),
      updateBaseline: async () => calls.push('baseline'),
      advanceCursor: async () => calls.push('cursor'),
      completeClaim: async () => calls.push('complete'),
      failClaim: async () => calls.push('fail'),
    }
    const result = await runTodoistAmbientSync({ connectionId: 'c', trigger: 'test', ports })
    expect(result).toMatchObject({ processed: true, reconciled: ['task-a'] })
    expect(calls).toEqual(['baseline', 'cursor', 'complete'])
  })

  it('fails closed for unknown identity and never claims', async () => {
    const claimRun = jest.fn()
    const result = await runTodoistAmbientSync({ connectionId: 'c', trigger: 'test', ports: { loadConnection: async () => ({ id: 'c', userId: 'u', provider: 'todoist', providerAccountId: null, accessToken: 't' }), claimRun } as any })
    expect(result).toEqual({ skipped: 'ineligible' })
    expect(claimRun).not.toHaveBeenCalled()
  })
})
