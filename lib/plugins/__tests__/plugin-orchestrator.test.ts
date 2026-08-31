/** @jest-environment node */

jest.mock('../notion-plugin', () => ({ syncNotionPlugin: jest.fn() }))
jest.mock('../todoist-plugin', () => ({ syncTodoistPlugin: jest.fn() }))
jest.mock('../slack-plugin', () => ({ syncSlackPlugin: jest.fn() }))
jest.mock('../gcal-plugin', () => ({ syncGCalPlugin: jest.fn() }))
jest.mock('../github-plugin', () => ({ syncGitHubPlugin: jest.fn() }))
jest.mock('../gmail-plugin', () => ({ syncGmailPlugin: jest.fn() }))
jest.mock('@/lib/google-account', () => ({ hasGoogleScopes: jest.fn().mockReturnValue(false) }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    integrationAccount: { findMany: jest.fn() },
    account: { findMany: jest.fn() },
    cognitiveTwinRecord: { findUnique: jest.fn() },
  },
}))

import { syncNotionPlugin } from '../notion-plugin'
import { syncPlugin } from '../plugin-orchestrator'

describe('plugin sync deadlines', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
  })

  afterEach(() => jest.useRealTimers())

  it('aborts and bounds an individual provider read', async () => {
    ;(syncNotionPlugin as jest.Mock).mockImplementation((_userId: string, options?: { signal?: AbortSignal }) => {
      if (!options?.signal) return Promise.resolve({ signalsEmitted: 0 })
      return new Promise((resolve) => options.signal?.addEventListener('abort', () => {
        resolve({ signalsEmitted: 0, error: 'unavailable' })
      }, { once: true }))
    })

    const pending = (syncPlugin as any)('user-1', 'notion', { timeoutMs: 25 })
    await jest.advanceTimersByTimeAsync(25)

    await expect(pending).resolves.toMatchObject({ status: 'error', error: 'unavailable' })
    expect(syncNotionPlugin).toHaveBeenCalledWith('user-1', expect.objectContaining({ signal: expect.any(AbortSignal) }))
  })
})
