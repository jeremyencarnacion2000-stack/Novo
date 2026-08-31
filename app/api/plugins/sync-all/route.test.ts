/** @jest-environment node */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('next/server', () => ({
  NextResponse: { json: (body: unknown, init?: ResponseInit) => new Response(JSON.stringify(body), init) },
}))
jest.mock('@/lib/plugins/plugin-orchestrator', () => ({ syncAllPlugins: jest.fn() }))
jest.mock('@/lib/cognitive/ambient-twin-runtime', () => ({ runAmbientTwinForUser: jest.fn() }))

import { getServerSession } from 'next-auth'
import { syncAllPlugins } from '@/lib/plugins/plugin-orchestrator'
import { runAmbientTwinForUser } from '@/lib/cognitive/ambient-twin-runtime'
import { POST } from './route'

describe('POST /api/plugins/sync-all', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns the adaptive planning result after sources are synchronized', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(syncAllPlugins as jest.Mock).mockResolvedValue({ results: [{ provider: 'github', status: 'success', signalsEmitted: 1, summary: { commitsAnalyzed: 4 } }], totalSignals: 1, twinUpdated: true })
    ;(runAmbientTwinForUser as jest.Mock).mockResolvedValue({ planning: 'completed', recommendation: { id: 'action-1', title: 'Ship the next step' } })

    const response = await POST(new Request('http://localhost/api/plugins/sync-all', { method: 'POST' }) as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.planning).toBe('completed')
    expect(body.recommendation).toEqual({ id: 'action-1', title: 'Ship the next step' })
  })
})
