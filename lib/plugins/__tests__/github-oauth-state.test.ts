/** @jest-environment node */

import {
  createIntegrationOAuthState,
  parseIntegrationOAuthState,
} from '@/lib/todoist-oauth-state'

describe('GitHub connector OAuth state', () => {
  it('round-trips a signed GitHub state payload', () => {
    const state = createIntegrationOAuthState('user-1', 'github' as never)
    expect(parseIntegrationOAuthState(state, 'github' as never)).toMatchObject({
      userId: 'user-1',
      provider: 'github',
    })
  })

  it('rejects a GitHub state when the provider is changed', () => {
    const state = createIntegrationOAuthState('user-1', 'github' as never)
    expect(parseIntegrationOAuthState(state, 'slack')).toBeNull()
  })
})
